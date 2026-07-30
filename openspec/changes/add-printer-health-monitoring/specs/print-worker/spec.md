# print-worker — Delta Spec

## ADDED Requirements

### Requirement: Coleta IPP de saúde da impressora
A cada ciclo de heartbeat, o worker SHALL consultar os atributos IPP da impressora
(`printer-state-reasons` e `marker-levels`) via `ipptool`, alcançando o equipamento pelo
device URI derivado do nome da fila (`lpstat -v <fila>`) quando este for de rede
(`ipp`/`ipps`/`http`/`https`), com fallback para a fila CUPS local
(`ipp://localhost:631/printers/<fila>`). Nenhum endereço IP de impressora SHALL ser
configurado ou embutido no código — tudo MUST derivar do nome da fila que o worker já possui.
A coleta MUST ser best-effort: ausência de `ipptool`, timeout ou atributos ilegíveis são
logados e o worker degrada para os estados derivados dos health-checks existentes, sem
interromper a impressão.

#### Scenario: Coleta bem-sucedida via device URI de rede
- **WHEN** o worker consulta a impressora e o `ipptool` retorna atributos
- **THEN** `printer-state-reasons` e o nível de toner são lidos e usados para derivar o estado
  e preencher `detalhes`

#### Scenario: ipptool indisponível
- **WHEN** o `ipptool` não está instalado ou falha ao consultar
- **THEN** o worker loga o erro, mantém apenas os estados `OK`/`PAUSADA`/`INALCANCAVEL`
  derivados dos health-checks e segue imprimindo normalmente

### Requirement: Estados de saúde derivados de state-reasons e toner
O worker SHALL mapear as razões IPP para os estados `SEM_PAPEL` (media-empty/media-needed),
`SEM_TONER` (toner-empty ou nível de toner no limiar low) e `MANUTENCAO`
(media-jam/cover-open/door-open), publicados em `impressora_status.estado`. Quando múltiplas
razões coexistirem, o estado publicado MUST seguir a prioridade
`SEM_TONER > SEM_PAPEL > MANUTENCAO > PAUSADA > IMPRIMINDO > OK`. `INALCANCAVEL` SHALL ser
publicado somente quando o equipamento realmente não responde à consulta IPP direta (sem o
cache da fila CUPS local): se os health-checks indicam indisponibilidade (ex.:
`printer-state = stopped`, que o firmware também usa para falha física com job bloqueado) mas
o equipamento responde IPP com razões que mapeiam para falha física, o estado físico MUST
prevalecer. Toner baixo (nível ≤ 10%, acima
do limiar de `SEM_TONER`) MUST NOT alterar o `estado`: SHALL apenas marcar
`detalhes.toner_baixo = true`. Razões IPP desconhecidas MUST NOT bloquear a fila — são
registradas em `detalhes.state_reasons` sem mudar o estado.

#### Scenario: Bandeja sem papel
- **WHEN** a impressora reporta `media-empty` e nenhuma razão de maior prioridade
- **THEN** o heartbeat publica `estado = 'SEM_PAPEL'`

#### Scenario: Toner e papel simultâneos
- **WHEN** a impressora reporta ao mesmo tempo `toner-empty` e `media-empty`
- **THEN** o estado publicado é `SEM_TONER` (maior prioridade)

#### Scenario: Toner baixo não bloqueia
- **WHEN** o nível de toner cai para 10% sem razão `toner-empty`
- **THEN** o estado permanece `OK`/`IMPRIMINDO` e `detalhes.toner_baixo` é `true`

### Requirement: Retenção de pedidos em estado bloqueante
O worker SHALL reter os pedidos enquanto o estado corrente for bloqueante (`SEM_PAPEL`,
`SEM_TONER`, `MANUTENCAO` ou `INALCANCAVEL`): nesse período o worker MUST NOT reivindicar
novos pedidos e o pedido `PAGO` mais antigo SHALL permanecer intacto na fila, sem transição
para `ERRO` nem submissão de job. Quando a
razão física deixar de ser reportada, o worker SHALL voltar a reivindicar pedidos
automaticamente no ciclo seguinte, sem intervenção manual além da reposição do insumo.

#### Scenario: Papel acaba com pedido na fila
- **WHEN** há um pedido `PAGO` e a impressora está em `SEM_PAPEL`
- **THEN** o worker não reivindica o pedido, que permanece `PAGO`, e nenhum job é submetido

#### Scenario: Recuperação automática após reposição
- **WHEN** o papel é reposto e a razão `media-empty` some
- **THEN** no ciclo seguinte o worker reivindica o pedido `PAGO` pendente e imprime normalmente

### Requirement: Notificação da equipe por transição de estado
O worker SHALL notificar a equipe via Telegram Bot API (envs `TELEGRAM_BOT_TOKEN` e
`TELEGRAM_CHAT_ID`) APENAS nestas transições: quando o estado publicado ENTRA em um estado de
problema (ex.: `OK → SEM_PAPEL`); quando um problema já avisado é RESOLVIDO — o estado volta a
operar (`OK`/`IMPRIMINDO`) — com uma mensagem de recuperação (ex.: papel reposto); e quando
`detalhes.toner_baixo` passa de `false` para `true`. A notificação MUST NOT ser enviada a cada
heartbeat de um mesmo estado (sem spam), e a reentrada no MESMO problema ainda pendente (ex.:
`SEM_PAPEL → INALCANCAVEL → SEM_PAPEL` por queda de rede, sem reposição no meio) MUST NOT
repetir o aviso. `INALCANCAVEL`/`PAUSADA` MUST NOT contar como resolução (não provam
reposição). Ao iniciar, o worker SHALL continuar a memória de transição a partir da última
linha publicada em `impressora_status`, para que um restart não duplique avisos nem perca a
recuperação pendente. O envio MUST ser best-effort: falha ou envs ausentes são logadas e MUST
NOT interromper o heartbeat nem o ciclo de impressão.

#### Scenario: Transição para sem papel notifica uma vez
- **WHEN** o estado muda de `OK` para `SEM_PAPEL`
- **THEN** uma mensagem é enviada ao Telegram e ciclos subsequentes ainda em `SEM_PAPEL` não
  enviam novas mensagens

#### Scenario: Reposição do papel notifica a recuperação
- **WHEN** o estado estava em `SEM_PAPEL` (problema avisado) e volta a `OK` ou `IMPRIMINDO`
- **THEN** uma mensagem de recuperação (papel reposto, fila retomada) é enviada ao Telegram e o
  problema deixa de estar pendente

#### Scenario: Queda de rede no meio do problema não gera ruído
- **WHEN** o estado vai de `SEM_PAPEL` para `INALCANCAVEL` e retorna a `SEM_PAPEL` sem reposição
- **THEN** nenhuma mensagem adicional é enviada (nem de recuperação, nem de reentrada)

#### Scenario: Sem papel com job bloqueado (printer-state stopped)
- **WHEN** o firmware reporta `printer-state = stopped` com razão `media-empty` e o equipamento
  responde à consulta IPP direta
- **THEN** o worker publica `SEM_PAPEL` (não `INALCANCAVEL`) e a notificação de entrada dispara

#### Scenario: Telegram não configurado
- **WHEN** ocorre uma transição de estado e as envs do Telegram não estão definidas
- **THEN** o worker apenas loga e continua o heartbeat e a impressão sem erro
