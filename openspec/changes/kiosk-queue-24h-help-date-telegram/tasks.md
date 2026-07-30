## 1. Banco — janela de 24 h na view (delicado: contrato público / RLS — implementar com Fable 5)

- [x] 1.1 Criar `supabase/migrations/0010_fila_publica_24h.sql` com `create or replace view public.fila_publica` mantendo colunas e `security_invoker = on`, mudando o `where` para: `PAGO`/`IMPRIMINDO` sempre; `IMPRESSO` com `printed_at > now() - interval '24 hours'`; `ERRO` com `paid_at > now() - interval '24 hours'`
- [x] 1.2 Aplicar a migration no ambiente Supabase (SQL Editor ou `supabase db push`) e conferir com um `select` que pedidos IMPRESSO de horas atrás aparecem e os de mais de 24 h não

## 2. Helpers de data relativa (simples — pode delegar a Opus/Sonnet)

- [x] 2.1 Adicionar `formatarDataRelativa(iso)` em `src/components/kiosk/status.ts`: retorna `"hoje"`, `"ontem"`, `"dd/MM"` ou `""` (null/inválido), comparando por dia de calendário no horário local
- [x] 2.2 Atualizar `rotuloHorarioFila` para incluir a data quando o timestamp não for de hoje (ex.: "impresso ontem às 22:10", "pago em 12/07 às 09:15"); itens de hoje continuam só com horário

## 3. Idle por inatividade em KioskApp (lógica central do totem — implementar com Fable 5)

- [x] 3.1 Substituir em `src/components/kiosk/KioskApp.tsx` a lógica `filaVazia`/`interagiu` por timer global de inatividade: `IDLE_MS = 180_000`, listener `pointerdown` em capture no container raiz resetando o timer (cobre tela principal e overlays)
- [x] 3.2 Ao expirar o timer: fechar overlay aberto (`setOverlay(null)`) e exibir `IdleScreen`; toque na idle volta à tela principal (manter `onClick` para o toque não vazar aos botões)
- [x] 3.3 Acordar da idle quando a contagem de pedidos ativos (`PAGO`/`IMPRIMINDO`) crescer ou um pedido transicionar para `IMPRIMINDO` (comparação com ref da fila anterior); garantir que a saída de um `IMPRESSO` velho da janela NÃO acorda a tela

## 4. Data na consulta de protocolo (simples — pode delegar a Opus/Sonnet)

- [x] 4.1 Em `src/components/kiosk/OverlayAjuda.tsx`, usar `formatarDataRelativa` no caso `IMPRESSO` de `orientacao()`: "Impresso hoje às HH:MM" / "Impresso ontem às HH:MM" / "Impresso em dd/MM às HH:MM"

## 5. QR do grupo de ajuda no Telegram (simples — pode delegar a Opus/Sonnet)

- [x] 5.1 Estender `src/components/kiosk/KioskQRCode.tsx` para aceitar prop alternativa `url` (absoluta, ex.: `https://t.me/+...`), mantendo `path` para os usos atuais
- [x] 5.2 Adicionar botão "Falar com a equipe no Telegram" ao final do `OverlayAjuda`, renderizado apenas se `NEXT_PUBLIC_TELEGRAM_HELP_INVITE_URL` estiver definida; toque alterna um painel interno (sem segundo overlay) com o QR do convite
- [x] 5.3 No painel do QR: se `codigo.length === 8`, exibir o protocolo em fonte mono grande com "Ao entrar no grupo, envie este protocolo"; sem protocolo, instrução genérica de descrever o problema
- [x] 5.4 Documentar `NEXT_PUBLIC_TELEGRAM_HELP_INVITE_URL` no `.env.example` (ou equivalente do projeto) e definir o valor no ambiente do kiosk/Vercel

## 6. Verificação no totem

- [ ] 6.1 Rodar o kiosk e verificar: fila mostra IMPRESSO/ERRO das últimas 24 h com rótulo "ontem"/"dd/MM" quando aplicável; idle aparece após 3 min sem toque mesmo com fila cheia; toque e novo pedido ativo acordam a tela
- [ ] 6.2 Verificar overlay Ajuda: consulta mostra data relativa correta (hoje/ontem/dd/MM); botão Telegram abre QR legível na tela 1024×600, com e sem protocolo digitado; botão some sem a env var
