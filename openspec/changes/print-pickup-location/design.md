## Context

O checkout `/impressao` é uma view client-side (`src/views/Impressao.tsx`, montada por
`app/impressao/page.tsx` via `next/dynamic` sem SSR) com uma máquina de passos
`UPLOAD → CONFIG → PAGAMENTO → SUCESSO/TIMEOUT`. A `TelaSucesso` mostra o protocolo e um
botão "Voltar ao início". O projeto usa **Next.js App Router**, **shadcn/ui** (`Button`,
`Card`, `Badge`), ícones **lucide-react**, **sonner** para toasts, **Tailwind** com tokens
de marca (`titans-red`, `titans-orange`) e componentes prontos de galeria/carrossel
(`ScrollingImageGallery`, `ProjectHeroCarousel`, o `carousel` do shadcn/ui).

O local de retirada é **fixo e público**: Sala 207, Prédio LDTEA – FCTE Gama. Não há
necessidade de banco, autenticação ou estado dinâmico — a informação cabe em código/assets.

## Goals / Non-Goals

**Goals:**
- Dar ao cliente uma página clara de **onde retirar** a impressão, com endereço e fotos.
- Tornar essa página alcançável por um CTA "Onde Pegar Minha Impressão?" tanto no checkout
  quanto na tela de sucesso (pós-pagamento).
- Reaproveitar ao máximo os componentes/estilos existentes; **zero** novas dependências.
- Página estática, leve, responsiva e indexável (pode ser SSG/Server Component).

**Non-Goals:**
- Nenhum upload dinâmico de fotos, CMS ou edição via painel — fotos são commitadas em `public/`.
- Nada de mapa interativo/Google Maps embed nesta entrega (pode vir depois).
- Nenhuma alteração em pagamento, fila, RLS, Storage, webhook ou `print-worker`.
- Não vincular as fotos a um pedido específico — a página é genérica do local.

## Decisions

### 1. Rota dedicada `/impressao/retirada` (Server Component estático), não modal

Uma **rota própria** no App Router (`app/impressao/retirada/page.tsx`) em vez de um
modal/dialog. Rationale:
- Conteúdo **compartilhável** por URL (o cliente pode mandar o link para alguém que vai buscar).
- Pode ser **Server Component estático** (SSG) — diferente de `/impressao`, que é client-only
  por causa de pdfjs/Realtime/envs. A página de retirada não precisa de `"use client"` nem de
  `next/dynamic`, então é mais leve e indexável.
- O CTA vira um simples `next/link`, sem acoplar estado de modal à máquina de passos do checkout.

Alternativa considerada: **modal/dialog** dentro de `/impressao`. Rejeitada — não é
linkável, e exigiria estado extra na view client-side já complexa.

### 2. Local como constante tipada; fotos como assets estáticos em `public/`

O endereço fica em uma **constante** (ex.: `src/lib/retirada.ts` com `LOCAL_RETIRADA` e a
lista de `{ src, alt }`), e as imagens em `public/retirada/foto-1..4.jpg`. Rationale: fonte
única de verdade, fácil de evoluir, e a galeria itera sobre a lista (renderiza bem com 1–4
fotos). Placeholders (`/placeholder.svg`) cobrem o gap até as fotos reais existirem, sem
travar a entrega.

Alternativa considerada: hardcode espalhado no JSX. Rejeitada por duplicação e por dificultar
trocar fotos/endereço depois.

### 3. Galeria: reutilizar componente existente, não criar um novo

Reaproveitar um componente de galeria já no projeto. `ScrollingImageGallery` é o candidato
direto (recebe `{ src, alt }[]`), mas seu dimensionamento (`min-w-[640px]`, `h-96`) é pensado
para faixa horizontal larga; para 4 fotos de um local, um **grid responsivo simples** ou o
`carousel` do shadcn/ui pode encaixar melhor no mobile. Decisão de implementação: usar o
`carousel`/grid do shadcn/ui se o `ScrollingImageGallery` ficar largo demais no mobile —
mas **sem** criar um componente de galeria do zero.

### 4. CTA compartilhado entre checkout e tela de sucesso

Extrair um pequeno componente `BotaoOndeRetirar` (ou similar) reutilizado nos dois lugares,
para garantir rótulo/estilo/rota idênticos e evitar divergência. É um `Button asChild` +
`next/link href="/impressao/retirada"` com um ícone `MapPin` do lucide-react.

### 5. Apresentação do CTA — botão vs. card/banner (a pergunta do usuário)

**Recomendação:** apresentação **dependente do contexto**, com o mesmo destino:
- **No checkout `/impressao`:** um **CTA discreto** logo abaixo do subtítulo — botão
  `variant="outline"` com ícone `MapPin`. Discreto para não competir com o fluxo principal
  (upload → pagar), mas presente desde o início para quem só quer saber onde buscar.
- **Na tela de sucesso:** um **card/banner mais estiloso** com destaque — um bloco com ícone
  `MapPin`, o texto "Onde Pegar Minha Impressão?" e (opcionalmente) já um preview do endereço,
  usando o gradiente de marca (`from-titans-red to-titans-orange`). Esse é o momento de maior
  intenção do usuário (acabou de pagar e quer saber onde retirar), então merece destaque.

Resumo do trade-off: **botão** = mínimo esforço, consistente, baixa fricção visual;
**card/banner** = mais chamativo e informativo, ideal no pós-pagamento. A proposta entrega
**ambos** — botão no checkout, banner na sucesso — mantendo um único componente de CTA por baixo.

## Risks / Trade-offs

- [Fotos reais ainda não existem] → Usar `placeholder.svg` / imagens temporárias e abrir
  tarefa para substituir; a lista tipada torna a troca trivial e a galeria tolera 1–4 itens.
- [`ScrollingImageGallery` largo demais no mobile] → Fallback para grid responsivo ou
  `carousel` do shadcn/ui; validar visualmente no viewport pequeno antes de fechar.
- [Endereço pode mudar no futuro] → Constante única (`src/lib/retirada.ts`) isola a mudança a
  um arquivo.
- [Divergência de rótulo/rota entre os dois CTAs] → Mitigado pelo componente de CTA único
  compartilhado.

## Open Questions

- As 4 fotos finais (local/caminho até a Sala 207) serão fornecidas pela equipe? Até lá,
  placeholders.
- Vale incluir um link "Como chegar" (Google Maps) numa próxima iteração? Fora do escopo aqui.
