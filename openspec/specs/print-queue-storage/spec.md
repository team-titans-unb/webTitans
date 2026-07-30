# print-queue-storage Specification

## Purpose
Definir o armazenamento da fila de impressão no Supabase: a tabela `fila_impressao` e seu
ciclo de status, a tabela de preços `config_precos`, o bucket privado `pdfs-impressao`, as
políticas RLS que restringem o acesso anônimo a INSERT/SELECT controlados, e o contrato de
leitura via `service_role` consumido pelo worker de impressão externo.
## Requirements
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

### Requirement: Índice em `status` para o consumidor externo

O Supabase SHALL ter um índice em `fila_impressao(status)` para que o script Python externo possa varrer linhas `PAGO` de forma eficiente.

#### Scenario: Consulta de fila por status
- **WHEN** o script executa `SELECT * FROM fila_impressao WHERE status='PAGO' ORDER BY created_at`
- **THEN** o plano usa o índice e responde em <50 ms para até 10k linhas

### Requirement: Políticas RLS para INSERT anônimo restrito

O Supabase SHALL ter RLS habilitado em `fila_impressao` com policy que permite ao role `anon` somente `INSERT` com `WITH CHECK (status = 'AGUARDANDO_PAGAMENTO' AND mp_payment_id IS NULL AND paid_at IS NULL AND printed_at IS NULL AND quantidade_copias >= 1)`.

#### Scenario: Cliente anônimo insere pedido inicial
- **WHEN** o frontend insere linha com status `AGUARDANDO_PAGAMENTO` e `quantidade_copias = 2` usando anon key
- **THEN** o insert é aceito

#### Scenario: Cliente anônimo tenta inserir já como PAGO
- **WHEN** o frontend tenta inserir linha com `status='PAGO'`
- **THEN** o insert é negado pela RLS

#### Scenario: Cliente anônimo tenta inserir quantidade inválida
- **WHEN** o frontend tenta inserir linha com `quantidade_copias = 0` usando anon key
- **THEN** o insert é negado (pela RLS e/ou pelo check constraint)

### Requirement: Políticas RLS para SELECT por id e bloqueio de UPDATE/DELETE anônimo

O Supabase SHALL permitir ao role `anon` `SELECT` em `fila_impressao` apenas quando o cliente fornece o `id` da linha (recuperado da própria sessão), e SHALL **negar** todo `UPDATE` e `DELETE` para `anon`. UPDATEs SHALL ser feitos exclusivamente via `service_role` na função `/api/webhooks/mercadopago`.

#### Scenario: Cliente verifica status do próprio pedido
- **WHEN** o frontend chama `select * from fila_impressao where id = <seu-uuid>`
- **THEN** retorna a linha

#### Scenario: Cliente tenta mudar status para PAGO
- **WHEN** o frontend tenta `update fila_impressao set status='PAGO' where id=...` com anon
- **THEN** a RLS bloqueia (0 rows affected, sem erro silencioso? — deve retornar erro 403)

### Requirement: Bucket privado `pdfs-impressao` no Storage

O Supabase Storage SHALL ter um bucket chamado `pdfs-impressao` marcado como **privado** (não público), com policies que permitem ao role `anon` apenas `INSERT` (upload), negando `SELECT`, `UPDATE` e `DELETE`. Apenas `service_role` SHALL ler arquivos para o script Python externo baixar.

#### Scenario: Cliente faz upload do PDF
- **WHEN** o frontend chama `supabase.storage.from('pdfs-impressao').upload(path, file)`
- **THEN** o arquivo é salvo

#### Scenario: Terceiro tenta baixar PDF público
- **WHEN** alguém faz `GET https://<supabase>/storage/v1/object/public/pdfs-impressao/<path>`
- **THEN** o Supabase retorna 400/404 (bucket não é público)

#### Scenario: Cliente tenta listar arquivos do bucket
- **WHEN** o frontend chama `supabase.storage.from('pdfs-impressao').list()` com anon
- **THEN** retorna lista vazia / 403

### Requirement: Tabela `config_precos` para preços por modo de cor

O Supabase SHALL ter uma tabela `config_precos` com `modo_cor` (text primary key check in ('PB','COLORIDO')) e `valor_centavos_por_pagina` (int not null check >0), populada pela migração inicial com valores acordados com a equipe.

#### Scenario: Cliente carrega preços ao abrir /impressao
- **WHEN** o frontend executa `select * from config_precos`
- **THEN** retorna duas linhas, uma para cada modo de cor, com valores atuais

#### Scenario: Time TITANS atualiza preço sem deploy
- **WHEN** alguém com acesso ao painel Supabase muda `valor_centavos_por_pagina` da linha 'PB'
- **THEN** novos checkouts já usam o preço atualizado

### Requirement: Contrato com o script Python externo (somente leitura via service_role)

O script Python externo SHALL ler `fila_impressao` filtrando por `status='PAGO'`, baixar o PDF correspondente em `pdf_path` do bucket `pdfs-impressao` usando `service_role` key, e ao concluir a impressão atualizar a linha para `status='IMPRESSO'` setando `printed_at`. Este contrato está definido aqui apenas como referência; o script vive fora deste repositório.

#### Scenario: Script consome um pedido pago
- **WHEN** existe uma linha com `status='PAGO'`
- **THEN** o script consegue, com `service_role`, baixar o PDF e atualizar a linha para `IMPRESSO`

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

### Requirement: Estados de saúde estendidos em impressora_status
A coluna `estado` de `impressora_status` SHALL aceitar, além de `OK`, `IMPRIMINDO`, `PAUSADA` e
`INALCANCAVEL`, os valores `SEM_PAPEL`, `SEM_TONER` e `MANUTENCAO`. A migração
`0009_printer_health.sql` SHALL estender o CHECK da coluna sem alterar a forma da tabela, sem
criar novas tabelas/colunas e sem tocar nas policies de RLS existentes (anon somente SELECT;
escrita apenas via service_role). A migração MUST ser reversível (restaurar o CHECK anterior).

#### Scenario: Worker publica estado de falta de papel
- **WHEN** o worker faz upsert com `estado = 'SEM_PAPEL'`
- **THEN** a escrita é aceita pelo CHECK estendido

#### Scenario: RLS inalterada
- **WHEN** o anon consulta `impressora_status` após a migração
- **THEN** a leitura funciona e a escrita anônima continua negada, como antes

### Requirement: Contrato de detalhes de saúde em impressora_status
O campo `detalhes` (jsonb) de `impressora_status` SHALL carregar, quando a coleta IPP tiver
sucesso, o contrato `{ toner_pct: int (0–100), state_reasons: string[], toner_baixo: bool }`.
Esses campos MUST ser somente informativos para o kiosk e MUST NOT exigir mudança de schema
(a coluna já é jsonb livre) nem de RLS. A ausência dos campos (coleta IPP indisponível) SHALL
ser tratada como estado de saúde desconhecido pelos consumidores, sem erro.

#### Scenario: Detalhes preenchidos após coleta IPP
- **WHEN** o worker lê o toner e as razões via IPP e faz upsert
- **THEN** `detalhes` contém `toner_pct`, `state_reasons` e `toner_baixo`

#### Scenario: Coleta IPP indisponível
- **WHEN** o `ipptool` não retorna atributos e o worker publica o estado dos health-checks
- **THEN** `detalhes` pode omitir os campos de saúde e o consumidor não recebe erro

