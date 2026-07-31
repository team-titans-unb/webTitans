-- Printer health: estende o CHECK de impressora_status.estado com os estados
-- de saúde física detectados via IPP pelo print-worker (change
-- add-printer-health-monitoring). Sem novas tabelas, colunas ou policies —
-- a RLS existente (anon SELECT, escrita só service_role) já cobre; `detalhes`
-- jsonb passa a carregar { toner_pct, state_reasons, toner_baixo }.
--
-- Rollback: restaurar o CHECK antigo exige que nenhuma linha esteja em
-- SEM_PAPEL/SEM_TONER/MANUTENCAO — normalize a linha (update para 'OK') ou
-- apague-a (o worker recria no próximo heartbeat) antes de reverter:
--   alter table public.impressora_status
--     drop constraint impressora_status_estado_check;
--   alter table public.impressora_status
--     add constraint impressora_status_estado_check
--     check (estado in ('OK', 'IMPRIMINDO', 'PAUSADA', 'INALCANCAVEL'));

alter table public.impressora_status
  drop constraint impressora_status_estado_check;

alter table public.impressora_status
  add constraint impressora_status_estado_check
  check (
    estado in (
      'OK',
      'IMPRIMINDO',
      'PAUSADA',
      'INALCANCAVEL',
      'SEM_PAPEL',
      'SEM_TONER',
      'MANUTENCAO'
    )
  );
