## ADDED Requirements

### Requirement: Página pública de local de retirada em `/impressao/retirada`

O sistema SHALL expor uma página pública e somente-leitura em `/impressao/retirada`,
sem exigir autenticação, exibindo o local fixo de retirada da impressão **"Sala 207,
Prédio LDTEA – FCTE Gama"** e uma galeria de **até 4 fotos** do local. As informações do
local SHALL ser estáticas (sem consulta a banco, Storage ou API) e as fotos SHALL ser
servidas como assets estáticos a partir de `public/`. A página SHALL renderizar com o
Header/Footer do site e SHALL ser responsiva (mobile-first).

#### Scenario: Usuário acessa a página de retirada diretamente
- **WHEN** o usuário navega para `https://<host>/impressao/retirada`
- **THEN** a página renderiza com Header/Footer e exibe o texto "Sala 207, Prédio LDTEA – FCTE Gama" e a galeria de fotos do local

#### Scenario: Galeria exibe as fotos disponíveis
- **WHEN** existem fotos do local configuradas em `public/` (até 4)
- **THEN** a página exibe cada foto disponível com `alt` descritivo, sem quebrar o layout quando há menos de 4 fotos

#### Scenario: Página funciona em telas pequenas
- **WHEN** a página é aberta em um viewport de celular
- **THEN** o endereço e a galeria permanecem legíveis e a galeria se adapta à largura sem overflow horizontal

### Requirement: CTA "Onde Pegar Minha Impressão?" no checkout e na tela de sucesso

O sistema SHALL exibir um CTA rotulado **"Onde Pegar Minha Impressão?"** que navega para
`/impressao/retirada`, presente em **dois pontos** do fluxo: (1) na página de checkout
`/impressao`, visível desde o passo inicial; e (2) na tela de sucesso exibida após o
pagamento ser confirmado (`PAGO`), junto ao protocolo. O CTA SHALL ser um link de
navegação interna (não dispara pagamento, upload nem qualquer mutação) e SHALL reutilizar
os componentes de UI existentes do projeto.

#### Scenario: CTA visível no checkout antes de pagar
- **WHEN** o usuário abre `/impressao` no passo de upload
- **THEN** o CTA "Onde Pegar Minha Impressão?" está visível e, ao ser clicado, navega para `/impressao/retirada`

#### Scenario: CTA presente na tela de sucesso
- **WHEN** o pedido transiciona para `PAGO` e a tela de sucesso é exibida com o protocolo
- **THEN** o CTA "Onde Pegar Minha Impressão?" aparece junto ao protocolo e navega para `/impressao/retirada` ao ser clicado

#### Scenario: CTA não interfere no fluxo de pagamento
- **WHEN** o usuário clica no CTA durante o checkout
- **THEN** o sistema apenas navega para a página de retirada, sem criar pedido, sem upload e sem gerar PIX

## MODIFIED Requirements

### Requirement: Tela de sucesso com identificador do pedido

O sistema SHALL exibir uma tela de confirmação contendo o `id` do pedido (UUID truncado
para legibilidade) e uma mensagem orientando o cliente sobre a retirada/entrega da
impressão. A tela SHALL adicionalmente oferecer um CTA "Onde Pegar Minha Impressão?" que
leva à página de local de retirada (`/impressao/retirada`).

#### Scenario: Sucesso após pagamento aprovado
- **WHEN** o pedido transiciona para `PAGO`
- **THEN** a tela mostra "Pagamento confirmado" e os 8 primeiros caracteres do UUID do pedido como protocolo

#### Scenario: Tela de sucesso oferece o caminho para a retirada
- **WHEN** a tela de sucesso é exibida
- **THEN** além do protocolo e de "Voltar ao início", o usuário vê o CTA "Onde Pegar Minha Impressão?" que abre `/impressao/retirada`
