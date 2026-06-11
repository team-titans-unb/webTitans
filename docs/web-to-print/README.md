# Web-to-Print — Documentação da feature

Serviço de impressão sob demanda acoplado ao site da TITANS: qualquer pessoa envia um PDF
em `/impressao`, paga via PIX, e o documento é impresso na **HP Laser MFP** na sede (fila
CUPS de rede Wi-Fi, com fallback USB), sem intervenção manual da equipe.

## Visão geral em uma página

A feature é composta por **quatro subsistemas** que rodam em **três ambientes** distintos
e se coordenam exclusivamente pela coluna `fila_impressao.status` no Supabase:

```
   NAVEGADOR (cliente)              VERCEL (serverless)            SEDE (máquina Linux)
  ┌─────────────────────┐        ┌──────────────────────┐       ┌─────────────────────┐
  │ /impressao (Next.js)│        │ /api/payments/        │       │ print-worker.py     │
  │  • upload do PDF    │        │   create-pix          │       │  (serviço systemd)  │
  │  • conta páginas    │        │ /api/webhooks/        │       │  • polling FIFO     │
  │    (pdfjs-dist)     │        │   mercadopago         │       │  • claim atômico    │
  │  • calcula preço    │        │  (usa service_role)   │       │  • baixa o PDF      │
  │  • acompanha status │        │                       │       │  • imprime via CUPS │
  └──────────┬──────────┘        └──────────┬───────────┘       └──────────┬──────────┘
             │ anon key                     │ service_role / MP            │ service_role
             ▼                              ▼                              ▼
        ┌──────────────────────────────────────────────────────────────────────────┐
        │                              SUPABASE                                       │
        │  Storage: bucket privado `pdfs-impressao`  │  DB: `fila_impressao`,         │
        │                                            │      `config_precos` (+RLS,    │
        │                                            │      Realtime)                  │
        └──────────────────────────────────────────────────────────────────────────┘
```

| Subsistema | Onde roda | Faz | Spec canônica |
| --- | --- | --- | --- |
| **Checkout** | Navegador (Next.js / App Router) | Upload, contagem de páginas, preço, pagamento, acompanhamento | [`web-to-print-checkout`](../../openspec/specs/web-to-print-checkout/spec.md) |
| **Pagamento PIX** | Vercel (Next.js Route Handlers) | Gera o PIX e processa o webhook do Mercado Pago | [`mercadopago-pix-integration`](../../openspec/specs/mercadopago-pix-integration/spec.md) |
| **Armazenamento** | Supabase | Tabelas, bucket privado, RLS, Realtime | [`print-queue-storage`](../../openspec/specs/print-queue-storage/spec.md) |
| **Print worker** | Máquina da sede (Python + systemd) | Detecta pedidos pagos e imprime | [`print-worker`](../../openspec/specs/print-worker/spec.md) |

**Princípio central:** o PDF nunca passa pela Vercel (vai direto do navegador ao Storage),
e os quatro subsistemas não se falam diretamente — eles se coordenam pela máquina de
estados de `status`.

## Índice

1. [Arquitetura](01-arquitetura.md) — os quatro componentes, as três fronteiras de execução e onde vivem os segredos.
2. [Fluxo do pedido e máquina de estados](02-fluxo-pedido.md) — o ciclo de vida de um pedido, transição a transição.
3. [Checkout (frontend)](03-checkout.md) — a página `/impressao`.
4. [Pagamento PIX (Route Handlers)](04-pagamento-pix.md) — `create-pix` e o webhook.
5. [Armazenamento Supabase](05-supabase.md) — tabelas, bucket, RLS, Realtime.
6. [Print worker](06-print-worker.md) — o serviço Python da sede.
7. [Operação (runbook)](07-operacao.md) — instalar/atualizar o worker, tratar `ERRO`, re-filar.
8. [Segurança](08-seguranca.md) — segredos por ambiente, webhook, RLS.
9. [Diagramas (UML)](09-diagramas.md) — implantação, atividades e caso de uso.

## Para quem é cada documento

- **Vou mexer no frontend** → [03](03-checkout.md).
- **Vou mexer no pagamento** → [04](04-pagamento-pix.md) e [08](08-seguranca.md).
- **Vou mexer no banco/RLS** → [05](05-supabase.md).
- **Vou operar/depurar a impressão na sede** → [06](06-print-worker.md) e [07](07-operacao.md).
- **Quero entender o todo** → [01](01-arquitetura.md) e [02](02-fluxo-pedido.md).
