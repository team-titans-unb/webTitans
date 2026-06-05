-- Web-to-Print: agenda a limpeza da fila (harden-web-to-print-security).
-- Roda a Edge Function `cleanup-fila` de hora em hora via pg_cron + pg_net.
--
-- PRÉ-REQUISITOS (nesta ordem), antes de rodar este arquivo:
--   1. Migration 0002 aplicada (habilita pg_cron e pg_net).
--   2. Edge Function implantada:  supabase functions deploy cleanup-fila
--   3. Segredo da função criado:  supabase secrets set CLEANUP_FUNCTION_SECRET=<valor>
--
-- IMPORTANTE: este arquivo NÃO contém segredos. O segredo é lido do Vault do
-- Supabase em tempo de execução. Antes de agendar, guarde o MESMO valor de
-- CLEANUP_FUNCTION_SECRET no Vault, rodando UMA vez (com o valor real, que NÃO
-- deve ser commitado):
--
--   select vault.create_secret('<VALOR_REAL>', 'cleanup_function_secret');
--
-- E substitua <PROJECT_REF> abaixo pelo ref do seu projeto (o mesmo de
-- https://<PROJECT_REF>.supabase.co). Ele não é segredo (já aparece na URL
-- pública), mas é específico do projeto, por isso fica como placeholder.

-- Remove um agendamento anterior de mesmo nome (idempotência ao reaplicar).
select cron.unschedule('cleanup-fila-hourly')
where exists (select 1 from cron.job where jobname = 'cleanup-fila-hourly');

-- Agenda de hora em hora ('0 * * * *').
select cron.schedule(
  'cleanup-fila-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://cgkjpodfnfxnrlvnqhki.supabase.co/functions/v1/cleanup-fila',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'cleanup_function_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Conferência:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 5;
