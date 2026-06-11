# 01 — Arquitetura

[← Índice](README.md)

## Os quatro componentes

| Componente | Responsabilidade | Não faz |
| --- | --- | --- |
| **Checkout** (`src/`) | Recebe o PDF, conta páginas, calcula preço, cria o pedido, dispara o PIX e acompanha o status até o sucesso. | Nunca processa o pagamento nem imprime; não tem segredos de servidor. |
| **Pagamento PIX** (`app/api/`) | Gera a cobrança PIX no Mercado Pago e processa o webhook de confirmação, escrevendo o status no banco. | Nunca toca o arquivo PDF. |
| **Armazenamento** (Supabase) | Guarda o PDF (Storage), a fila e os preços (Postgres), aplica RLS e publica mudanças via Realtime. | Não tem lógica de negócio; é o ponto de encontro dos outros três. |
| **Print worker** (`print-worker/`) | Detecta pedidos pagos, baixa o PDF, reconfere páginas e imprime na HP Laser MFP via fila CUPS de rede (Wi-Fi), com fallback USB. | Não fala com o Mercado Pago nem com o cliente. |

## As três fronteiras de execução

A feature roda em três lugares com níveis de confiança diferentes. **Esse é o eixo de
segurança da arquitetura** — o que cada fronteira pode fazer é deliberadamente limitado.

### 1. Navegador (não confiável)

- Roda o app **Next.js (App Router)** servido pela Vercel.
- Usa apenas a **anon key** do Supabase (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`),
  que está sob RLS: só pode **inserir** pedidos em estado inicial e **ler** uma linha pelo
  `id`. Não consegue marcar nada como pago nem ler PDFs de volta.
- Faz **upload do PDF direto ao Storage** e a **contagem de páginas localmente**.

### 2. Vercel (confiável, sem estado)

- Roda os **Next.js Route Handlers** em `app/api/**/route.ts` (runtime Node, `runtime = "nodejs"`).
- Detém a **`SUPABASE_SERVICE_ROLE_KEY`** (bypassa RLS) e os segredos do Mercado Pago
  (`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`) — todos como variáveis de
  ambiente (Project Settings da Vercel) **sem** prefixo `NEXT_PUBLIC_`, então nunca vão para o
  bundle do cliente.
- É efêmera (timeout de 10s no plano gratuito) e **nunca toca o PDF**.

### 3. Sede (confiável, com estado físico)

- Máquina Linux que imprime na HP Laser MFP por uma fila CUPS de rede (Wi-Fi / IPP
  Everywhere `Titans_Laser`), com fila USB de fallback, rodando o worker Python como serviço
  systemd.
- Também detém a **`service_role` key**, num `.env` com permissão `0600` (ver [08](08-seguranca.md)).
- É o **único lugar fora da Vercel que lê o PDF de volta** — porque é onde a impressão
  física acontece.

## Por que o PDF não passa pela Vercel

O site está no **plano gratuito da Vercel**, que impõe:

- **Timeout de 10s** nas funções serverless (os Route Handlers viram funções na Vercel) —
  insuficiente para receber e repassar um PDF de dezenas de MB.
- **Limite de tamanho de payload** nas funções.
- **Sem armazenamento persistente.**

Por isso o upload vai **direto do navegador para o Supabase Storage** usando a anon key, e
a Vercel só lida com pagamento (dados pequenos e rápidos). Foi a decisão arquitetural que
moldou todo o resto.

## Por que a contagem de páginas é feita no cliente

O preço depende do número de páginas. Contar no cliente (via `pdfjs-dist`) permite mostrar
o preço **imediatamente**, sem round-trip de servidor com o arquivo. Como isso é
falsificável, o worker **reconfere** a contagem antes de imprimir (defesa em profundidade —
ver [02](02-fluxo-pedido.md) e [06](06-print-worker.md)).

## Onde vivem os segredos

| Segredo | Navegador | Vercel | Sede |
| --- | :---: | :---: | :---: |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon) | ✅ | — | — |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ nunca | ✅ | ✅ |
| `MERCADOPAGO_ACCESS_TOKEN` | ❌ nunca | ✅ | — |
| `MERCADOPAGO_WEBHOOK_SECRET` | ❌ nunca | ✅ | — |

Detalhes e cuidados em [08 — Segurança](08-seguranca.md).

---

Próximo: [02 — Fluxo do pedido e máquina de estados](02-fluxo-pedido.md)
