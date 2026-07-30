# print-queue-storage — Delta Spec

## ADDED Requirements

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
