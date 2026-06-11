# 02 — Fluxo do pedido e máquina de estados

[← Índice](README.md)

Os quatro subsistemas não se chamam diretamente. Eles se coordenam por uma única coluna:
`fila_impressao.status`. Entender essa máquina de estados é entender a feature.

## Caminho feliz, de ponta a ponta

1. **Upload (navegador)** — o cliente escolhe um PDF em `/impressao`. O navegador valida
   tipo/tamanho e conta as páginas com `pdfjs-dist`.
2. **Configuração (navegador)** — escolhe modo de cor; o preço é calculado a partir de
   `config_precos`.
3. **Criação do pedido (navegador → Supabase)** — o PDF é enviado direto ao bucket
   `pdfs-impressao` e uma linha é inserida em `fila_impressao` com
   `status = 'AGUARDANDO_PAGAMENTO'`.
4. **Geração do PIX (navegador → Vercel → Mercado Pago)** — o front chama
   `POST /api/payments/create-pix`, que cria a cobrança e devolve QR Code + Copia e Cola.
5. **Pagamento (cliente → Mercado Pago)** — o cliente paga pelo app do banco.
6. **Confirmação (Mercado Pago → Vercel → Supabase)** — o MP chama
   `POST /api/webhooks/mercadopago`; com assinatura válida e pagamento aprovado, o status
   vira `PAGO` e `paid_at` é setado.
7. **Aviso ao cliente (Supabase → navegador)** — o front recebe a mudança via Realtime
   (com polling de fallback) e mostra a tela de sucesso com o protocolo.
8. **Impressão (sede)** — o worker detecta o `PAGO`, reivindica (`IMPRIMINDO`), baixa o
   PDF, reconfere as páginas, imprime na 135w e marca `IMPRESSO` com `printed_at`.

## A máquina de estados

```
            checkout: anon INSERT
                    │
                    ▼
        AGUARDANDO_PAGAMENTO
           │                 │
 webhook   │                 │ webhook (cancelled / rejected)
 approved  │                 ▼
           │            CANCELADO
           ▼
         PAGO ───────────────────────► (worker: claim atômico)
           ▲                                       │
           │ recuperação de travados               ▼
           │ (preso > STUCK_TIMEOUT)          IMPRIMINDO
           └──────────────────────────────────┤   │
                                               │   ▼
                              (falha /       ┌─┴─────────┐
                               divergência)  │           │ (CUPS concluiu)
                                             ▼           ▼
                                           ERRO      IMPRESSO (+ printed_at)
```

## Cada transição: quem escreve e por quê

| De → Para | Quem escreve | Como / regra |
| --- | --- | --- |
| (novo) → `AGUARDANDO_PAGAMENTO` | Cliente (anon key) | `INSERT` permitido pela RLS só neste estado, com `mp_payment_id`/`paid_at`/`printed_at` nulos. |
| `AGUARDANDO_PAGAMENTO` → `PAGO` | Webhook (service_role) | `UPDATE ... WHERE status='AGUARDANDO_PAGAMENTO'` (idempotente). Seta `paid_at`. |
| `AGUARDANDO_PAGAMENTO` → `CANCELADO` | Webhook (service_role) | Quando o MP devolve `cancelled`/`rejected`. |
| `PAGO` → `IMPRIMINDO` | Worker (service_role) | **Claim atômico**: `UPDATE ... WHERE id=:id AND status='PAGO'`. Quem ganhar a corrida imprime. |
| `IMPRIMINDO` → `IMPRESSO` | Worker | CUPS concluiu o job. Seta `printed_at`. |
| `IMPRIMINDO` → `ERRO` | Worker | Falha de download/impressão, PDF inválido ou divergência de páginas. |
| `IMPRIMINDO` → `PAGO` | Worker | **Recuperação de travados**: preso há mais que `STUCK_TIMEOUT` (padrão 15 min) volta para nova tentativa. |

### Por que o claim atômico existe

Se duas instâncias do worker (ou um worker fantasma num notebook esquecido) virem o mesmo
pedido `PAGO` ao mesmo tempo, ambas tentariam imprimir. O `UPDATE ... WHERE
status='PAGO'` resolve isso no banco: **só uma** transação consegue mudar de `PAGO` para
`IMPRIMINDO`; a outra afeta 0 linhas e desiste. Resultado: impressão **exatamente uma
vez**. Foi para isso que o estado `IMPRIMINDO` foi adicionado (migration
`0004_print_worker.sql`).

### Por que o webhook é idempotente

O Mercado Pago **reenvia** o mesmo evento várias vezes (e por dois canais — ver
[04](04-pagamento-pix.md)). O `WHERE status='AGUARDANDO_PAGAMENTO'` garante que uma
reentrega não reescreva um pedido que já avançou (por exemplo, já `IMPRESSO`). Reentregas
respondem 200 e não mudam nada.

## Caminhos de exceção

- **`CANCELADO`** — pagamento recusado/cancelado no MP. Estado terminal.
- **`ERRO`** — algo deu errado na impressão ou validação. Estado terminal que exige
  tratamento manual (ver [07 — Operação](07-operacao.md)).
- **Timeout de pagamento** — se o pedido ficar em `AGUARDANDO_PAGAMENTO` por mais de 10
  min, o **frontend** desiste de esperar e mostra a tela "Pagamento não confirmado". Isso é
  só na UI; a linha no banco continua como está (se o pagamento chegar depois, o status
  ainda vira `PAGO`, mas o cliente já saiu da tela).

---

Anterior: [01 — Arquitetura](01-arquitetura.md) · Próximo: [03 — Checkout](03-checkout.md)
