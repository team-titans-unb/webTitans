# Tasks: add-kiosk-client-view

## 1. Banco de dados (migration 0008)

- [x] 1.1 Criar `supabase/migrations/0008_kiosk.sql` com a view `fila_publica`
      (protocolo `upper(left(id::text, 8))`, status, num_paginas, quantidade_copias,
      modo_cor, paid_at, printed_at; filtro PAGO/IMPRIMINDO + IMPRESSO/ERRO em janela
      curta; ordem `paid_at asc`) e grant de SELECT para `anon`
- [x] 1.2 Na mesma migration, criar `impressora_status` (fila pk, estado com check,
      detalhes jsonb, atualizado_em) com RLS: SELECT anon, escrita só service_role, e
      adicionar à publicação `supabase_realtime`
- [x] 1.3 Na mesma migration, criar `chamados_ajuda` (id, protocolo, categoria com
      check, criado_em, resolvido_em) com RLS habilitado e nenhuma policy anon
- [x] 1.4 Rodar a migration no Supabase e verificar: SELECT anon na view e em
      impressora_status funciona; INSERT anon em chamados_ajuda é negado

## 2. Worker — heartbeat da impressora

- [x] 2.1 Em `print-worker/worker.py`, adicionar função de heartbeat que deriva o estado
      (`OK`/`IMPRIMINDO`/`PAUSADA`/`INALCANCAVEL`) reutilizando `fila_saudavel` e
      `fila_alcancavel`, e faz upsert best-effort em `impressora_status` (try/except com
      log; nunca interrompe o ciclo)
- [x] 2.2 Chamar o heartbeat uma vez por ciclo de poll (incluindo ciclos ociosos) e
      gravar `IMPRIMINDO` enquanto houver pedido reivindicado
- [x] 2.3 Testar localmente: worker com tabela ausente segue imprimindo (só loga);
      estados mudam ao desabilitar a fila CUPS e ao derrubar a impressora da rede
- [x] 2.4 Atualizar `print-worker/README.md` com a nova escrita e permissão necessária

## 3. Helpers e API routes

- [x] 3.1 Extrair a derivação do protocolo para `src/lib/protocolo.ts`
      (`protocoloDoPedido(id)`) e usar em `TelaSucesso.tsx` sem mudança de comportamento
- [x] 3.2 Criar `app/api/kiosk/pedido/route.ts` (GET): valida protocolo (8 hex), busca
      por prefixo com service_role, resolve colisão pelo mais recente, calcula
      posição na fila e responde `{ status, paid_at, printed_at, posicao_na_fila }`
- [x] 3.3 Criar `app/api/kiosk/help/route.ts` (POST): valida categoria, aplica
      rate-limit de 5 min por protocolo+categoria, insere em `chamados_ajuda` e dispara
      Telegram Bot API best-effort (falha não bloqueia nem erra a resposta)
- [x] 3.4 Documentar `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` no `.env.local.example` e configurar na Vercel

## 4. Kiosk — dados e tela principal

- [x] 4.1 Criar `app/kiosk/layout.tsx` (fullscreen, fundo escuro, sem
      Header/Footer/ScrollToTop, touch-action, cursor oculto) e `app/kiosk/page.tsx`
- [x] 4.2 Criar hook `src/hooks/useFilaPublica.ts`: fetch da view + assinatura realtime
      em `fila_impressao` como gatilho de refetch (debounce ~1 s) + polling de fallback
- [x] 4.3 Criar hook `src/hooks/useImpressoraStatus.ts`: leitura + realtime de
      `impressora_status`, derivando "offline" quando `atualizado_em` > 3× heartbeat
- [x] 4.4 Componentes da tela principal em `src/components/kiosk/`: card "Imprimindo
      agora" em destaque, lista da fila (protocolo, páginas, cópias, cor, status com cor
      semântica) com transições de entrada/saída, e faixa de estado da impressora
- [x] 4.5 Barra inferior com os 3 botões grandes (Ajuda, Preços, Imprimir/QR)

## 5. Kiosk — overlays e idle

- [x] 5.1 Criar `KioskOverlay` reutilizável: painel sobreposto com fundo escurecido,
      X grande, animação de entrada/saída, exclusividade (um por vez) e auto-fechamento
      após 60 s sem interação
- [x] 5.2 Overlay de preços lendo `config_precos` com formatação BRL reutilizada de
      `src/lib/pricing.ts`
- [x] 5.3 Overlay "Imprimir" com QR code (`qrcode.react`) apontando para `/impressao` e
      instrução curta
- [x] 5.4 Overlay de ajuda: teclado touch hex (0-9/A-F + apagar), consulta via
      `/api/kiosk/pedido`, orientação por status e botão "Chamar a equipe" via
      `/api/kiosk/help` com confirmação e tratamento de duplicado
- [x] 5.5 Tela idle: sem pedidos visíveis → branding TITANS (gradiente
      titans-red→titans-orange, logo, animação sutil) com QR em destaque; toque ou novo
      pedido retorna à tela principal

## 6. Verificação e provisionamento

- [x] 6.1 Verificação end-to-end em resolução da tela touch: criar pedido de teste,
      acompanhar PAGO→IMPRIMINDO→IMPRESSO no kiosk, consultar protocolo na ajuda e
      registrar um chamado (conferir linha na tabela e webhook)
- [x] 6.2 Escrever `docs/web-to-print/kiosk.md`: Chromium --kiosk no Wayland/labwc,
      desligar screen blanking, unit systemd com Restart=always, coexistência com
      print-worker.service, nota térmica da Pi 5
- [ ] 6.3 Provisionar a Pi 5 conforme o doc e validar recuperação automática após
      queda de energia (reboot → kiosk volta sozinho)
