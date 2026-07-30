# Delta — pedido-reimpressao (add-reimpressao-autorizada)

## ADDED Requirements

### Requirement: Núcleo de reimpressão com guarda de estado

O sistema SHALL expor uma função server-side reutilizável de reimpressão, compartilhada
por todos os fluxos (bot e totem), que recebe um protocolo e a origem da solicitação
(`bot` ou `totem`) e executa, nesta ordem:

1. Resolve o protocolo (8 hex) para o pedido em `fila_impressao`, usando a mesma busca por
   intervalo de UUID já adotada em `/api/kiosk/pedido` (`de = "{p}-0000-...-000000000000"`,
   `ate = "{p}-ffff-...-ffffffffffff"`, case-insensitive). O UUID completo MUST NOT ser
   retornado ao chamador nem exposto ao cliente.
2. Aplica a **guarda de estado**: só prossegue se `status ∈ {ERRO, IMPRESSO}` E
   `pdf_path IS NOT NULL`. Qualquer outro status (incluindo `AGUARDANDO_PAGAMENTO`, `PAGO`,
   `IMPRIMINDO`, `CANCELADO`) SHALL ser rejeitado sem alterar o pedido.
3. Re-enfileira o pedido com um `UPDATE` **atômico e condicional**:
   `SET status='PAGO', reimpressao=true WHERE id=? AND status IN ('ERRO','IMPRESSO')`. O
   `paid_at` original MUST ser preservado (o pedido volta ao início da fila FIFO por
   `paid_at` — prioridade desejada). Se o `UPDATE` não afetar nenhuma linha (corrida com
   outra reimpressão ou mudança de status), a operação SHALL falhar sem efeito colateral.
4. Registra auditoria em `reimpressoes` e notifica a equipe no grupo Telegram
   (best-effort — falha de notificação não desfaz a reimpressão).

Toda a operação roda com `service_role` no servidor. O worker de impressão NÃO é alterado:
ele já re-imprime qualquer pedido que retorne a `PAGO`.

#### Scenario: Pedido com ERRO é re-enfileirado
- **WHEN** o núcleo recebe o protocolo de um pedido `status='ERRO'` com `pdf_path` presente
- **THEN** o pedido passa a `status='PAGO'` com `reimpressao=true`, mantém o `paid_at`
  original e uma linha de auditoria é gravada em `reimpressoes`

#### Scenario: Pedido IMPRESSO com PDF ainda disponível é re-enfileirado
- **WHEN** o núcleo recebe o protocolo de um pedido `IMPRESSO` cujo `pdf_path` ainda não
  foi removido pela retenção
- **THEN** o pedido volta a `PAGO` com `reimpressao=true` e entra na fila do worker

#### Scenario: PDF expirado bloqueia a reimpressão
- **WHEN** o pedido está `IMPRESSO` mas seu `pdf_path IS NULL` (PDF já removido após a
  janela de retenção de 7 dias)
- **THEN** o núcleo rejeita com mensagem clara de que o arquivo expirou e um novo envio é
  necessário, sem alterar o pedido

#### Scenario: Status não elegível é recusado
- **WHEN** o protocolo aponta para um pedido em `AGUARDANDO_PAGAMENTO`, `PAGO`,
  `IMPRIMINDO` ou `CANCELADO`
- **THEN** o núcleo recusa sem alterar o pedido, informando que ele não está elegível para
  reimpressão

#### Scenario: Corrida de re-enfileiramento não duplica
- **WHEN** duas solicitações de reimpressão do mesmo pedido chegam quase ao mesmo tempo
- **THEN** apenas o primeiro `UPDATE` condicional afeta a linha; o segundo não afeta
  nenhuma linha e é reportado como já processado, sem duplicar o job na fila

### Requirement: Auditoria de reimpressões

O Supabase SHALL conter uma tabela `reimpressoes` com, no mínimo: `id` (uuid pk default
`gen_random_uuid()`), `pedido_id` (uuid, referência lógica a `fila_impressao.id`),
`protocolo` (text), `origem` (text check in ('bot','totem')), `telegram_user_id` (bigint
nullable — preenchido nos fluxos originados no bot), `criado_em` (timestamptz default
now()). Toda reimpressão bem-sucedida SHALL gravar exatamente uma linha nessa tabela. A
tabela SHALL ter RLS habilitado sem qualquer policy para `anon` (acesso apenas via
`service_role`).

#### Scenario: Reimpressão gera registro de auditoria
- **WHEN** o núcleo re-enfileira um pedido com sucesso
- **THEN** uma linha é inserida em `reimpressoes` com `pedido_id`, `protocolo`, `origem` e,
  quando originada no bot, o `telegram_user_id` do solicitante

#### Scenario: Tabela de auditoria é inacessível ao anônimo
- **WHEN** o role `anon` tenta `SELECT` ou `INSERT` em `reimpressoes`
- **THEN** a RLS nega a operação

### Requirement: Códigos de reimpressão de uso único

O Supabase SHALL conter uma tabela `reimpressao_tokens` com, no mínimo: `id` (uuid pk),
`token_hash` (text not null — hash do código, nunca o texto puro), `pedido_id` (uuid not
null), `expira_em` (timestamptz not null), `usado_em` (timestamptz nullable),
`criado_por` (bigint — Telegram user ID que gerou), `criado_em` (timestamptz default
now()). Deve haver índice em `token_hash`. A tabela SHALL ter RLS habilitado sem policy
para `anon` (acesso apenas via `service_role`).

Cada código SHALL ser gerado com **entropia criptográfica real** (não `Math.random`),
como 8 caracteres hexadecimais, apresentado ao solicitante no formato `R-XXXXXXXX` (o
prefixo `R-` distingue-o do protocolo e impede confusão). O banco SHALL armazenar apenas o
**hash** do código; o texto puro é exibido uma única vez pelo bot e não é recuperável.

#### Scenario: Geração de código guarda apenas o hash
- **WHEN** um administrador gera um código para um protocolo elegível
- **THEN** o texto `R-XXXXXXXX` é exibido uma vez e apenas `token_hash`, `pedido_id`,
  `expira_em` (janela padrão de 24h) e `criado_por` são persistidos

#### Scenario: Resgate atômico de uso único
- **WHEN** um código válido, não expirado e ainda não usado é apresentado com o protocolo
  correspondente
- **THEN** o sistema marca `usado_em=now()` via `UPDATE ... WHERE usado_em IS NULL
  RETURNING` (resgate atômico) e só então invoca o núcleo de reimpressão

#### Scenario: Código já usado é recusado
- **WHEN** um código cujo `usado_em` já está preenchido é apresentado
- **THEN** o resgate atômico não afeta nenhuma linha e a reimpressão é recusada

#### Scenario: Código expirado é recusado
- **WHEN** um código cujo `expira_em` já passou é apresentado
- **THEN** o resgate é recusado, ainda que `usado_em` seja nulo

#### Scenario: Código não corresponde ao protocolo
- **WHEN** o código apresentado é válido, mas seu `pedido_id` não corresponde ao protocolo
  digitado
- **THEN** o resgate é recusado, sem revelar a qual pedido o código pertence
