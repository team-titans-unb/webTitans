# Web-to-Print — Guia de Setup Manual

Este documento lista as tarefas que **precisam ser feitas por uma pessoa** antes
do fluxo funcionar end-to-end. O código (frontend, API e migration SQL) já está
pronto no repositório.

> **NUNCA commite os valores reais de envs ou as keys do Supabase / MP.**

## 1. Instalar dependências novas

```bash
bun install
# ou: npm install
```

Pacotes adicionados pelo change: `@supabase/supabase-js`, `mercadopago`,
`pdfjs-dist`, `qrcode.react`, `@vercel/node` (dev).

## 2. Provisionar Supabase (tarefas 1.1–1.7 do tasks.md)

1. Em <https://supabase.com/dashboard> → **New Project** (plano free).
2. Em **Project Settings → API**, copie:
   - `Project URL` → vai virar `VITE_SUPABASE_URL` e `SUPABASE_URL`.
   - `anon public` → vira `VITE_SUPABASE_ANON_KEY`.
   - `service_role` → vira `SUPABASE_SERVICE_ROLE_KEY` (**nunca exponha no
     bundle**).
3. Em **SQL Editor → New Query**, cole e rode o conteúdo de
   `supabase/migrations/0001_fila_impressao.sql`. Isso cria as tabelas,
   o bucket, as policies RLS e ativa Realtime.
4. Em **Database → Replication**, confirme que a publicação
   `supabase_realtime` inclui `fila_impressao` (a migration já adiciona; só
   confira na UI).
5. Em **Storage**, abra o bucket `pdfs-impressao` e confirme que está marcado
   como **privado**.

## 3. Provisionar Mercado Pago (tarefas 2.1–2.3)

1. Em <https://www.mercadopago.com.br/developers/panel> → **Suas integrações
   → Criar aplicação**. Tipo: "Pagamentos online", check-out PIX.
2. Em **Credenciais de teste**, copie o `Access Token` →
   `MERCADOPAGO_ACCESS_TOKEN` (use as de **teste** primeiro).
3. Em **Webhooks → Configurar notificações**:
   - URL: `https://<seu-preview>.vercel.app/api/webhooks/mercadopago`
     (você só consegue preencher depois do primeiro deploy de preview).
   - Eventos: `Pagamentos`.
   - Salve. O painel exibe a **Chave secreta** do webhook →
     `MERCADOPAGO_WEBHOOK_SECRET`.

Quando for para produção (tarefa 12.3), repita com as **credenciais de
produção** e troque a URL para o domínio definitivo.

## 4. Configurar variáveis de ambiente

### 4.1 Localmente (`.env.local`)

```bash
cp .env.local.example .env.local
# edite .env.local e preencha os 6 valores
```

**Regras de ouro:**

- `.env.local.example` **fica em branco** e é commitado como template para o
  próximo dev. **Nunca** coloque valores reais nele.
- `.env.local` tem os valores reais e **nunca** é commitado (já está no
  `.gitignore`).
- Se uma chave secreta vazar (foi commitada, postada em chat, etc.),
  **rotacione imediatamente**:
  - Supabase service_role: Project Settings → API → **Reset service_role key**.
  - Mercado Pago access token: painel do MP → suas credenciais → revogar e
    regenerar.
  - Webhook secret do MP: painel de Notificações → gerar nova secret.
- A `anon` key do Supabase é pública por design (vai mesmo no bundle do
  cliente). Não precisa esconder, mas garanta que as policies RLS da migration
  estão ativas — elas é que protegem os dados.

### 4.2 Na Vercel (tarefa 3.5)

No painel da Vercel → **Settings → Environment Variables**, adicione as 6 envs
em **Production, Preview e Development**:

| Nome | Valor | Escopo |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | URL pública do projeto Supabase | cliente (vai no bundle) |
| `VITE_SUPABASE_ANON_KEY` | anon key | cliente (vai no bundle) |
| `SUPABASE_URL` | mesma URL do Supabase | server-only |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **server-only (segredo)** |
| `MERCADOPAGO_ACCESS_TOKEN` | access token MP | **server-only (segredo)** |
| `MERCADOPAGO_WEBHOOK_SECRET` | secret do webhook MP | **server-only (segredo)** |

## 5. Teste sandbox (tarefas 11.1–11.6)

```bash
# instale o CLI da Vercel se ainda não tiver
npm i -g vercel

# rode com as envs do .env.local
vercel dev
```

Roteiro de teste:

1. Abra `http://localhost:3000/impressao`.
2. Faça upload de um PDF qualquer.
3. Escolha modo de cor e clique em **Pagar com PIX**.
4. No painel do Supabase (`Table Editor → fila_impressao`), confirme uma linha
   com `status = 'AGUARDANDO_PAGAMENTO'`.
5. Use a [conta de teste comprador do MP](https://www.mercadopago.com.br/developers/panel/test-users)
   para pagar o PIX exibido.
6. Confirme que:
   - O webhook foi recebido (logs em `vercel dev`).
   - A linha em `fila_impressao` virou `PAGO` com `paid_at` preenchido.
   - A UI mudou para a tela de sucesso automaticamente em <5s.
7. **Caso negativo**: tente POSTar manualmente em
   `/api/webhooks/mercadopago` sem o header `x-signature` → deve responder
   `401` e o banco não muda.

## 6. Deploy (tarefas 12.1–12.6)

1. Abra PR para `main`.
2. A Vercel cria um preview deploy. Atualize a URL do webhook no painel do MP
   para apontar para o domínio do preview e refaça o smoke test.
3. Quando estiver ok, troque envs do MP para produção, atualize webhook URL
   para o domínio definitivo e dê merge.
4. Comunique à equipe do **script Python externo**:
   - URL e `service_role` key do Supabase.
   - Esquema da tabela `fila_impressao` (campos no arquivo de migration).
   - Nome do bucket: `pdfs-impressao`.
   - Contrato: ler linhas com `status = 'PAGO'`, baixar `pdf_path`, atualizar
     para `IMPRESSO` com `printed_at = now()` ao concluir.
5. Monitore logs da Vercel por 24h após go-live, especialmente erros 401 do
   webhook ou 502 do `create-pix`.

## Decisões já tomadas (resumo)

- Preço inicial: **R$ 0,50/página (PB)**, **R$ 2,00/página (Colorido)** —
  ajustável direto em `config_precos` sem deploy.
- Limite de PDF: **50 MB**.
- Cliente anônimo, sem login. UUID do pedido = "senha" temporária para o
  cliente ler o próprio status via PostgREST.
- SDK oficial `mercadopago` no backend.
- Atualização da UI via Supabase Realtime + polling de 5s como fallback.

## Pontos a confirmar com a equipe (do `design.md`)

- E-mail de confirmação ao cliente após pagamento? Não está no escopo atual,
  mas `@emailjs/browser` já está no projeto.
- Cron para limpar pedidos `AGUARDANDO_PAGAMENTO` órfãos depois de N horas.
