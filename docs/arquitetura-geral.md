# Arquitetura Geral — Site da TITANS (webTitans)

> Documento de referência da arquitetura completa do sistema: site institucional
> da equipe de robótica **TITANS** (FCTE/UnB) e os serviços acoplados a ele
> (impressão web-to-print, totem/kiosk, reimpressão via Telegram, formulários).
>
> Para o detalhamento profundo da feature de impressão, ver
> [`docs/web-to-print/`](web-to-print/README.md). Este documento dá a visão de
> conjunto e concentra a **descrição do banco de dados** (seção 7).

---

## 1. Visão geral

O `webTitans` é uma aplicação **Next.js 16 (App Router)** que cumpre três papéis:

1. **Site institucional** — páginas públicas de apresentação da equipe, modalidades
   de robótica, projetos em destaque, parcerias e processo seletivo.
2. **Serviços ao público** — impressão de PDF sob demanda com pagamento via PIX
   (*web-to-print*), serviço de impressão 3D (captação de leads) e loja de produtos.
3. **Ferramentas internas** — área de membros (login), quadro Kanban de tarefas e
   formulário de feedback anônimo.

A hospedagem principal é a **Vercel** (plano gratuito). O estado persistente vive
no **Supabase** (Postgres + Storage + Realtime). A impressão física acontece numa
**máquina Linux na sede** (Raspberry Pi 5 na Sala 208) que roda um worker Python.

```
   NAVEGADOR (cliente)            VERCEL (Next.js)             SEDE — Raspberry Pi 5
  ┌────────────────────┐        ┌────────────────────┐       ┌──────────────────────┐
  │ Site + páginas SPA │        │ Route Handlers      │       │ print-worker.py       │
  │ /impressao (upload)│        │  /api/payments/*    │       │  (systemd)            │
  │ /kiosk (totem)     │        │  /api/webhooks/*    │       │ Chromium --kiosk      │
  │ pdfjs / Realtime   │        │  /api/kiosk/*       │       │ CUPS (fila IPP)       │
  │ anon key           │        │  /api/telegram/*    │       │ service_role          │
  └─────────┬──────────┘        └─────────┬──────────┘       └──────────┬───────────┘
            │ anon key                    │ service_role / MP secrets   │ service_role
            ▼                             ▼                             ▼
       ┌───────────────────────────────────────────────────────────────────────────┐
       │                              SUPABASE                                       │
       │  Postgres: fila_impressao, config_precos, impressora_status, chamados_ajuda,│
       │            reimpressao_tokens, reimpressoes  (+ RLS, Realtime, pg_cron)     │
       │  Storage:  bucket privado `pdfs-impressao`                                   │
       │  Edge Function: cleanup-fila (retenção, horária)                            │
       └───────────────────────────────────────────────────────────────────────────┘
                                          ▲
                                          │ webhook assinado (HMAC)
                                   ┌──────┴───────┐
                                   │ Mercado Pago │   ┌──────────┐
                                   └──────────────┘   │ Telegram │  (bot: notificações
                                                      └────┬─────┘   + comandos admin)
                                                           │ webhook (secret_token)
                                                     Vercel /api/telegram/webhook
```

### Princípio arquitetural central

O sistema é dividido por **fronteiras de confiança**. O que cada fronteira pode
fazer é deliberadamente limitado:

| Fronteira | Confiança | Credencial | Pode |
| --- | --- | --- | --- |
| Navegador | Não confiável | `anon` key (sob RLS) | Ler páginas, subir PDF, inserir pedido em estado inicial, ler status por `id` |
| Vercel (Route Handlers) | Confiável, sem estado | `service_role` + segredos MP/Telegram | Falar com Mercado Pago, escrever status no banco, gerar/resgatar tokens |
| Sede (worker) | Confiável, com estado físico | `service_role` | Ler PDFs de volta, imprimir, publicar heartbeat da impressora |

O **PDF nunca passa pela Vercel** (limite de 10 s / payload no plano gratuito):
vai direto do navegador para o Storage. Os subsistemas **não se chamam
diretamente** — coordenam-se pela coluna `fila_impressao.status`.

---

## 2. Tecnologias utilizadas

### 2.1 Frontend / aplicação web

| Tecnologia | Versão | Papel |
| --- | --- | --- |
| **Next.js** | ^16.2.6 (App Router) | Framework — roteamento, Route Handlers, SSR/CSR, `output: "standalone"` |
| **React** | ^18.3.1 | Biblioteca de UI |
| **TypeScript** | 5.8.3 | Tipagem (`strict: false`, `strictNullChecks: false` — ver nota em §6) |
| **Tailwind CSS** | ^3.4.17 | Estilização utilitária; tema via CSS vars (`--titans-red/orange/gold/dark`) |
| **shadcn/ui** + **Radix UI** | — | Componentes acessíveis (`src/components/ui/*`) |
| **next-themes** | ^0.3.0 | Alternância de tema claro/escuro (default: dark) |
| **lucide-react** | ^0.462 | Ícones |
| **TanStack Query** | ^5.83 | Cache/polling de dados (status de pedido, fila pública, status da impressora) |
| **react-hook-form** + **zod** | ^7.61 / ^3.25 | Formulários e validação (feedback, impressão 3D) |
| **embla-carousel**, **recharts**, **sonner**, **cmdk**, **vaul**, **date-fns** | — | Carrossel, gráficos, toasts, command palette, drawer, datas |

### 2.2 Processamento de PDF (no navegador)

| Tecnologia | Papel |
| --- | --- |
| **pdfjs-dist** ^4.10 | Conta páginas do PDF localmente (worker servido como asset estático em `public/pdf.worker.min.mjs`, copiado por `scripts/copy-pdf-worker.mjs` no `postinstall`/`prebuild`) |
| **pdf-lib** ^1.17 | Mescla vários PDFs num só, no cliente, antes do upload |

### 2.3 Backend serverless (Vercel — Route Handlers em `app/api/**`)

| Tecnologia | Papel |
| --- | --- |
| **@supabase/supabase-js** ^2.107 | Cliente Postgres/Storage (com `service_role` no servidor, `anon` no cliente) |
| **mercadopago** ^2.13 | SDK oficial — cria cobrança PIX e consulta pagamento |
| **node:crypto** | Validação HMAC de assinatura (webhook MP, webhook Telegram, hash de tokens) |
| Runtime | `runtime = "nodejs"` + `dynamic = "force-dynamic"` em todas as rotas |

### 2.4 Persistência — Supabase

| Componente | Papel |
| --- | --- |
| **Postgres** | Tabelas da fila de impressão, preços, status da impressora, chamados, tokens e auditoria de reimpressão |
| **Storage** | Bucket privado `pdfs-impressao` (só `application/pdf`, ≤ 30 MB) |
| **Row Level Security (RLS)** | Isola o cliente anônimo; `service_role` bypassa |
| **Realtime** | Publica mudanças de `fila_impressao` e `impressora_status` para o cliente/kiosk |
| **Edge Functions (Deno)** | `cleanup-fila` — retenção de dados |
| **pg_cron + pg_net** | Agenda `cleanup-fila` de hora em hora |
| **Vault** | Guarda `cleanup_function_secret` |

### 2.5 Print worker (sede)

| Tecnologia | Papel |
| --- | --- |
| **Python 3.7+** | `print-worker/worker.py` — loop de polling, claim atômico, impressão |
| **supabase** (py) ≥ 2.0 | Acesso ao banco/Storage com `service_role` |
| **pypdf** ≥ 4.0 | Reconferência da contagem de páginas + replicação de cópias |
| **CUPS** (`lp`, `lpstat`, `ipptool`) | Fila de impressão IPP Everywhere (Wi-Fi) + fila USB de fallback |
| **systemd** | `print-worker.service` (`Restart=always`, sobe no boot) |
| **Avahi / mDNS** | Resolve o nome `.local` da impressora antes de submeter (checagem de alcançabilidade) |

### 2.6 Totem / kiosk (sede)

| Tecnologia | Papel |
| --- | --- |
| **Raspberry Pi OS (64-bit, Bookworm+)** | SO da Pi 5 (8 GB), Sala 208 |
| **Wayland + labwc** | Compositor gráfico |
| **Chromium** `--kiosk` | Renderiza `https://<site>/kiosk` (a Pi só exibe; a página vive na Vercel) |
| **systemd --user** + **wlopm** | Autostart/watchdog do Chromium e anti-blanking |

### 2.7 Integrações externas

| Serviço | Uso |
| --- | --- |
| **Mercado Pago** | Cobrança PIX (`create-pix`) e confirmação (`webhook`) |
| **Telegram Bot API** | Notificações à equipe (chamados de ajuda, reimpressões) e comandos administrativos de reimpressão (`/reimprimir`, `/gerar_codigo`) |
| **EmailJS** (`@emailjs/browser`) | Envio do formulário de feedback anônimo por e-mail (100% client-side) |

### 2.8 Infraestrutura e DevOps

| Item | Detalhe |
| --- | --- |
| **Hospedagem** | Vercel (`vercel.json`: framework nextjs), domínio `https://www.roboticstitans.com.br` |
| **CI** | GitHub Actions (`.github/workflows/ci.yml`): lint (informativo, não bloqueia) + `next build` (portão de qualidade) em push/PR para `main` |
| **Docker** | `Dockerfile` multi-stage (`node:22-alpine`, output standalone, porta 8080); `docker-compose.yaml` para dev com hot reload |
| **Supabase CLI** | `supabase/migrations/*.sql`, `supabase/config.toml`, `supabase functions deploy` |
| **Node** | 20.9+ (recomendado 22 LTS) |

---

## 3. Estrutura do repositório

```
webTitans/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Root layout (Providers: React Query, tema, toasts)
│   ├── page.tsx              # "/" → src/views/Index
│   ├── login/ inscricao/ feedback/ produtos/ combate/ ssl/ vsss/ seguidor-linha/
│   ├── projetos/            (page + robo-bio, impressao, extensao-escolas)
│   ├── servicos/impressao-3d/
│   ├── impressao/            # checkout web-to-print (+ retirada/)
│   ├── equipe/tarefas/       # quadro Kanban (client-only, sem SSR)
│   ├── kiosk/                # totem (layout próprio full-screen + page client-only)
│   └── api/                  # Route Handlers (runtime nodejs)
│       ├── payments/create-pix/
│       ├── webhooks/mercadopago/
│       ├── telegram/webhook/
│       └── kiosk/{pedido,help,reimpressao}/
├── src/
│   ├── views/                # Componentes de página (importados pelos wrappers de app/)
│   ├── components/           # Header, Footer, cards + ui/ (shadcn) + impressao/ kiosk/ kanban/ servicos/
│   ├── hooks/                # usePedidoStatus, useFilaPublica, useImpressoraStatus, useKanban
│   ├── lib/
│   │   ├── supabase.ts       # cliente browser (anon)
│   │   ├── pdf-utils.ts pricing.ts protocolo.ts retirada.ts types.ts
│   │   ├── kanban/           # types, seed, format
│   │   └── server/           # supabase-admin, mercadopago, mp-signature, telegram,
│   │                         # reimpressao, reimpressao-tokens, pedido-protocolo,
│   │                         # fila, rate-limit
│   └── assets/               # imagens (banners, fotos de membros por modalidade)
├── print-worker/             # worker.py, requirements.txt, .env.example, .service, testes
├── supabase/
│   ├── migrations/           # 0001 … 0012 (.sql)
│   ├── functions/cleanup-fila/index.ts
│   └── config.toml
├── docs/
│   ├── arquitetura-geral.md  # (este documento)
│   └── web-to-print/         # 01…09 + README + kiosk.md
├── scripts/copy-pdf-worker.mjs
├── Dockerfile · docker-compose.yaml · vercel.json · next.config.mjs
└── .github/workflows/ci.yml
```

O padrão de rota: cada `app/**/page.tsx` é um wrapper fino (`"use client"`) que
renderiza um componente de `src/views/`. Páginas que dependem de envs
`NEXT_PUBLIC_*`, Realtime ou `window` (`/impressao`, `/kiosk`, `/equipe/tarefas`)
usam `next/dynamic` com `ssr: false` para o build não pré-renderizá-las.

---

## 4. Módulos funcionais

### 4.1 Site institucional (público, sem estado)

Páginas puramente estáticas/apresentação, servidas pela Vercel:

- **`/`** (`Index`) — hero com carrossel, "Quem Somos" (`#sobre`), "Modalidades"
  (`#modalidades`), "Inscrições" (`#inscricoes`), "Apoiar" (`#apoiar`), parcerias.
- **Modalidades** — `/vsss`, `/ssl`, `/combate`, `/seguidor-linha` — cada uma com
  descrição, galeria e cartões dos membros (fotos em `src/assets/fotos*`).
- **Projetos** — `/projetos` e destaques `/projetos/robo-bio`,
  `/projetos/impressao`, `/projetos/extensao-escolas`.
- **`/produtos`** — vitrine de produtos.

Conteúdo textual mora em `src/lib/*-content.ts`; dados de projetos em
`src/lib/projects-data.ts`. **Nenhuma dessas páginas toca banco.**

### 4.2 Processo seletivo e área de membros (stubs)

- **`/inscricao`** (`Inscricao`) e **`/login`** (`Login`) — formulários montados
  visualmente, mas **sem back-end**: o submit só faz `console.log`. Login não tem
  autenticação implementada. São pontos de evolução futura (provável Supabase Auth).

### 4.3 Feedback anônimo (`/feedback`)

Formulário `react-hook-form` + `zod` (`src/lib/feedback-schema.ts`): 5 escalas
1–5 + 2 respostas curtas + 1 sugestão opcional. No submit, envia via **EmailJS**
(`emailjs.send`) usando `NEXT_PUBLIC_EMAILJS_{SERVICE,TEMPLATE,PUBLIC_KEY}_ID`.
Não persiste nada localmente nem no Supabase — o e-mail é o único registro.

### 4.4 Serviço de impressão 3D (`/servicos/impressao-3d`)

Dois formulários (`src/lib/impressao-3d-schema.ts`): "Preciso de modelagem" e "Já
tenho os arquivos". Captação de leads (nome, e-mail, telefone, origem do
contato). *(Verificar destino do envio no componente de formulário —
`src/components/servicos/*`.)*

### 4.5 Quadro Kanban de tarefas (`/equipe/tarefas`)

`useKanban` (`useReducer`) — CRUD de tarefas com subtarefas, prioridade (1–3),
prazo e três colunas (`pendente` / `em_progresso` / `concluida`).
**Estado 100% em memória**, semeado de `src/lib/kanban/seed.ts`: recarregar a
página zera. Não há persistência nem migration para Kanban — é a V1 (ver commit
`eb50704`). Evolução natural: tabela `tarefas` no Supabase.

### 4.6 Web-to-print (`/impressao`) — fluxo principal

Máquina de 4 passos: `UPLOAD → CONFIG → PAGAMENTO → SUCESSO` (ou `TIMEOUT`).

1. **Upload** — 1 a 10 PDFs (`application/pdf`, ≤ 30 MB cada), lista ordenável;
   contagem de páginas via `pdfjs-dist` no navegador.
2. **Mesclagem** — 2+ arquivos são unidos por `pdf-lib` no cliente; só o PDF
   final (≤ 30 MB) sobe. 1 arquivo sobe byte a byte, sem reescrita.
3. **Configuração** — modo de cor (`PB`/`COLORIDO`); preço **estimado** de
   `config_precos`.
4. **Criação** — upload direto ao bucket `pdfs-impressao` (`<uuid>/<nome>.pdf`) +
   `INSERT` em `fila_impressao` (`status = AGUARDANDO_PAGAMENTO`, sem
   `valor_centavos` — a RLS exige `NULL`).
5. **PIX** — `POST /api/payments/create-pix` **baixa o PDF, reconta as páginas
   com `pdf-lib`, recalcula o valor** (`páginas × cópias × config_precos[modo]`),
   cria a cobrança no Mercado Pago (`idempotencyKey = pedidoId`) e devolve QR
   Code + Copia-e-Cola + expiração (30 min).
6. **Acompanhamento** — `usePedidoStatus`: Realtime (`postgres_changes` filtrado
   por `id`) + polling de 5 s como fallback, até `expiration_date_to`.
7. **Sucesso** — mostra o **protocolo** (8 primeiros caracteres do UUID,
   maiúsculo).

**Confirmação de pagamento**: Mercado Pago chama `POST /api/webhooks/mercadopago`
→ valida assinatura HMAC-SHA256 (`x-signature`, anti-replay de 5 min) → consulta
o pagamento na API do MP → `UPDATE ... SET status='PAGO', paid_at=now() WHERE
id=:ref AND status='AGUARDANDO_PAGAMENTO'` (idempotente). `cancelled`/`rejected`
→ `CANCELADO`.

**Impressão**: o `print-worker` na sede detecta `PAGO`, faz o **claim atômico**
(`UPDATE ... SET status='IMPRIMINDO' WHERE id=:id AND status='PAGO'` — garante
impressão exatamente uma vez), baixa o PDF, reconfere as páginas (divergência →
`ERRO`), replica as cópias no próprio PDF, escolhe a fila CUPS (Wi-Fi primária →
USB fallback, failover só na pré-submissão) e, ao concluir, marca `IMPRESSO` +
`printed_at`. Pedidos presos em `IMPRIMINDO` além de `STUCK_TIMEOUT` (15 min)
voltam a `PAGO`.

Detalhes completos: [`docs/web-to-print/`](web-to-print/README.md).

### 4.7 Totem / kiosk (`/kiosk`) — Sala 208

Interface full-screen touch para quem imprime na sede:

- **Fila pública** (`useFilaPublica`) — lê a **view** `fila_publica` (protocolo
  derivado, nunca o UUID); Realtime de `fila_impressao` como gatilho de refetch
  (+ polling de 30 s).
- **Faixa de status da impressora** (`useImpressoraStatus`) — lê a view
  `impressora_status_publica` (idade do heartbeat calculada no relógio do
  Postgres); traduz `estado` + `detalhes` em texto/cor. Heartbeat > 30 s →
  "Sistema de impressão offline".
- **Consulta por protocolo** — `GET /api/kiosk/pedido?protocolo=XXXXXXXX`
  (server-side, `service_role`, resolve o intervalo de UUID pelo prefixo) devolve
  status + posição na fila.
- **Chamar a equipe** — `POST /api/kiosk/help` grava em `chamados_ajuda`
  (rate-limit de 5 min por protocolo+categoria) e notifica o Telegram.
- **Código de reimpressão** — `POST /api/kiosk/reimpressao` resgata um token de
  uso único (`R-XXXXXXXX`), rate-limit por IP (5/5 min), mensagens genéricas
  anti-oráculo.

A Raspberry Pi que exibe o kiosk **também roda o `print-worker`** (dois papéis,
processos independentes: `systemd --user` para o Chromium, `systemd` de sistema
para o worker).

### 4.8 Reimpressão autorizada (Telegram + totem)

Permite à equipe re-enfileirar um pedido já pago (`ERRO`/`IMPRESSO`, com PDF
ainda retido) **sem cobrar de novo**. Dois fluxos, um núcleo único
(`src/lib/server/reimpressao.ts`):

- **Fluxo A (bot)** — admin envia `/reimprimir <protocolo>` no grupo; o webhook
  `POST /api/telegram/webhook` valida o `secret_token` (tempo constante),
  autoriza por **allowlist de user IDs** (`TELEGRAM_ADMIN_IDS`, nunca por "estar
  no grupo"), aplica a guarda de estado e faz um `UPDATE` atômico condicional
  (`status → PAGO`, `reimpressao = true`, **`paid_at` preservado** → volta ao
  fim do FIFO).
- **Fluxo B (totem)** — admin envia `/gerar_codigo <protocolo>`; o bot devolve um
  código `R-XXXXXXXX` (8 hex de entropia real, só o **hash** vai ao banco,
  validade 24 h, uso único) que o cliente digita no kiosk.

Toda reimpressão bem-sucedida vira linha em `reimpressoes` (auditoria
append-only) e notifica o Telegram (best-effort).

### 4.9 Retenção de dados (`cleanup-fila`)

Edge Function acionada de hora em hora pelo `pg_cron` (autenticada por
`CLEANUP_FUNCTION_SECRET` — comparação em tempo constante):

| Regra | Ação |
| --- | --- |
| `AGUARDANDO_PAGAMENTO` há > 1 h | remove o PDF do Storage + apaga a linha |
| `IMPRESSO` com `printed_at` > 7 dias | remove o PDF, seta `pdf_path = NULL` |
| `IMPRESSO` com `printed_at` > 6 meses | apaga a linha |
| `reimpressao_tokens` expirado ou usado há > 24 h | apaga a linha |

Nunca toca pedido `PAGO` não impresso nem token ainda válido.

---

## 5. Fluxos de dados e máquina de estados

### 5.1 `fila_impressao.status` — ponto único de coordenação

```
            checkout: anon INSERT
                    │
                    ▼
        AGUARDANDO_PAGAMENTO ──── webhook cancelled/rejected ──► CANCELADO (terminal)
                    │
     webhook approved (service_role, idempotente; seta paid_at)
                    ▼
                  PAGO ◄───────────────┐
                    │                  │ recuperação de travados
       worker: claim atômico           │ (preso > STUCK_TIMEOUT = 15 min)
       UPDATE ... WHERE status='PAGO'  │
                    ▼                  │
               IMPRIMINDO ─────────────┘
                 │      │
   CUPS concluiu │      │ falha download / PDF inválido / divergência de páginas
                 ▼      ▼                        / timeout CUPS pós-aceitação
     IMPRESSO (+printed_at)                  ERRO (terminal, intervenção manual)
        (terminal)
```

- Transições após `AGUARDANDO_PAGAMENTO` são **exclusivas do `service_role`**
  (webhook e worker) — a RLS nega `UPDATE`/`DELETE` ao `anon`.
- **Reimpressão**: `ERRO`/`IMPRESSO` → `PAGO` (via núcleo de reimpressão),
  preservando `paid_at`.
- **Timeout de pagamento** é só de UI: a linha permanece; se o PIX for pago
  depois, o status ainda vira `PAGO`.

### 5.2 Mecanismos de robustez

| Problema | Solução |
| --- | --- |
| Dois workers competindo | Claim atômico `UPDATE ... WHERE status='PAGO'` → só um vence |
| Mercado Pago reenvia webhooks (2 canais) | `WHERE status='AGUARDANDO_PAGAMENTO'` torna o `UPDATE` idempotente; 200 para tudo não-acionável |
| Cliente clica "Pagar" 2×​ | `idempotencyKey = pedidoId` no MP → mesmo pagamento |
| Realtime cai silenciosamente | Polling de fallback (5 s pedido, 30 s fila/kiosk) |
| Impressora Wi-Fi desligada (fica `enabled` no CUPS) | Checagem de alcançabilidade TCP/mDNS antes de submeter → failover pré-submissão para USB |
| Job já aceito pelo CUPS falha | **Sem** failover (evita duplicar dezenas de folhas) → `ERRO` |
| Worker preso em `IMPRIMINDO` | `recuperar_travados` re-fila após `STUCK_TIMEOUT` |
| Relógio do dispositivo do totem dessincronizado | Idade do heartbeat calculada no Postgres (view + trigger, migration 0012); cliente extrapola com `performance.now()` |
| Força bruta de código de reimpressão | Uso único + hash + expiração 24 h + rate-limit por IP + mensagem genérica + route separada da consulta |

---

## 6. Segurança

### 6.1 Segredos por ambiente

| Segredo | Navegador | Vercel | Sede |
| --- | :---: | :---: | :---: |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ (público por design, restrito por RLS) | — | — |
| `NEXT_PUBLIC_TELEGRAM_HELP_INVITE_URL` | ✅ (convite público) | — | — |
| `NEXT_PUBLIC_EMAILJS_*` | ✅ | — | — |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ **nunca** | ✅ | ✅ (`.env` `chmod 600`) |
| `MERCADOPAGO_ACCESS_TOKEN` / `MERCADOPAGO_WEBHOOK_SECRET` | ❌ nunca | ✅ | — |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | ❌ nunca | ✅ | — |
| `TELEGRAM_ADMIN_IDS` / `TELEGRAM_WEBHOOK_SECRET` | ❌ nunca | ✅ | — |
| `CLEANUP_FUNCTION_SECRET` | ❌ nunca | — (Supabase Vault + Edge env) | — |
| `PUBLIC_BASE_URL` | — | ✅ | — |

**Regra**: segredo de servidor **nunca** leva o prefixo `NEXT_PUBLIC_` (isso o
empacotaria no bundle do cliente). Verificação:
`grep -r MERCADOPAGO_ACCESS_TOKEN .next/static/` deve retornar 0.

Clientes Supabase de servidor (`supabase-admin.ts`) e o SDK do Mercado Pago
(`mercadopago.ts`) usam **inicialização preguiçosa** (Proxy) para o `next build`
no CI não quebrar por env ausente.

### 6.2 Validação de webhooks

- **Mercado Pago** (`mp-signature.ts`): recompõe o manifest
  `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, compara
  `HMAC_SHA256(secret, manifest)` com `v1` em tempo constante (`timingSafeEqual`);
  rejeita `ts` fora de janela de 5 min. Inválido → 401 sem tocar o banco.
- **Telegram** (`/api/telegram/webhook`): exige o header
  `X-Telegram-Bot-Api-Secret-Token` igual a `TELEGRAM_WEBHOOK_SECRET` (tempo
  constante) **antes** de olhar o corpo; depois, allowlist de user IDs.

### 6.3 RLS (Supabase)

Detalhe por tabela na §7. Resumo do que o cliente `anon` pode:

- **`fila_impressao`**: `INSERT` só em `AGUARDANDO_PAGAMENTO` com
  `valor_centavos`/`mp_payment_id`/`paid_at`/`printed_at` nulos e
  `quantidade_copias >= 1`; `SELECT` liberado (`using (true)` — a proteção é o
  UUID opaco na query). **Sem** `UPDATE`/`DELETE`.
- **`config_precos`**: só `SELECT`.
- **`impressora_status`**: só `SELECT`.
- **`chamados_ajuda`, `reimpressao_tokens`, `reimpressoes`**: RLS habilitado
  **sem nenhuma policy** → todo acesso `anon` negado; só `service_role` (Route
  Handlers) entra.
- **Storage `pdfs-impressao`**: `anon` só `INSERT` (upload); `SELECT`/`UPDATE`/
  `DELETE` negados. Bucket privado, `allowed_mime_types = ['application/pdf']`,
  `file_size_limit = 30 MB` — impostos pelo próprio Storage.

**Risco conhecido aceito**: a policy de `SELECT` de `fila_impressao` é permissiva
(`using (true)`). A auditoria concluiu que um UUID v4 é inviável de enumerar; um
token de leitura separado da PK fica como evolução futura.

### 6.4 Nota sobre TypeScript

O projeto roda com `strictNullChecks: false`. Sem ele, o TS **não estreita
uniões discriminadas por booleano** quando a condição é negada (`!x.ok`) — só com
comparação explícita (`x.ok === false`). Essa convenção é seguida em todo
`src/lib/server/reimpressao*.ts`.

---

## 7. Descrição do banco de dados

**SGBD**: PostgreSQL (gerenciado pelo Supabase). Schema: `public`.
**Timezone**: `America/Sao_Paulo` (migration 0006 — só exibição; `timestamptz`
continua em UTC). **Extensões**: `pgcrypto` (0001), `pg_cron` + `pg_net` (0002).
Migrations em `supabase/migrations/0001…0012`.

### 7.1 Diagrama de relacionamentos (lógico)

```
config_precos ──(modo_cor, leitura no create-pix e no checkout)──┐
                                                                 │
                                            ┌────────────────────▼─────────────────┐
                                            │           fila_impressao             │
                                            │  (PK id uuid = protocolo/token)       │
                                            └──┬───────────┬──────────────┬─────────┘
                        view fila_publica ─────┘           │              │
             (protocolo = upper(left(id,8)))               │              │
                                                           │              │
   reimpressao_tokens.pedido_id ──(ref. lógica, sem FK)────┘              │
   reimpressoes.pedido_id ───────(ref. lógica, sem FK)────────────────────┘

   impressora_status (PK fila text)  ──► view impressora_status_publica (idade_ms)
   chamados_ajuda (PK id uuid, protocolo opcional — texto, sem FK)
   Storage: bucket pdfs-impressao  ◄── fila_impressao.pdf_path (caminho <uuid>/<nome>.pdf)
```

> As tabelas de reimpressão referenciam `fila_impressao.id` **logicamente, sem
> chave estrangeira** — de propósito: o `cleanup-fila` apaga pedidos `IMPRESSO`
> após 6 meses, e uma FK travaria esse `DELETE`. A integridade é garantida pela
> aplicação (`service_role`).

---

### 7.2 Tabela `fila_impressao`

A fila de pedidos de impressão. Núcleo do sistema — a coluna `status` coordena
todos os subsistemas.

| Coluna | Tipo | Nulo? | Default | Descrição |
| --- | --- | :---: | --- | --- |
| `id` | `uuid` | não | `gen_random_uuid()` | **PK**. Serve de protocolo (8 primeiros hex, maiúsculo) e de token de leitura do pedido. |
| `created_at` | `timestamptz` | não | `now()` | Criação do pedido (INSERT do cliente). |
| `pdf_path` | `text` | **sim** ¹ | — | Caminho no bucket `pdfs-impressao` (`<uuid>/<nome>.pdf`). Sempre **um único objeto** por pedido (o navegador mescla vários PDFs antes de subir). Anulado pela limpeza 7 dias após `IMPRESSO`. |
| `num_paginas` | `int` | não | — | `> 0`. Com vários arquivos, a **soma**. Declarado pelo cliente, **reconferido e sobrescrito** pelo `create-pix` e pelo worker. |
| `modo_cor` | `text` | não | — | `CHECK IN ('PB','COLORIDO')`. |
| `valor_centavos` | `int` | **sim** ² | — | `CHECK (is null OR > 0)`. `NULL` no INSERT (a RLS exige); preenchido pelo `create-pix` com o valor autoritativo do servidor. |
| `quantidade_copias` | `int` | não | `1` | `CHECK (>= 1)`. Adicionada em 0007; default preserva retrocompatibilidade. Autoridade do servidor (lida da linha pelo `create-pix`). |
| `status` | `text` | não | `'AGUARDANDO_PAGAMENTO'` | `CHECK IN ('AGUARDANDO_PAGAMENTO','PAGO','IMPRIMINDO','IMPRESSO','ERRO','CANCELADO')`. `IMPRIMINDO` veio em 0004. |
| `reimpressao` | `boolean` | não | `false` | `true` quando o pedido foi re-enfileirado para reimpressão (0011). Não altera o ciclo de status nem o FIFO. |
| `mp_payment_id` | `text` | sim | — | ID do pagamento no Mercado Pago; preenchido pelo `create-pix`. |
| `mp_preference_id` | `text` | sim | — | Reservado (não usado no fluxo PIX atual). |
| `paid_at` | `timestamptz` | sim | — | Setado pelo webhook ao aprovar. **Chave de ordenação FIFO** da fila. Preservado nas reimpressões. |
| `printed_at` | `timestamptz` | sim | — | Setado pelo worker ao concluir a impressão. |

¹ Criada `NOT NULL` em 0001, tornada nullable em 0005 (a limpeza precisa anular).
² Criada `NOT NULL` em 0001, tornada nullable em 0002 (autoridade de preço no servidor).

**Índices**: `fila_impressao_status_idx` em `(status)` — o worker varre
`status = 'PAGO'` eficientemente.

**RLS** (habilitado):

| Policy | Comando | Regra |
| --- | --- | --- |
| `fila_impressao_anon_insert` | `INSERT` (anon) | `status = 'AGUARDANDO_PAGAMENTO' AND valor_centavos IS NULL AND mp_payment_id IS NULL AND paid_at IS NULL AND printed_at IS NULL AND quantidade_copias >= 1` |
| `fila_impressao_anon_select` | `SELECT` (anon) | `using (true)` — proteção efetiva é o UUID opaco na query |
| (sem policy) | `UPDATE` / `DELETE` (anon) | Negado. Só `service_role`. |

**Realtime**: tabela adicionada à publicação `supabase_realtime` (0001) — clientes
assinam `postgres_changes` na sua linha.

---

### 7.3 Tabela `config_precos`

Preço por página, por modo de cor. Editável no painel do Supabase **sem deploy**.

| Coluna | Tipo | Nulo? | Descrição |
| --- | --- | :---: | --- |
| `modo_cor` | `text` | não | **PK**. `CHECK IN ('PB','COLORIDO')`. |
| `valor_centavos_por_pagina` | `int` | não | `CHECK (> 0)`. |

**Seed inicial**: `PB = 50`, `COLORIDO = 200` (centavos).
**RLS**: `config_precos_anon_select` — `anon` só `SELECT`.

---

### 7.4 Tabela `impressora_status`

Heartbeat da impressora, gravado pelo `print-worker` a cada ciclo, lido pelo
kiosk e pela página `/impressao`.

| Coluna | Tipo | Nulo? | Default | Descrição |
| --- | --- | :---: | --- | --- |
| `fila` | `text` | não | — | **PK**. Nome da fila CUPS (ex.: `Titans_Laser`). |
| `estado` | `text` | não | — | `CHECK IN ('OK','IMPRIMINDO','PAUSADA','INALCANCAVEL','SEM_PAPEL','SEM_TONER','MANUTENCAO')`. Os três últimos vieram em 0009 (monitoramento de saúde via IPP). |
| `detalhes` | `jsonb` | sim | — | `{ toner_pct, state_reasons[], toner_baixo }` — diagnóstico coletado via `ipptool` (`printer-state-reasons`, `marker-levels`). |
| `atualizado_em` | `timestamptz` | não | `now()` | **Forçado por trigger** (`impressora_status_relogio_servidor`, 0012) para `now()` do Postgres a cada INSERT/UPDATE — elimina dependência do relógio da Raspberry Pi. |

**RLS**: `impressora_status_anon_select` — `anon` só `SELECT`; escrita só
`service_role`.
**Realtime**: adicionada à publicação `supabase_realtime` (0008).

---

### 7.5 Tabela `chamados_ajuda`

Registros do botão "Chamar a equipe" do kiosk.

| Coluna | Tipo | Nulo? | Default | Descrição |
| --- | --- | :---: | --- | --- |
| `id` | `uuid` | não | `gen_random_uuid()` | **PK**. |
| `protocolo` | `text` | sim | — | `CHECK (is null OR ~ '^[0-9A-F]{8}$')`. Protocolo do pedido, se informado. |
| `categoria` | `text` | não | — | `CHECK IN ('NAO_SAIU','SAIU_COM_DEFEITO','OUTRO')`. |
| `criado_em` | `timestamptz` | não | `now()` | — |
| `resolvido_em` | `timestamptz` | sim | — | Marcação manual de resolução (não usada pela UI atual). |

**Índice**: `chamados_ajuda_recentes_idx` em `(criado_em desc)` — para o
rate-limit da API (chamado idêntico em 5 min é rejeitado).
**RLS**: habilitado **sem policy** → acesso `anon` negado; só a Route Handler
`/api/kiosk/help` (`service_role`) escreve/lê.

---

### 7.6 Tabela `reimpressao_tokens`

Códigos de uso único (`R-XXXXXXXX`) do fluxo B (totem), gerados pelo bot do
Telegram. Introduzida em 0011.

| Coluna | Tipo | Nulo? | Default | Descrição |
| --- | --- | :---: | --- | --- |
| `id` | `uuid` | não | `gen_random_uuid()` | **PK**. |
| `token_hash` | `text` | não | — | `SHA-256` do código. **O texto puro nunca é armazenado.** |
| `pedido_id` | `uuid` | não | — | Referência **lógica** a `fila_impressao.id` (sem FK). |
| `expira_em` | `timestamptz` | não | — | Validade (24 h a partir da criação). |
| `usado_em` | `timestamptz` | sim | — | Setado no resgate atômico (uso único). |
| `criado_por` | `bigint` | sim | — | Telegram user ID do admin que gerou. |
| `criado_em` | `timestamptz` | não | `now()` | — |

**Índice**: `reimpressao_tokens_token_hash_idx` em `(token_hash)`.
**RLS**: habilitado **sem policy** → só `service_role`.
**Resgate**: um único `UPDATE ... SET usado_em = now() WHERE token_hash = :h AND
pedido_id = :id AND usado_em IS NULL AND expira_em > now()` com `RETURNING` —
toda a condição num só passo atômico.
**Limpeza**: `cleanup-fila` apaga tokens expirados ou usados há > 24 h.

---

### 7.7 Tabela `reimpressoes`

Auditoria **append-only** de toda reimpressão bem-sucedida. Introduzida em 0011.

| Coluna | Tipo | Nulo? | Default | Descrição |
| --- | --- | :---: | --- | --- |
| `id` | `uuid` | não | `gen_random_uuid()` | **PK**. |
| `pedido_id` | `uuid` | não | — | Referência **lógica** a `fila_impressao.id` (sem FK). |
| `protocolo` | `text` | não | — | `CHECK (~ '^[0-9A-F]{8}$')`. |
| `origem` | `text` | não | — | `CHECK IN ('bot','totem')`. |
| `telegram_user_id` | `bigint` | sim | — | Admin que autorizou (só no fluxo bot). |
| `criado_em` | `timestamptz` | não | `now()` | — |

**Índice**: `reimpressoes_pedido_id_idx` em `(pedido_id)`.
**RLS**: habilitado **sem policy** → só `service_role`.

---

### 7.8 Views

#### `fila_publica` (0008, ampliada em 0010)

`security_invoker = on` — roda com os direitos de quem consulta (o `SELECT` do
`anon` passa pela policy de `fila_impressao`). Expõe o **protocolo derivado**,
nunca o UUID.

| Coluna | Origem |
| --- | --- |
| `protocolo` | `upper(left(id::text, 8))` |
| `status`, `num_paginas`, `quantidade_copias`, `modo_cor`, `paid_at`, `printed_at` | colunas de `fila_impressao` |

**Filtro**: `status IN ('PAGO','IMPRIMINDO')` **OU** (`IMPRESSO` e `printed_at >
now() - 24h`) **OU** (`ERRO` e `paid_at > now() - 24h`). Ordenado por `paid_at asc`.
`GRANT SELECT` a `anon, authenticated`.

#### `impressora_status_publica` (0012)

`security_invoker = on`. Expõe a **idade do heartbeat calculada no servidor**,
para o cliente nunca comparar timestamps contra o próprio relógio.

| Coluna | Origem |
| --- | --- |
| `estado`, `detalhes`, `atualizado_em` | colunas de `impressora_status` |
| `idade_ms` | `extract(epoch from (now() - atualizado_em)) * 1000` |

`GRANT SELECT` a `anon, authenticated`.

---

### 7.9 Storage — bucket `pdfs-impressao`

| Propriedade | Valor |
| --- | --- |
| `public` | `false` (não servível por URL pública) |
| `allowed_mime_types` | `['application/pdf']` (0002) |
| `file_size_limit` | `31457280` bytes = 30 MB (0002) |
| Policy `pdfs_impressao_anon_insert` | `anon` só `INSERT` (`bucket_id = 'pdfs-impressao'`) |
| `SELECT` / `UPDATE` / `DELETE` | Sem policy → negados ao `anon`; só `service_role` (worker e `create-pix`) lê |

Layout dos objetos: `<uuid-do-pedido>/<nome-sanitizado>.pdf` (ou
`pedido-<N>-arquivos.pdf` quando houve mesclagem).

---

### 7.10 Automação no banco

| Objeto | Definição | Função |
| --- | --- | --- |
| `cron.job` `cleanup-fila-hourly` | `pg_cron`, `'0 * * * *'` (0003) | `net.http_post` para a Edge Function `cleanup-fila` com `Authorization: Bearer <vault:cleanup_function_secret>` |
| Trigger `impressora_status_relogio_servidor` | `BEFORE INSERT OR UPDATE` em `impressora_status` (0012) | `new.atualizado_em := now()` |
| Função `impressora_status_definir_relogio_servidor()` | `plpgsql`, `security invoker`, `search_path = ''` | corpo do trigger acima |

---

## 8. Ambientes e configuração

### 8.1 Variáveis de ambiente

**Cliente (`.env.local`, prefixo `NEXT_PUBLIC_`)** — empacotadas no bundle:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_TELEGRAM_HELP_INVITE_URL      # opcional (botão Telegram no kiosk)
NEXT_PUBLIC_EMAILJS_SERVICE_ID
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
```

**Servidor (Vercel Project Settings — sem `NEXT_PUBLIC_`)**:

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET
TELEGRAM_BOT_TOKEN                        # opcional (notificações)
TELEGRAM_CHAT_ID                          # opcional
TELEGRAM_ADMIN_IDS                        # allowlist de user IDs (comandos)
TELEGRAM_WEBHOOK_SECRET                   # secret_token do setWebhook
PUBLIC_BASE_URL=https://www.roboticstitans.com.br
```

**Sede (`print-worker/.env`, `chmod 600`)**:

```
SUPABASE_URL                              (obrigatória)
SUPABASE_SERVICE_ROLE_KEY                 (obrigatória)
PRINTER_NAME=Titans_Laser                 (obrigatória — fila CUPS primária Wi-Fi)
PRINTER_NAME_FALLBACK                     (opcional — fila USB)
POLL_INTERVAL=10  PRINT_TIMEOUT=180  STUCK_TIMEOUT=900
REACHABILITY_TIMEOUT=3  LP_OPTIONS=fit-to-page
```

**Supabase (Edge / Vault)**: `CLEANUP_FUNCTION_SECRET`.

### 8.2 Deploy

| Alvo | Como |
| --- | --- |
| Site + API | Push para `main` → Vercel build (`next build`, output standalone) |
| Migrations | `supabase db push` ou SQL Editor, na ordem `0001…0012` |
| Edge Function | `supabase functions deploy cleanup-fila` + `supabase secrets set CLEANUP_FUNCTION_SECRET=…` + agendar (0003) |
| Worker | `git pull` / `cp worker.py` em `/opt/print-worker` + `systemctl restart print-worker` |
| Kiosk | Só `git push` da UI; a Pi renderiza a Vercel. Provisionamento manual — ver [`docs/web-to-print/kiosk.md`](web-to-print/kiosk.md) |
| Docker (alternativa) | `docker build -t auth .` / `docker run -p 5000:8080 auth` ou `docker compose up` (dev) |

### 8.3 CI (`.github/workflows/ci.yml`)

Em `push`/`pull_request` para `main`, `ubuntu-latest`, Node 22:

1. `npm ci`
2. `npm run lint` — **informativo**, `continue-on-error: true` (erros pré-existentes no shadcn/ui)
3. `npm run build` — **portão de qualidade** (type-check + build de produção)

---

## 9. Observações e evoluções futuras

| Item | Situação |
| --- | --- |
| Login / área de membros | Stub (só `console.log`) — falta autenticação (provável Supabase Auth) |
| Inscrição no processo seletivo | Stub — falta persistência |
| Kanban de tarefas | V1 em memória — falta tabela `tarefas` + realtime |
| Formulário de impressão 3D | Captação por formulário — verificar destino do envio |
| Feedback | Só e-mail (EmailJS), sem histórico consultável |
| Modo `COLORIDO` no checkout | Ainda aparece na UI, mas a HP Laser 135w é monocromática (sai em cinza, com aviso no log do worker) |
| Policy `SELECT` de `fila_impressao` | Permissiva (`using (true)`) — risco aceito; token de leitura separado da PK fica como evolução |
| Worker em máquina única | Se a sede cai, pedidos acumulam em `PAGO` e drenam quando volta |

---

## 10. Referências

- [`docs/web-to-print/README.md`](web-to-print/README.md) — índice da feature de impressão
- [`docs/web-to-print/01-arquitetura.md`](web-to-print/01-arquitetura.md) — fronteiras de execução
- [`docs/web-to-print/02-fluxo-pedido.md`](web-to-print/02-fluxo-pedido.md) — máquina de estados
- [`docs/web-to-print/05-supabase.md`](web-to-print/05-supabase.md) — armazenamento
- [`docs/web-to-print/06-print-worker.md`](web-to-print/06-print-worker.md) — worker
- [`docs/web-to-print/08-seguranca.md`](web-to-print/08-seguranca.md) — segurança
- [`docs/web-to-print/09-diagramas.md`](web-to-print/09-diagramas.md) — diagramas UML (Mermaid)
- [`docs/web-to-print/kiosk.md`](web-to-print/kiosk.md) — provisionamento da Raspberry Pi
- [`print-worker/README.md`](../print-worker/README.md) — instalação do worker
- `supabase/migrations/` — fonte de verdade do schema
