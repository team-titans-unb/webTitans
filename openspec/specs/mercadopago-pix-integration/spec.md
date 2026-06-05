# mercadopago-pix-integration Specification

## Purpose
Integrar o checkout web-to-print ao Mercado Pago via PIX: gerar cobranças através de
Serverless Functions na Vercel, confirmar pagamentos por webhook com assinatura HMAC
validada e idempotência, e manter os segredos (access token, webhook secret, service_role)
exclusivamente no servidor.
## Requirements
### Requirement: Endpoint serverless `POST /api/payments/create-pix`

O sistema SHALL expor uma Vercel Serverless Function em `api/payments/create-pix.ts` (runtime Node) que recebe `{ pedidoId: string }` no body JSON e devolve `{ qr_code_base64, qr_code_copia_cola, expiration_date_to, mp_payment_id }`. O servidor SHALL ser a autoridade de preço: SHALL reconferir `num_paginas` a partir do PDF real no Storage, SHALL ler `quantidade_copias` e `modo_cor` da própria linha do pedido, e SHALL calcular `valor_centavos = num_paginas_reais * quantidade_copias * config_precos.valor_centavos_por_pagina[modo_cor]`, persistindo o valor autoritativo na linha antes de cobrar.

#### Scenario: Pedido válido gera PIX com múltiplas cópias
- **WHEN** o cliente POSTa `{ pedidoId: "<uuid-em-AGUARDANDO_PAGAMENTO com quantidade_copias=2>" }`, o PDF real tem 10 páginas e `config_precos.PB = 50`
- **THEN** o endpoint calcula `valor_centavos = 10 * 2 * 50 = 1000`, chama o Mercado Pago com `transaction_amount = 10.00`, persiste `num_paginas=10` e `valor_centavos=1000` na linha, e responde 200 com o payload de PIX

#### Scenario: Pedido com 1 cópia mantém o comportamento atual
- **WHEN** o pedido tem `quantidade_copias = 1`, PDF de 4 páginas e `config_precos.PB = 50`
- **THEN** o endpoint calcula `valor_centavos = 4 * 1 * 50 = 200`

#### Scenario: Pedido inexistente
- **WHEN** `pedidoId` não existe em `fila_impressao`
- **THEN** o endpoint responde 404 com `{ error: "Pedido não encontrado" }`

#### Scenario: Pedido já pago
- **WHEN** `pedidoId` está em estado diferente de `AGUARDANDO_PAGAMENTO`
- **THEN** o endpoint responde 409 com `{ error: "Pedido não está aguardando pagamento" }`

### Requirement: Idempotência na criação de pagamento

O endpoint `create-pix` SHALL enviar `X-Idempotency-Key: <pedidoId>` no header da requisição ao Mercado Pago para que cliques duplos ou retries do cliente não criem cobranças duplicadas.

#### Scenario: Cliente clica duas vezes em "Pagar"
- **WHEN** duas requisições idênticas chegam ao endpoint para o mesmo `pedidoId` em janela de poucos segundos
- **THEN** o Mercado Pago devolve o mesmo `payment_id` para ambas e a linha em `fila_impressao` é gravada uma única vez

### Requirement: Endpoint serverless `POST /api/webhooks/mercadopago`

O sistema SHALL expor uma Vercel Serverless Function em `api/webhooks/mercadopago.ts` que aceita notificações do Mercado Pago, valida a assinatura, busca o pagamento atualizado na API do MP, e atualiza `fila_impressao` conforme o status do pagamento.

#### Scenario: Webhook de pagamento aprovado
- **WHEN** o MP envia notificação com `type='payment'` e `data.id=<id>` para um pagamento cujo status na API do MP é `approved` e `external_reference` aponta para um pedido em `AGUARDANDO_PAGAMENTO`
- **THEN** o endpoint atualiza a linha para `status='PAGO'`, seta `paid_at = now()` e responde 200

#### Scenario: Webhook de pagamento rejeitado
- **WHEN** o pagamento na API do MP volta como `cancelled` ou `rejected`
- **THEN** o endpoint atualiza a linha para `status='CANCELADO'` e responde 200

### Requirement: Validação de assinatura HMAC do webhook

O endpoint de webhook SHALL validar o header `x-signature` do Mercado Pago recomputando `HMAC_SHA256(MERCADOPAGO_WEBHOOK_SECRET, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;")` e comparando com `v1=<hash>` em tempo constante. Requisições sem assinatura, com assinatura inválida ou com `ts` fora de uma janela de 5 minutos SHALL ser rejeitadas com `401`.

#### Scenario: Assinatura válida
- **WHEN** o MP envia o webhook com header `x-signature: ts=<now>,v1=<hash-correto>`
- **THEN** o endpoint processa a notificação

#### Scenario: Assinatura ausente
- **WHEN** uma requisição POST chega sem o header `x-signature`
- **THEN** o endpoint responde 401 e não modifica o banco

#### Scenario: Assinatura inválida
- **WHEN** uma requisição POST chega com `v1` que não bate com o hash recomputado
- **THEN** o endpoint responde 401 e não modifica o banco

#### Scenario: Timestamp fora da janela
- **WHEN** o `ts` no header é mais antigo que 5 minutos
- **THEN** o endpoint responde 401 (anti-replay)

### Requirement: Idempotência do webhook (anti-duplicate)

O endpoint de webhook SHALL ser **idempotente**: o `UPDATE` na tabela SHALL incluir `WHERE status='AGUARDANDO_PAGAMENTO'` (no caso de aprovação) para que reentregas do MP não sobrescrevam estados terminais já alcançados (e.g. `IMPRESSO`).

#### Scenario: Reentrega do mesmo webhook
- **WHEN** o MP reenviou o mesmo evento `payment.updated` 3 vezes para um pedido que já está `IMPRESSO`
- **THEN** o endpoint responde 200 em todas as reentregas e o status permanece `IMPRESSO`

### Requirement: Resposta 200 mesmo em erros recuperáveis

O endpoint de webhook SHALL responder `200` para qualquer notificação cuja assinatura seja válida, mesmo quando o pedido referenciado não exista ou o estado não permita atualização — exceto erros internos genuínos (banco fora). Isso evita que o Mercado Pago entre em loop de retry por motivos não acionáveis.

#### Scenario: Webhook com external_reference desconhecido
- **WHEN** chega notificação assinada para um pedido cujo UUID não está em `fila_impressao`
- **THEN** o endpoint loga a anomalia e responde 200 (não retry-able)

#### Scenario: Banco temporariamente indisponível
- **WHEN** o Supabase está fora durante o webhook
- **THEN** o endpoint responde 500 para que o MP tente novamente

### Requirement: Segredos exclusivamente no servidor

O `MERCADOPAGO_ACCESS_TOKEN`, o `MERCADOPAGO_WEBHOOK_SECRET` e a `SUPABASE_SERVICE_ROLE_KEY` SHALL existir apenas como variáveis de ambiente das Serverless Functions (sem prefixo `VITE_`), garantindo que não sejam empacotados no bundle do cliente.

#### Scenario: Build do cliente
- **WHEN** o build de produção é gerado
- **THEN** `grep -r MERCADOPAGO_ACCESS_TOKEN dist/` retorna 0 ocorrências

