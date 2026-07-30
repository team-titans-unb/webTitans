# Tasks: add-impressao-printer-status

## 1. Extrair lógica compartilhada do kiosk

- [x] 1.1 Mover `faixaImpressora()` e o tipo `FaixaImpressora` de `src/components/kiosk/status.ts` para um módulo neutro (ex.: `src/lib/impressora.ts`), mantendo reexport em `kiosk/status.ts` para não alterar os imports do kiosk
- [x] 1.2 Verificar que o kiosk continua compilando e se comportando igual (lint + `next build`; se houver testes de `status.ts`, seguem passando)

## 2. Faixa de status em /impressao

- [x] 2.1 Criar componente compacto `StatusImpressora` (ex.: `src/components/impressao/StatusImpressora.tsx`) que consome `useImpressoraStatus` e `faixaImpressora()`: cores semânticas do kiosk em escala shadcn (`text-sm`, ícone `Printer`), aviso de toner baixo quando `toner_baixo` for true, e sem render durante `isLoading`
- [x] 2.2 Incluir `StatusImpressora` em `src/views/Impressao.tsx` entre o parágrafo introdutório e o `BotaoOndeRetirar`, visível em todos os passos do checkout

## 3. Correção do cabeçalho

- [x] 3.1 Corrigir a sobreposição em `src/views/Impressao.tsx`: colocar o link "Voltar ao início" em linha própria acima do badge "Serviço de Impressão" (contêiner block ou `flex` no Link), conferindo em larguras mobile e desktop

## 4. Verificação

- [x] 4.1 Testar manualmente a página `/impressao` contra a tabela `impressora_status`: estado OK, um estado de problema (ex.: simular `SEM_PAPEL` na linha), heartbeat velho (>30 s ⇒ "Sistema de impressão offline") e atualização em tempo real com a página aberta
- [x] 4.2 Confirmar que o kiosk (`/kiosk`) permanece visualmente idêntico e que `next build` + lint passam
