# Proposal: kiosk-queue-24h-help-date-telegram

## Why

O kiosk hoje esconde pedidos concluídos rápido demais (IMPRESSO some em 15 min, ERRO em 60 min), então um cliente que volta horas depois não encontra seu pedido na fila e não tem como confirmar visualmente que ele saiu. Além disso, a consulta por protocolo mostra só o horário ("Impresso às 14:32") — ambíguo quando o pedido é de ontem — e o único canal de ajuda é o botão de chamado, sem um caminho direto de conversa com a equipe.

## What Changes

- **Fila de 24 horas**: a view `fila_publica` passa a exibir pedidos `IMPRESSO`/`ERRO` das últimas 24 horas (hoje: 15/60 min). Pedidos `PAGO`/`IMPRIMINDO` continuam sempre visíveis.
- **Rótulo de data na fila**: como a fila agora cruza a meia-noite, itens de ontem indicam a data no rótulo de horário (ex.: "impresso ontem às 22:10") para não parecerem de hoje.
- **Idle por inatividade (3 min)**: a tela idle (branding TITANS + QR) deixa de depender de fila vazia — ela aparece após 3 minutos sem toque na tela, mesmo com pedidos na fila. Qualquer toque ou a chegada de um novo pedido ativo retorna à fila. (Hoje o idle só aparece com fila vazia, o que nunca aconteceria com janela de 24h.)
- **Data na consulta de protocolo**: a orientação do pedido `IMPRESSO` no overlay Ajuda passa a incluir a data relativa: "Impresso hoje às 14:32", "Impresso ontem às 22:10" ou "Impresso em 12/07 às 09:15" para mais antigos.
- **QR code do grupo de ajuda no Telegram**: novo botão no overlay Ajuda que abre um QR code com o link de convite do grupo de ajuda no Telegram. Se um protocolo estiver digitado, ele é exibido em destaque junto ao QR com instrução de enviá-lo no grupo ao entrar (links de convite do Telegram não suportam mensagem pré-preenchida — ver design).

## Capabilities

### New Capabilities

(nenhuma — as mudanças estendem capabilities existentes)

### Modified Capabilities

- `kiosk-client-view`: janela de exibição da fila muda de 15/60 min para 24 h; requisito da tela idle muda de "quando a fila está vazia" para "após 3 min de inatividade"; rótulo de horário dos itens da fila ganha data relativa quando o pedido não é de hoje.
- `kiosk-help-requests`: orientação do status `IMPRESSO` passa a incluir data relativa (hoje/ontem/dd/MM) além do horário; novo requisito de QR code de convite ao grupo de ajuda no Telegram, com exibição do protocolo digitado como mitigação da ausência de mensagem pré-preenchida.

## Impact

- **Banco (Supabase)**: nova migration recriando a view `fila_publica` com janela de 24 h (`create or replace view` não basta se a ordem das colunas mudar; a view atual não muda colunas, só o `where`). A retenção do cleanup (linhas IMPRESSO vivem 6 meses) já comporta 24 h. A policy `fila_impressao_anon_select` continua a mesma (security_invoker).
- **Frontend kiosk**: `KioskApp.tsx` (lógica de idle reescrita: timer global de inatividade em vez de fila vazia), `status.ts` (helper de data relativa + rótulo da fila), `OverlayAjuda.tsx` (texto com data + botão/painel do QR Telegram), `KioskQRCode.tsx` (aceitar URL absoluta externa, hoje só aceita path do site).
- **Configuração**: nova env var pública com o link de convite do grupo (ex.: `NEXT_PUBLIC_TELEGRAM_HELP_INVITE_URL`); botão só aparece se configurada.
- **APIs**: nenhuma mudança — `/api/kiosk/pedido` já retorna `printed_at` ISO completo; a formatação de data é client-side.
- **Sem breaking changes**: contratos de API e colunas da view permanecem os mesmos.
