# Design — prevent-garbled-prints

## Context

O worker (`print-worker/worker.py`) é o único submissor legítimo de jobs à fila CUPS
(`PRINTER_NAME`, com fallback opcional). A fonte da verdade da fila de pedidos é o Supabase
(`fila_impressao`); o spool do CUPS é só um meio de transporte. Hoje há duas brechas que produzem
páginas de lixo binário (bytes do fluxo PCLm/URF interpretados como texto CP437 pela HP 135w):

1. **Jobs órfãos no spool.** O CUPS persiste jobs em `/var/spool/cups` entre reboots. Se a máquina
   desliga/suspende no meio de uma transmissão, ao religar o CUPS retoma o envio — a impressora
   recebe um fluxo sem cabeçalho e o auto-sense cai no fallback de texto. O worker nem participa:
   a retransmissão dispara sozinha no boot.
2. **Submissão durante o boot da impressora.** `fila_alcancavel` faz só TCP-connect; a 135w abre a
   porta 631 segundos antes de o firmware estar pronto. Um job enviado nessa janela pode ser
   corrompido na interpretação.

O worker já possui toda a infraestrutura IPP necessária (`ipptool` via `_consultar_ipp`,
resolução mDNS via `_uri_com_host_resolvido`, arquivo de teste `ARQUIVO_IPP_SAUDE`).

## Goals / Non-Goals

**Goals:**
- Nenhum job órfão do spool CUPS chega à impressora: purga no boot do worker e antes de cada
  submissão.
- Nenhum job é submetido a uma impressora que não reporta `printer-state = idle` via IPP.
- Degradação segura: falha na purga ou na consulta IPP nunca trava a fila para sempre — o
  comportamento regride ao atual (TCP-connect), nunca para pior.
- Preservar os invariantes existentes: claim atômico, failover só em pré-submissão, nunca
  imprimir duas vezes.

**Non-Goals:**
- Não alterar a configuração do daemon CUPS (`PreserveJobFiles`, `ErrorPolicy`) — a solução vive
  inteiramente no worker para não depender de estado de máquina provisionado à mão. Pode ser
  revisitado depois.
- Não detectar/abortar lixo já em impressão (exigiria parsing de contadores de página via SNMP).
- Não cobrir jobs submetidos por humanos fora do worker — a fila passa a ser exclusiva do worker.

## Decisions

### D1: Purga via `cancel -a <fila>` (não `lprm`, não limpeza de `/var/spool`)

`cancel -a <fila>` cancela todos os jobs (pendentes e em transmissão) da fila usando a API IPP do
CUPS local — não requer root nem manipulação direta do spool. `lprm` é equivalente mas com sintaxe
menos previsível entre versões. Mexer em `/var/spool/cups` diretamente exigiria root e correria
contra o daemon.

A purga roda:
- **No boot do worker** (início de `main`), para todas as filas candidatas (primária + fallback) —
  mata retransmissões de jobs órfãos de antes do reboot.
- **No início de cada `processar`** (antes do download/submissão), também em todas as filas
  candidatas — cobre órfãos acumulados sem reboot (caso relatado em produção).

Segurança: entre a purga e o `lp`, o único job que pode existir na fila é o do próprio worker
(single-instance por claim atômico). A purga NUNCA roda entre a submissão (`lp`) e a conclusão
(`aguardar_conclusao`) do job ativo — o fluxo de `processar` é sequencial, então isso é garantido
por construção. Um pedido cujo job órfão foi purgado já está em `IMPRIMINDO`/`ERRO` no Supabase e
é devolvido a `PAGO` pelo `recuperar_travados` existente (ou tratado manualmente se `ERRO`) — a
purga não cria estados novos.

Falha na purga (timeout, `cancel` ausente) é logada como warning e **não bloqueia** a impressão:
pior caso é o comportamento atual.

### D2: Prontidão via `printer-state` no mesmo pedido IPP de saúde

Adicionar `printer-state` ao `requested-attributes` de `ARQUIVO_IPP_SAUDE` e parseá-lo em
`_parse_atributos_ipp` (enum IPP: 3 = idle, 4 = processing, 5 = stopped). Nova função
`impressora_pronta(cfg, fila) -> bool | None`:

- `True` — `printer-state` lido do **equipamento** (device URI direto) e igual a `3` (idle) ou
  `4` (processing).
- `False` — estado lido e igual a `5` (stopped), ou equipamento alcançável por TCP mas consulta
  IPP ao device URI falhou/sem estado (janela de boot do firmware: porta aberta, IPP não pronto).
- `None` (degrada) — `ipptool` ausente, ou o único alvo consultável é a fila CUPS local
  (`ipp://localhost/...`, que responde pelo daemon e não prova nada sobre o firmware), ou fila
  USB/local. Nesse caso vale só o TCP-connect atual.

`printer-state = 4` (processing) **autoriza** a submissão: enfileirar atrás de um job ativo (ex.:
impressão manual por outra fila apontando para a mesma impressora física) é comportamento normal
do IPP e não corrompe o job. Tratá-lo como "não pronto" criaria uma regressão: um pedido pago
reivindicado durante uma impressão manual simultânea esgotaria as filas e cairia em ERRO. O risco
de lixo binário vem de fluxo órfão sem cabeçalho e da janela de boot — não de enfileirar. Isso
também mantém o heartbeat coerente: durante um job do próprio worker o estado publicado continua
sendo IMPRIMINDO (nunca INALCANCAVEL).

Integração: a checagem entra no gate pré-submissão de `processar`, ao lado de `fila_alcancavel`.
Não-pronto = falha de PRÉ-SUBMISSÃO (nada enviado) → elegível ao failover existente; sem fallback
utilizável, o pedido permanece `PAGO` via a retenção existente (`deve_segurar_pedidos` continua
intocado — a espera de ciclo em ciclo já dá a folga de estabilização do firmware, sem necessidade
de sleep dedicado).

Alternativa considerada: sleep fixo (ex.: 30s) após a impressora ficar alcançável. Rejeitada —
chuta o tempo de boot do firmware e atrasa toda impressão pós-religada; `printer-state` mede a
prontidão real.

### D3: Nada de mudança no schema Supabase nem no kiosk

Os estados publicados pelo heartbeat não mudam. Uma impressora "alcançável mas não pronta"
continua aparecendo como `INALCANCAVEL`/`OK` conforme os checks existentes; a retenção de pedidos
usa o fluxo atual. Mantém o blast radius mínimo.

## Risks / Trade-offs

- [Purga cancela job legítimo submetido por humano na mesma fila] → Decisão consciente: a fila
  `Titans_Laser` passa a ser exclusiva do worker; documentar no README do worker. Impressões
  manuais devem usar outra fila CUPS apontando para a mesma impressora.
- [`printer-state` do firmware HP pode ser pouco confiável (reportar idle cedo demais)] → O gate
  reduz drasticamente a janela, não a zera; a purga pré-submissão é a defesa principal e não
  depende do firmware.
- [Impressora de terceiros na fila fallback pode não responder IPP Get-Printer-Attributes] →
  `impressora_pronta` degrada para `None` (comportamento atual) quando a consulta não é possível;
  só bloqueia com evidência positiva de não-prontidão.
- [Latência extra por pedido (1 consulta IPP + 1 `cancel` por fila)] → Ambos com timeout curto
  (mesmos timeouts já usados); custo de ~1–3s por pedido, irrelevante para o fluxo.
- [Loop infinito de retenção se o firmware nunca reportar idle] → `printer-state` ilegível com TCP
  fechado já é INALCANCAVEL (fluxo atual); ilegível com TCP aberto por mais de alguns ciclos é
  anômalo mas auto-observável nos logs; o failover para a fallback continua disponível.

## Migration Plan

1. Deploy = atualizar `worker.py` na máquina do lab e reiniciar o serviço systemd (procedimento
   padrão). Sem migração de dados.
2. Verificação: religar a impressora com o worker rodando e conferir nos logs a sequência
   "purga → aguardando idle → submissão"; simular job órfão (`lp` manual + derrubar Wi-Fi) e
   confirmar que o worker o cancela no ciclo seguinte.
3. Rollback: reverter o arquivo e reiniciar o serviço.

## Open Questions

- Nenhuma bloqueante. (Configurar `ErrorPolicy abort-job` no CUPS da máquina do lab fica como
  melhoria operacional fora do escopo deste change.)
