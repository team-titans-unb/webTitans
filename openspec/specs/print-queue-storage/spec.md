# print-queue-storage Specification

## Purpose
Definir o armazenamento da fila de impressão no Supabase: a tabela `fila_impressao` e seu
ciclo de status, a tabela de preços `config_precos`, o bucket privado `pdfs-impressao`, as
políticas RLS que restringem o acesso anônimo a INSERT/SELECT controlados, e o contrato de
leitura via `service_role` consumido pelo worker de impressão externo.
## Requirements
### Requirement: Tabela `fila_impressao` no Supabase

O Supabase SHALL conter uma tabela `fila_impressao` com os seguintes campos: `id` (uuid, primary key, default `gen_random_uuid()`), `created_at` (timestamptz default now()), `pdf_path` (text not null), `num_paginas` (int not null check >0), `quantidade_copias` (int not null default 1 check >=1), `modo_cor` (text not null check in ('PB','COLORIDO')), `valor_centavos` (int not null check >0), `status` (text not null default 'AGUARDANDO_PAGAMENTO' check in ('AGUARDANDO_PAGAMENTO','PAGO','IMPRESSO','ERRO','CANCELADO')), `mp_payment_id` (text nullable), `mp_preference_id` (text nullable), `paid_at` (timestamptz nullable), `printed_at` (timestamptz nullable).

#### Scenario: Schema criado conforme migração
- **WHEN** a migração SQL é executada em um banco limpo
- **THEN** `\d fila_impressao` mostra exatamente esses campos com os check constraints, incluindo `quantidade_copias int not null default 1 check (quantidade_copias >= 1)`

#### Scenario: Linha com status inválido é rejeitada
- **WHEN** tenta-se inserir `status='RECUSADO'`
- **THEN** o Postgres rejeita por check constraint

#### Scenario: Quantidade de cópias inválida é rejeitada
- **WHEN** tenta-se inserir `quantidade_copias = 0`
- **THEN** o Postgres rejeita por check constraint

#### Scenario: Pedido legado sem quantidade assume 1
- **WHEN** um INSERT não informa `quantidade_copias`
- **THEN** o Postgres aplica o default `1`

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

