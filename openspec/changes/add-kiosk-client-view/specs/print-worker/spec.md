# print-worker — Delta Spec

## ADDED Requirements

### Requirement: Heartbeat de estado da impressora
A cada ciclo de poll, o worker SHALL fazer upsert de uma linha em `impressora_status`
para a fila primária, com `estado` derivado dos health-checks já existentes
(`fila_saudavel`, `fila_alcancavel`): `INALCANCAVEL` quando a fila está insalubre ou o
destino de rede não responde; `PAUSADA` quando a fila CUPS está desabilitada;
`IMPRIMINDO` quando há um pedido reivindicado em impressão; `OK` caso contrário — além de
`atualizado_em` com o timestamp corrente. A escrita SHALL usar a service_role já
configurada e MUST ser best-effort: falha no upsert (tabela ausente, rede) é logada e
MUST NOT interromper, atrasar classificação de erro ou alterar o fluxo de impressão
exactly-once.

#### Scenario: Ciclo normal com impressora saudável
- **WHEN** o worker completa um ciclo de poll com a fila CUPS habilitada e alcançável e
  sem job em andamento
- **THEN** `impressora_status` registra `estado = 'OK'` com `atualizado_em` atual

#### Scenario: Impressora inalcançável
- **WHEN** o health-check de rede falha (host não resolve ou porta recusa)
- **THEN** o heartbeat grava `estado = 'INALCANCAVEL'` e o comportamento de
  impressão/failover permanece o já especificado

#### Scenario: Falha na escrita do heartbeat
- **WHEN** o upsert em `impressora_status` lança exceção
- **THEN** o worker loga o erro e o ciclo de impressão continua normalmente
