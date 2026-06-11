> **Clean Code (vale para TODAS as tarefas de código):** nomes descritivos, funções pequenas e de responsabilidade única, sem duplicação, comentários só quando agregam, legibilidade acima de esperteza. Preservar INTACTA a lógica de segurança/preço/idempotência ao portar — mudar apenas os adaptadores de plataforma.

## 0. Estratégia de integração (Fase 0 — decisão de design)

- [x] 0.1 Criar branch nova a partir de `origin/main`: `git switch -c feat/web-to-print-next origin/main` (NÃO rebasear `feat/Impressora`)
- [x] 0.2 Trazer verbatim de `feat/Impressora`: `git checkout feat/Impressora -- supabase print-worker openspec/specs openspec/changes/web-to-print-nextjs-port`
- [x] 0.3 Confirmar que `supabase/.temp/` NÃO foi versionado (`git status --porcelain | grep supabase/.temp` vazio); validar `.gitignore` cobre `supabase/.temp/`

## 1. Dependências e config base (Fase 1 — só adiciona, não-quebrante)

- [x] 1.1 Adicionar deps: `npm install mercadopago pdf-lib pdfjs-dist qrcode.react`
- [x] 1.2 Remover qualquer uso/dep de `@vercel/node` (tipos `VercelRequest`/`VercelResponse`)
- [x] 1.3 Reescrever `.env.local.example` para o modelo Next: cliente `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`; servidor sem prefixo `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`MERCADOPAGO_ACCESS_TOKEN`/`MERCADOPAGO_WEBHOOK_SECRET`/`PUBLIC_BASE_URL`; remover `VITE_*`; atualizar comentários de "Vercel Functions" para "Route Handlers / envs de servidor (em produção: Project Settings da Vercel)"; comentar que segredos de servidor NUNCA levam prefixo `NEXT_PUBLIC_`
- [x] 1.4 Verificar `package-lock.json` versionado e `npm ci` limpo

## 2. Backend: portar `/api` → Next Route Handlers (Fase 2)

- [x] 2.1 Mover libs `api/_lib/{mercadopago,mp-signature,supabase-admin}.ts` → `src/lib/server/*` e remover as extensões `.js` dos imports
- [x] 2.2 Criar `app/api/payments/create-pix/route.ts` (de `api/payments/create-pix.ts`): exportar `POST`; `await req.json()`; `Response.json(payload,{status})`; `export const runtime = "nodejs"` e `export const dynamic = "force-dynamic"`; tratar método não-POST → 405
- [x] 2.3 No `create-pix`: derivar `notification_url` de `process.env.PUBLIC_BASE_URL` (`<base>/api/webhooks/mercadopago`), com fallback aos headers `x-forwarded-*`
- [x] 2.4 Preservar INTACTA a lógica do `create-pix`: contagem de páginas via pdf-lib, preço por `config_precos`, `quantidade_copias` da linha, `idempotencyKey = pedido.id`, `date_of_expiration` (offset -03:00 de Brasília), validações 404/409/422/502
- [x] 2.5 Criar `app/api/webhooks/mercadopago/route.ts` (de `api/webhooks/mercadopago.ts`): exportar `POST`; ler `data.id` via `new URL(req.url).searchParams` (fallback ao body `await req.json()`); `runtime="nodejs"`; método não-POST → 405
- [x] 2.6 No webhook: adaptar headers do Next para `verificarAssinaturaMP` via `Object.fromEntries(req.headers)` (lib permanece verbatim); confirmar que NÃO é preciso raw body (manifest não usa o corpo cru)
- [x] 2.7 Preservar INTACTA a lógica do webhook: validação de assinatura HMAC + anti-replay 5 min (401), transições `AGUARDANDO_PAGAMENTO`→`PAGO`/`CANCELADO` com `WHERE status='AGUARDANDO_PAGAMENTO'`, 200 em erros não-acionáveis e 500 em banco fora

## 3. Frontend: portar a UI de impressão para o App Router (Fase 3)

- [x] 3.1 Criar `src/views/Impressao.tsx` (de `src/pages/Impressao.tsx`) com `"use client"`; criar wrapper `app/impressao/page.tsx` (`"use client"`) importando `@/views/Impressao`
- [x] 3.2 Portar `src/components/impressao/{UploadPDF,ConfiguracaoImpressao,TelaPagamento,TelaSucesso}.tsx` e `src/hooks/usePedidoStatus.ts`; portar `src/lib/{types,pricing}.ts` verbatim
- [x] 3.3 Portar `src/lib/supabase.ts` (cliente): trocar `import.meta.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` por `process.env.NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] 3.4 Trocar roteamento: `react-router-dom` `Link to=` → `next/link` `Link href=` (em `Impressao.tsx` e `TelaSucesso.tsx`); `useNavigate`/`useSearchParams` → `next/navigation` se existir; manter `fetch("/api/payments/create-pix")` relativo
- [x] 3.5 pdfjs worker: em `src/lib/pdf-utils.ts` remover o import `?url` do Vite e setar `GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"`; manter `pdf-utils` em client component
- [x] 3.6 Adicionar script de cópia do worker para `public/pdf.worker.min.mjs` no `postinstall`/`prebuild` (versão sincronizada com `pdfjs-dist`)
- [x] 3.7 Reconciliar `src/views/Produtos.tsx` da `main`: mesclar SOMENTE o CTA/Link `next/link href="/impressao"` (comparar diff com `feat:src/pages/Produtos.tsx`), sem sobrescrever o conteúdo institucional migrado
- [x] 3.8 Confirmar que NÃO se recriam provedores (reaproveitar `QueryClientProvider`/`ThemeProvider`/`TooltipProvider`/Toasters de `app/providers.tsx`)

## 4. Trazer Supabase e print-worker verbatim (Fase 4)

- [x] 4.1 Confirmar `supabase/` presente (migrations 0001–0007, `functions/cleanup-fila`, `config.toml`) e sem `supabase/.temp/` versionado
- [x] 4.2 Confirmar `print-worker/` presente sem mudança de lógica (incluindo failover por inalcançabilidade já corrigido)

## 5. Não-quebra: portões de qualidade

- [x] 5.1 `npm run build` (portão de qualidade do CI da `main`) permanece VERDE
- [x] 5.2 `npm run lint` rodado (informativo); não reintroduzir Vite, `index.html`, `vercel.json` nem `react-router-dom`
- [x] 5.3 Verificar não-vazamento de segredo: `grep -r MERCADOPAGO_ACCESS_TOKEN .next/static/` retorna 0 ocorrências
- [x] 5.4 Verificar páginas institucionais da `main` inalteradas (smoke nas rotas existentes)

## 6. [MANUAL / OPERACIONAL] Runbook pós-código

> Esta seção é executada MANUALMENTE pela equipe APÓS o código portado (ver `design.md` › Migration Plan). Não é trabalho de implementação automatizável.

- [ ] 6.1 [MANUAL] Abrir PR `feat/web-to-print-next` → `main`; CI (`npm run build`) verde
- [ ] 6.2 [MANUAL] `cp .env.local.example .env.local` e preencher todas as envs; confirmar segredos de servidor SEM `NEXT_PUBLIC_`
- [ ] 6.3 [MANUAL] Produção = **Vercel**: configurar as envs em Project Settings → Environment Variables (`NEXT_PUBLIC_*` + segredos de servidor + `PUBLIC_BASE_URL=https://www.roboticstitans.com.br`); confirmar que o projeto Vercel aponta ao domínio `roboticstitans.com.br` e que o build passou. Docker (localhost, opcional): envs via `--env-file .env.local`/`env_file:`
- [ ] 6.4 [MANUAL] Confirmar `public/pdf.worker.min.mjs` no build e versão batendo com `pdfjs-dist`; `GET /pdf.worker.min.mjs` → 200
- [ ] 6.5 [MANUAL] Mercado Pago (painel): atualizar URL de notificação para `https://www.roboticstitans.com.br/api/webhooks/mercadopago`; conferir secret == `MERCADOPAGO_WEBHOOK_SECRET`; testar no simulador (esperar 200 + transição); sandbox: pagamento aprovado → `PAGO`
- [ ] 6.6 [MANUAL] Supabase: confirmar MESMO projeto (não re-rodar migrations à toa); checar bucket `pdfs-impressao` (privado, 30 MB, só PDF), Realtime habilitado na `fila_impressao`, RLS/policies intactas
- [ ] 6.7 [MANUAL] print-worker: confirmar serviço da sede ativo apontando ao mesmo Supabase (`.env` não muda)
- [ ] 6.8 [MANUAL] Smoke E2E: upload PDF → `create-pix` retorna QR → pagar (sandbox) → webhook marca `PAGO` → worker imprime → `IMPRESSO`. Erros: PDF inválido (422), pedido não-aguardando (409), assinatura inválida/replay (401), expiração de 30 min encerra o acompanhamento sem corte prematuro
- [ ] 6.9 [MANUAL] Rollback: se falhar, não mergear o PR (a `main` fica intacta); em produção, usar o rollback/redeploy do deploy anterior na Vercel + reverter URL de webhook no painel do MP se já trocada
