# Prevent Garbled Prints — limpeza do spool CUPS e gate de prontidão IPP

## Why

A impressora HP Laser MFP 135w imprime páginas de lixo binário (caracteres CP437: ☺ ☻ ♦ ♥ ●) quando
recebe um fluxo PCLm/URF sem o cabeçalho — o auto-sense de linguagem falha e o firmware despeja os
bytes como texto, desperdiçando dezenas de folhas e toner de pedidos já pagos. Isso acontece quando
o CUPS retransmite jobs órfãos retidos no spool (ex.: máquina desligada no meio de uma transmissão)
e quando um job é submetido enquanto a impressora ainda está inicializando (a porta IPP aceita
TCP-connect segundos antes de o firmware estar pronto). O episódio já ocorreu inclusive sem
desligamento do sistema, então a higiene do spool precisa acontecer também antes de cada impressão,
não só no boot.

## What Changes

- O worker passa a **purgar jobs órfãos da fila CUPS** em dois momentos: na inicialização do
  processo e imediatamente antes de cada submissão de job. Como o estado-fonte da fila é o Supabase
  (`fila_impressao`) e o worker é o único submissor, qualquer job presente no spool CUPS fora do
  fluxo ativo é órfão e pode ser cancelado com segurança — o pedido correspondente volta a `PAGO`
  pelo mecanismo existente de recuperação de travados.
- O gate de prontidão pré-submissão é **endurecido**: além do TCP-connect atual, o worker consulta
  `printer-state` via IPP (`ipptool`, infraestrutura já existente no worker) e só submete quando a
  impressora reporta estado pronto (`idle`, 3). Impressora alcançável mas ainda inicializando
  (estado ausente/ilegível ou `stopped`) é tratada como **não pronta**: falha de pré-submissão,
  sem envio de bytes, elegível a failover/retenção.
- A consulta IPP de prontidão degrada com segurança: sem `ipptool` ou com a fila local como único
  alvo consultável, o worker mantém o comportamento atual (TCP-connect) em vez de bloquear a fila
  indefinidamente.

## Capabilities

### New Capabilities

_Nenhuma — as mudanças endurecem requisitos da capability existente `print-worker`._

### Modified Capabilities

- `print-worker`: (1) novo requisito de higiene do spool CUPS — purga de jobs órfãos no boot do
  worker e antes de cada submissão; (2) o requisito "Verificação de alcançabilidade real do destino
  antes de submeter" passa a exigir também prontidão do firmware via `printer-state` IPP, com
  degradação segura quando a consulta não é possível.

## Impact

- **Código**: `print-worker/worker.py` — nova função de purga do spool (`cancel -a <fila>` /
  `cancel <job>` via subprocess), chamada no boot e no início de `processar`; extensão de
  `fila_alcancavel`/nova checagem `impressora_pronta` reutilizando `_consultar_ipp` com o atributo
  `printer-state`; ajuste do arquivo de teste IPP (`ARQUIVO_IPP_SAUDE`) para incluir `printer-state`.
- **Specs**: delta em `print-worker` (novo requisito + requisito modificado).
- **Dependências**: nenhuma nova — `cancel` (cups-client) e `ipptool` (cups-ipp-utils) já são usados.
- **Operação**: jobs enfileirados manualmente por operadores na fila `Titans_Laser` serão cancelados
  pelo worker; a fila CUPS passa a ser de uso exclusivo do worker (documentar no runbook).
- **Sem impacto** em site/Next.js, Supabase schema ou fluxo de pagamento.
