# Proposal: add-impressao-printer-status

## Why

Membros que imprimem de fora do laboratório usam a página `/impressao` sem nenhuma visibilidade do estado da impressora — podem pagar via PIX e só depois descobrir que a impressora está sem papel, sem toner ou offline. O kiosk (`/kiosk`) já exibe esse status em tempo real a partir da tabela `impressora_status` publicada pelo worker; basta levar a mesma informação ao checkout. Além disso, há um defeito visual na página: o badge "Serviço de Impressão" fica na mesma linha do link "Voltar ao início" (ambos são elementos inline), sobrepondo/colidindo os textos.

## What Changes

- Exibir na página `/impressao` uma faixa de status da impressora com o mesmo estado publicado no kiosk (pronta, imprimindo, pausada, sem papel, sem toner, manutenção, indisponível, sistema offline), atualizada em tempo real via Supabase Realtime com fallback de polling — reutilizando `useImpressoraStatus` e a lógica de rótulo/cor de `faixaImpressora`, hoje acoplados a `src/components/kiosk/`.
- Posicionar a faixa antes do fluxo de pagamento (visível já no passo de upload/configuração), para que o membro veja o estado da impressora **antes** de pagar. O status é informativo: não bloqueia o checkout.
- Corrigir o layout do cabeçalho da página `/impressao`: o link "Voltar ao início" e o badge "Serviço de Impressão" devem ocupar linhas separadas, sem sobreposição.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `web-to-print-checkout`: novo requisito — a página `/impressao` exibe o estado atual da impressora (mesma fonte do kiosk: `impressora_status` + heartbeat) antes do pagamento; e o cabeçalho da página não pode sobrepor o link "Voltar ao início" com o badge "Serviço de Impressão".

## Impact

- **Código afetado**:
  - `src/views/Impressao.tsx` — inclusão da faixa de status e correção do layout do cabeçalho.
  - `src/components/kiosk/FaixaImpressora.tsx` e `src/components/kiosk/status.ts` — a lógica de estado→rótulo/cor é compartilhada; provável extração/adaptação para uso fora do kiosk (o visual do kiosk é dimensionado para totem, `/impressao` precisa de uma variante compacta compatível com o design system shadcn da página).
  - `src/hooks/useImpressoraStatus.ts` — reutilizado sem mudança de comportamento (queryKey hoje prefixada com "kiosk", detalhe de implementação).
- **Dados/serviços**: nenhuma mudança em banco, worker ou APIs — apenas leitura da tabela `impressora_status` já existente (RLS de leitura pública já habilitada para o kiosk).
- **Specs**: delta em `web-to-print-checkout`; `kiosk-client-view` permanece intacta.
