# print-queue-storage — Delta Spec

## ADDED Requirements

### Requirement: View pública da fila (fila_publica)
O banco SHALL expor a view `fila_publica` sobre `fila_impressao` contendo apenas colunas
não sensíveis: `protocolo` (computado como `upper(left(id::text, 8))`), `status`,
`num_paginas`, `quantidade_copias`, `modo_cor`, `paid_at` e `printed_at`. A view SHALL
filtrar para pedidos com status `PAGO` e `IMPRIMINDO`, mais `IMPRESSO`/`ERRO` dentro de
uma janela curta após `printed_at`/atualização, ordenados por `paid_at` crescente (mesmo
critério FIFO do worker). O UUID completo, `pdf_path` e identificadores de pagamento MUST
NOT constar na view. O papel `anon` SHALL poder ler a view.

#### Scenario: Leitura anônima da fila pública
- **WHEN** um cliente anônimo consulta `fila_publica`
- **THEN** recebe os pedidos ativos com protocolo de 8 caracteres e metadados de
  impressão, sem UUID completo nem dados de pagamento

#### Scenario: Pedido antigo concluído
- **WHEN** um pedido `IMPRESSO` ultrapassa a janela de exibição
- **THEN** ele deixa de aparecer em `fila_publica` (a linha permanece em
  `fila_impressao` conforme a retenção existente)

### Requirement: Tabela impressora_status
O banco SHALL ter a tabela `impressora_status` com `fila text primary key`,
`estado text` restrito a (`OK`, `IMPRIMINDO`, `PAUSADA`, `INALCANCAVEL`),
`detalhes jsonb` e `atualizado_em timestamptz`. RLS habilitado: `anon` SHALL poder apenas
SELECT; INSERT/UPDATE/DELETE ficam sem policy (somente service_role). A tabela SHALL ser
adicionada à publicação `supabase_realtime`.

#### Scenario: Kiosk lê o estado
- **WHEN** o kiosk consulta `impressora_status` com a anon key
- **THEN** a leitura funciona e qualquer tentativa de escrita anônima é negada

### Requirement: Tabela chamados_ajuda
O banco SHALL ter a tabela `chamados_ajuda` com `id uuid pk default gen_random_uuid()`,
`protocolo text` (opcional), `categoria text` restrita a valores conhecidos,
`criado_em timestamptz default now()` e `resolvido_em timestamptz` (nulo enquanto
aberto). RLS habilitado sem nenhuma policy para `anon` (acesso negado por padrão);
somente a service_role (API route) SHALL escrever e ler.

#### Scenario: Escrita apenas server-side
- **WHEN** a API route de ajuda insere um chamado com service_role
- **THEN** a inserção funciona, enquanto um INSERT direto com a anon key é negado pela
  RLS
