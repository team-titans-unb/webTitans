# print-worker Specification

## Purpose
TBD - created by archiving change add-print-worker. Update Purpose after archive.
## Requirements
### Requirement: Detecção de pedidos pagos
O worker SHALL consultar periodicamente a tabela `fila_impressao` por pedidos com
`status = 'PAGO'`, processando-os em ordem de `paid_at` crescente (FIFO). O intervalo de
consulta SHALL ser configurável via variável de ambiente, com padrão de 10 segundos.

#### Scenario: Pedido pago disponível
- **WHEN** existe ao menos uma linha com `status = 'PAGO'`
- **THEN** o worker seleciona a mais antiga por `paid_at` e inicia o processamento dela

#### Scenario: Fila vazia
- **WHEN** não há nenhuma linha com `status = 'PAGO'`
- **THEN** o worker aguarda o intervalo configurado e consulta novamente, sem erro

### Requirement: Claim atômico do pedido
O worker SHALL reivindicar um pedido de forma atômica antes de imprimir, executando um
`UPDATE` condicional de `status = 'PAGO'` para `status = 'IMPRIMINDO'` na mesma operação.
Apenas a execução cujo UPDATE afetar a linha SHALL prosseguir com a impressão.

#### Scenario: Claim bem-sucedido
- **WHEN** o worker tenta reivindicar um pedido `PAGO` e o UPDATE retorna a linha
- **THEN** o worker passa a ser o dono do pedido e segue para download e impressão

#### Scenario: Claim perdido para outra execução
- **WHEN** o worker tenta reivindicar um pedido que já foi mudado de `PAGO` por outra execução
- **THEN** o UPDATE não afeta nenhuma linha e o worker ignora esse pedido sem imprimir

### Requirement: Download seguro do PDF
O worker SHALL baixar o PDF do bucket privado `pdfs-impressao` usando o caminho `pdf_path`
do pedido e a `service_role` key do Supabase. A `service_role` key NÃO SHALL ser exposta a
clientes nem commitada no repositório.

#### Scenario: PDF baixado com sucesso
- **WHEN** o `pdf_path` aponta para um objeto existente no bucket
- **THEN** o worker carrega o conteúdo do PDF em memória para conferência e impressão

#### Scenario: PDF ausente ou inacessível
- **WHEN** o download falha (objeto inexistente, erro de rede após retentativas)
- **THEN** o worker marca o pedido como `status = 'ERRO'` e registra o motivo no log

### Requirement: Reconferência de páginas antes da impressão
O worker SHALL contar as páginas reais do PDF baixado e SHALL recusar a impressão se o PDF
for ilegível/criptografado ou se a contagem real divergir de `num_paginas` registrado no
pedido.

#### Scenario: Contagem confere
- **WHEN** a contagem real de páginas do PDF é igual a `num_paginas` do pedido
- **THEN** o worker prossegue para a impressão

#### Scenario: Contagem diverge
- **WHEN** a contagem real de páginas difere de `num_paginas`
- **THEN** o worker marca `status = 'ERRO'`, registra a contagem observada no log e não imprime

#### Scenario: PDF inválido
- **WHEN** o PDF não pode ser lido (corrompido ou criptografado)
- **THEN** o worker marca `status = 'ERRO'` e não imprime

### Requirement: Impressão na HP Laser MFP 135w via CUPS
O worker SHALL enviar o PDF para impressão na fila CUPS configurada (`PRINTER_NAME`) usando o
utilitário `lp` do sistema, produzindo a quantidade de cópias do pedido. A quantidade SHALL ser
lida do campo `quantidade_copias` da linha (>= 1), com fallback para 1 caso ausente.

Como a HP Laser MFP 135w ignora a opção de cópias do CUPS (`lp -n` / `-o copies`), o worker SHALL
materializar as cópias no próprio arquivo — concatenando o documento `quantidade_copias` vezes num
único PDF — e enviá-lo como um único job de uma cópia, em vez de depender da opção de cópias do
driver. A reconferência de páginas (`num_paginas`) SHALL ocorrer sobre o PDF original, antes da
replicação. Por a impressora ser monocromática, todo pedido SHALL ser impresso em preto-e-branco.

Quando uma fila de fallback (`PRINTER_NAME_FALLBACK`) estiver configurada, o worker SHALL tentar
a fila primária e, se ela for **comprovadamente inalcançável antes de qualquer byte chegar à
impressora**, SHALL fazer failover para a fila de fallback. Um destino de rede que não resolve ou
cuja porta IPP não aceita conexão SHALL ser tratado como falha de PRÉ-SUBMISSÃO (nada impresso),
autorizando o failover — mesmo que o `lpstat -p` reporte a fila como `enabled` e mesmo que o CUPS
aceitaria o job no spool. Uma vez que o job tenha sido aceito por uma fila cujo destino foi (ou
pôde ter sido) contatado, o worker NÃO SHALL fazer failover para outra fila; falhas posteriores
(ex.: timeout de conclusão) SHALL resultar em cancelamento do job e `status = 'ERRO'`, nunca em
reimpressão automática, para preservar o invariante de nunca imprimir o mesmo pedido duas vezes.

#### Scenario: Envio aceito pelo CUPS
- **WHEN** o worker envia o PDF (já com as cópias materializadas) e o CUPS aceita o trabalho
- **THEN** o worker captura o identificador do job para acompanhar a conclusão

#### Scenario: Pedido com múltiplas cópias
- **WHEN** o pedido tem `quantidade_copias = 3` e o PDF original tem N páginas
- **THEN** o worker imprime um único job contendo `3 * N` páginas (o documento repetido 3 vezes)

#### Scenario: Pedido sem quantidade definida
- **WHEN** a linha do pedido não traz `quantidade_copias` (pedido legado)
- **THEN** o worker imprime 1 cópia (fallback), sem replicar o PDF

#### Scenario: Pedido COLORIDO em impressora mono
- **WHEN** o pedido tem `modo_cor = 'COLORIDO'`
- **THEN** o worker registra um aviso no log e imprime o documento em tons de cinza

#### Scenario: Failover quando a primária está inalcançável
- **WHEN** a fila primária de rede está comprovadamente inalcançável (host não resolve ou porta
  IPP recusa conexão) e há uma fila de fallback configurada
- **THEN** o worker NÃO submete à primária, faz failover para a fila de fallback e imprime o
  pedido uma única vez, sem duplicar

#### Scenario: Sem failover após o destino ter sido contatado
- **WHEN** o job foi aceito por uma fila cujo destino respondeu (ou cuja ausência de impressão
  não pode ser comprovada) e a conclusão falha por timeout
- **THEN** o worker cancela o job, marca `status = 'ERRO'` e NÃO tenta outra fila, evitando
  reimpressão duplicada

### Requirement: Confirmação de conclusão com timeout
O worker SHALL acompanhar o job no CUPS até a conclusão ou até estourar um tempo limite
configurável (`PRINT_TIMEOUT`, padrão 180 segundos). Somente após a conclusão confirmada o
worker SHALL marcar o pedido como impresso.

#### Scenario: Impressão concluída
- **WHEN** o CUPS reporta o job como concluído dentro do tempo limite
- **THEN** o worker atualiza o pedido para `status = 'IMPRESSO'` com `printed_at = now()`

#### Scenario: Tempo limite excedido
- **WHEN** o job não conclui dentro de `PRINT_TIMEOUT` (impressora offline, sem papel, atolada)
- **THEN** o worker tenta cancelar o job, marca `status = 'ERRO'` e registra o motivo no log

### Requirement: Recuperação de pedidos travados
O worker SHALL, no início de cada ciclo, detectar pedidos presos em `status = 'IMPRIMINDO'`
por mais tempo que um limite configurável (`STUCK_TIMEOUT`, padrão 15 minutos) e devolvê-los à
fila para nova tentativa, sem deixá-los presos indefinidamente.

#### Scenario: Pedido órfão em IMPRIMINDO
- **WHEN** um pedido permanece em `IMPRIMINDO` além de `STUCK_TIMEOUT` (ex.: queda da máquina)
- **THEN** o worker devolve o pedido para `status = 'PAGO'` para ser reprocessado

#### Scenario: Pedido PAGO nunca é tocado por outro estado
- **WHEN** um pedido está em `status = 'PAGO'` e ainda não foi reivindicado
- **THEN** o worker apenas o reivindica via claim atômico, nunca o apaga ou altera fora do fluxo

### Requirement: Execução resiliente e contínua
O worker SHALL rodar continuamente como serviço de longa duração, tolerando erros
transitórios (rede, Supabase indisponível) sem encerrar, e SHALL ser executável como serviço
systemd com reinício automático.

#### Scenario: Erro transitório de rede
- **WHEN** uma consulta ao Supabase falha por erro de rede
- **THEN** o worker registra o erro, aguarda e tenta novamente no próximo ciclo, sem encerrar

#### Scenario: Reinício do serviço
- **WHEN** o processo do worker é encerrado (crash ou reboot da máquina)
- **THEN** o systemd reinicia o serviço automaticamente e o worker retoma o processamento da fila

### Requirement: Nunca imprimir o mesmo pedido duas vezes
O sistema SHALL garantir que cada pedido seja impresso no máximo uma vez, mesmo com múltiplas
execuções concorrentes do worker ou reinícios no meio do processamento.

#### Scenario: Duas instâncias concorrentes
- **WHEN** duas instâncias do worker veem o mesmo pedido `PAGO` ao mesmo tempo
- **THEN** apenas uma vence o claim atômico e imprime; a outra ignora o pedido

### Requirement: Failover automático entre filas restrito à pré-submissão
O worker SHALL fazer failover automático da fila primária para a fila de fallback APENAS quando
a falha ocorrer **antes de o job ser aceito pelo CUPS** (falha de pré-submissão), em que é
seguro afirmar que nada foi impresso. São falhas de pré-submissão: a fila estar
desabilitada/parada/inalcançável no health-check; o nome de host `.local` (mDNS) não resolver;
a impressora estar inalcançável; o `lp` retornar erro de submissão; ou o `lp` retornar sucesso
mas sem job id rastreável.

O worker SHALL registrar em log cada failover, indicando a fila de origem, a fila de destino e
o motivo da pré-submissão.

#### Scenario: Failover por fila primária inalcançável
- **WHEN** a fila primária (Wi-Fi) falha na submissão por host `.local` não resolver ou
  impressora inalcançável, e a fila de fallback está configurada e saudável
- **THEN** o worker submete o mesmo job à fila de fallback e prossegue acompanhando a conclusão
  nessa fila

#### Scenario: Failover por fila primária desabilitada no health-check
- **WHEN** o health-check indica que a fila primária está desabilitada/parada e a fila de
  fallback está saudável
- **THEN** o worker não submete à primária, submete à fila de fallback e registra o motivo no log

#### Scenario: Todas as filas falham na pré-submissão
- **WHEN** nenhuma fila (primária nem fallback) aceita o job, todas falhando antes da aceitação
- **THEN** o worker marca o pedido como `status = 'ERRO'` e registra que nenhuma fila aceitou o
  trabalho, sem ter impresso nada

### Requirement: Proibição de failover após aceitação do job (anti-duplicação)
O worker SHALL NOT fazer failover nem reimprimir automaticamente um pedido após o CUPS ter
aceitado o job (job id obtido). Após a aceitação, não há garantia de que nada foi impresso, de
modo que reenviar o documento — que pode conter múltiplas cópias materializadas — arriscaria
duplicar a impressão. Qualquer falha pós-aceitação (notadamente o timeout de conclusão) SHALL
manter o comportamento de cancelar o job e marcar `status = 'ERRO'` para tratamento manual,
nunca reimprimir.

#### Scenario: Timeout após aceitação não dispara failover
- **WHEN** o job foi aceito pela fila primária mas não conclui dentro de `PRINT_TIMEOUT`
- **THEN** o worker tenta cancelar o job nessa fila, marca `status = 'ERRO'` e NÃO tenta a fila
  de fallback, evitando reimpressão duplicada

#### Scenario: Falso negativo pós-aceitação é resolvido manualmente
- **WHEN** o job foi aceito e possivelmente impresso, mas o worker não confirmou a conclusão
- **THEN** o pedido permanece em `status = 'ERRO'` com a fila e o job id registrados no log,
  para que um operador decida manualmente, em vez de o worker reimprimir automaticamente

### Requirement: Confirmação de conclusão na fila escolhida
O worker SHALL acompanhar o job no CUPS na **mesma fila** em que ele foi aceito, até a
conclusão ou até estourar `PRINT_TIMEOUT`. A confirmação de conclusão e o eventual cancelamento
SHALL referir-se sempre à fila onde o job foi efetivamente submetido, e não a uma fila fixa.

#### Scenario: Conclusão confirmada na fila de fallback
- **WHEN** o job foi aceito pela fila de fallback após um failover de pré-submissão e conclui
  dentro do tempo limite
- **THEN** o worker atualiza o pedido para `status = 'IMPRESSO'` com `printed_at = now()`,
  tendo acompanhado a conclusão na fila de fallback

#### Scenario: Cancelamento na fila correta após timeout
- **WHEN** o job aceito por uma fila estoura `PRINT_TIMEOUT`
- **THEN** o worker tenta cancelar o job nessa mesma fila e marca `status = 'ERRO'`

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

#### Scenario: Primária Wi-Fi com host inalcançável
- **WHEN** a fila primária é de rede e o host (mDNS `.local`) não resolve ou a porta IPP não
  aceita conexão dentro do timeout
- **THEN** o worker considera a primária inalcançável, NÃO submete o job a ela, e registra a
  falha como pré-submissão (nada impresso)

#### Scenario: Primária alcançável
- **WHEN** o host da fila primária resolve e a porta IPP aceita conexão dentro do timeout
- **THEN** o worker prossegue para a submissão normal do job à primária

#### Scenario: Fila USB de fallback não sofre checagem de rede
- **WHEN** a fila candidata tem device-uri USB/local (ex.: `usb://`, `hp:/usb/...`)
- **THEN** o worker NÃO aplica a verificação de alcançabilidade de rede e usa o health-check de
  fila habilitada existente

#### Scenario: Device-uri não interpretável
- **WHEN** o worker não consegue extrair host/porta do device-uri da fila
- **THEN** o worker degrada para o health-check existente e não bloqueia a impressão por causa
  do parsing

