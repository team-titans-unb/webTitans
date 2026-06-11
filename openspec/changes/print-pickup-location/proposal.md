## Why

Hoje o checkout de impressão informa ao cliente que ele deve "retirar na sede", mas
nenhuma tela diz **onde** fica essa sede nem mostra como chegar. O cliente paga, recebe o
protocolo e fica sem referência visual do local de retirada — o que gera dúvidas e idas e
vindas com a equipe. O local é fixo e conhecido (Sala 207, Prédio LDTEA – FCTE Gama), então
basta uma página informativa com endereço e fotos para resolver isso de forma autônoma.

## What Changes

- **Nova página de local de retirada** (rota estática do App Router, `/impressao/retirada`)
  que exibe o local fixo **"Sala 207, Prédio LDTEA – FCTE Gama"** e uma galeria de **até 4
  fotos** do local/caminho. As fotos são **assets estáticos** em `public/` — sem upload
  dinâmico, sem Supabase, sem banco.
- **CTA "Onde Pegar Minha Impressão?"** adicionado em **dois pontos** do fluxo:
  1. na página de checkout `/impressao` (visível desde o início, antes mesmo de pagar);
  2. na **tela de sucesso** (`TelaSucesso`, exibida após o pagamento aprovado / protocolo).
- O CTA é um **link de navegação** (`next/link`) para `/impressao/retirada`, reaproveitando
  os componentes de UI existentes (`Button`, `Card`, ícones `lucide-react`) e um componente
  de galeria/carrossel já presente no projeto. A decisão entre "botão simples" e um
  "card/banner mais estiloso" fica registrada em `design.md` (com recomendação).
- **Sem mudança** em pagamento, fila, RLS, preço, webhook ou `print-worker`. A página é
  puramente informativa e somente-leitura.

## Capabilities

### New Capabilities

(nenhuma — a funcionalidade é uma extensão informativa do checkout já existente)

### Modified Capabilities

- `web-to-print-checkout`: passa a oferecer uma página pública de **local de retirada** em
  `/impressao/retirada` e um **CTA de acesso a ela** tanto na página `/impressao` quanto na
  tela de sucesso. A tela de sucesso, além do protocolo, passa a oferecer o caminho para
  consultar onde retirar a impressão.

## Impact

- **Frontend (novo):** `app/impressao/retirada/page.tsx` (rota estática) + a view/seção que
  renderiza endereço e galeria; possivelmente um componente pequeno reutilizável de CTA
  ("Onde Pegar Minha Impressão?") para evitar duplicação entre `/impressao` e a tela de
  sucesso.
- **Frontend (modificado):** `src/views/Impressao.tsx` (insere o CTA no cabeçalho do fluxo) e
  `src/components/impressao/TelaSucesso.tsx` (adiciona o CTA ao lado de "Voltar ao início").
- **Assets (novo):** até 4 imagens do local em `public/` (ex.: `public/retirada/foto-1.jpg`…).
  Placeholders podem ser usados até as fotos reais existirem.
- **Sem impacto:** rotas de API, Supabase (schema/RLS/Storage), Mercado Pago, `print-worker`,
  dependências (nenhuma nova lib necessária — usa shadcn/ui, lucide-react e o que já existe).
