## 1. Dados e assets do local

- [x] 1.1 Criar `src/lib/retirada.ts` com a constante `LOCAL_RETIRADA` (`"Sala 207, Prédio LDTEA – FCTE Gama"`) e a lista tipada `FOTOS_RETIRADA: { src: string; alt: string }[]` (até 4 itens)
- [x] 1.2 Adicionar os assets das fotos em `public/retirada/` (`foto-1..4`), usando `public/placeholder.svg` como provisório enquanto as fotos reais não chegam
- [x] 1.3 Apontar `FOTOS_RETIRADA` para os caminhos em `public/retirada/` com `alt` descritivo

## 2. Componente de CTA compartilhado

- [x] 2.1 Criar `src/components/impressao/BotaoOndeRetirar.tsx` — `Button asChild` + `next/link href="/impressao/retirada"`, ícone `MapPin` (lucide-react), rótulo "Onde Pegar Minha Impressão?"
- [x] 2.2 Aceitar prop de variante/estilo para suportar a versão discreta (checkout) e a versão destacada (sucesso), sem duplicar rótulo/rota

## 3. Página de local de retirada

- [x] 3.1 Criar `app/impressao/retirada/page.tsx` como Server Component estático (sem `"use client"`), renderizando Header e Footer
- [x] 3.2 Exibir o endereço de `LOCAL_RETIRADA` com destaque (ícone `MapPin`, tipografia/Badge de marca) e um link "Voltar" para `/impressao`
- [x] 3.3 Renderizar a galeria iterando `FOTOS_RETIRADA`, reutilizando `ScrollingImageGallery` ou o `carousel`/grid do shadcn/ui conforme o que ficar melhor no mobile
- [x] 3.4 Garantir layout responsivo (mobile-first), sem overflow horizontal, e tolerância a 1–4 fotos
- [x] 3.5 Definir `metadata` (title/description) da rota para a página informativa

## 4. Integração dos CTAs no fluxo

- [x] 4.1 Inserir `BotaoOndeRetirar` (variante discreta) no cabeçalho do checkout em `src/views/Impressao.tsx`, logo abaixo do subtítulo, visível desde o passo de upload
- [x] 4.2 Inserir `BotaoOndeRetirar` (variante destacada / card-banner) em `src/components/impressao/TelaSucesso.tsx`, junto ao protocolo e ao "Voltar ao início"
- [x] 4.3 Confirmar que o CTA apenas navega (não cria pedido, não faz upload, não gera PIX)

## 5. Verificação

- [x] 5.1 `npm run build`/lint passam sem erros
- [x] 5.2 Acessar `/impressao/retirada` direto: endereço e galeria aparecem com Header/Footer
- [x] 5.3 No `/impressao`, o CTA aparece desde o início e navega para a página de retirada
- [x] 5.4 Simular pagamento `PAGO` (ou montar a `TelaSucesso`): o CTA destacado aparece junto ao protocolo e navega corretamente
- [x] 5.5 Validar responsividade em viewport de celular (endereço legível, galeria sem overflow)
