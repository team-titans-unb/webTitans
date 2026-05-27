## 1. Provisionamento Supabase (fora do código)

- [ ] 1.1 Criar projeto Supabase (free tier) e anotar `Project URL`, `anon key`, `service_role key`.
- [x] 1.2 Criar migração SQL `supabase/migrations/0001_fila_impressao.sql` com a tabela `fila_impressao` (campos, defaults, check constraints) conforme spec `print-queue-storage`.
- [x] 1.3 Adicionar índice `create index on fila_impressao(status);` na mesma migração.
- [x] 1.4 Criar tabela `config_precos` com seed inicial (preço PB e COLORIDO acordados com a equipe).
- [x] 1.5 Habilitar RLS em ambas as tabelas; criar policies: `anon INSERT` em `fila_impressao` somente com `status='AGUARDANDO_PAGAMENTO'`; `anon SELECT` por `id`; `anon SELECT` livre em `config_precos`; bloquear UPDATE/DELETE para anon.
- [x] 1.6 Criar bucket `pdfs-impressao` **privado**; policies: `anon INSERT` permitido, `SELECT`/`UPDATE`/`DELETE` negados para anon (apenas service_role).
- [x] 1.7 Habilitar Realtime na tabela `fila_impressao` (Replication → toggle ON em `postgres_changes`).
- [x] 1.8 Documentar credenciais e SQL em `openspec/changes/add-web-to-print/README.md` interno (sem commitar segredos).

## 2. Provisionamento Mercado Pago

- [ ] 2.1 Criar aplicação no painel do Mercado Pago e gerar `Access Token` (sandbox + produção).
- [ ] 2.2 Gerar `Webhook Secret` (`MERCADOPAGO_WEBHOOK_SECRET`) no painel de Notificações.
- [ ] 2.3 Configurar URL de webhook (será preenchida com a URL do preview da Vercel após o passo 8.2).

## 3. Setup do projeto (dependências e configs)

- [x] 3.1 Adicionar dependências runtime: `@supabase/supabase-js`, `pdfjs-dist`, `qrcode.react`. (Opcional: `mercadopago` SDK — caso contrário usar `fetch` global do Node 20.)
- [x] 3.2 Atualizar `vercel.json` para preservar `/api/*`: trocar o rewrite por `"source": "/((?!api/).*)"` ou listar duas regras explícitas (uma para `/api/*` sem rewrite, outra para o resto).
- [x] 3.3 Adicionar `.env.local.example` listando todas as envs (sem valores reais): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`.
- [x] 3.4 Atualizar `.gitignore` para garantir que `.env`, `.env.local` e `.vercel/` não sejam commitados.
- [ ] 3.5 Configurar as 6 envs nos três escopos (Production, Preview, Development) no painel da Vercel.

## 4. Camada de dados / cliente Supabase

- [x] 4.1 Criar `src/lib/supabase.ts` exportando um único `supabase` client criado com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- [x] 4.2 Criar `src/lib/pricing.ts` com função `fetchPrecos()` que retorna `{ PB: number, COLORIDO: number }` lendo de `config_precos`.
- [x] 4.3 Criar `src/lib/types.ts` com a tipagem `Pedido` espelhando a tabela `fila_impressao`.

## 5. Utilitários do PDF (cliente)

- [x] 5.1 Criar `src/lib/pdf-utils.ts` com `contarPaginas(file: File): Promise<number>` usando `pdfjs-dist` (configurar `GlobalWorkerOptions.workerSrc` apontando para o worker do pacote).
- [x] 5.2 Adicionar validação de tipo MIME (`application/pdf`) e tamanho (50 MB) no mesmo módulo.

## 6. UI / Página e componentes do checkout

- [x] 6.1 Criar `src/pages/Impressao.tsx` com state machine de 4 passos (`UPLOAD`, `CONFIG`, `PAGAMENTO`, `SUCESSO`) usando `useState` ou `useReducer`.
- [x] 6.2 Adicionar `<Route path="/impressao" element={<Impressao />} />` em `src/App.tsx` **antes** da rota catch-all `*`.
- [x] 6.3 Criar `src/components/impressao/UploadPDF.tsx` (drag-and-drop com shadcn `Card` + input file, mostra nome/tamanho).
- [x] 6.4 Criar `src/components/impressao/ConfiguracaoImpressao.tsx` (mostra contagem de páginas, `RadioGroup` para modo de cor, total em R$, botão "Pagar").
- [x] 6.5 Criar `src/components/impressao/TelaPagamento.tsx` (renderiza QR Code via `qrcode.react`, botão "Copiar código", contador de expiração).
- [x] 6.6 Criar `src/components/impressao/TelaSucesso.tsx` (mensagem de confirmação + protocolo = primeiros 8 chars do UUID).
- [x] 6.7 Adicionar link/CTA para `/impressao` em algum ponto natural do site (ex.: header ou página `Produtos` — alinhar com a equipe).

## 7. Hook de status do pedido (Realtime + polling)

- [x] 7.1 Criar `src/hooks/usePedidoStatus.ts` que recebe `pedidoId`, retorna `{ status, isLoading, error }`.
- [x] 7.2 Dentro do hook, abrir um `useEffect` que assina `supabase.channel('pedido-' + id).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fila_impressao', filter: 'id=eq.' + id }, ...)`.
- [x] 7.3 Em paralelo, usar `useQuery` (TanStack já presente) com `refetchInterval: 5000` consultando a linha do pedido como fallback.
- [x] 7.4 Implementar timeout de 10 minutos: após esse período sem `PAGO`, marcar `error: 'TIMEOUT'`.
- [x] 7.5 Limpar canal Realtime no cleanup do useEffect.

## 8. Fluxo de orquestração (cliente)

- [x] 8.1 No clique "Pagar" da tela de configuração: (a) upload do PDF para `pdfs-impressao/{uuid-temp}/{nome}.pdf`, (b) `insert` em `fila_impressao` com os campos calculados, (c) guardar `pedidoId` no state.
- [x] 8.2 Após sucesso do insert: `POST /api/payments/create-pix` com `{ pedidoId }`, guardar resposta no state, navegar para `TelaPagamento`.
- [x] 8.3 Em `TelaPagamento`, montar `usePedidoStatus(pedidoId)`. Quando `status === 'PAGO'`, mudar para `TelaSucesso`.
- [x] 8.4 Tratar erros com toasts (Sonner já presente no app).

## 9. Backend: gerar PIX

- [x] 9.1 Criar `api/payments/create-pix.ts` (Vercel Function, runtime Node default).
- [x] 9.2 Validar método `POST` e shape do body (`{ pedidoId: string }`).
- [x] 9.3 Criar `supabaseAdmin` com `SUPABASE_SERVICE_ROLE_KEY` (módulo separado em `api/_lib/supabase-admin.ts`).
- [x] 9.4 Buscar o pedido; retornar 404/409 conforme as scenarios da spec.
- [x] 9.5 Chamar `POST https://api.mercadopago.com/v1/payments` com headers `Authorization: Bearer <token>` e `X-Idempotency-Key: <pedidoId>`. Body: `{ transaction_amount, description, payment_method_id: 'pix', payer: { email: 'sem-email@titans.unb.br', first_name: 'Cliente' }, external_reference: pedidoId, notification_url: <vercel-url>/api/webhooks/mercadopago }`.
- [x] 9.6 Atualizar `fila_impressao` setando `mp_payment_id`.
- [x] 9.7 Responder 200 com `{ qr_code_base64, qr_code_copia_cola, expiration_date_to, mp_payment_id }` extraídos de `point_of_interaction.transaction_data` da resposta do MP.

## 10. Backend: webhook do Mercado Pago

- [x] 10.1 Criar `api/webhooks/mercadopago.ts` aceitando `POST`.
- [x] 10.2 Implementar `verificarAssinatura(req)` em `api/_lib/mp-signature.ts` recomputando `HMAC_SHA256(secret, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;")` e comparando em tempo constante; retornar `false` se `ts` for >5 min no passado.
- [x] 10.3 Se assinatura inválida ou ausente → 401 (não logar o secret).
- [x] 10.4 Buscar pagamento na API do MP: `GET https://api.mercadopago.com/v1/payments/{data.id}` com `Authorization: Bearer <token>`.
- [x] 10.5 Verificar `external_reference` (deve casar com um `pedido.id`); se não casar, log + 200.
- [x] 10.6 Se `status === 'approved'`: UPDATE `fila_impressao` SET `status='PAGO', paid_at=now()` WHERE `id=external_reference AND status='AGUARDANDO_PAGAMENTO'`.
- [x] 10.7 Se `status` ∈ {`cancelled`,`rejected`}: UPDATE para `CANCELADO`.
- [x] 10.8 Responder 200 sempre que a chamada for válida (mesmo em no-op idempotente); 500 apenas em erro interno real (banco fora).

## 11. Verificação end-to-end (sandbox)

- [ ] 11.1 Rodar `vercel dev` localmente com envs do `.env.local` (sandbox do MP).
- [ ] 11.2 Fazer um pedido real (PDF de teste) → conferir linha em `fila_impressao` com `AGUARDANDO_PAGAMENTO`.
- [ ] 11.3 Pagar PIX no sandbox MP → conferir webhook recebido (logs Vercel) e linha atualizada para `PAGO`.
- [ ] 11.4 Conferir que a UI muda para tela de sucesso em <5 s após o pagamento.
- [ ] 11.5 Testar caso negativo: enviar webhook forjado sem assinatura → deve responder 401 e não alterar banco.
- [ ] 11.6 Testar reentrega: chamar manualmente o webhook 2x com o mesmo evento → status deve permanecer `PAGO`.

## 12. Deploy e go-live

- [ ] 12.1 Abrir PR para `main` com todas as mudanças.
- [ ] 12.2 Conferir Preview deployment na Vercel: smoke test do fluxo com sandbox.
- [ ] 12.3 Trocar envs do MP para produção; atualizar `notification_url` e URL de webhook no painel MP para o domínio de produção.
- [ ] 12.4 Merge → deploy de produção.
- [ ] 12.5 Comunicar à equipe do script Python externo: `service_role key`, esquema da tabela, nome do bucket.
- [ ] 12.6 Pós-deploy: monitorar logs da Vercel por 24h para erros de assinatura ou timeout do MP.
