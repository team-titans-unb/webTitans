# Tasks — add-reimpressao-autorizada

## 1. Migração Supabase (schema + RLS)

- [x] 1.1 Escrever migração SQL: `ALTER TABLE fila_impressao ADD COLUMN reimpressao boolean
      not null default false`
- [x] 1.2 Criar tabela `reimpressao_tokens` (`id` uuid pk default `gen_random_uuid()`,
      `token_hash` text not null, `pedido_id` uuid not null, `expira_em` timestamptz not
      null, `usado_em` timestamptz null, `criado_por` bigint, `criado_em` timestamptz
      default now()); índice em `token_hash`
- [x] 1.3 Criar tabela `reimpressoes` (`id` uuid pk, `pedido_id` uuid, `protocolo` text,
      `origem` text check in ('bot','totem'), `telegram_user_id` bigint null, `criado_em`
      timestamptz default now())
- [x] 1.4 Habilitar RLS em `reimpressao_tokens` e `reimpressoes` SEM policy para `anon`
      (acesso apenas via `service_role`); confirmar que `anon` não lê/escreve
- [ ] 1.5 Verificar reversibilidade (`DROP TABLE` / `DROP COLUMN`) num banco de teste —
      pendente: exige aplicar a migração num banco Supabase real (não disponível neste
      ambiente); script de rollback está documentado no cabeçalho da migração 0011

## 2. Núcleo de reimpressão compartilhado (server-side)

- [x] 2.1 Criar módulo em `src/lib/server/` com função de reimpressão que recebe
      `{ protocolo, origem, telegramUserId? }`; reutilizar o helper de intervalo de UUID
      (extrair/compartilhar com `/api/kiosk/pedido` para não duplicar)
- [x] 2.2 Implementar a guarda de estado: prossegue só se `status ∈ {ERRO, IMPRESSO}` e
      `pdf_path IS NOT NULL`; retornar erro tipado distinto para "PDF expirado" vs "status
      não elegível" vs "não encontrado"
- [x] 2.3 Implementar o `UPDATE` atômico condicional `SET status='PAGO', reimpressao=true
      WHERE id=? AND status IN ('ERRO','IMPRESSO')`, preservando `paid_at`; tratar
      "nenhuma linha afetada" como já-processado (sem efeito colateral)
- [x] 2.4 Inserir auditoria em `reimpressoes` após sucesso; notificar o grupo Telegram
      (best-effort, mesmo padrão de `notificarEquipe`), sem desfazer a reimpressão se a
      notificação falhar
- [x] 2.5 Calcular e retornar a posição na fila (mesma lógica FIFO por `paid_at` de
      `/api/kiosk/pedido`) para as respostas dos fluxos
- [x] 2.6 Nunca retornar o UUID completo; retornar apenas o necessário aos chamadores

## 3. Geração e resgate de códigos de uso único

- [x] 3.1 Função de geração: `crypto.randomBytes` → 8 hex, formato `R-XXXXXXXX`; hashear
      (ex.: SHA-256) e persistir apenas o hash em `reimpressao_tokens` com `expira_em`
      (janela configurável, default 24h) e `criado_por`
- [x] 3.2 Função de resgate atômico: localizar por `token_hash`, validar não-expirado +
      pertence ao `pedido_id` do protocolo, e `UPDATE ... SET usado_em=now() WHERE
      usado_em IS NULL RETURNING`; só invocar o núcleo se o resgate afetou a linha
- [x] 3.3 Erros de resgate genéricos (não distinguir inexistente/de-outro-pedido/expirado/
      usado) para não vazar informação

## 4. Webhook de entrada do Telegram

- [x] 4.1 Criar `app/api/telegram/webhook/route.ts` (`runtime='nodejs'`,
      `dynamic='force-dynamic'`); validar `X-Telegram-Bot-Api-Secret-Token` contra
      `TELEGRAM_WEBHOOK_SECRET` antes de processar o corpo
- [x] 4.2 Autorização: comparar `message.from.id` com a allowlist `TELEGRAM_ADMIN_IDS`
      (parse da env em lista de IDs); recusar com resposta neutra se fora da allowlist
- [x] 4.3 Roteador de comandos + parse/validação de argumento de protocolo (8 hex);
      responder `200` rápido mesmo em recusa (evitar reentrega)
- [x] 4.4 Comando `/reimprimir <protocolo>` → núcleo (origem `bot`, `telegramUserId`); ao
      concluir, responder confirmação + posição na fila, ou a mensagem de erro adequada
- [x] 4.5 Comando `/gerar_codigo <protocolo>` → checar elegibilidade, gerar código,
      responder o `R-XXXXXXXX` UMA vez com instrução ao cliente; se inelegível, não gerar
- [ ] 4.6 Passo operacional documentado: `setWebhook` com `secret_token`; e `deleteWebhook`
      como rollback — comandos prontos, ver seção "Passos manuais pendentes" na resposta
      final (exige `TELEGRAM_BOT_TOKEN` e domínio público em produção)

## 5. Totem — endpoint dedicado e UI

- [x] 5.1 Criar `app/api/kiosk/reimpressao/route.ts` (service_role, `nodejs`,
      `force-dynamic`); validar formato de `protocolo` (8 hex) e `codigo` (`R-`+8 hex);
      chamar resgate atômico → núcleo (origem `totem`)
- [x] 5.2 Aplicar rate-limit por tentativa no endpoint (padrão análogo ao de
      `/api/kiosk/help`) para conter força bruta
- [x] 5.3 Em `src/components/kiosk/OverlayAjuda.tsx`, adicionar o caminho "Tenho um código
      de reimpressão" com campo SEPARADO do teclado de protocolo, chamando
      `/api/kiosk/reimpressao`; garantir que a consulta/ajuda não aceitam código
- [x] 5.4 Exibir confirmação (com posição na fila) em sucesso e mensagem genérica amigável
      em erro/rate-limit

## 6. Retenção — limpeza de tokens

- [x] 6.1 Estender `supabase/functions/cleanup-fila/index.ts` para remover
      `reimpressao_tokens` com `expira_em < now()` ou `usado_em` antigo, preservando PDFs e
      as regras existentes
- [ ] 6.2 Reimplantar a Edge Function e confirmar que a execução horária limpa tokens sem
      afetar a retenção de PDFs — pendente: exige `supabase functions deploy cleanup-fila`
      contra o projeto real (não disponível neste ambiente)

## 7. Configuração e verificação

- [x] 7.1 Adicionar as envs server-side `TELEGRAM_ADMIN_IDS` e `TELEGRAM_WEBHOOK_SECRET`
      (documentar em `.env.example`/README de ops); confirmar que nenhuma vaza para o
      cliente (sem prefixo público)
- [ ] 7.2 Testes do núcleo: guarda de estado (cada status), PDF expirado, atomicidade sob
      corrida (nenhuma linha afetada na 2ª chamada), preservação de `paid_at` — pendente:
      o projeto não tem test runner configurado para o lado TypeScript/Next (só pytest no
      print-worker); introduzir um framework (ex.: vitest) é uma decisão de escopo que não
      foi pedida — verificado por typecheck + build limpos e revisão manual da lógica
- [ ] 7.3 Testes de token: geração guarda só hash, resgate uso único, expiração,
      não-pertence-ao-protocolo, respostas genéricas — mesma pendência de 7.2
- [ ] 7.4 Testes do webhook: secret_token ausente/errado recusado; `from.id` fora da
      allowlist recusado; comandos felizes e malformados — mesma pendência de 7.2
- [ ] 7.5 Teste ponta-a-ponta manual: fluxo A (bot reimprime) e fluxo B (gerar código →
      digitar no totem → pedido volta à fila e o worker reimprime) — pendente: exige
      Supabase, bot do Telegram e worker rodando de verdade, indisponíveis neste ambiente
- [x] 7.6 Revisão final Clean Code: nomes descritivos, funções pequenas de
      responsabilidade única, sem duplicação (helper de UUID/posição-na-fila reutilizado),
      sem segredos no cliente, comentários só onde agregam
