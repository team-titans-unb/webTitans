## Why

Quando uma impressão sai com defeito, não sai (job `ERRO`), ou o cliente precisa de
outra via de um pedido já `IMPRESSO`, hoje não há caminho seguro para reimprimir: seria
preciso um novo pagamento ou intervenção manual no banco. A equipe precisa de um modo
**controlado** de re-enfileirar um pedido já pago — sem cobrar de novo e sem abrir uma
brecha para qualquer pessoa forçar reimpressões grátis. O worker já re-imprime qualquer
pedido que volte para `PAGO` (FIFO por `paid_at`), então o trabalho é construir a camada
de **autorização, auditoria e experiência**, não mexer na impressão em si.

## What Changes

- **Núcleo de reimpressão reutilizável** (server-side): resolve protocolo → pedido,
  aplica uma **guarda de estado** (só reimprime se `status ∈ {ERRO, IMPRESSO}` e
  `pdf_path IS NOT NULL`), faz o `UPDATE` atômico `→ PAGO` com `reimpressao=true`
  preservando o `paid_at` original (prioridade no início da fila FIFO), e registra
  auditoria. O worker existente cuida do resto — **nenhuma mudança no worker**.
- **Webhook de ENTRADA do bot Telegram** (`POST /api/telegram/webhook`) — infraestrutura
  nova: hoje o sistema só *envia* (`sendMessage`), nunca *recebe*. Protegido por
  `secret_token` no header `X-Telegram-Bot-Api-Secret-Token` e por uma **allowlist**
  de Telegram user IDs (`TELEGRAM_ADMIN_IDS`), verificada contra `from.id` — nunca por
  "pertencer ao grupo".
- **Fluxo A — comando direto** `/reimprimir <protocolo>`: a equipe reimprime pelo bot;
  o cliente não faz nada. Resposta traz a posição na fila.
- **Fluxo B — código de uso único no totem** `/gerar_codigo <protocolo>`: gera um código
  `R-XXXXXXXX` (8 hex com entropia real, prefixo `R-` para nunca colidir com protocolo),
  exibido **uma vez** no bot; no banco guarda-se apenas o **hash**. O cliente digita o
  código no totem por um caminho e endpoint **dedicados** (`POST /api/kiosk/reimpressao`),
  separados da consulta/ajuda para que o "Ajuda" nunca vire oráculo de força bruta. O
  resgate é atômico (`WHERE usado_em IS NULL RETURNING`) e com rate-limit.
- **Novas tabelas** de suporte (`reimpressao_tokens`, `reimpressoes`) e **nova coluna**
  `fila_impressao.reimpressao`.
- **Limpeza** de tokens expirados estendendo a função `cleanup-fila`.

Nenhuma mudança **BREAKING**: o schema de `fila_impressao` só ganha coluna com default,
o contrato do worker e do kiosk atual permanecem.

## Capabilities

### New Capabilities
- `pedido-reimpressao`: o núcleo de reimpressão autorizada (resolução de protocolo,
  guarda de estado, re-enfileiramento atômico preservando `paid_at`, auditoria) e o
  modelo de dados que o sustenta (`reimpressao_tokens` para códigos de uso único e
  `reimpressoes` para auditoria), com suas políticas RLS.
- `telegram-bot-webhook`: o recebimento de updates do Telegram via
  `POST /api/telegram/webhook`, autenticação por `secret_token`, autorização por
  allowlist de user IDs e roteamento dos comandos `/reimprimir` e `/gerar_codigo`.

### Modified Capabilities
- `print-queue-storage`: `fila_impressao` ganha a coluna `reimpressao boolean not null
  default false` (marca pedidos re-enfileirados para reimpressão), sem alterar o ciclo
  de status nem as RLS existentes.
- `kiosk-help-requests`: o overlay de ajuda ganha o caminho "Tenho um código de
  reimpressão" (campo separado do teclado de protocolo) e um endpoint dedicado
  `POST /api/kiosk/reimpressao` que resgata o código de uso único, distinto de
  `/api/kiosk/pedido` e `/api/kiosk/help`.
- `print-data-retention`: a função `cleanup-fila` passa a remover também os
  `reimpressao_tokens` expirados/usados, sem afetar a retenção de PDFs já definida.

## Impact

- **Frontend/API (Next.js App Router)**: nova route `app/api/telegram/webhook/route.ts`;
  nova route `app/api/kiosk/reimpressao/route.ts`; núcleo compartilhado em
  `src/lib/server/` (reutilizado pelo webhook e pelo endpoint do totem); `OverlayAjuda`
  (`src/components/kiosk/OverlayAjuda.tsx`) ganha o caminho de código de reimpressão.
- **Supabase**: migração adicionando `fila_impressao.reimpressao`, tabelas
  `reimpressao_tokens` e `reimpressoes` com RLS (acesso apenas via `service_role`);
  extensão da Edge Function `cleanup-fila`.
- **Ambiente/segredos** (apenas server-side, nunca no cliente): `TELEGRAM_ADMIN_IDS`,
  `TELEGRAM_WEBHOOK_SECRET` (secret_token). Reutiliza `TELEGRAM_BOT_TOKEN`,
  `TELEGRAM_CHAT_ID`, e a chave `service_role` já existentes.
- **Telegram**: registro único do webhook (`setWebhook` com `secret_token`) — passo
  operacional documentado.
- **Worker Python**: nenhuma alteração.
