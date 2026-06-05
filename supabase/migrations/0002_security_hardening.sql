-- Web-to-Print: endurecimento de segurança (harden-web-to-print-security)
-- Rode este arquivo no SQL Editor do Supabase (produção) ou via `supabase db push`.
--
-- O que esta migration faz:
--   1. Torna `valor_centavos` nullable — o valor passa a ser preenchido pelo
--      servidor (create-pix), nunca pelo cliente.
--   2. Reforça a policy de INSERT anon para exigir `valor_centavos IS NULL`.
--   3. Restringe o bucket `pdfs-impressao` a PDFs de até 30 MB.
--   4. Habilita pg_cron e pg_net (usados depois para agendar a limpeza).
--
-- O agendamento da função de limpeza (cron.schedule + net.http_post) fica numa
-- migration posterior (0003), pois depende da Edge Function já implantada e do
-- segredo CLEANUP_FUNCTION_SECRET configurado.
--
-- Numeração: 0001 (base) e 0004 (status IMPRIMINDO) já existem. Esta usa 0002 e
-- roda antes da 0004; como não mexe em `status`, não há colisão.

-- =====================================================================
-- 1. Autoridade de preço no servidor: valor_centavos vira nullable
-- =====================================================================
-- O cliente deixa de enviar valor_centavos no INSERT; o create-pix calcula e
-- grava o valor a partir da contagem real de páginas × config_precos.
alter table public.fila_impressao
  alter column valor_centavos drop not null;

-- Troca o check inline `valor_centavos > 0` por uma versão que aceita NULL.
alter table public.fila_impressao
  drop constraint if exists fila_impressao_valor_centavos_check;

alter table public.fila_impressao
  add constraint fila_impressao_valor_centavos_check
  check (valor_centavos is null or valor_centavos > 0);

-- =====================================================================
-- 2. RLS — INSERT anon não pode definir o preço
-- =====================================================================
drop policy if exists fila_impressao_anon_insert on public.fila_impressao;

create policy fila_impressao_anon_insert
  on public.fila_impressao
  for insert
  to anon
  with check (
    status = 'AGUARDANDO_PAGAMENTO'
    and valor_centavos is null
    and mp_payment_id is null
    and paid_at is null
    and printed_at is null
  );
-- num_paginas declarado pelo cliente continua aceito, mas é mera estimativa:
-- o create-pix reconta a partir do PDF e ignora esse valor para a cobrança.
-- UPDATE/DELETE anon permanecem sem policy = negados.

-- =====================================================================
-- 3. Storage — restrições de tipo e tamanho no bucket
-- =====================================================================
-- 30 MB = 31457280 bytes. Teto alinhado ao que o create-pix consegue baixar e
-- parsear dentro do limite de 10s da Vercel. Mesmo uma chamada direta à API de
-- Storage com a anon key passa a rejeitar não-PDF ou arquivos grandes.
update storage.buckets
  set file_size_limit = 31457280,
      allowed_mime_types = array['application/pdf']
  where id = 'pdfs-impressao';

-- =====================================================================
-- 4. Extensões para a limpeza agendada (usadas na migration 0003)
-- =====================================================================
-- Na maioria dos projetos Supabase também dá para habilitar via
-- Dashboard → Database → Extensions. Aqui garantimos via SQL.
create extension if not exists pg_cron;
create extension if not exists pg_net;
