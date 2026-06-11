# 05 — Armazenamento Supabase

[← Índice](README.md) · Spec canônica: [`print-queue-storage`](../../openspec/specs/print-queue-storage/spec.md)

## Responsabilidade

O Supabase é o backbone da feature e o ponto de encontro dos outros três subsistemas:
guarda o PDF (Storage), a fila e os preços (Postgres), aplica as regras de acesso (RLS) e
publica mudanças (Realtime). Migrations em `supabase/migrations/`.

## `fila_impressao`

A fila de pedidos. Definida em `0001_fila_impressao.sql`; o status `IMPRIMINDO` veio em
`0004_print_worker.sql`. O hardening tornou `valor_centavos` nullable (`0002`) e `pdf_path`
nullable (`0005`).

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()`; serve de protocolo e de token de leitura. |
| `created_at` | timestamptz | `now()`. |
| `pdf_path` | text? | Caminho no bucket (`<uuid>/<nome>.pdf`). Anulado pela limpeza após 7 dias. |
| `num_paginas` | int | `> 0`. Declarado pelo cliente, **reconferido e sobrescrito** pelo `create-pix` (e pelo worker). |
| `modo_cor` | text | `'PB'` ou `'COLORIDO'`. |
| `valor_centavos` | int? | `NULL` no INSERT; preenchido pelo `create-pix` (`> 0`). |
| `status` | text | `AGUARDANDO_PAGAMENTO`/`PAGO`/`IMPRIMINDO`/`IMPRESSO`/`ERRO`/`CANCELADO`. Default `AGUARDANDO_PAGAMENTO`. |
| `mp_payment_id` | text? | Preenchido pelo `create-pix`. |
| `mp_preference_id` | text? | Reservado. |
| `paid_at` | timestamptz? | Setado pelo webhook ao aprovar. |
| `printed_at` | timestamptz? | Setado pelo worker ao imprimir. |

**Índice:** `fila_impressao_status_idx` em `(status)` — o worker varre `status='PAGO'`
eficientemente. A máquina de estados está em [02](02-fluxo-pedido.md).

## `config_precos`

Preço por página, por modo de cor — editável no painel **sem deploy**.

| Campo | Tipo |
| --- | --- |
| `modo_cor` | text PK (`'PB'`/`'COLORIDO'`) |
| `valor_centavos_por_pagina` | int `> 0` |

Seed inicial: `PB = 50`, `COLORIDO = 200` (centavos). Mudar uma linha no Table Editor já
afeta os próximos checkouts.

## Bucket `pdfs-impressao` (privado)

- Criado com `public = false` — **não** é servível por URL pública.
- **Limites no bucket** (`0002`): `allowed_mime_types = ['application/pdf']` e
  `file_size_limit = 30 MB` — violações são rejeitadas pelo próprio Storage, mesmo via API
  direta com a anon key.
- Policy `pdfs_impressao_anon_insert`: `anon` só pode **INSERT** (upload). SELECT/UPDATE/
  DELETE não têm policy → negados.
- Quem lê os PDFs de volta é a `service_role` (o worker da sede). Ver [06](06-print-worker.md).

## RLS

RLS habilitado em `fila_impressao` e `config_precos`. A `service_role` (Vercel e sede)
**bypassa** RLS — por isso o webhook e o worker conseguem escrever.

**`fila_impressao`:**

- `fila_impressao_anon_insert` — `anon` só insere com `status='AGUARDANDO_PAGAMENTO' AND
  valor_centavos IS NULL AND mp_payment_id IS NULL AND paid_at IS NULL AND printed_at IS NULL`
  (o `valor_centavos IS NULL` veio no `0002`). O cliente não cria pedido já "pago" **nem**
  define o preço.
- `fila_impressao_anon_select` — `anon` pode `SELECT` (`using (true)`). Na prática a
  proteção é o `id` (UUID opaco) que o cliente precisa fornecer na query; sem ele, teria
  que adivinhar UUIDs.
- **UPDATE / DELETE** — sem policy para `anon` → negados. O cliente nunca muda status.

**`config_precos`:** `anon` só pode `SELECT`.

> **Ponto de atenção.** A policy de SELECT é permissiva (`using (true)`): quem
> souber/adivinhar um `id` lê a linha. A auditoria de RLS do hardening **aceitou** esse
> risco (um UUID v4 é inviável de enumerar); um token separado da PK fica como evolução
> futura. Ver [08](08-seguranca.md).

## Realtime

A migration adiciona `fila_impressao` à publicação `supabase_realtime`, permitindo ao
cliente assinar `postgres_changes` na sua linha (usado por `usePedidoStatus`, ver
[03](03-checkout.md)).

## Decisões e pontos de atenção

- **Numeração das migrations**: `0001` (base), `0002` (hardening — `valor_centavos`
  nullable + RLS + limites do bucket), `0003` (agendamento da limpeza), `0004` (status
  `IMPRIMINDO`), `0005` (`pdf_path` nullable).
- **Limpeza automática**: a Edge Function `cleanup-fila`, agendada por pg_cron de hora em
  hora, apaga órfãos não pagos (1h), remove o PDF de impressos (7 dias) e a linha (6 meses).
  Ver a capability [`print-data-retention`](../../openspec/specs/print-data-retention/spec.md)
  e o runbook em [07](07-operacao.md).

---

Anterior: [04 — Pagamento PIX](04-pagamento-pix.md) · Próximo: [06 — Print worker](06-print-worker.md)
