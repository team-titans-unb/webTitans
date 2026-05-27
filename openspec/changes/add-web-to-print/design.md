## Context

O site atual é uma **SPA Vite + React 18 + TypeScript** (não é Next.js), com `react-router-dom` v6 para roteamento, shadcn/ui + Tailwind para UI, TanStack Query já configurado em `src/App.tsx`, e Sonner para toasts. O deploy é na **Vercel plano gratuito**, com `vercel.json` reescrevendo qualquer rota para `/index.html` (comportamento padrão SPA). Não existe nenhuma rota de backend hoje — todo o app é estático.

Restrições impostas pelo plano gratuito da Vercel:
- Serverless Functions têm limite de **10 segundos de execução** e **4.5 MB de payload de request** — qualquer fluxo que envolva upload de PDF de muitas páginas precisa contornar isso.
- Sistema de arquivos efêmero — não dá para armazenar o PDF no servidor.
- 100 GB-h de execução por mês — webhooks e geração de PIX são ações curtas, ficamos confortáveis.

Stakeholders / consumidores:
- **Cliente final** (navegador): faz upload, paga, espera confirmação.
- **Script Python externo** (fora deste repo): lê linhas com `status='PAGO'` da tabela `fila_impressao`, baixa o PDF do Storage, imprime, marca como `IMPRESSO`. Esta mudança apenas garante o contrato (tabela + bucket).
- **Mercado Pago**: emissor do webhook de pagamento.

## Goals / Non-Goals

**Goals:**
- Manter a arquitetura compatível com o plano gratuito da Vercel: zero processamento de PDF no servidor, zero armazenamento de arquivos no filesystem da Vercel.
- Garantir que o webhook do Mercado Pago seja **idempotente** e **autenticado** (HMAC).
- Permitir ao usuário ver o status do pagamento mudar de "Aguardando" para "Sucesso" em segundos após o PIX cair, sem refresh manual.
- Fornecer um modelo de dados e bucket prontos para o script Python externo consumir sem ambiguidade.
- Não acoplar a nenhuma identidade/login — o checkout é anônimo (consistente com o site atual).

**Non-Goals:**
- Comunicação com a impressora física, gerenciamento da fila do lado do operador, ou UI administrativa — todos vivem fora deste repositório.
- Login / contas de usuário / histórico de pedidos por usuário.
- Migração para Next.js ou outro framework — manteremos Vite + funções `/api`.
- Suporte a meios de pagamento que não sejam PIX nesta primeira entrega.
- Edição/preview do PDF; o arquivo é impresso exatamente como enviado.

## Decisions

### D1. Manter Vite + adicionar `/api` da Vercel (em vez de migrar para Next.js)
A Vercel detecta automaticamente arquivos `.ts`/`.js` em `/api/` na raiz do projeto e os serve como Serverless Functions com runtime Node 20, mesmo em projetos Vite. Isso atende totalmente nossa necessidade (duas funções simples) sem custo de migração de framework. Alternativa descartada: migrar para Next.js — ganharíamos App Router/Pages mas pagaríamos uma reescrita completa do projeto.

### D2. Upload direto do navegador para o Supabase Storage
O cliente usa `supabase.storage.from('pdfs-impressao').upload(...)` com a anon key. O PDF nunca passa pela Vercel, eliminando o limite de 4.5 MB e o de 10 s. Alternativa descartada: criar uma URL pré-assinada via função serverless — adiciona um round-trip extra sem ganho real, dado que a anon key + RLS de Storage já dão o controle necessário.

### D3. Contagem de páginas no cliente com `pdfjs-dist`
Usamos o build worker do `pdfjs-dist` para contar páginas localmente. Isso permite calcular o preço **antes** do upload, dar feedback imediato, e mantém o servidor sem dependência de bibliotecas pesadas de PDF. Alternativa descartada: contar no backend — quebraria a regra de "zero processamento de PDF no servidor" e estouraria os 10 s para PDFs grandes.

### D4. Modelo de dados — uma tabela `fila_impressao`
Campos: `id` (uuid pk), `created_at`, `pdf_path` (string, path no Storage), `num_paginas` (int), `modo_cor` ('PB' | 'COLORIDO'), `valor_centavos` (int), `status` ('AGUARDANDO_PAGAMENTO' | 'PAGO' | 'IMPRESSO' | 'ERRO' | 'CANCELADO'), `mp_payment_id` (string nullable), `mp_preference_id` (string nullable), `paid_at` (timestamptz nullable), `printed_at` (timestamptz nullable). Esquema único é suficiente para a primeira versão; podemos normalizar depois se virarem múltiplos itens por pedido.

### D5. RLS — INSERT anônimo restrito; UPDATE só com service_role
- `anon` pode `INSERT` linhas apenas com `status='AGUARDANDO_PAGAMENTO'` (policy com `WITH CHECK`).
- `anon` pode `SELECT` apenas a própria linha pelo `id` (que é UUID — opaco, ok para uso público).
- `UPDATE` é negado para `anon`; somente a função `/api/webhooks/mercadopago.ts` atualiza via `service_role` key.
- Storage: bucket `pdfs-impressao` privado; `anon` pode `INSERT`, mas não pode `SELECT`/`DELETE`. O script Python externo lê com `service_role`.

### D6. Endpoint `/api/payments/create-pix.ts`
Recebe `{ pedidoId }` no body. Servidor (1) busca o pedido no Supabase usando service_role e confere que está em `AGUARDANDO_PAGAMENTO`, (2) chama `POST https://api.mercadopago.com/v1/payments` com `payment_method_id: 'pix'`, `transaction_amount`, `external_reference: pedidoId`, e header `X-Idempotency-Key: pedidoId`, (3) salva `mp_payment_id` no pedido, (4) devolve `{ qr_code_base64, qr_code_copia_cola, expiration }` para o cliente. Idempotency-Key garante que cliques duplos não criem cobranças duplicadas.

### D7. Endpoint `/api/webhooks/mercadopago.ts`
- **Segurança**: valida o header `x-signature` do MP. O MP envia `ts=...,v1=<hmac>`; o webhook deve recomputar `HMAC_SHA256(secret, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;")` e comparar (timing-safe) — sem isso, qualquer um pode marcar pedidos como pagos.
- **Idempotência**: o MP reenvia webhooks; o handler só atualiza se a linha ainda está em `AGUARDANDO_PAGAMENTO` (UPDATE com WHERE `status='AGUARDANDO_PAGAMENTO'`); retornos 200 sempre, mesmo em reentrega, para evitar retries infinitos.
- **Fluxo**: ao receber notificação, (1) busca o pagamento via `GET /v1/payments/{id}` no MP usando o access token, (2) confirma `status='approved'` e `external_reference` válido, (3) atualiza a linha para `PAGO`, seta `paid_at`. Em qualquer outro `status` (cancelled, rejected) marca `CANCELADO`.

### D8. UI / Estado da espera de pagamento — Supabase Realtime + polling fallback
Após gerar o PIX, o cliente assina o canal `postgres_changes` do Supabase filtrado por `id=eq.<pedidoId>`. Quando o webhook atualizar a linha para `PAGO`, o cliente recebe o evento em <1s e navega para a tela de sucesso. Como fallback (rede ruim, Realtime cair), também roda um `useQuery` com `refetchInterval: 5000` consultando o status diretamente no Supabase (via anon + RLS SELECT). Timeout total: 10 minutos — depois disso, mostramos "Pagamento não confirmado, tente novamente". Decisão sobre alternativa: **não** vamos abrir um endpoint `/api/orders/[id]/status` próprio porque o Supabase já serve isso de graça via PostgREST e Realtime.

### D9. Configuração de preço no banco
Tabela `config_precos` com colunas `modo_cor` (pk), `valor_centavos_por_pagina`. Carregada pelo cliente no `useEffect` inicial via Supabase. Permite que o time da TITANS ajuste preços sem deploy.

### D10. Variáveis de ambiente
- **Cliente** (prefixo `VITE_`, expostas no bundle): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Servidor** (apenas nas Functions): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`.
- Configurar nos três escopos da Vercel (Production, Preview, Development) e em `.env.local` para `vercel dev`.

### D11. `vercel.json` — preservar `/api/*`
O rewrite atual `"/(.*)" -> "/index.html"` capturaria também `/api/payments/create-pix`. Mudança: usar `"source": "/((?!api/).*)"` ou explicitar duas regras. Sem isso, as funções serverless nunca rodam.

## Risks / Trade-offs

- **Webhook do MP sem validação de assinatura** → qualquer um envia POST e marca como pago. **Mitigação**: D7 implementa HMAC obrigatório; pull request bloqueado se a validação não estiver presente; teste em sandbox antes de deploy.
- **Anon key vazada via bundle** → Mitigação: anon key é pública por design; o que protege são as policies RLS (D5). Auditoria obrigatória das policies antes de subir.
- **Cliente fecha o navegador antes de pagar** → linha fica em `AGUARDANDO_PAGAMENTO` para sempre. **Mitigação**: cron diário (depois desta entrega) ou TTL pelo `expiration_date_to` do PIX (~30 min); por ora, só documentamos e aceitamos o lixo na fila.
- **PDFs muito grandes (200 MB+)** estouram a memória do navegador no `pdfjs-dist`. **Mitigação**: validar `file.size < 50 MB` antes de tentar parsear; mensagem clara ao usuário.
- **Limites de Realtime no plano gratuito do Supabase (200 conexões concorrentes)** — se o site bombar, alguns clientes não recebem o push. **Mitigação**: o polling de 5 s já cobre esse caso; impacto = UX ligeiramente pior, não funcional.
- **Race entre webhook do MP chegando antes da resposta do `create-pix`** → quase impossível (MP só dispara webhook após confirmação real do PIX, depois do `create-pix` retornar), mas a UPDATE com WHERE de D7 cobre.
- **Custo da função Vercel** — webhook é chamado pelo MP várias vezes por pagamento (retry policy). 100 GB-h é mais do que suficiente para um volume universitário.

## Migration Plan

Não há migração de dados — funcionalidade totalmente nova. Plano de deploy:

1. Provisionar projeto no Supabase, rodar SQL de schema (tabela, índice em `status`, RLS, bucket, policies de Storage).
2. Configurar variáveis de ambiente na Vercel (Preview primeiro).
3. Deploy de preview → testar fluxo end-to-end com credenciais **sandbox** do Mercado Pago.
4. Configurar webhook URL no painel do MP apontando para `https://<preview>.vercel.app/api/webhooks/mercadopago`.
5. Quando validado, promover envs para Production, atualizar URL do webhook para produção, deploy.
6. **Rollback**: reverter o commit no main → Vercel re-deploya versão anterior. Linhas órfãs no Supabase ficam inertes (script Python ignora pendentes). Sem migração reversa necessária.

## Open Questions

- Qual é o preço definitivo por página (P&B e Colorido)? Precisamos do número antes do deploy para popular `config_precos`.
- Vamos limitar o tamanho máximo do PDF? Sugestão: 50 MB / 200 páginas como teto inicial.
- O script Python externo já tem credencial `service_role`? Se não, precisamos provisioná-la junto.
- Precisa de e-mail de confirmação ao cliente após pagamento? Não está no escopo atual, mas o `@emailjs/browser` já está no projeto — pode ser uma extensão simples.
