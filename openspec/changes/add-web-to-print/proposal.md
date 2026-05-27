## Why

A equipe TITANS quer oferecer um serviço de impressão sob demanda ("Web-to-Print") acoplado ao site institucional como nova fonte de receita e serviço para a comunidade da UnB. O site atual está hospedado no plano gratuito da Vercel, que não suporta armazenamento persistente nem processos de longa duração — qualquer upload e armazenamento do PDF precisa ser feito fora da Vercel para evitar limites de timeout (10s nas funções gratuitas) e de tamanho de payload. Adicionalmente, a impressão física será executada por um script Python externo (fora do escopo desta mudança) que consome a fila de pedidos pagos a partir do Supabase.

## What Changes

- Nova página pública `/impressao` com fluxo de quatro etapas (upload → configuração → pagamento → confirmação).
- Contagem de páginas do PDF feita **localmente** no navegador via `pdfjs-dist` — o servidor nunca processa o PDF.
- Upload **direto** do PDF do navegador para o Supabase Storage (bucket privado `pdfs-impressao`), sem trafegar pela Vercel.
- Criação de registro na tabela `fila_impressao` no Supabase Database com status `AGUARDANDO_PAGAMENTO`, número de páginas, modo de cor (P&B ou COLORIDO) e valor calculado.
- Cálculo de preço configurável (valores P&B e Colorido por página) lido do banco.
- Duas novas Serverless Functions na Vercel (pasta `/api` na raiz, suportada nativamente por projetos Vite):
  - `POST /api/payments/create-pix` — chama a API do Mercado Pago para gerar um PIX dinâmico (QR Code + Copia e Cola) e devolve ao cliente.
  - `POST /api/webhooks/mercadopago` — endpoint protegido por validação de assinatura HMAC (`x-signature`) que recebe a confirmação de pagamento e atualiza o pedido no Supabase para `PAGO`.
- Atualização em tempo real da tela de espera de pagamento via Supabase Realtime (canal `postgres_changes` na linha do pedido), com polling via TanStack Query como fallback.
- Ajuste de `vercel.json` para que a regra de rewrite SPA não capture rotas `/api/*`.
- Novas variáveis de ambiente na Vercel (Supabase URL/anon/service-role, Mercado Pago access token, segredo do webhook).

## Capabilities

### New Capabilities

- `web-to-print-checkout`: Fluxo end-to-end do cliente — upload de PDF, contagem local de páginas, escolha de cor, cálculo de preço, geração do PIX, espera do pagamento e tela de sucesso.
- `print-queue-storage`: Modelo de dados, regras de segurança (RLS) e bucket de Storage no Supabase que sustentam a fila de impressão consumida posteriormente pelo script Python externo.
- `mercadopago-pix-integration`: Endpoints serverless que geram cobrança PIX no Mercado Pago e processam webhooks de confirmação de pagamento com verificação de assinatura.

### Modified Capabilities

<!-- Não há specs pré-existentes em openspec/specs/; nenhuma capability existente é modificada. -->

## Impact

- **Código novo**:
  - `api/payments/create-pix.ts` e `api/webhooks/mercadopago.ts` (Vercel Serverless Functions, runtime Node).
  - `src/pages/Impressao.tsx` e nova rota em `src/App.tsx`.
  - `src/components/impressao/*` (UploadPDF, ConfiguracaoImpressao, TelaPagamento, TelaSucesso).
  - `src/lib/supabase.ts` (cliente browser), `src/lib/pricing.ts`, `src/lib/pdf-utils.ts`.
  - `src/hooks/usePedidoStatus.ts` (Realtime + polling).
- **Banco / Storage**: nova tabela `fila_impressao` e bucket `pdfs-impressao` no Supabase; políticas RLS para permitir INSERT anônimo apenas em status inicial e SELECT/UPDATE restritos.
- **Config**: `vercel.json` ganha regra para preservar `/api/*`; novas envs em produção e preview.
- **Dependências novas** no `package.json`: `@supabase/supabase-js`, `pdfjs-dist`, `qrcode.react` (renderizar QR PIX), opcionalmente `mercadopago` (SDK oficial — pode-se também usar `fetch` direto).
- **Fora do escopo**: comunicação com a impressora física; o script Python que lê a fila vive em outro repositório.
- **Risco**: validação de assinatura do webhook do Mercado Pago é crítica — endpoint público; precisa de teste com pagamento sandbox antes de subir para produção.
