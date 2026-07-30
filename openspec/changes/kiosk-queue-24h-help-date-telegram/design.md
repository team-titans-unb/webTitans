# Design: kiosk-queue-24h-help-date-telegram

## Context

O kiosk (`/kiosk`, Raspberry Pi com tela touch 1024×600) lê a fila da view `fila_publica`
(migration `0008_kiosk.sql`), que hoje filtra: `PAGO`/`IMPRIMINDO` sempre; `IMPRESSO` por
15 min após `printed_at`; `ERRO` por 60 min após `paid_at`. A tela idle em `KioskApp.tsx`
aparece quando a fila está **vazia** e há um re-idle de 60 s (`REIDLE_MS`) só válido com
fila vazia. O overlay Ajuda (`OverlayAjuda.tsx`) consulta `/api/kiosk/pedido` e mostra
"Impresso às HH:MM" via `formatarHorario` (`status.ts`). Já existe bot do Telegram
(`TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`) usado server-side para notificar a equipe de
chamados; o grupo de ajuda para clientes é um chat do Telegram com link de convite.

Restrições relevantes:
- O cleanup (`cleanup-fila`) mantém linhas `IMPRESSO` por 6 meses — janela de 24 h na view
  é segura. `ERRO` não é apagado pelo cleanup.
- `KioskQRCode` só monta URLs `https://roboticstitans.com.br<path>` — precisa aceitar URL
  absoluta para o convite `https://t.me/...`.
- Links de convite de grupo do Telegram (`t.me/+hash` ou `t.me/<username>`) **não aceitam
  texto pré-preenchido**; deep links com `?text=` só funcionam para chats diretos com
  usuários/bots (`t.me/<user>?text=`) e `t.me/share/url` exige escolher o destino
  manualmente. Portanto "entrar no grupo já enviando o protocolo" não é tecnicamente
  possível só com link de convite.

## Goals / Non-Goals

**Goals:**
- Fila pública exibindo pedidos concluídos (IMPRESSO/ERRO) das últimas 24 h.
- Tela idle disparada por inatividade (3 min sem toque), não mais por fila vazia.
- Datas não ambíguas: rótulos "hoje"/"ontem"/"dd/MM" na fila e na consulta de protocolo.
- Canal de ajuda humano: QR do convite do grupo Telegram no overlay Ajuda, com o protocolo
  digitado em destaque para a pessoa enviar ao entrar.

**Non-Goals:**
- Bot conversacional de ajuda no Telegram (deep link `t.me/bot?start=<protocolo>` fica
  como evolução futura; exigiria fluxo no bot e tira a pessoa do grupo).
- Mudanças nas APIs `/api/kiosk/*`, no worker ou no fluxo de pagamento.
- Paginação/virtualização da fila (24 h de pedidos são dezenas de linhas; a lista já rola).

## Decisions

### D1 — Janela de 24 h direto na view (nova migration `0010_fila_publica_24h.sql`)

`create or replace view public.fila_publica` mantendo colunas e `security_invoker`,
mudando só o `where`:

```sql
status in ('PAGO', 'IMPRIMINDO')
or (status = 'IMPRESSO' and printed_at > now() - interval '24 hours')
or (status = 'ERRO' and paid_at > now() - interval '24 hours')
```

*Por quê na view e não no client?* A view é o contrato público; filtrar no client exigiria
expor mais linhas ao `anon` do que o necessário. `create or replace` funciona porque as
colunas não mudam. ERRO passa a usar 24 h também (consistência: o cliente pode voltar no
dia seguinte para entender um erro).

*Alternativa rejeitada:* filtro `gte("printed_at", ...)` no `useFilaPublica` — duplicaria a
regra em dois lugares e deixaria a janela da view (15/60 min) mandando de qualquer forma.

### D2 — Idle por timer global de inatividade em `KioskApp.tsx`

Substituir a dupla `filaVazia`/`interagiu` por um timer de inatividade:

- Constante `IDLE_MS = 180_000` (3 min).
- Listener global `pointerdown` (capture, no container raiz) reseta o timer — vale para a
  tela principal e para overlays abertos.
- Timer expira → fecha overlay aberto (`setOverlay(null)`) e mostra a idle.
- Sai da idle: toque na idle (comportamento atual, via `onClick` para não vazar o toque)
  **ou** chegada de novo pedido ativo — detectada comparando a contagem de itens
  `PAGO`/`IMPRIMINDO` com a contagem anterior (ref); crescimento acorda a tela. Mudança
  para `IMPRIMINDO` também acorda (o cliente vê "está saindo agora").

*Por quê contagem de ativos e não `itens.length`?* Com janela de 24 h a fila quase nunca
fica vazia; `itens.length` mudaria quando um IMPRESSO velho sai da janela, acordando a
tela sem motivo.

*Interação com o auto-close de 60 s dos overlays:* mantido como está (spec
kiosk-client-view) — overlay abandonado fecha em 60 s e a idle chega aos 3 min totais.

### D3 — Data relativa em helper único (`formatarDataRelativa` em `status.ts`)

Novo helper puro ao lado de `formatarHorario`:

```
formatarDataRelativa(iso) → "hoje" | "ontem" | "dd/MM" | ""  (null/inválido → "")
```

Comparação por dia de calendário em horário local (o kiosk roda em America/Sao_Paulo,
mesmo fuso do negócio), não por intervalos de 24 h — "ontem 23:50" é ontem mesmo que faça
só 10 minutos. Consumidores:

- `rotuloHorarioFila`: "impresso ontem às 22:10" / "pago às 14:32" (omite "hoje" na fila
  para não poluir; só mostra a data quando **não** é hoje).
- `orientacao()` no `OverlayAjuda`: "Impresso hoje às 14:32" / "Impresso ontem às 22:10" /
  "Impresso em 12/07 às 09:15" (na consulta o "hoje" explícito é útil, pois o pedido pode
  ter dias).

*Alternativa rejeitada:* `Intl.RelativeTimeFormat` — formata "há 2 dias", não "ontem às
HH:MM", e complica o caso dd/MM.

### D4 — QR do Telegram como sub-painel do overlay Ajuda existente

- Env var `NEXT_PUBLIC_TELEGRAM_HELP_INVITE_URL` (link `https://t.me/+...`). Pública por
  natureza (qualquer um com o QR entra); botão não renderiza se ausente.
- `KioskQRCode` ganha prop alternativa `url` (absoluta) — `path` continua existindo para
  os usos atuais; exatamente um dos dois é aceito.
- Botão "Falar com a equipe no Telegram" ao final do overlay Ajuda (abaixo dos chamados).
  Toque abre um estado interno do overlay (não um segundo overlay — a spec exige um
  overlay por vez) com: QR grande, e, se `codigo.length === 8`, o protocolo em fonte mono
  grande + instrução "Ao entrar no grupo, envie este protocolo".
- Sem protocolo digitado, mostra só o QR + "Ao entrar, conte seu problema e, se tiver, o
  protocolo do pedido".

*Sobre a mensagem pré-preenchida:* impossível com link de convite (ver Context). A
mitigação é mostrar o protocolo na tela do QR para transcrição. Evolução futura possível:
bot com `?start=<protocolo>` que posta no grupo em nome do cliente.

## Risks / Trade-offs

- [Fila longa com 24 h de pedidos] → A lista já tem `overflow-y-auto`; o pedido
  `IMPRIMINDO` continua destacado no topo. Se a rolagem virar problema de UX no totem,
  tratar em change futura (ex.: colapsar IMPRESSO antigos), fora deste escopo.
- [Idle esconde a fila enquanto algo imprime] → Aceito por decisão de produto (3 min sem
  toque = ninguém olhando); a transição para `IMPRIMINDO` de um novo pedido acorda a tela
  (D2), então quem acabou de pagar vê o próprio pedido sair.
- [Link de convite do Telegram rotaciona/expira] → Env var permite trocar sem deploy de
  código (só restart); botão some se não configurada, sem estado quebrado.
- [Fuso do dispositivo errado quebraria "hoje/ontem"] → O kiosk é hardware controlado
  (Raspberry Pi com NTP e TZ America/Sao_Paulo); risco aceito, sem lógica de fuso extra.
- [`create or replace view` falhar por diferença de colunas] → As colunas não mudam;
  migration testável em dev com `supabase db push` antes de produção.

## Migration Plan

1. Aplicar `0010_fila_publica_24h.sql` no Supabase (SQL Editor ou `supabase db push`) —
   compatível com o frontend atual (só amplia a janela; frontend velho continua correto).
2. Deploy do frontend com as mudanças de kiosk + env `NEXT_PUBLIC_TELEGRAM_HELP_INVITE_URL`.
3. Rollback: reaplicar o `create or replace view` da 0008 (janela 15/60 min) e reverter o
   deploy; sem mudança de dados, rollback é trivial.

## Open Questions

- ~~Confirmar qual grupo do Telegram será usado~~ **Resolvido**: será um grupo novo,
  dedicado a clientes — separado do chat que recebe as notificações de chamados. O link
  de convite desse grupo novo vai em `NEXT_PUBLIC_TELEGRAM_HELP_INVITE_URL`.
