# Design: add-impressao-printer-status

## Context

O worker de impressão publica o estado da impressora na tabela `impressora_status` (linha única com `estado`, `atualizado_em`, `detalhes`) e o kiosk (`/kiosk`) já consome esse dado por três peças:

- `src/hooks/useImpressoraStatus.ts` — hook com React Query + Realtime + tick local que deriva `offline` quando o heartbeat envelhece (>30 s).
- `src/components/kiosk/status.ts` → `faixaImpressora()` — mapeia estado → texto amigável + classes de cor.
- `src/components/kiosk/FaixaImpressora.tsx` — componente visual da faixa, dimensionado para totem (texto `text-xl`, padding grande), incluindo o aviso ortogonal de toner baixo.

A página `/impressao` (`src/views/Impressao.tsx`) é o checkout web e hoje não mostra nada sobre a impressora. Ela também tem um defeito de layout: o `Link` "Voltar ao início" (`inline-flex`) e o `Badge` "Serviço de Impressão" (shadcn, também inline) são irmãos inline, então renderizam na mesma linha e os textos colidem/sobrepõem.

Restrições: nenhuma mudança em banco, RLS ou worker — a leitura pública de `impressora_status` já existe para o kiosk. A página `/impressao` é client-only (carregada com `ssr: false`), então o hook funciona sem ajuste.

## Goals / Non-Goals

**Goals:**
- Mostrar em `/impressao` o mesmo estado da impressora exibido no kiosk, em tempo real, antes do passo de pagamento.
- Reutilizar hook e lógica de mapeamento existentes — uma única fonte de verdade para estado → rótulo/cor.
- Corrigir a sobreposição "Serviço de Impressão" / "Voltar ao início" no cabeçalho da página.

**Non-Goals:**
- Bloquear ou desencorajar o checkout quando a impressora está com problema (o status é informativo; a fila continua aceitando pedidos).
- Mudanças no worker, no schema do banco ou no kiosk (comportamento do kiosk permanece idêntico).
- Exibir fila/pedidos em `/impressao` (já coberto pelo kiosk e pela tela de sucesso).

## Decisions

1. **Promover a lógica compartilhada para fora de `kiosk/`.** Mover (ou reexportar) `faixaImpressora()` — e o tipo `FaixaImpressora` — de `src/components/kiosk/status.ts` para um módulo neutro (ex.: `src/lib/impressora.ts` ou `src/components/impressora/`), mantendo `kiosk/status.ts` importando de lá para não tocar o kiosk. Alternativa rejeitada: importar diretamente de `components/kiosk/` na página de checkout — funciona, mas cimenta um acoplamento invertido (checkout dependendo do kiosk) e dificulta evolução visual independente.

2. **Novo componente compacto `StatusImpressora` para o checkout, em vez de reutilizar `FaixaImpressora`.** O componente do kiosk é dimensionado para totem visto a distância; o checkout precisa de uma faixa discreta no idioma visual shadcn da página (tamanho `text-sm`, ícone `Printer`, mesmas cores semânticas vindas de `faixaImpressora()`). Reutilizamos a *lógica*, não o *markup*. Alternativa rejeitada: parametrizar `FaixaImpressora` com prop de variante — dois contextos visuais muito diferentes num componente só tende a virar `if` de estilo.

3. **Mesmo comportamento de dados do kiosk: `useImpressoraStatus` sem alterações.** O hook já cobre Realtime + polling de 15 s + detecção de heartbeat velho. A queryKey `["kiosk", "impressora-status"]` é detalhe interno e pode ficar como está (ou ser renomeada para neutra — decisão de implementação sem efeito observável, já que kiosk e checkout nunca coabitam a mesma árvore React).

4. **Posição: entre o parágrafo introdutório e o `BotaoOndeRetirar`, visível em todos os passos.** O membro vê o estado antes do upload e continua vendo durante configuração/pagamento. Enquanto `isLoading`, não renderizar nada (evita flash de "offline" antes do primeiro fetch). Exibir também o aviso de toner baixo quando `toner_baixo` for true, igual ao kiosk.

5. **Correção do cabeçalho: tornar o `Link` um bloco próprio.** Trocar a estrutura para que "Voltar ao início" fique em linha exclusiva (ex.: envolver o `Link` num contêiner block, ou usar `flex` no lugar de `inline-flex` no próprio Link). É a correção mínima; não redesenhamos o cabeçalho.

## Risks / Trade-offs

- [Status desatualizado assusta o usuário na hora do pagamento] → O hook já mitiga com Realtime + polling + heartbeat de 30 s; o texto "equipe avisada" das mensagens existentes reduz atrito.
- [Usuário paga mesmo com impressora indisponível] → Aceito por decisão de produto: a fila persiste e o pedido é impresso quando a impressora voltar. O status visível antes do PIX é exatamente a mitigação que esta mudança introduz.
- [Refatoração de `status.ts` quebrar o kiosk] → Mudança é só de localização (move + reexport); cobertura: verificação manual do kiosk + `next build`/lint. Testes existentes de `status.ts`, se houver, seguem passando pois a API não muda.
- [Mais uma assinatura Realtime por visitante de /impressao] → Custo marginal no Supabase; mesmo padrão já usado por `usePedidoStatus` na própria página durante o pagamento.
