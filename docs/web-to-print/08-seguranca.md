# 08 — Segurança

[← Índice](README.md)

A segurança da feature se apoia em três pilares: **isolamento de segredos por ambiente**,
**validação de assinatura do webhook** e **RLS no Supabase**.

## Segredos por ambiente

| Segredo | Onde vive | Onde **nunca** pode estar |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon) | Bundle do cliente (é pública por design, restrita por RLS). | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Envs da Vercel (Project Settings) **e** `.env` da sede. | No bundle do cliente. Nunca com prefixo `NEXT_PUBLIC_`. |
| `MERCADOPAGO_ACCESS_TOKEN` | Envs da Vercel. | No cliente. |
| `MERCADOPAGO_WEBHOOK_SECRET` | Envs da Vercel. | No cliente. |

**A `service_role` bypassa RLS** — é a chave-mestra do projeto. Por isso só existe em
ambientes confiáveis (Vercel e sede), nunca no navegador.

- Na Vercel: como variável de ambiente (Project Settings), sem `NEXT_PUBLIC_` → não entra no
  bundle. Verificação: `grep -r MERCADOPAGO_ACCESS_TOKEN .next/static/` deve retornar **0**
  ocorrências.
- Na sede: no `.env` com **`chmod 600`**, propriedade de um **usuário de serviço
  dedicado** (sem login, sem home), lido pelo systemd via `EnvironmentFile`. Nunca
  commitado (está no `.gitignore`).
- **Rotação:** se a `service_role` vazar, rotacione-a no painel do Supabase e atualize os
  dois lugares (Vercel + sede).

## Validação do webhook

O endpoint `/api/webhooks/mercadopago` é **público**. A defesa (ver [04](04-pagamento-pix.md)):

- Recomputa `HMAC_SHA256(MERCADOPAGO_WEBHOOK_SECRET, manifest)` e compara com o `v1` do
  header `x-signature`, em **tempo constante**.
- **Anti-replay:** rejeita timestamps fora de uma janela de **5 minutos**.
- Sem assinatura válida → **401**, sem tocar o banco.

Assim, um terceiro não consegue forjar um "pagamento aprovado" para marcar um pedido como
`PAGO`.

## Garantias de RLS

(Detalhe em [05](05-supabase.md).) O cliente anônimo:

- **Pode** inserir um pedido só em `AGUARDANDO_PAGAMENTO`, com `mp_payment_id`/`paid_at`/
  `printed_at` nulos — não consegue criar um pedido já "pago".
- **Pode** ler uma linha pelo `id`.
- **Não pode** fazer `UPDATE`/`DELETE` — só a `service_role` (webhook/worker) muda status.
- **Não pode** ler PDFs do bucket privado nem listar arquivos — só pode fazer upload.

Toda transição de pagamento e de impressão é, portanto, exclusiva do servidor.

## Hardening (implementado)

A mudança companheira `harden-web-to-print-security` (já em produção) tratou:

- **Valor e páginas no servidor** ✅ — o `create-pix` baixa o PDF, reconta as páginas com
  `pdf-lib` e recalcula `valor_centavos` a partir de `config_precos`; o cliente não envia
  mais o preço (a RLS exige `valor_centavos IS NULL`). PDF inválido → 422 sem cobrar.
  Capability `print-payment-integrity`.
- **Limpeza automática** ✅ — Edge Function `cleanup-fila` agendada por pg_cron: órfão não
  pago (1h), PDF de impresso (7 dias) e linha (6 meses). Protegida por
  `CLEANUP_FUNCTION_SECRET`. Capability `print-data-retention`.
- **Limites de upload** ✅ — bucket restrito a `application/pdf` e 30 MB, no nível do
  Storage. Capability `print-upload-abuse-protection`.

Risco conhecido **aceito**: a policy de SELECT permissiva (`using (true)`) — a auditoria
concluiu que o `id` UUID v4 é inviável de enumerar; um token de leitura separado da PK fica
como evolução futura.

---

Anterior: [07 — Operação](07-operacao.md) · [↑ Índice](README.md)
