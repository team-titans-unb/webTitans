# Delta — print-queue-storage (add-reimpressao-autorizada)

## MODIFIED Requirements

### Requirement: Tabela `fila_impressao` no Supabase

O Supabase SHALL conter uma tabela `fila_impressao` com os seguintes campos: `id` (uuid, primary key, default `gen_random_uuid()`), `created_at` (timestamptz default now()), `pdf_path` (text not null), `num_paginas` (int not null check >0), `quantidade_copias` (int not null default 1 check >=1), `modo_cor` (text not null check in ('PB','COLORIDO')), `valor_centavos` (int not null check >0), `status` (text not null default 'AGUARDANDO_PAGAMENTO' check in ('AGUARDANDO_PAGAMENTO','PAGO','IMPRESSO','ERRO','CANCELADO')), `mp_payment_id` (text nullable), `mp_preference_id` (text nullable), `paid_at` (timestamptz nullable), `printed_at` (timestamptz nullable), `reimpressao` (boolean not null default false).

O campo `reimpressao` marca pedidos que foram re-enfileirados para reimpressão autorizada
(volta de `ERRO`/`IMPRESSO` para `PAGO` sem novo pagamento). Ele NÃO altera o ciclo de
status nem o critério FIFO do worker (que continua ordenando por `paid_at`); serve como
sinalizador de auditoria/observabilidade. Pedidos criados normalmente assumem o default
`false`.

#### Scenario: Schema criado conforme migração
- **WHEN** a migração SQL é executada em um banco limpo
- **THEN** `\d fila_impressao` mostra exatamente esses campos com os check constraints, incluindo `quantidade_copias int not null default 1 check (quantidade_copias >= 1)` e `reimpressao boolean not null default false`

#### Scenario: Linha com status inválido é rejeitada
- **WHEN** tenta-se inserir `status='RECUSADO'`
- **THEN** o Postgres rejeita por check constraint

#### Scenario: Quantidade de cópias inválida é rejeitada
- **WHEN** tenta-se inserir `quantidade_copias = 0`
- **THEN** o Postgres rejeita por check constraint

#### Scenario: Pedido legado sem quantidade assume 1
- **WHEN** um INSERT não informa `quantidade_copias`
- **THEN** o Postgres aplica o default `1`

#### Scenario: Pedido novo assume reimpressao=false
- **WHEN** um INSERT não informa `reimpressao`
- **THEN** o Postgres aplica o default `false`
