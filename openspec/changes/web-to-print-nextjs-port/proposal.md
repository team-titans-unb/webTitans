## Why

O recurso **web-to-print** (checkout público `/impressao`, geração de PIX, webhook do Mercado Pago, fila no Supabase e `print-worker`) só existe na branch `feat/Impressora`, escrito para o stack **antigo** (Vite + React SPA, `react-router-dom`, Vercel Serverless Functions). Enquanto isso, a `main` já migrou para **Next.js 16 (App Router)** — mantendo a **Vercel como hospedeiro principal** (Next.js nativo; domínio de produção `https://www.roboticstitans.com.br/`), com **Docker apenas como forma alternativa de rodar localmente** — e divergiu **antes** do web-to-print existir (merge-base `62bbefc`): a `main` não tem `api/`, `supabase/`, `print-worker/`, nem as dependências de pagamento/PDF. Para entregar a impressão paga em produção, é preciso **portar** o recurso para o stack atual da `main` sem reescrever a lógica de negócio, sem regressão nas páginas institucionais já migradas, e sem tocar no schema/RLS do Supabase nem no `print-worker`.

## What Changes

- **Estratégia de port (não rebase).** Uma branch nova é criada a partir de `origin/main` e o web-to-print é portado por cima dela. Não se rebaseia `feat/Impressora` (que está na base Vite). Os artefatos OpenSpec e o `print-worker`/`supabase` são trazidos verbatim da `feat/Impressora`.
- **Dependências (só adiciona).** Adicionar `mercadopago`, `pdf-lib`, `pdfjs-dist`, `qrcode.react`. **Remover** qualquer uso de `@vercel/node` (tipos `VercelRequest`/`VercelResponse`).
- **Backend: Vercel Functions → Next Route Handlers.** `api/payments/create-pix.ts` → `app/api/payments/create-pix/route.ts`; `api/webhooks/mercadopago.ts` → `app/api/webhooks/mercadopago/route.ts`; `api/_lib/*` → `src/lib/server/*`. Mudam só os adaptadores de I/O (`req.json()`, `new URL(req.url).searchParams`, `Headers`, `Response.json`, `runtime = "nodejs"`); a lógica de segurança/preço/idempotência permanece **intacta**.
- **`notification_url` por env.** Adotar `PUBLIC_BASE_URL` (= `https://www.roboticstitans.com.br`) como fonte de verdade para a URL de webhook, com fallback aos headers `x-forwarded-*`. Na Vercel a inferência por header funciona em produção, mas fixar o domínio canônico evita que um deploy de **preview** (URL efêmera `*.vercel.app`) registre uma `notification_url` que o Mercado Pago não conseguiria reconfirmar.
- **Frontend: SPA → App Router.** `src/pages/Impressao.tsx` → `src/views/Impressao.tsx` + wrapper fino `app/impressao/page.tsx` (`"use client"`); componentes/hook/libs de impressão portados; `react-router-dom` → `next/link`/`next/navigation`; `import.meta.env.VITE_*` → `process.env.NEXT_PUBLIC_*`. Reaproveitar os provedores existentes de `app/providers.tsx` (sem recriá-los).
- **Worker do pdfjs.** Substituir `import ...?url` (sintaxe Vite, não funciona no Next) por um asset servido de `public/pdf.worker.min.mjs` (copiado via script `postinstall`/`copy`, com versão sincronizada à dep) e `GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"`.
- **Reconciliação de `Produtos`.** A `main` tem `src/views/Produtos.tsx` (com `next/link`); a entrada/CTA para `/impressao` é **mesclada** ali, sem sobrescrever a versão da `main`.
- **Supabase e print-worker verbatim.** Copiar `supabase/` (migrations 0001–0007, `functions/cleanup-fila`, `config.toml`) e `print-worker/` sem alterar lógica (incluindo o failover por inalcançabilidade já corrigido). Não commitar `supabase/.temp/`.
- **NÃO BREAKING para o usuário final:** nenhum scenario de comportamento do fluxo de checkout/pagamento/impressão muda. Os deltas de spec são **re-plataforma** (mecânica de roteamento/handler/deploy/env), não mudança de regra de negócio.

## Capabilities

### New Capabilities

(nenhuma — todas as capabilities do web-to-print já existem; o port altera a mecânica de plataforma de algumas delas)

### Modified Capabilities

- `web-to-print-checkout`: a página `/impressao` deixa de ser uma rota do `src/App.tsx` (React Router) e passa a ser servida pelo App Router (`app/impressao/page.tsx` + `src/views/Impressao.tsx`); a contagem de páginas via `pdfjs-dist` passa a usar worker servido de `public/`; envs do cliente passam a `NEXT_PUBLIC_*`.
- `mercadopago-pix-integration`: os endpoints `create-pix` e `webhooks/mercadopago` deixam de ser handlers estilo `@vercel/node` (`api/*.ts`) e passam a ser Next Route Handlers (`app/api/**/route.ts`, `runtime = "nodejs"`) — que na Vercel continuam virando funções serverless; a `notification_url` passa a derivar de `PUBLIC_BASE_URL`; segredos de servidor passam a viver nas variáveis de ambiente da Vercel (Project Settings), sem prefixo `NEXT_PUBLIC_`.
- `print-queue-storage`: a referência ao endpoint de UPDATE via `service_role` passa a apontar para o Route Handler `app/api/webhooks/mercadopago/route.ts` (mesma garantia: UPDATE só via `service_role`).
- `print-upload-abuse-protection`: o teto de 30 MB permanece dimensionado para o limite de tempo (~10 s) da função serverless da Vercel onde o `create-pix` roda; o texto apenas reflete que o endpoint agora é um Route Handler do Next.
- `web-to-print-docs`: a documentação de arquitetura passa a descrever o deploy na **Vercel** (Next.js nativo, domínio `roboticstitans.com.br`), com **Docker como execução local opcional**, e a fronteira de segredos (envs da Vercel); os endpoints documentados passam a Route Handlers.

## Impact

- **Dependências:** `+ mercadopago`, `+ pdf-lib`, `+ pdfjs-dist`, `+ qrcode.react`; `- @vercel/node`. `package-lock.json` atualizado.
- **Backend (novo):** `app/api/payments/create-pix/route.ts`, `app/api/webhooks/mercadopago/route.ts`, `src/lib/server/{mercadopago,mp-signature,supabase-admin}.ts`.
- **Frontend (novo/portado):** `app/impressao/page.tsx`, `src/views/Impressao.tsx`, `src/components/impressao/*`, `src/hooks/usePedidoStatus.ts`, `src/lib/{pdf-utils,supabase,types,pricing}.ts`; merge em `src/views/Produtos.tsx`.
- **Assets:** `public/pdf.worker.min.mjs` + script de cópia no `package.json`.
- **Config:** `.env.local.example` reescrito para o modelo Next (`NEXT_PUBLIC_*` cliente / sem prefixo servidor + `PUBLIC_BASE_URL`); em produção as envs de servidor vivem nas **Project Settings da Vercel**; para rodar localmente (Docker incluso) usam-se `.env.local`/`env_file`.
- **Trazidos verbatim:** `supabase/**` (sem `.temp/`), `print-worker/**`.
- **Infra/operacional (sem código):** configurar as envs de servidor no Project Settings da Vercel; atualizar a URL de webhook no painel do Mercado Pago para `https://www.roboticstitans.com.br/api/webhooks/mercadopago`; confirmar mesmo projeto Supabase (Realtime, bucket, RLS) e que o `print-worker` da sede segue apontando ao mesmo Supabase.
- **Sem mudança:** schema do banco, RLS, regra de preço, contrato do webhook (manifest de assinatura), lógica do `print-worker`, páginas institucionais da `main`. Sem reintroduzir Vite, `index.html`, `vercel.json` ou `react-router-dom`.
