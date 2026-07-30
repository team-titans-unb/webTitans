# Design: add-kiosk-client-view

## Context

O web-to-print já tem: checkout em `/impressao` (upload → PIX → acompanhamento realtime),
tabela `fila_impressao` com ciclo `AGUARDANDO_PAGAMENTO → PAGO → IMPRIMINDO → IMPRESSO |
ERRO | CANCELADO` e Realtime habilitado (migration 0001), protocolo derivado do UUID
(`pedidoId.slice(0, 8).toUpperCase()` em `src/components/impressao/TelaSucesso.tsx`),
preços em `config_precos`, e um worker Python (`print-worker/worker.py`) rodando na sede
que já possui helpers de saúde da impressora (`fila_saudavel` via `lpstat -p`,
`fila_alcancavel` via resolução mDNS + TCP-connect) — mas não publica esse estado em lugar
nenhum.

Hardware alvo: Raspberry Pi 5 (8 GB) + tela touch, montada sobre a impressora na Sala 208.
A Pi exibirá a rota `/kiosk` (hospedada na Vercel) em Chromium kiosk e rodará o worker
localmente. Tela pequena → a UI precisa de hierarquia forte e pouca densidade por vez.

## Goals / Non-Goals

**Goals:**

- Rota `/kiosk` fullscreen, sem Header/Footer, com uma tela principal (fila + estado da
  impressora) e painéis sobrepostos (overlays) para ajuda, preços e QR code.
- Fila ao vivo anonimizada pelo protocolo existente, via Realtime + refetch.
- Estado da impressora visível ao cliente, alimentado pelo worker (heartbeat).
- Botão de ajuda com consulta por protocolo e registro de chamado com notificação.
- Tela idle com branding TITANS quando não há pedidos ativos.
- Interface fluida (transições/animações) — a Pi 5 tem GPU de sobra para isso.

**Non-Goals:**

- Reimpressão self-service (fluxo futuro; aqui o chamado apenas notifica a equipe).
- Autenticação/admin no kiosk — a rota é pública e somente leitura (exceto chamados).
- Telemetria de toner/suprimentos via IPP (pode entrar depois; o heartbeat já reserva um
  campo `detalhes jsonb` para isso).
- Provisionamento automatizado da Pi (documentamos manualmente; sem Ansible/imagem).

## Decisions

### D1 — Kiosk como rota do site (Vercel), não app local na Pi

A Pi só roda Chromium apontando para `https://<site>/kiosk`. Alternativa considerada:
servir um app local (Node/Electron) na Pi. Rejeitada — duplicaria build/deploy, perderia o
reuso de componentes/tokens do site e a Pi 5 exibe uma página remota com folga. Deploy de
UI vira um `git push` normal, sem tocar na Pi.

### D2 — Protocolo: reutilizar a derivação existente, extraída para helper

O protocolo mostrado em `TelaSucesso.tsx` (`id.slice(0, 8).toUpperCase()`) é a identidade
pública do pedido. Extraímos para `src/lib/protocolo.ts` (`protocoloDoPedido(id)`) e usamos
nos dois lugares. **Não** criamos coluna nova nem token dedicado — a fila pública expõe o
protocolo computado no próprio Postgres (`upper(left(id::text, 8))`), então o kiosk nunca
vê o UUID completo (que funciona como token de leitura do pedido — vazá-lo na tela seria
regressão de segurança).

### D3 — View `fila_publica` para a fila do kiosk

Nova view com `security_invoker = on` expondo só o necessário dos pedidos com status em
(`PAGO`, `IMPRIMINDO`, `IMPRESSO`-recente, `ERRO`-recente): `protocolo`, `status`,
`num_paginas`, `quantidade_copias`, `modo_cor`, `paid_at`, `printed_at`. Ordenação FIFO por
`paid_at` (mesmo critério do worker). Alternativa: o kiosk consultar `fila_impressao`
direto (o SELECT anon `using (true)` já permite). Rejeitada — acoplaria a UI a colunas
sensíveis (`mp_payment_id`, `pdf_path`) e a view documenta o contrato público mínimo.
IMPRESSO/ERRO aparecem por uma janela curta (ex.: 15 min pós-`printed_at`) para o cliente
ver seu pedido concluir, sem poluir a fila.

**Realtime**: Supabase Realtime não emite eventos de views. O kiosk assina
`postgres_changes` na tabela `fila_impressao` (INSERT/UPDATE) apenas como *gatilho* e
refaz o fetch da view — payload ignorado. Polling de fallback (ex.: 30 s) cobre perda de
conexão, mesmo padrão híbrido de `usePedidoStatus.ts`.

### D4 — Estado da impressora: heartbeat do worker em `impressora_status`

Tabela singleton (uma linha por fila CUPS): `fila text pk`, `estado text` (`OK`,
`IMPRIMINDO`, `PAUSADA`, `INALCANCAVEL`), `detalhes jsonb`, `atualizado_em timestamptz`.
A cada ciclo de poll (10 s) o worker faz upsert reutilizando `fila_saudavel` +
`fila_alcancavel` já existentes — custo marginal zero, sem novo processo. O kiosk deriva:

- `atualizado_em` mais velho que `3 × POLL_INTERVAL` → "Sistema de impressão offline"
  (worker/Pi caiu), independente do valor de `estado`;
- senão, mostra o `estado` reportado.

Alternativa: o kiosk consultar o CUPS localmente (ele roda na mesma Pi). Rejeitada — a
página vem da Vercel e não tem como falar com `localhost` do CUPS sem um serviço local
extra (violaria D1); e o heartbeat também beneficia a equipe remotamente. A escrita usa a
service_role que o worker já possui; falha no upsert é logada e **nunca** interrompe o
ciclo de impressão (try/except em volta, best-effort).

### D5 — Ajuda: consulta por protocolo + chamado via API route

Overlay de ajuda em dois passos:

1. **Consulta**: teclado touch próprio (8 teclas hex não bastam — protocolo usa `[0-9a-f]`;
   um teclado de 16 teclas + backspace resolve sem teclado de SO). Busca server-side via
   nova API route `GET /api/kiosk/pedido?protocolo=` que consulta por prefixo
   (`id::text like '<protocolo lower>%'`) com service_role e retorna somente
   `{status, paid_at, printed_at, posicao_na_fila}`. Busca por prefixo no servidor evita
   expor um índice de UUIDs ao anon e trata colisão (retorna o mais recente).
2. **Chamado**: botão "Chamar a equipe" → `POST /api/kiosk/help` com protocolo opcional +
   categoria (ex.: "não saiu", "saiu com defeito", "outro"). A route insere em
   `chamados_ajuda` (id, protocolo, categoria, criado_em, resolvido_em null) com
   service_role e, se `TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHAT_ID` estiverem configuradas, envia mensagem
   via Bot API do Telegram, best-effort. Rate-limit simples: rejeitar novo chamado idêntico
   (mesmo protocolo/categoria) dentro de 5 min, para evitar toque repetido.

Alternativa: INSERT anon direto na tabela + Edge Function de notificação. Rejeitada — API
routes já são o padrão server-side do projeto (`create-pix`, webhook MP) e concentram
segredo do webhook + rate-limit num lugar só. `chamados_ajuda` fica sem nenhuma policy anon
(negado por padrão), como `fila_impressao` para UPDATE/DELETE.

### D6 — Estrutura da UI: uma tela, overlays e idle

- `app/kiosk/page.tsx` + `app/kiosk/layout.tsx` (layout próprio: fundo escuro, sem
  Header/Footer/ScrollToTop, `touch-action: manipulation`, cursor oculto).
- Tela principal: coluna esquerda = "Imprimindo agora" em destaque + fila (cards com
  protocolo, páginas, cor, status com cor semântica); rodapé/faixa = estado da impressora;
  barra inferior = 3 botões grandes (Ajuda, Preços, Imprimir — QR).
- Overlays: painel único reutilizável (`KioskOverlay`) que desliza sobre a tela com fundo
  escurecido e X grande no canto — conteúdo: Ajuda | Preços (lê `config_precos`, reusa
  formatação de `src/lib/pricing.ts`) | QR (usa `qrcode.react`, já dependência, apontando
  para `/impressao`).
- **Idle**: sem pedidos ativos → tela de branding TITANS (gradiente
  `titans-red → titans-orange`, logo, animação sutil) com QR e chamada "Imprima aqui".
  Qualquer toque volta à tela principal.
- **Auto-retorno**: overlay aberto sem interação por 60 s fecha sozinho (totem público não
  pode ficar preso numa tela de ajuda abandonada).
- Animações via CSS transitions/`framer-motion` se já presente — checar; caso contrário,
  CSS puro (evitar dependência nova).

### D7 — Provisionamento da Pi documentado, não automatizado

Página `docs/web-to-print/kiosk.md`: Chromium `--kiosk` no Wayland/labwc, desligar
blanking, unit systemd com `Restart=always` (watchdog), coexistência com o
`print-worker.service` existente, e nota térmica da Pi 5 (dissipador). Sem código de infra
no repo além do exemplo de unit.

## Risks / Trade-offs

- [Realtime como gatilho + refetch gera 1 query por evento] → fila pequena (dezenas de
  linhas), view barata; debounce de 1 s no cliente agrupa rajadas.
- [Heartbeat acrescenta escrita a cada 10 s no Supabase] → 1 upsert/ciclo é desprezível
  no free tier; se preocupar, gravar só em mudança de estado + a cada N ciclos.
- [Chromium na Pi pode travar/varar memória com o site pesado] → rota `/kiosk` importa só
  os componentes do kiosk (sem Header/Footer/imagens pesadas); systemd reinicia o browser;
  Pi 5 8 GB dá folga.
- [Protocolo de 8 hex digitado errado / colisão de prefixo] → teclado touch restrito a
  `[0-9A-F]`; servidor resolve colisão pelo pedido mais recente e responde "não
  encontrado" claramente.
- [Webhook de notificação fora do ar] → chamado sempre persiste na tabela; webhook é
  best-effort e a equipe pode consultar `chamados_ajuda` direto.
- [View exposta ao anon amplia superfície] → view minimiza (vs. tabela já legível hoje);
  na prática **reduz** a superfície recomendada e prepara terreno para apertar o SELECT
  anon da tabela no futuro (fora do escopo desta change).

## Migration Plan

1. Migration `0008_kiosk.sql`: view `fila_publica`, tabelas `impressora_status` e
   `chamados_ajuda`, policies (anon: SELECT na view e em `impressora_status`; nada em
   `chamados_ajuda`).
2. Deploy do worker atualizado (heartbeat) — retrocompatível; se a migration ainda não
   rodou, o upsert falha com log e o worker segue imprimindo.
3. Deploy do site com `/kiosk` + API routes (vars: `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` opcionais).
4. Provisionar a Pi 5 (Chromium kiosk + worker) conforme `docs/web-to-print/kiosk.md`.

Rollback: remover rota/route handlers (UI é aditiva); worker tolera a ausência da tabela;
migration pode ficar (objetos inertes) ou ser revertida com `drop`.

## Open Questions

- Janela de exibição de IMPRESSO/ERRO na fila pública: 15 min é bom padrão? (decidir na
  implementação; parametrizável na view por `printed_at`).
- Canal de notificação: Telegram (Bot API), definido por env.
