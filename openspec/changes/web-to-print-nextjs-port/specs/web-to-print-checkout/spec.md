## MODIFIED Requirements

### Requirement: Página de checkout de impressão acessível em `/impressao`

O sistema SHALL expor uma página pública em `/impressao` servida pelo **Next.js App Router** — um wrapper fino `app/impressao/page.tsx` (`"use client"`) que importa a tela `src/views/Impressao.tsx` — sem exigir autenticação, contendo o fluxo completo de upload, configuração, pagamento e confirmação. A página SHALL reaproveitar os provedores já definidos em `app/providers.tsx` (`QueryClientProvider`, `ThemeProvider`, `TooltipProvider`, Toasters), sem recriá-los.

#### Scenario: Usuário acessa /impressao diretamente
- **WHEN** o usuário navega para `https://<host>/impressao`
- **THEN** a página de checkout é renderizada com o Header/Footer do site e o fluxo começa no passo de upload

#### Scenario: Usuário acessa rota inexistente sob /impressao
- **WHEN** o usuário navega para `/impressao/qualquer-coisa`
- **THEN** o `app/not-found.tsx` do App Router é renderizado (a rota não existe)

### Requirement: Contagem de páginas no cliente via pdfjs-dist

O sistema SHALL contar o número de páginas do PDF **localmente no navegador** usando `pdfjs-dist`, sem enviar o arquivo ao servidor para essa operação. O worker do pdfjs SHALL ser carregado de um asset estático servido em `public/pdf.worker.min.mjs` (via `GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"`), cuja versão SHALL ser mantida sincronizada com a dependência `pdfjs-dist` por um script de cópia no `postinstall`/`prebuild`. A contagem SHALL ocorrer em um client component (`"use client"`).

#### Scenario: PDF de 12 páginas carregado
- **WHEN** o usuário seleciona um PDF de 12 páginas válido
- **THEN** o sistema exibe "12 páginas" na tela de configuração antes de qualquer upload

#### Scenario: PDF corrompido
- **WHEN** o `pdfjs-dist` falha ao abrir o arquivo
- **THEN** o sistema mostra "Não foi possível ler este PDF" e permite escolher outro arquivo

#### Scenario: Worker servido como asset estático
- **WHEN** a página de checkout carrega e inicializa o pdfjs
- **THEN** `GET /pdf.worker.min.mjs` retorna 200 e a versão do worker bate com a da dependência `pdfjs-dist`

### Requirement: Geração do PIX via backend

O sistema SHALL chamar `POST /api/payments/create-pix` (Route Handler do Next, `runtime = "nodejs"`) com o `pedidoId` recém-criado e SHALL exibir ao usuário o QR Code (imagem) e o código Copia e Cola devolvidos. A chamada SHALL usar caminho relativo (`fetch("/api/payments/create-pix")`).

#### Scenario: PIX gerado com sucesso
- **WHEN** o backend devolve 200 com `qr_code_base64` e `qr_code_copia_cola`
- **THEN** a tela de pagamento renderiza a imagem do QR Code, o botão "Copiar código" e um timer com a expiração

#### Scenario: Falha na geração do PIX
- **WHEN** o backend devolve 5xx
- **THEN** o cliente exibe "Erro ao gerar pagamento" e oferece botão "Tentar novamente"

### Requirement: Atualização em tempo real do status do pedido

O sistema SHALL assinar o canal Supabase Realtime filtrado pela linha do pedido (usando o cliente configurado com `process.env.NEXT_PUBLIC_SUPABASE_URL` / `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`) e SHALL adicionalmente fazer polling do status a cada 5 segundos como fallback; quando o status passar a `PAGO`, SHALL navegar automaticamente para a tela de sucesso. O acompanhamento SHALL durar até a expiração real do QR (sem corte prematuro).

#### Scenario: Webhook chega e Realtime entrega
- **WHEN** o `/api/webhooks/mercadopago` atualiza o pedido para `PAGO`
- **THEN** o cliente recebe o evento Realtime em menos de 2 segundos e exibe a tela de sucesso sem refresh

#### Scenario: Realtime indisponível, polling cobre
- **WHEN** o canal Realtime falha em conectar mas o pedido é marcado como `PAGO`
- **THEN** o polling de 5 s detecta a mudança e a tela de sucesso é exibida em até 10 segundos após o webhook

#### Scenario: PIX expira sem pagamento
- **WHEN** o pedido permanece em `AGUARDANDO_PAGAMENTO` até a expiração real do QR
- **THEN** o sistema encerra o acompanhamento no tempo real do QR e oferece botão "Voltar ao início"
