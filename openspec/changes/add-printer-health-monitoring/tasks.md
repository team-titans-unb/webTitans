# Tasks: add-printer-health-monitoring

## 1. Banco de dados (migração 0009)

- [x] 1.1 Criar `supabase/migrations/0009_printer_health.sql` que faz `drop constraint` +
      `add constraint` no CHECK de `impressora_status.estado`, estendendo a lista para incluir
      `SEM_PAPEL`, `SEM_TONER` e `MANUTENCAO` (sem novas tabelas/colunas/policies), com
      comentário explicando o rollback (restaurar o CHECK antigo após normalizar linhas)
- [x] 1.2 Rodar a migração no Supabase e verificar: upsert com `estado = 'SEM_PAPEL'` é
      aceito; RLS inalterada (anon SELECT funciona, escrita anônima negada)

## 2. Worker — coleta IPP de saúde

- [x] 2.1 Em `print-worker/worker.py`, adicionar função que deriva o alvo IPP do nome da fila:
      device URI de rede via `device_uri_da_fila` quando o esquema for `ipp/ipps/http/https`,
      com fallback para `ipp://localhost:631/printers/<fila>` — sem IP hardcoded
- [x] 2.2 Adicionar coleta via `ipptool` (subprocess, `CUPS_ENV`, timeout curto) que lê
      `printer-state-reasons` e `marker-levels`, com parsing tolerante e best-effort
      (try/except; ausência de `ipptool`/timeout degrada sem quebrar o ciclo)
- [x] 2.3 Implementar a normalização de razões (remover sufixos `-warning/-error/-report`) e o
      mapeamento para `SEM_PAPEL`/`SEM_TONER`/`MANUTENCAO`, aplicando a prioridade
      `SEM_TONER > SEM_PAPEL > MANUTENCAO > PAUSADA > IMPRIMINDO > OK` e mantendo
      `INALCANCAVEL` dominante; toner ≤ 10% (sem `toner-empty`) vira `detalhes.toner_baixo`

## 3. Worker — heartbeat, detalhes e transições

- [x] 3.1 Estender `estado_da_fila`/`Heartbeat._publicar` para gravar o estado de saúde e
      preencher `detalhes = { toner_pct, state_reasons, toner_baixo }` no upsert de
      `impressora_status`
- [x] 3.2 Adicionar memória do último estado publicado e do último `toner_baixo`, e um helper
      `notificar_transicao(...)` que envia Telegram (`sendMessage`, timeout curto) só na
      transição para um estado de problema e no `toner_baixo false→true`, best-effort
- [x] 3.3 Adicionar `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` (opcionais) à `Config` do worker e
      documentar que envs ausentes desabilitam a notificação sem erro

## 4. Worker — retenção de pedidos em estado bloqueante

- [x] 4.1 No loop principal (`main`), antes de `proximo_pago`/`reivindicar`, consultar o estado
      de saúde corrente (reusando a coleta do ciclo) e, se bloqueante
      (`SEM_PAPEL`/`SEM_TONER`/`MANUTENCAO`/`INALCANCAVEL`), pular a reivindicação e dormir o
      ciclo — pedido `PAGO` permanece intacto, sem `ERRO`
- [x] 4.2 Garantir a recuperação automática: quando a razão some, o ciclo seguinte volta a
      reivindicar normalmente (sem toque manual além da reposição)

## 5. Testes offline do worker

- [x] 5.1 Testar o mapeamento de estados com saídas simuladas de `ipptool` (fixtures de
      `printer-state-reasons`/`marker-levels`): media-empty, toner-empty, media-jam+cover-open,
      múltiplas razões (checar prioridade), toner baixo e razão desconhecida (fail-safe)
- [x] 5.2 Testar transições e notificação: garantir que Telegram dispara só na entrada do
      problema e no `toner_baixo false→true`, e nunca a cada heartbeat do mesmo estado
- [x] 5.3 Testar degradação: sem `ipptool`, o worker mantém `OK/PAUSADA/INALCANCAVEL` e segue
      imprimindo; em estado bloqueante, o pedido `PAGO` não vira `ERRO`

## 6. Kiosk — faixa e aviso de toner

- [x] 6.1 Estender o union `EstadoImpressora` em `src/hooks/useImpressoraStatus.ts` com
      `SEM_PAPEL`/`SEM_TONER`/`MANUTENCAO` e selecionar/expor `detalhes` (toner_baixo,
      toner_pct, state_reasons) além de `estado`
- [x] 6.2 Estender `faixaImpressora` em `src/components/kiosk/status.ts` com ramos e cores para
      os novos estados (mensagens "…— a equipe já foi avisada"), mantendo `offline` prioritário
- [x] 6.3 Exibir o aviso discreto de toner baixo em `FaixaImpressora.tsx` quando
      `detalhes.toner_baixo`, ortogonal ao estado, sumindo quando voltar a `false`

## 7. Documentação e verificação no laboratório

- [x] 7.1 Atualizar `print-worker/README.md`: coleta IPP, pré-requisito `cups-ipp-utils`
      (`ipptool`), novos estados/`detalhes`, e envs `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`
- [x] 7.2 Atualizar `docs/web-to-print/kiosk.md`: novos estados exibidos na faixa e o aviso de
      toner baixo
- [x] 7.3 Verificação com a impressora real (HP Laser 135w, fila `Titans_Laser`): tirar papel
      da bandeja e observar o kiosk mudar para `SEM_PAPEL` e o alerta chegar no Telegram; repor
      e confirmar que um pedido `PAGO` pendente imprime sozinho; conferir `toner_pct` reportado
