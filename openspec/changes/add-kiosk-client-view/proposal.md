# Proposal: add-kiosk-client-view

## Why

No fluxo atual do web-to-print, o cliente paga, recebe um protocolo e apenas confia que a
impressão vai sair: no local de retirada (Sala 208) não há nenhuma informação visual sobre a
fila, o estado da impressora ou um canal de ajuda quando algo dá errado. Temos uma Raspberry
Pi 5 (8 GB) com tela touch instalada sobre a impressora, ociosa, que pode virar um totem de
autoatendimento e elevar a percepção de qualidade do serviço.

## What Changes

- Nova rota pública `/kiosk` (fullscreen, sem Header/Footer) desenhada para a tela touch da
  Pi: fila de impressão ao vivo, estado da impressora e botões que abrem painéis sobrepostos
  (overlays com X para fechar) — ajuda, tabela de preços e QR code para nova impressão —
  mantendo a tela principal limpa.
- Fila ao vivo identificada pelo **protocolo já existente** (primeiros 8 caracteres do UUID
  do pedido, como em `TelaSucesso.tsx`), sem nome de arquivo nem dados sensíveis; atualização
  via Supabase Realtime já habilitado na `fila_impressao`.
- Tela idle com branding TITANS quando não há pedidos ativos, com QR code em destaque para
  iniciar uma nova impressão.
- O print-worker (que já consulta o estado da fila CUPS via `lpstat`, mas não publica isso)
  passa a gravar um heartbeat com o estado da impressora numa nova tabela
  `impressora_status`, consumida pelo kiosk (online / imprimindo / pausada / inalcançável,
  com detecção de worker parado por heartbeat velho).
- Botão de ajuda: overlay onde o cliente digita o protocolo e vê o status real do seu pedido
  com orientação por estado, e pode acionar a equipe — o chamado é registrado numa nova
  tabela `chamados_ajuda` via API route server-side, com notificação opcional via
  Bot API do Telegram, configurada por variáveis de ambiente.
- Nova view `fila_publica` no Postgres expondo apenas colunas não sensíveis da fila
  (protocolo derivado, status, páginas, cópias, modo de cor), para o kiosk não depender do
  SELECT amplo do `anon` na tabela inteira.

Sem breaking changes: nenhum fluxo existente (checkout, webhook, worker, limpeza) muda de
contrato; o worker apenas ganha uma escrita adicional.

## Capabilities

### New Capabilities

- `kiosk-client-view`: a interface do totem em `/kiosk` — fila ao vivo com protocolo,
  indicador de estado da impressora, tela idle com branding, overlays de preços e QR code
  para nova impressão, comportamento touch (auto-retorno à tela principal por inatividade).
- `kiosk-help-requests`: o fluxo de ajuda — consulta de pedido por protocolo com orientação
  por status, registro de chamados na tabela `chamados_ajuda` via API route e notificação
  opcional da equipe por webhook.

### Modified Capabilities

- `print-worker`: novo requisito de publicar heartbeat do estado da impressora
  (`impressora_status`) a cada ciclo, sem alterar o fluxo de impressão exactly-once.
- `print-queue-storage`: novos objetos de banco — view `fila_publica`, tabelas
  `impressora_status` e `chamados_ajuda` com RLS (anon somente leitura na view e no status;
  chamados só via service_role).

## Impact

- **Frontend**: novas páginas/componentes em `app/kiosk/` e `src/components/kiosk/`; reuso
  de `qrcode.react` (já dependência), tokens `titans-red`/`titans-orange` do Tailwind,
  padrão de Realtime + polling de `usePedidoStatus.ts` e derivação de protocolo de
  `TelaSucesso.tsx` (extraída para helper compartilhado em `src/lib/`).
- **Backend**: nova API route `app/api/kiosk/help` (mesmo padrão server-side de
  `create-pix`); nova migration `0008` (view + 2 tabelas + RLS + realtime).
- **Worker**: `print-worker/worker.py` ganha upsert de heartbeat por ciclo, reutilizando os
  helpers `lpstat` existentes.
- **Infra local**: a Pi 5 roda Chromium em modo kiosk apontando para a rota hospedada na
  Vercel; documentação de provisionamento (systemd + kiosk + watchdog) em
  `docs/web-to-print/`.
- **Dependências**: nenhuma nova no frontend; nenhuma nova no worker.
