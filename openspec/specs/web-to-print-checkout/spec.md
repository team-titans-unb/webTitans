# web-to-print-checkout Specification

## Purpose
Oferecer a página pública `/impressao` com o fluxo completo de checkout: upload e validação
do PDF, contagem de páginas no navegador via pdfjs-dist, escolha de modo de cor com cálculo
de preço, upload ao Storage e criação do pedido, geração do PIX pelo backend e
acompanhamento do status em tempo real (Realtime + polling) até a tela de sucesso.
## Requirements
### Requirement: Página de checkout de impressão acessível em `/impressao`

O sistema SHALL expor uma página pública em `/impressao` integrada ao roteamento de `src/App.tsx`, sem exigir autenticação, contendo o fluxo completo de upload, configuração, pagamento e confirmação.

#### Scenario: Usuário acessa /impressao diretamente
- **WHEN** o usuário navega para `https://<host>/impressao`
- **THEN** a página de checkout é renderizada com o Header/Footer do site e o fluxo começa no passo de upload

#### Scenario: Usuário acessa rota inexistente sob /impressao
- **WHEN** o usuário navega para `/impressao/qualquer-coisa`
- **THEN** o componente `NotFound` existente é renderizado (catch-all `*` continua valendo)

### Requirement: Upload local de PDF com validação

O sistema SHALL aceitar arquivos PDF do usuário via um seletor de arquivo, validar tipo MIME (`application/pdf`) e tamanho máximo (50 MB), e rejeitar com mensagem clara qualquer outro tipo ou arquivo acima do limite.

#### Scenario: Usuário seleciona um PDF válido
- **WHEN** o usuário escolhe um arquivo `documento.pdf` de 3 MB
- **THEN** o sistema mostra o nome e tamanho do arquivo e habilita o próximo passo

#### Scenario: Usuário tenta enviar um arquivo não-PDF
- **WHEN** o usuário escolhe `imagem.png`
- **THEN** o sistema mostra um toast de erro "Apenas arquivos PDF são aceitos" e não avança

#### Scenario: Usuário tenta enviar PDF maior que 50 MB
- **WHEN** o usuário escolhe um PDF de 75 MB
- **THEN** o sistema mostra um toast "Arquivo excede o limite de 50 MB" e bloqueia o avanço

### Requirement: Contagem de páginas no cliente via pdfjs-dist

O sistema SHALL contar o número de páginas do PDF **localmente no navegador** usando `pdfjs-dist`, sem enviar o arquivo ao servidor para essa operação.

#### Scenario: PDF de 12 páginas carregado
- **WHEN** o usuário seleciona um PDF de 12 páginas válido
- **THEN** o sistema exibe "12 páginas" na tela de configuração antes de qualquer upload

#### Scenario: PDF corrompido
- **WHEN** o `pdfjs-dist` falha ao abrir o arquivo
- **THEN** o sistema mostra "Não foi possível ler este PDF" e permite escolher outro arquivo

### Requirement: Seleção de modo de cor e cálculo de preço

O sistema SHALL oferecer escolha entre `P&B` e `COLORIDO` e calcular o valor total como `num_paginas * quantidade_copias * valor_centavos_por_pagina[modo]`, com os valores por página carregados da tabela `config_precos` do Supabase. O total exibido SHALL recalcular imediatamente quando a quantidade de cópias mudar.

#### Scenario: Cálculo P&B com cópias
- **WHEN** o PDF tem 10 páginas, `config_precos.PB = 50` centavos, o usuário escolhe P&B e informa 2 cópias
- **THEN** o total exibido é `R$ 10,00` (`10 * 2 * 50` centavos)

#### Scenario: Troca de modo de cor recalcula
- **WHEN** o usuário alterna de P&B para COLORIDO em um pedido de 10 páginas, 1 cópia, com preços 50 e 200
- **THEN** o total exibido muda imediatamente de `R$ 5,00` para `R$ 20,00`

#### Scenario: Mudar a quantidade de cópias recalcula
- **WHEN** o usuário aumenta a quantidade de cópias de 1 para 3 em um pedido de 10 páginas P&B a 50 centavos
- **THEN** o total exibido muda imediatamente de `R$ 5,00` para `R$ 15,00`

### Requirement: Upload direto para Supabase Storage e criação do pedido

O sistema SHALL fazer upload do PDF diretamente do navegador para o bucket `pdfs-impressao` do Supabase Storage usando a anon key, e ao concluir SHALL inserir uma linha em `fila_impressao` com `status='AGUARDANDO_PAGAMENTO'`, `pdf_path` apontando para o arquivo no Storage, `num_paginas`, `quantidade_copias`, `modo_cor` e `valor_centavos`.

#### Scenario: Upload bem-sucedido
- **WHEN** o cliente clica em "Pagar" e o upload do PDF conclui sem erro
- **THEN** uma nova linha aparece em `fila_impressao` com `quantidade_copias` preenchido (>= 1) e status `AGUARDANDO_PAGAMENTO`, e o cliente recebe o `id` do pedido

#### Scenario: Falha de rede durante upload
- **WHEN** o upload do PDF falha por timeout/conexão
- **THEN** nenhum registro é criado em `fila_impressao` e o cliente vê "Falha no envio, tente novamente"

### Requirement: Geração do PIX via backend

O sistema SHALL chamar `POST /api/payments/create-pix` com o `pedidoId` recém-criado e SHALL exibir ao usuário o QR Code (imagem) e o código Copia e Cola devolvidos.

#### Scenario: PIX gerado com sucesso
- **WHEN** o backend devolve 200 com `qr_code_base64` e `qr_code_copia_cola`
- **THEN** a tela de pagamento renderiza a imagem do QR Code, o botão "Copiar código" e um timer com a expiração

#### Scenario: Falha na geração do PIX
- **WHEN** o backend devolve 5xx
- **THEN** o cliente exibe "Erro ao gerar pagamento" e oferece botão "Tentar novamente"

### Requirement: Atualização em tempo real do status do pedido

O sistema SHALL assinar o canal Supabase Realtime filtrado pela linha do pedido e SHALL adicionalmente fazer polling do status a cada 5 segundos como fallback; quando o status passar a `PAGO`, SHALL navegar automaticamente para a tela de sucesso.

#### Scenario: Webhook chega e Realtime entrega
- **WHEN** o `/api/webhooks/mercadopago` atualiza o pedido para `PAGO`
- **THEN** o cliente recebe o evento Realtime em menos de 2 segundos e exibe a tela de sucesso sem refresh

#### Scenario: Realtime indisponível, polling cobre
- **WHEN** o canal Realtime falha em conectar mas o pedido é marcado como `PAGO`
- **THEN** o polling de 5 s detecta a mudança e a tela de sucesso é exibida em até 10 segundos após o webhook

#### Scenario: Pagamento não chega em 10 minutos
- **WHEN** o pedido permanece em `AGUARDANDO_PAGAMENTO` por mais de 10 minutos
- **THEN** o sistema exibe "Pagamento não confirmado" e oferece botão "Voltar ao início"

### Requirement: Tela de sucesso com identificador do pedido

O sistema SHALL exibir uma tela de confirmação contendo o `id` do pedido (UUID truncado para legibilidade) e uma mensagem orientando o cliente sobre a retirada/entrega da impressão.

#### Scenario: Sucesso após pagamento aprovado
- **WHEN** o pedido transiciona para `PAGO`
- **THEN** a tela mostra "Pagamento confirmado" e os 8 primeiros caracteres do UUID do pedido como protocolo

### Requirement: Seleção da quantidade de cópias

O checkout SHALL oferecer um campo numérico "Quantidade de cópias" com valor mínimo 1 e padrão 1. O sistema SHALL impedir o avanço com quantidade menor que 1 ou não inteira, normalizando entradas inválidas para o mínimo.

#### Scenario: Usuário define 3 cópias
- **WHEN** o usuário informa `3` no campo de quantidade de cópias
- **THEN** o checkout registra `quantidade_copias = 3` e o usa no INSERT do pedido e no cálculo do total

#### Scenario: Quantidade padrão
- **WHEN** o usuário não altera o campo de quantidade
- **THEN** o checkout assume `quantidade_copias = 1`

#### Scenario: Quantidade inválida é normalizada
- **WHEN** o usuário tenta informar `0`, vazio ou um valor não inteiro
- **THEN** o checkout normaliza para `1` (mínimo) e não permite gerar PIX com quantidade menor que 1

