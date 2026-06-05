## Context

O web-to-print existe apenas na branch `feat/Impressora`, escrito para o stack antigo:

- **Backend:** dois handlers estilo Vercel (`api/payments/create-pix.ts`, `api/webhooks/mercadopago.ts`) tipados com `@vercel/node`, mais três libs em `api/_lib/{mercadopago,mp-signature,supabase-admin}.ts` importadas com extensão `.js` (resolução ESM da Vercel).
- **Frontend:** SPA Vite com `react-router-dom` (`src/App.tsx` → `Routes`/`Route`), página `src/pages/Impressao.tsx`, componentes `src/components/impressao/*`, hook `src/hooks/usePedidoStatus.ts`, libs `src/lib/{pdf-utils,supabase,types,pricing}.ts`. Usa `import.meta.env.VITE_*` e o worker do pdfjs via `pdfjs-dist/build/pdf.worker.min.mjs?url` (sintaxe Vite).
- **Dados/automação (agnósticos a framework):** `supabase/` (migrations 0001–0007, `functions/cleanup-fila`, `config.toml`) e `print-worker/` (Python, com failover por inalcançabilidade já corrigido).

A `main` divergiu **antes** do web-to-print (merge-base `62bbefc`) e migrou para **Next.js 16 App Router**. O **hospedeiro principal continua sendo a Vercel** (Next.js nativo; domínio de produção `https://www.roboticstitans.com.br/`). O `Dockerfile` multi-stage `node:22-alpine` (`output: "standalone"`, `server.js` na porta 8080) e o `docker-compose.yaml` (dev na 3000, montando volume) existem **apenas como forma alternativa de rodar o site localmente** — não são o caminho de deploy de produção. Padrões observados na `main`:

- Rota = `app/<rota>/page.tsx` é um wrapper fino `"use client"` que importa a tela de `src/views/<Nome>.tsx` (ex.: `app/produtos/page.tsx` → `@/views/Produtos`).
- `app/providers.tsx` JÁ provê `QueryClientProvider` (@tanstack/react-query), `ThemeProvider`, `TooltipProvider` e os dois Toasters. Não recriar provedores.
- `tsconfig` com alias `@/* -> ./src/*`. Migração de UI já vista: `react-router-dom` `Link to=` → `next/link` `Link href=`; componentes com estado/efeito/browser API levam `"use client"`.
- A `main` **não** tem `mercadopago`, `pdf-lib`, `pdfjs-dist`, `qrcode.react`, `@vercel/node`, `react-router-dom`.
- CI da `main` (`.github/workflows/ci.yml`): lint é **informativo** (`continue-on-error: true`); o **portão de qualidade é `npm run build`** (type-check + build de produção, Node 22). O build PRECISA permanecer verde.

Stakeholders: equipe TITANS (operação da impressora na sede); cliente final que paga via PIX. Restrição dominante: **portar sem quebrar** páginas institucionais, dados (Supabase) nem o `print-worker`.

## Goals / Non-Goals

**Goals:**

- Portar o web-to-print para o stack da `main` (Next 16 App Router + Docker) preservando 100% da lógica de segurança, preço, idempotência e máquina de estados.
- Manter `npm run build` e o fluxo institucional da `main` intactos (não-quebra).
- Trazer `supabase/` e `print-worker/` verbatim, apontando para o MESMO projeto Supabase.
- Entregar um runbook operacional exaustivo do trabalho manual pós-código (env, Docker, webhook MP, asset pdfjs, smoke test E2E).
- Deixar explícito que a implementação resultante segue Clean Code: nomes descritivos, funções pequenas de responsabilidade única, sem duplicação, comentários só quando necessários, legibilidade acima de esperteza.

**Non-Goals:**

- Redesign visual da UI; mudança de regra de preço; mudança de schema/RLS; mudança de lógica do print-worker; troca de provedor de pagamento.
- Mudar o hospedeiro de produção: ele **permanece a Vercel** (domínio `roboticstitans.com.br`); Docker é só execução local. Esta mudança não escolhe nem provisiona infraestrutura nova — apenas configura as envs no projeto Vercel existente.
- Rebase de `feat/Impressora` sobre a `main` (decisão D0 abaixo).

## Decisions

### D0 — Branch nova a partir de `origin/main` + port por cima (não rebase)

Criar uma branch nova de `origin/main` e portar o web-to-print por cima dela. **Alternativa rejeitada:** rebasear/mergear `feat/Impressora` na `main`. Como `feat/Impressora` foi construída sobre a base **Vite** (que a `main` removeu por inteiro — `index.html`, `vite.config`, `react-router-dom`, `App.tsx`), um rebase geraria conflitos massivos e arriscaria reintroduzir artefatos Vite na `main`. Portar arquivo-a-arquivo sobre a base Next é mais previsível e revisável, e **isola o risco**: a `main` permanece intacta até o merge do PR.

- **Trade-off:** port manual exige reescrever os adaptadores de I/O e os imports de roteamento/env (trabalho mecânico, descrito nas tasks), em troca de zero contaminação Vite e diffs limpos.
- **Como trazer os artefatos da `feat`:** `supabase/`, `print-worker/` e os artefatos OpenSpec (`openspec/specs/*` e este change) são copiados verbatim de `feat/Impressora` via `git checkout feat/Impressora -- <path>` na nova branch.

### D1 — Backend: Vercel Functions → Next Route Handlers (`runtime = "nodejs"`)

Cada handler vira `app/api/.../route.ts` exportando `POST` (mais tratamento de método não-POST → 405). As libs movem de `api/_lib/*` para `src/lib/server/{mercadopago,mp-signature,supabase-admin}.ts`, **removendo as extensões `.js`** dos imports (eram exigência ESM da Vercel; sob o resolver do Next/tsc não são necessárias). Adaptadores de I/O a trocar:

- Corpo: `await req.json()` em vez de `req.body`.
- Query (webhook): `new URL(req.url).searchParams.get("data.id") ?? searchParams.get("id")` em vez de `req.query`.
- Headers: no Next `req.headers` é um `Headers` (web). A lib `mp-signature` espera `Record<string,string|string[]>`. Adaptar passando `Object.fromEntries(req.headers)` na chamada (mantém a lib intacta) — preferível a refatorar a lib.
- Respostas: `Response.json(payload, { status })` (ou `NextResponse.json`) em vez de `res.status().json()`.
- Runtime: `export const runtime = "nodejs"` (usa `node:crypto`, `pdf-lib`, `@supabase/supabase-js`, `mercadopago` — incompatíveis com Edge) e `export const dynamic = "force-dynamic"` (rotas dependem de request/efeitos, nunca devem ser pré-renderizadas/cacheadas).

**Tranquilizador (documentar para evitar retrabalho):** a verificação de assinatura do MP **NÃO usa o corpo cru** — o manifest é `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, montado a partir da query/headers. Portanto **não** há necessidade de desabilitar bodyParser nem capturar raw body (preocupação típica de webhooks Stripe-like). `await req.json()` é seguro aqui.

- **Alternativa considerada:** refatorar `mp-signature` para receber um getter `(name) => string|undefined`. Rejeitada por ora: aumenta o diff e a lib é trazida verbatim; `Object.fromEntries(req.headers)` resolve com uma linha no call site.

### D2 — `notification_url` via `PUBLIC_BASE_URL` (fonte de verdade) com fallback a headers

Hoje a `notification_url` é inferida de `x-forwarded-host`/`x-forwarded-proto`. Na **Vercel** essa inferência funciona em produção (era o que rodava antes da migração), mas há um risco real: deploys de **preview** têm URLs efêmeras (`*.vercel.app`); se o `create-pix` rodar num preview, a `notification_url` apontaria para esse preview — e o Mercado Pago tentaria reconfirmar num deploy que pode já não existir ou não ter os segredos de produção. Decisão: usar `process.env.PUBLIC_BASE_URL = https://www.roboticstitans.com.br` como fonte de verdade — `notification_url = \`${PUBLIC_BASE_URL}/api/webhooks/mercadopago\`` — com **fallback** aos headers quando a env não estiver definida (dev local / Docker localhost).

- **Trade-off:** adiciona uma env (já com valor conhecido: o domínio canônico). Em troca, fixa o webhook sempre no domínio de produção, eliminando a classe de bug "webhook cai num preview efêmero". O domínio NÃO é mais uma pergunta em aberto.

### D3 — Worker do pdfjs: asset em `public/` + `workerSrc` absoluto

`src/lib/pdf-utils.ts` faz `import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"` — sintaxe `?url` do Vite, que **não** funciona no Next. Decisão: copiar `pdf.worker.min.mjs` para `public/` via um script de cópia rodado no `postinstall` (e/ou `prebuild`), e setar `pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"` num client component.

- **Por que script de cópia (e não commitar o arquivo):** mantém a versão do worker **sincronizada** com a dep `pdfjs-dist` automaticamente a cada `npm install`/build, evitando o mismatch "API version vs Worker version" que quebra a contagem de páginas. O `postinstall` garante o asset tanto em dev quanto no estágio de build do Docker (que roda `npm ci`).
- **Alternativa considerada:** `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`. Funciona em alguns bundlers, mas o comportamento sob Next/Turbopack/webpack para um asset `.mjs` de worker é menos previsível entre versões; o asset estático em `public/` é o caminho mais robusto e fácil de verificar (`curl /pdf.worker.min.mjs`). Recomendado o asset em `public/`.
- `pdf-utils.ts` e tudo que toca `GlobalWorkerOptions` roda em client component (`"use client"`).

### D4 — Frontend: SPA → App Router, reaproveitando provedores

`src/pages/Impressao.tsx` → `src/views/Impressao.tsx` (`"use client"`) + wrapper `app/impressao/page.tsx` (`"use client"` importando `@/views/Impressao`), seguindo o padrão da `main`. Portar `src/components/impressao/*`, `src/hooks/usePedidoStatus.ts`, `src/lib/types.ts`/`pricing.ts` verbatim e `src/lib/supabase.ts` (cliente). Trocas:

- Roteamento: `react-router-dom` `Link to=` → `next/link` `Link href=` (em `Impressao.tsx` e `TelaSucesso.tsx`); se houver `useNavigate`/`useSearchParams`, usar `next/navigation`. `fetch("/api/payments/create-pix")` continua relativo e funciona.
- Env do cliente: `import.meta.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` → `process.env.NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Não recriar provedores:** `QueryClientProvider`, `ThemeProvider`, `TooltipProvider` e Toasters já vêm de `app/providers.tsx`. O hook `usePedidoStatus` e os toasts dependem desses provedores que já envolvem toda a árvore.
- Realtime do Supabase (`postgres_changes` em `usePedidoStatus`) é 100% client-side e não muda; depende das envs `NEXT_PUBLIC_*` e do Realtime habilitado na `fila_impressao` (infra existente).

### D5 — Reconciliação de `Produtos.tsx` (merge, não sobrescrever)

A `main` já tem `src/views/Produtos.tsx` (com `next/link`); a `feat` tem `src/pages/Produtos.tsx` (base da CTA de produtos). A entrada para `/impressao` deve ser **mesclada** na `src/views/Produtos.tsx` da `main`, adicionando um CTA/Link `next/link` `href="/impressao"` (ex.: na seção de contato/produtos), sem sobrescrever o conteúdo institucional já migrado. Verificar o diff entre as duas versões antes de editar.

### D6 — Supabase e print-worker verbatim

Copiar `supabase/**` (migrations 0001–0007, `functions/cleanup-fila`, `config.toml`) e `print-worker/**` sem reescrever lógica. **Não commitar `supabase/.temp/`** (estado local do CLI — já coberto por `.gitignore: supabase/.temp/`, confirmar na nova branch). A LÓGICA desses dois não muda; é só trazer o código e garantir que apontam ao mesmo projeto Supabase. O `.env` do worker na sede não muda.

### D7 — `.env.local.example` no modelo Next

Reescrever para: cliente com prefixo `NEXT_PUBLIC_` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) e servidor sem prefixo (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `PUBLIC_BASE_URL`). Remover os `VITE_*` e os textos "Vercel". Regra de segurança a deixar explícita no arquivo: **segredos de servidor NUNCA com prefixo `NEXT_PUBLIC_`** (o prefixo os empacotaria no bundle do cliente).

## Risks / Trade-offs

- **[Build standalone quebra por causa das novas rotas/pdfjs]** → `npm run build` local antes do PR; `runtime="nodejs"` nas rotas de API; worker do pdfjs como asset estático em `public/` (não import dinâmico de bundler) reduz a chance de erro de build; CI da `main` roda o build no PR.
- **[Vazamento de segredo no bundle]** → segredos só sem prefixo `NEXT_PUBLIC_`; libs de servidor isoladas em `src/lib/server/*` importadas apenas por Route Handlers (`runtime="nodejs"`), nunca por client components; verificação `grep -r MERCADOPAGO_ACCESS_TOKEN .next/` deve dar 0.
- **[Webhook cai num preview efêmero da Vercel por `notification_url` inferida]** → `PUBLIC_BASE_URL` fixo no domínio de produção (D2); testar com o simulador de webhook do MP no runbook.
- **[Mismatch de versão do worker pdfjs → contagem de páginas falha]** → script de cópia sincronizado à dep no `postinstall`/`prebuild` (D3); verificar `public/pdf.worker.min.mjs` no build.
- **[Sobrescrever conteúdo institucional ao mesclar `Produtos`]** → merge cirúrgico de apenas o CTA (D5), revisando o diff antes.
- **[Re-rodar migrations num projeto já provisionado]** → não re-rodar à toa; confirmar que a nova branch aponta ao MESMO projeto e que as migrations já estão aplicadas (runbook).
- **[Mudança de assinatura ao adaptar headers]** → manter `mp-signature` verbatim e adaptar só no call site (`Object.fromEntries`); cobrir com os scenarios de assinatura válida/ausente/inválida/replay já existentes.
- **[Clean Code esquecido sob pressão do port mecânico]** → a Definition of Done das tasks exige nomes descritivos, funções pequenas de responsabilidade única, sem duplicação e comentários só quando necessários.

## Migration Plan

> Esta seção é o **runbook do trabalho MANUAL/OPERACIONAL** que a equipe executa **depois** do código portado. Comandos são ilustrativos. Datas absolutas: proposta redigida em 2026-06-04.

### M1 — Branch & port (dev)

1. `git fetch origin && git switch -c feat/web-to-print-next origin/main`
2. Trazer dados/automação/artefatos verbatim da `feat/Impressora`:
   - `git checkout feat/Impressora -- supabase print-worker openspec/specs openspec/changes/web-to-print-nextjs-port`
3. Portar backend e frontend conforme as tasks (Fases 1–3). Garantir que `supabase/.temp/` não entrou: `git status --porcelain | grep supabase/.temp` deve ser vazio.
4. Abrir PR contra `main`. **Critério:** PR aberto, CI (`npm run build`) verde.

### M2 — Dependências

1. `npm install mercadopago pdf-lib pdfjs-dist qrcode.react` e remover `@vercel/node` se presente.
2. Conferir `package-lock.json` versionado. **Critério:** `npm ci` instala limpo; `npm run build` verde.

### M3 — Env local (`.env.local`)

1. `cp .env.local.example .env.local` e preencher: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `PUBLIC_BASE_URL`.
2. **Regra:** segredos de servidor NUNCA com `NEXT_PUBLIC_`. **Critério:** `grep NEXT_PUBLIC_ .env.local` lista só URL + anon key.

### M4 — Env de produção (Vercel) e execução local (Docker)

1. **Produção = Vercel.** Configurar as envs no **Project Settings → Environment Variables** da Vercel (escopo Production/Preview conforme o caso): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `PUBLIC_BASE_URL=https://www.roboticstitans.com.br`. A Vercel detecta o Next automaticamente — não há `vercel.json` a recriar nem `Dockerfile` envolvido no deploy.
2. Confirmar que o projeto Vercel já aponta para o domínio `www.roboticstitans.com.br` (era o que servia o SPA antigo) e que o build do Next passou; os Route Handlers viram funções serverless automaticamente.
3. **Execução local via Docker (opcional):** passar as envs por `--env-file .env.local` (ou `env_file:` no `docker-compose.yaml`); serve para testar o container, não para produção.
4. **Critério:** deploy na Vercel verde; `GET https://www.roboticstitans.com.br/impressao` responde 200.

### M5 — Asset do pdfjs worker

1. Garantir que o script de cópia gera `public/pdf.worker.min.mjs` no `postinstall`/`prebuild` (também dentro do estágio de build do Docker, que roda `npm ci`).
2. **Critério:** após `npm run build`, `public/pdf.worker.min.mjs` existe e a versão bate com `node -p "require('pdfjs-dist/package.json').version"`; em runtime, `GET /pdf.worker.min.mjs` retorna 200.

### M6 — Mercado Pago (painel)

1. Atualizar a URL de notificação para `https://www.roboticstitans.com.br/api/webhooks/mercadopago`.
2. Confirmar que o secret do painel == `MERCADOPAGO_WEBHOOK_SECRET` do ambiente.
3. Testar com o **simulador de webhook do MP**: esperar `200` e a transição de status. Em **sandbox**, pagar um PIX aprovado e confirmar `AGUARDANDO_PAGAMENTO → PAGO`. **Critério:** simulador retorna 200; pagamento sandbox marca `PAGO`.

### M7 — Supabase

1. Confirmar que a nova branch aponta para o **MESMO** projeto Supabase (migrations já aplicadas anteriormente; **não** re-rodar à toa).
2. Verificar bucket `pdfs-impressao` (privado, `file_size_limit = 31457280` = 30 MB, `allowed_mime_types=['application/pdf']`), **Realtime habilitado** na `fila_impressao`, e RLS/policies intactas. **Critério:** upload de teste aceito; SELECT por id funciona; UPDATE anon negado.

### M8 — print-worker

1. Nenhuma ação de código. Apenas confirmar que o serviço na sede segue rodando e apontando ao mesmo Supabase (o `.env` dele NÃO muda). **Critério:** `systemctl status print-worker` ativo; worker faz claim de um pedido `PAGO` de teste.

### M9 — Smoke test ponta a ponta (checklist)

Subir o app (dev e/ou container) e validar o caminho feliz e os erros:

1. Upload de PDF válido → tela de configuração mostra nº de páginas.
2. `create-pix` retorna QR (`qr_code_base64` + copia-e-cola).
3. Pagar em sandbox → webhook marca `PAGO` → tela de sucesso (Realtime < 2 s; polling cobre se Realtime cair).
4. Worker imprime → `IMPRESSO`.
5. **Casos de erro:** PDF inválido/criptografado → 422; pedido não-aguardando → 409; assinatura inválida/ausente/replay → 401; expiração de 30 min → acompanhamento encerra no tempo real do QR (sem "não confirmado" prematuro).

### M10 — Limpeza / rollback

- A nova branch **isola o risco**: a `main` permanece intacta até o merge. Se algo falhar, fechar o PR / não mergear; nenhum impacto em produção institucional.
- Em produção, rollback = redeploy da imagem anterior do container e reversão da URL de webhook no painel do MP, se já trocada.

## Open Questions

- **(RESOLVIDO) Host de produção:** permanece a **Vercel** (Next.js nativo), domínio `https://www.roboticstitans.com.br/`. Isso define `PUBLIC_BASE_URL` e a URL do webhook no painel do MP. Docker é apenas execução local — sem manifesto de produção a definir.
- **Envs no projeto Vercel:** confirmar que o projeto Vercel existente (que servia o SPA antigo) será reaproveitado e que as novas envs de servidor (`SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_*`, `PUBLIC_BASE_URL`) serão adicionadas no Project Settings antes do primeiro deploy do checkout.
- **Script de cópia do worker pdfjs:** confirmar o gancho exato (`postinstall` vs `prebuild` vs ambos) que garante o asset `public/pdf.worker.min.mjs` tanto em dev/Vercel quanto na execução via Docker.
