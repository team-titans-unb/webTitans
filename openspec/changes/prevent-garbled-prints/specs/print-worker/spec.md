# Delta — print-worker (prevent-garbled-prints)

## ADDED Requirements

### Requirement: Higiene do spool CUPS (purga de jobs órfãos)
O worker SHALL tratar a(s) fila(s) CUPS configuradas como de uso exclusivo seu e SHALL purgar
jobs órfãos do spool para impedir que o CUPS retransmita fluxos interrompidos — causa de páginas
de lixo binário (bytes PCLm/URF interpretados como texto) na impressora.

A purga SHALL cancelar todos os jobs presentes nas filas candidatas (primária e fallback, quando
configurada), via mecanismo IPP do CUPS local (ex.: `cancel -a <fila>`), em dois momentos:
1. na inicialização do processo do worker, antes do primeiro ciclo;
2. imediatamente antes de cada submissão de job (início do processamento de um pedido), antes de
   qualquer envio à impressora.

A purga NÃO SHALL ocorrer entre a aceitação de um job pelo CUPS e a confirmação de conclusão (ou
timeout) desse mesmo job. Falha na purga (comando indisponível, timeout, erro) SHALL ser registrada
em log e NÃO SHALL bloquear o processamento do pedido — o worker degrada para o comportamento sem
purga.

Pedidos cujo job órfão foi purgado NÃO SHALL receber tratamento novo: eles já estarão em
`IMPRIMINDO` (recuperados para `PAGO` pelo mecanismo de pedidos travados) ou em `ERRO` (tratamento
manual), conforme o fluxo existente.

#### Scenario: Job órfão de reboot é purgado no boot do worker
- **WHEN** a máquina religou com um job parcialmente transmitido retido no spool CUPS e o worker
  inicia
- **THEN** o worker cancela todos os jobs das filas candidatas antes do primeiro ciclo, e o CUPS
  não retransmite o fluxo interrompido para a impressora

#### Scenario: Job órfão acumulado sem reboot é purgado antes da submissão
- **WHEN** existe um job residual no spool da fila (ex.: transmissão interrompida por queda de
  Wi-Fi) e o worker inicia o processamento de um novo pedido
- **THEN** o worker purga a fila antes de submeter o novo job, e somente o job do pedido atual é
  transmitido à impressora

#### Scenario: Purga nunca atinge o job ativo do próprio worker
- **WHEN** o worker submeteu um job e está aguardando sua conclusão
- **THEN** nenhuma purga é executada até a conclusão ou timeout desse job, e o job ativo nunca é
  cancelado pela higiene do spool

#### Scenario: Falha na purga não bloqueia a impressão
- **WHEN** o comando de purga falha (indisponível, timeout ou erro)
- **THEN** o worker registra um aviso em log e prossegue com o fluxo normal de submissão

## MODIFIED Requirements

### Requirement: Verificação de alcançabilidade real do destino antes de submeter
Para filas de rede (device-uri `ipp://`, `ipps://`, `http://` ou `socket://`), o worker SHALL
verificar a **alcançabilidade real do destino físico da impressora antes de submeter o job**,
e NÃO SHALL confiar apenas no estado `enabled` reportado por `lpstat -p`, que permanece
`enabled` mesmo quando o host da fila Wi-Fi está inalcançável.

A verificação SHALL obter o device-uri da fila (ex.: `lpstat -v <fila>`), resolver o host
(incluindo nomes mDNS `.local`) e tentar uma conexão TCP à porta IPP do destino, ambas com
timeout curto. Uma fila de rede cujo host não resolve ou cuja porta não aceita conexão SHALL
ser considerada **inalcançável**, classificada como falha de PRÉ-SUBMISSÃO (nada foi enviado à
impressora), e NÃO SHALL receber o job. Para filas USB/locais (`usb://`, `hp:/usb/...`,
`file://`), essa verificação de rede NÃO SHALL ser aplicada; mantém-se o health-check existente
de fila habilitada. Se o device-uri não puder ser interpretado, o worker SHALL degradar para o
health-check existente em vez de bloquear a impressão.

Além da alcançabilidade TCP, para destinos com device-uri IPP de rede o worker SHALL verificar a
**prontidão do firmware** consultando o atributo `printer-state` diretamente no equipamento
(Get-Printer-Attributes via `ipptool`) antes de submeter:
- `printer-state = 3` (idle) ou `4` (processing) SHALL autorizar a submissão — enfileirar atrás
  de um job ativo (ex.: impressão manual por outra fila apontando para a mesma impressora física)
  é comportamento normal do IPP e não corrompe o job submetido;
- `printer-state = 5` (stopped), bem como destino alcançável por TCP cuja consulta IPP falha ou
  não retorna o atributo (janela de inicialização do firmware), SHALL ser tratado como **não
  pronto**: falha de PRÉ-SUBMISSÃO (nada enviado), sem submissão nesta fila, elegível ao failover
  existente; sem fila de fallback utilizável, o pedido permanece aguardando em `PAGO` conforme o
  fluxo de retenção existente.

A checagem de prontidão SHALL degradar com segurança para o comportamento de alcançabilidade TCP
(sem bloquear a submissão) quando não houver como consultá-la com confiança: `ipptool`
indisponível, fila USB/local, ou quando o único alvo consultável for a fila do CUPS local (que
responde pelo daemon e não comprova o estado do firmware do equipamento).

#### Scenario: Primária Wi-Fi com host inalcançável
- **WHEN** a fila primária é de rede e o host (mDNS `.local`) não resolve ou a porta IPP não
  aceita conexão dentro do timeout
- **THEN** o worker considera a primária inalcançável, NÃO submete o job a ela, e registra a
  falha como pré-submissão (nada impresso)

#### Scenario: Primária alcançável e pronta
- **WHEN** o host da fila primária resolve, a porta IPP aceita conexão e o equipamento reporta
  `printer-state = 3` (idle) na consulta IPP direta
- **THEN** o worker prossegue para a submissão normal do job à primária

#### Scenario: Impressora ligando (porta aberta, firmware não pronto)
- **WHEN** a porta IPP do destino aceita conexão TCP, mas a consulta `printer-state` ao
  equipamento falha ou não retorna o atributo (firmware ainda inicializando)
- **THEN** o worker NÃO submete o job nesta fila neste ciclo, classifica como falha de
  pré-submissão (nada enviado) e o pedido segue o fluxo existente de failover/retenção

#### Scenario: Impressora reporta stopped
- **WHEN** a consulta IPP direta ao equipamento retorna `printer-state = 5` (stopped)
- **THEN** o worker NÃO submete o job nesta fila, classificando como falha de pré-submissão

#### Scenario: Consulta de prontidão impossível degrada para TCP-connect
- **WHEN** o `ipptool` está indisponível ou o único alvo consultável é a fila do CUPS local
- **THEN** o worker degrada para a verificação de alcançabilidade TCP existente e NÃO bloqueia a
  submissão por causa da checagem de prontidão

#### Scenario: Fila USB de fallback não sofre checagem de rede
- **WHEN** a fila candidata tem device-uri USB/local (ex.: `usb://`, `hp:/usb/...`)
- **THEN** o worker NÃO aplica a verificação de alcançabilidade de rede nem a checagem de
  prontidão IPP, e usa o health-check de fila habilitada existente

#### Scenario: Device-uri não interpretável
- **WHEN** o worker não consegue extrair host/porta do device-uri da fila
- **THEN** o worker degrada para o health-check existente e não bloqueia a impressão por causa
  do parsing
