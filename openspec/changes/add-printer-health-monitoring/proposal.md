# Proposal: add-printer-health-monitoring

## Why

Hoje o print-worker só distingue a impressora entre `OK`, `IMPRIMINDO`, `PAUSADA` e
`INALCANCAVEL` (heartbeat de `add-kiosk-client-view`) — ele não enxerga as falhas físicas
mais comuns da HP Laser 135w: acabou o papel, acabou o toner, atolou ou a tampa está aberta.
Quando isso acontece, o pedido é reivindicado, o job trava e cai em `ERRO`, o cliente no
totem vê "Impressora indisponível" sem explicação e ninguém da equipe é avisado do que
faltou repor. Já validamos que o IPP da própria fila (`get-printer-attributes`) devolve
`printer-state-reasons` (media-empty, media-jam, cover-open, toner-empty…) e `marker-levels`
(nível real do toner) — dá para transformar isso em estado acionável sem hardware novo nem
dependência de SNMP.

## What Changes

- O print-worker passa a consultar, a cada ciclo, os atributos IPP de saúde da impressora
  (via `ipptool`, no mesmo estilo do uso atual de `lpstat`), **derivando o device URI do
  nome da fila que já está na config** (com fallback para a fila CUPS local) — nenhum IP de
  impressora é configurado ou hardcoded.
- Novos estados em `impressora_status`: `SEM_PAPEL` (media-empty), `SEM_TONER` (toner-empty
  ou toner ≤ limiar baixo) e `MANUTENCAO` (media-jam, cover-open, door-open). A migração
  `0009` estende o CHECK da coluna `estado`. Prioridade quando há várias razões:
  `SEM_TONER > SEM_PAPEL > MANUTENCAO > PAUSADA > IMPRIMINDO > OK`.
- O worker publica em `detalhes` (jsonb): `toner_pct` (int 0–100), `state_reasons` (lista) e
  `toner_baixo` (bool). **Toner baixo (≤ 10%) não muda o `estado`** — vira apenas
  `detalhes.toner_baixo = true`, um aviso preventivo.
- Nos estados bloqueantes (`SEM_PAPEL`/`SEM_TONER`/`MANUTENCAO`) o worker **não reivindica
  pedidos novos**: pedidos `PAGO` ficam aguardando na fila (não vão para `ERRO`) e o worker
  volta a operar sozinho quando a razão física some — sem intervenção manual.
- Notificação da equipe via **Telegram Bot API direto do worker** (mesmas envs
  `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`), disparada **apenas na transição** de estado
  (ex.: `OK → SEM_PAPEL`) e na transição de `toner_baixo` `false → true` — nunca a cada
  heartbeat. Best-effort: falha no Telegram não afeta a impressão.
- A faixa de status do kiosk (`FaixaImpressora`) ganha mensagens específicas por estado
  ("Sem papel — a equipe já foi avisada", "Toner esgotado…", "Impressora em manutenção…") e,
  quando `detalhes.toner_baixo`, um aviso discreto. Sem mudança de API/rotas: o Realtime
  existente de `impressora_status` já entrega os dados.

Sem breaking changes: o contrato de impressão exactly-once, o failover e a limpeza não mudam;
o heartbeat apenas ganha estados e campos adicionais.

## Capabilities

### New Capabilities

<!-- Nenhuma capability nova: a feature estende as existentes de worker, storage e kiosk. -->

### Modified Capabilities

- `print-worker`: novos requisitos de coleta IPP de saúde (via device URI derivado da fila),
  mapeamento de `state-reasons`/toner para estados com prioridade, recusa de reivindicação em
  estado bloqueante e notificação Telegram por transição — tudo best-effort e sem tocar no
  fluxo exactly-once.
- `print-queue-storage`: a coluna `estado` de `impressora_status` passa a aceitar `SEM_PAPEL`,
  `SEM_TONER` e `MANUTENCAO` (migração `0009` altera o CHECK); `detalhes` ganha o contrato
  `{ toner_pct, state_reasons, toner_baixo }`.
- `kiosk-client-view`: a faixa da impressora passa a exibir mensagem específica por estado de
  saúde e um aviso discreto de toner baixo, lendo os novos campos de `detalhes`.

## Impact

- **Worker**: `print-worker/worker.py` ganha coleta IPP (`ipptool` no device URI derivado da
  fila, fallback para `ipp://localhost:631/printers/<fila>`), mapeamento de estados por
  prioridade, memória do último estado/`toner_baixo` para detectar transições, e envio
  Telegram best-effort. Pré-requisito de sistema: pacote `cups-ipp-utils` (fornece `ipptool`).
- **Config do worker**: novas envs opcionais `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` (mesmas
  do site); nenhum IP de impressora é adicionado.
- **Banco**: nova migração `supabase/migrations/0009_printer_health.sql` (altera o CHECK de
  `impressora_status.estado`; sem novas tabelas nem policies).
- **Frontend**: `src/components/kiosk/status.ts` (`faixaImpressora`) e `FaixaImpressora.tsx`
  ganham os novos estados e o aviso de toner baixo; `useImpressoraStatus.ts` passa a expor
  `detalhes`. Nenhuma rota, API ou dependência de frontend nova.
- **Docs**: `print-worker/README.md` (coleta IPP, `cups-ipp-utils`, envs Telegram) e
  `docs/web-to-print/kiosk.md` (novos estados exibidos no totem).
- **Fora de escopo**: bloquear novos pagamentos no site quando a impressora está parada;
  métricas de vida útil de peças via SNMP; dashboard administrativo.
