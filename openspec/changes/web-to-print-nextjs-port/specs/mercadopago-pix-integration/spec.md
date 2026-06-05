## MODIFIED Requirements

### Requirement: Endpoint serverless `POST /api/payments/create-pix`

O sistema SHALL expor um **Next.js Route Handler** em `app/api/payments/create-pix/route.ts` com `export const runtime = "nodejs"` (exigido por `pdf-lib`, `@supabase/supabase-js` e `mercadopago`) que recebe `{ pedidoId: string }` no body JSON (via `await req.json()`) e devolve `{ qr_code_base64, qr_code_copia_cola, expiration_date_to, mp_payment_id }`. O servidor SHALL ser a autoridade de preço: SHALL reconferir `num_paginas` a partir do PDF real no Storage, SHALL ler `quantidade_copias` e `modo_cor` da própria linha do pedido, e SHALL calcular `valor_centavos = num_paginas_reais * quantidade_copias * config_precos.valor_centavos_por_pagina[modo_cor]`, persistindo o valor autoritativo na linha antes de cobrar. A `notification_url` enviada ao Mercado Pago SHALL derivar de `process.env.PUBLIC_BASE_URL` (`<PUBLIC_BASE_URL>/api/webhooks/mercadopago`), com fallback aos headers `x-forwarded-host`/`x-forwarded-proto` quando a env não estiver definida.

#### Scenario: Pedido válido gera PIX com múltiplas cópias
- **WHEN** o cliente POSTa `{ pedidoId: "<uuid-em-AGUARDANDO_PAGAMENTO com quantidade_copias=2>" }`, o PDF real tem 10 páginas e `config_precos.PB = 50`
- **THEN** o endpoint calcula `valor_centavos = 10 * 2 * 50 = 1000`, chama o Mercado Pago com `transaction_amount = 10.00`, persiste `num_paginas=10` e `valor_centavos=1000` na linha, e responde 200 com o payload de PIX

#### Scenario: Pedido com 1 cópia mantém o comportamento atual
- **WHEN** o pedido tem `quantidade_copias = 1`, PDF de 4 páginas e `config_precos.PB = 50`
- **THEN** o endpoint calcula `valor_centavos = 4 * 1 * 50 = 200`

#### Scenario: notification_url derivada de PUBLIC_BASE_URL
- **WHEN** `PUBLIC_BASE_URL=https://www.roboticstitans.com.br` está definido e um pedido válido gera PIX
- **THEN** o `notification_url` enviado ao Mercado Pago é `https://www.roboticstitans.com.br/api/webhooks/mercadopago`

#### Scenario: Pedido inexistente
- **WHEN** `pedidoId` não existe em `fila_impressao`
- **THEN** o endpoint responde 404 com `{ error: "Pedido não encontrado" }`

#### Scenario: Pedido já pago
- **WHEN** `pedidoId` está em estado diferente de `AGUARDANDO_PAGAMENTO`
- **THEN** o endpoint responde 409 com `{ error: "Pedido não está aguardando pagamento" }`

### Requirement: Endpoint serverless `POST /api/webhooks/mercadopago`

O sistema SHALL expor um **Next.js Route Handler** em `app/api/webhooks/mercadopago/route.ts` com `export const runtime = "nodejs"` que aceita notificações do Mercado Pago, valida a assinatura, busca o pagamento atualizado na API do MP, e atualiza `fila_impressao` conforme o status do pagamento. O handler SHALL ler o `data.id` via `new URL(req.url).searchParams` (com fallback ao corpo `await req.json()`) e SHALL adaptar o `Headers` do Next para a verificação de assinatura (ex.: `Object.fromEntries(req.headers)`). A verificação de assinatura NÃO depende do corpo cru (o manifest usa apenas `data.id`, `x-request-id` e `ts`), portanto o handler NÃO precisa desabilitar parsing nem capturar raw body.

#### Scenario: Webhook de pagamento aprovado
- **WHEN** o MP envia notificação com `type='payment'` e `data.id=<id>` para um pagamento cujo status na API do MP é `approved` e `external_reference` aponta para um pedido em `AGUARDANDO_PAGAMENTO`
- **THEN** o endpoint atualiza a linha para `status='PAGO'`, seta `paid_at = now()` e responde 200

#### Scenario: Webhook de pagamento rejeitado
- **WHEN** o pagamento na API do MP volta como `cancelled` ou `rejected`
- **THEN** o endpoint atualiza a linha para `status='CANCELADO'` e responde 200

#### Scenario: data.id lido da query string
- **WHEN** o MP chama `POST /api/webhooks/mercadopago?data.id=<id>` com assinatura válida
- **THEN** o handler resolve `<id>` via `new URL(req.url).searchParams` e processa a notificação normalmente

### Requirement: Segredos exclusivamente no servidor

O `MERCADOPAGO_ACCESS_TOKEN`, o `MERCADOPAGO_WEBHOOK_SECRET` e a `SUPABASE_SERVICE_ROLE_KEY` SHALL existir apenas como variáveis de ambiente de **servidor** (em produção, no Project Settings da Vercel; em desenvolvimento, em `.env.local`), sem prefixo `NEXT_PUBLIC_`, consumidas exclusivamente por libs de servidor em `src/lib/server/*` importadas apenas por Route Handlers (`runtime = "nodejs"`), garantindo que não sejam empacotadas no bundle do cliente.

#### Scenario: Build do cliente
- **WHEN** o build de produção é gerado (`npm run build`)
- **THEN** `grep -r MERCADOPAGO_ACCESS_TOKEN .next/static/` retorna 0 ocorrências
