# 04 — Pagamento PIX (Route Handlers)

[← Índice](README.md) · Spec canônica: [`mercadopago-pix-integration`](../../openspec/specs/mercadopago-pix-integration/spec.md)

## Responsabilidade

Dois **Next.js Route Handlers** (runtime Node, `runtime = "nodejs"`) — que na Vercel viram
funções serverless — ligam o checkout ao Mercado Pago:
gerar a cobrança PIX e processar a confirmação de pagamento. São o **único** lugar na
nuvem com a `service_role` e os segredos do MP. **Nunca tocam o arquivo PDF.**

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `app/api/payments/create-pix/route.ts` | Gera a cobrança PIX e devolve QR Code/Copia e Cola. |
| `app/api/webhooks/mercadopago/route.ts` | Recebe a notificação do MP, valida assinatura e atualiza o status. |
| `src/lib/server/mercadopago.ts` | Cliente do SDK `mercadopago` (`MercadoPagoConfig` + `Payment`). |
| `src/lib/server/supabase-admin.ts` | Cliente Supabase com `service_role` (bypassa RLS). |
| `src/lib/server/mp-signature.ts` | Validação HMAC da assinatura `x-signature`. |

## `POST /api/payments/create-pix`

Entrada: `{ pedidoId: string }`. Passos:

1. Busca o pedido em `fila_impressao`. Responde **404** se não existir, **409** se não
   estiver em `AGUARDANDO_PAGAMENTO`.
2. **Baixa o PDF** do Storage (service_role), **conta as páginas** com `pdf-lib` e
   **recalcula** `valor_centavos = páginas reais × config_precos[modo_cor]`, ignorando o
   que o cliente declarou. PDF inválido/criptografado → **422** sem cobrar.
3. Chama `mpPayment.create(...)` com `transaction_amount = valor_centavos / 100` (o valor
   recalculado), `payment_method_id: "pix"`, `external_reference: pedido.id` e
   **`requestOptions.idempotencyKey: pedido.id`**.
4. Persiste `mp_payment_id` + o `num_paginas` e `valor_centavos` **autoritativos**, e
   devolve `{ qr_code_base64, qr_code_copia_cola, expiration_date_to, mp_payment_id,
   valor_centavos, num_paginas }`.

### Idempotência na criação

O `idempotencyKey = pedidoId` faz o MP devolver **o mesmo pagamento** se o cliente clicar
duas vezes em "Pagar" — evitando cobranças duplicadas para o mesmo pedido.

## `POST /api/webhooks/mercadopago`

Endpoint **público** chamado pelo Mercado Pago. Sequência:

1. Exige `MERCADOPAGO_WEBHOOK_SECRET` (500 se ausente na config).
2. Extrai o `data.id` da query string (`data.id`/`id`), com fallback no body. 400 se ausente.
3. **Valida a assinatura** (`verificarAssinaturaMP`). Se inválida → **401** e não toca o
   banco.
4. Busca o pagamento atualizado na API do MP (`mpPayment.get`). 502 se o MP estiver fora.
5. Pela `external_reference` (o `pedidoId`) e pelo `status` do pagamento:
   - `approved` → `UPDATE ... SET status='PAGO', paid_at=now() WHERE id=:ref AND status='AGUARDANDO_PAGAMENTO'`.
   - `cancelled`/`rejected` → `status='CANCELADO'` (mesma cláusula `WHERE`).
   - `pending`/`in_process`/etc → no-op, responde 200.

### Validação de assinatura (`mp-signature.ts`)

- Header `x-signature: ts=<unix>,v1=<hmac-hex>` + header `x-request-id`.
- Reconstrói o manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` e compara
  `HMAC_SHA256(secret, manifest)` com `v1` em **tempo constante** (`timingSafeEqual`).
- **Anti-replay**: rejeita se `ts` estiver fora de uma janela de **5 minutos**.
- Sem header, `v1` malformado ou hash que não bate → `{ ok: false }` → 401.

### Idempotência e política de status HTTP

- O `WHERE status='AGUARDANDO_PAGAMENTO'` torna o `UPDATE` **idempotente**: reentregas do
  MP sobre um pedido já avançado (ex.: `IMPRESSO`) não reescrevem nada.
- **Responde 200** para tudo que tenha assinatura válida mas não seja acionável
  (`external_reference` desconhecido, status não-terminal) — para o MP **não** entrar em
  loop de retry à toa.
- **Responde 500** só em erro genuíno (banco fora), aí sim o MP **deve** tentar de novo.
- **Responde 401** em assinatura inválida.

> **Nota operacional (dois canais de notificação).** O `create-pix` também envia um
> `notification_url`, e o painel do MP tem um webhook configurado. Os dois disparam: é
> normal ver no painel um POST **200** (canal que assina no formato esperado) seguido de
> alguns **401** (canal cujo formato legado não reconstrói a mesma assinatura). Não é bug
> de validação. Se incomodar, remover o `notification_url` do `create-pix` elimina o canal
> duplicado.

## Decisões e pontos de atenção

- **Segredos só no servidor**: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` e
  `SUPABASE_SERVICE_ROLE_KEY` são envs sem prefixo `NEXT_PUBLIC_` → não entram no bundle. Ver
  [08](08-seguranca.md).
- **Sem `vercel.json`**: no Next.js o roteamento de `/api/*` é nativo do App Router (cada
  `route.ts` vira uma função serverless na Vercel). A `notification_url` enviada ao Mercado
  Pago deriva de `PUBLIC_BASE_URL` (`https://www.roboticstitans.com.br`), com fallback aos
  headers `x-forwarded-*` em dev/local.
- **Preço e contagem são autoridade do servidor**: o `create-pix` baixa o PDF, conta as
  páginas com `pdf-lib` e recalcula `valor_centavos` a partir de `config_precos` (capability
  `print-payment-integrity`).

---

Anterior: [03 — Checkout](03-checkout.md) · Próximo: [05 — Armazenamento Supabase](05-supabase.md)
