## Context

O webTitans (Next.js App Router + Supabase + worker Python + bot Telegram) já tem o ciclo
de vida do pedido: cliente envia PDF, paga via Mercado Pago (webhook confirma server-side
→ `PAGO`), e o worker pega o `PAGO` mais antigo por `paid_at` (FIFO), reivindica atômico
`PAGO→IMPRIMINDO`, imprime e marca `IMPRESSO`/`ERRO`. A recuperação de travados devolve
`IMPRIMINDO→PAGO`. Consequência-chave que este design explora: **qualquer pedido que volte
para `PAGO` é reimpresso pelo worker sem nenhuma alteração nele** — logo, reimprimir é um
problema de autorização/auditoria/UX, não de impressão.

Hoje o Telegram é usado só para **envio** (`sendMessage` em `/api/kiosk/help`). Não há
recebimento de comandos. O protocolo público é os 8 primeiros hex do UUID; o UUID completo
é o token de leitura secreto e nunca é exposto. `/api/kiosk/pedido` resolve protocolo por
intervalo de UUID (`gte/lte`).

Restrições: segredos (`TELEGRAM_BOT_TOKEN`, `service_role`, secret do webhook) só existem
no servidor; o cliente do totem é não confiável; a operação precisa ser barata e simples
para a equipe e para o cliente.

## Goals / Non-Goals

**Goals:**
- Um caminho seguro para a equipe reimprimir um pedido já pago, sem novo pagamento.
- Cliente com experiência trivial: ou não faz nada (equipe reimprime pelo bot), ou digita
  um código curto no totem.
- Fonte da verdade da autorização é o servidor: allowlist de admins e códigos de uso único
  com hash — nunca confiança no cliente do totem nem em "estar no grupo".
- Zero alteração no worker Python.
- Auditoria completa de quem reimprimiu o quê e por qual origem.

**Non-Goals:**
- Não altera o fluxo de pagamento Mercado Pago nem o ciclo de status do worker.
- Não implementa um painel administrativo web (o bot é a interface da equipe).
- Não trata reembolso/estorno nem cobrança de reimpressão (reimpressão é gratuita por
  decisão do dono).
- Não permite o cliente iniciar reimpressão sozinho sem autorização da equipe.

## Decisions

### D1 — Núcleo único compartilhado, chamado por dois fluxos
Uma função server-side (`src/lib/server/`) concentra resolver-protocolo → guarda-de-estado
→ `UPDATE` atômico condicional → auditoria + notificação. Bot e totem apenas **autorizam**
e delegam. Rationale: uma só implementação da regra crítica (guarda de estado + atomicidade)
evita divergência entre caminhos. Alternativa descartada: lógica duplicada em cada route —
convida a bugs de segurança sutis (um caminho esquece a guarda).

### D2 — `UPDATE` atômico condicional preservando `paid_at`
`SET status='PAGO', reimpressao=true WHERE id=? AND status IN ('ERRO','IMPRESSO')`. Manter
`paid_at` antigo coloca o pedido no **início** da fila FIFO (prioridade desejada para quem
já esperou). A condição no `WHERE` torna o re-enfileiramento idempotente sob corrida: só a
primeira solicitação afeta a linha. Alternativa descartada: ler-status-depois-escrever em
duas queries — abre janela de corrida (dupla reimpressão / duplo job).

### D3 — Autorização por allowlist de user IDs, não por participação no grupo
`TELEGRAM_ADMIN_IDS` (env) versus `message.from.id`. "Estar no grupo" é fraco: qualquer
membro poderia reimprimir, e o grupo pode crescer. Allowlist explícita é o menor
privilégio. O webhook ainda exige `secret_token` no header (autenticidade do Telegram)
como primeira barreira, antes mesmo de olhar `from.id`.

### D4 — Código do totem: uso único, hash no banco, prefixo `R-`
Fluxo B gera `R-XXXXXXXX` com 8 hex de **entropia criptográfica** (`crypto.randomBytes`),
mostra em texto uma vez, guarda só o hash. Prefixo `R-` impede confundir com protocolo
(que é hex puro de 8). Resgate atômico `UPDATE ... WHERE usado_em IS NULL RETURNING`
garante uso único mesmo sob corrida. Rationale: o totem é não confiável e público; um
código previsível ou reutilizável seria explorável. Alternativa descartada: cliente digita
o próprio protocolo para reimprimir — transformaria protocolo (semi-público, impresso no
comprovante) em autorização, o que é inaceitável.

### D5 — Endpoint de resgate SEPARADO da consulta (anti-oráculo)
`POST /api/kiosk/reimpressao` é dedicado; `/api/kiosk/pedido` e `/api/kiosk/help`
permanecem sem qualquer noção de código. Se o resgate compartilhasse route com a consulta,
respostas diferenciadas poderiam virar um oráculo de força bruta. O endpoint dedicado
responde erros genéricos (não distingue "inexistente" de "de outro pedido") e tem
rate-limit — mesmo padrão anti-abuso já usado em `/api/kiosk/help`.

### D6 — Webhook de entrada como nova capacidade de infra
`POST /api/telegram/webhook` (`runtime=nodejs`, `force-dynamic`), registrado uma vez via
`setWebhook` com `secret_token`. Responde `200` rápido mesmo ao recusar (evita reentrega).
É a primeira vez que o sistema recebe do Telegram — isolar como capability própria mantém a
fronteira limpa e reutilizável para comandos futuros.

### D7 — Modelo de dados
- `fila_impressao.reimpressao boolean not null default false` (sinalizador; não muda FIFO).
- `reimpressao_tokens` (token_hash, pedido_id, expira_em, usado_em, criado_por, criado_em)
  com índice em `token_hash`, RLS sem policy anon.
- `reimpressoes` (pedido_id, protocolo, origem, telegram_user_id, criado_em), RLS sem
  policy anon. Auditoria append-only.
As tabelas de reimpressão pertencem à capability `pedido-reimpressao`; só a coluna nova em
`fila_impressao` toca `print-queue-storage`.

### D8 — Limpeza de tokens estende `cleanup-fila`
Reusar a Edge Function agendada (pg_cron horário) em vez de novo trigger/cron: menos
superfície operacional. Remove tokens expirados e usados-antigos; preserva PDFs e regras
existentes.

## Risks / Trade-offs

- **[Vazamento de segredo no cliente]** → todos os segredos (bot token, secret do webhook,
  service_role, allowlist) só no ambiente server-side; nenhuma route expõe UUID completo;
  código em texto puro só transita na resposta do bot (canal já confiável da equipe).
- **[Força bruta de código no totem]** → 8 hex = 2^32 espaço, uso único, expiração 24h,
  resposta genérica, rate-limit por tentativa. Combinação torna varredura inviável.
- **[Dupla reimpressão / job duplicado]** → `UPDATE` condicional idempotente (D2) e resgate
  atômico do token (D4); corridas resultam em "já processado", nunca em dois jobs.
- **[PDF já expirado (IMPRESSO >7 dias)]** → guarda exige `pdf_path IS NOT NULL`; recusa com
  mensagem clara pedindo novo envio, em vez de re-enfileirar um pedido sem arquivo.
- **[Reentrega do Telegram gerando ação dupla]** → webhook responde `200` sempre que
  reconhece o update; a ação em si é idempotente por D2, então uma reentrega não duplica.
- **[Reimpressão abusiva pela própria equipe]** → mitigado por auditoria completa em
  `reimpressoes` (quem, quando, origem); fora de escopo impor limite rígido (ver Q3).

## Migration Plan

1. Migração SQL: `ALTER TABLE fila_impressao ADD COLUMN reimpressao boolean not null
   default false`; `CREATE TABLE reimpressao_tokens ...`; `CREATE TABLE reimpressoes ...`;
   habilitar RLS em ambas sem policy anon; índice em `token_hash`. Reversível
   (`DROP TABLE` / `DROP COLUMN`).
2. Deploy do núcleo + routes (`/api/telegram/webhook`, `/api/kiosk/reimpressao`) + caminho
   no `OverlayAjuda`.
3. Configurar envs no servidor: `TELEGRAM_ADMIN_IDS`, `TELEGRAM_WEBHOOK_SECRET`.
4. Registrar o webhook no Telegram: `setWebhook` apontando para `/api/telegram/webhook` com
   `secret_token=TELEGRAM_WEBHOOK_SECRET`.
5. Estender e reimplantar `cleanup-fila`.
6. Rollback: remover o webhook (`deleteWebhook`) volta o bot ao estado atual (só envio); a
   coluna/tabelas podem ser dropadas sem afetar o fluxo de pagamento/impressão.

## Open Questions

- **Q1 — Janela de expiração do código do totem**: assumido 24h. Confirmar se é o desejado
  ou se um prazo menor (ex.: 2h) reduz risco sem atrapalhar o cliente.
- **Q2 — `/reimprimir` pede confirmação?** Assumido execução direta (equipe é confiável e
  o comando é explícito). Confirmar se um passo de confirmação (ex.: botão inline) é
  desejado para evitar reimpressão acidental por dígito errado no protocolo.
- **Q3 — Limite de reimpressões por pedido**: não imposto (apenas auditado). Confirmar se
  deve haver um teto (ex.: máximo N reimpressões por `pedido_id`) e qual o comportamento ao
  atingi-lo.
