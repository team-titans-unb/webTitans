-- Impressora status: relógio de servidor (fix-impressora-status-clock-skew).
-- Rode este arquivo no SQL Editor do Supabase (produção) ou via `supabase db push`.
--
-- Bug corrigido: `useImpressoraStatus` comparava `Date.now()` do dispositivo
-- que acessa o kiosk/`/impressao` contra `atualizado_em`, escrito pelo
-- print-worker com o relógio da própria Raspberry Pi. Se o relógio do
-- dispositivo cliente estiver dessincronizado (ex.: usuário muda a data/hora
-- do totem), a diferença fica artificialmente grande e o sistema mostra
-- "Sistema de impressão offline" com o worker saudável.
--
-- O que esta migration faz:
--   1. Trigger BEFORE INSERT OR UPDATE em `impressora_status` que força
--      `atualizado_em := now()` (relógio do Postgres) — elimina também a
--      dependência do relógio da própria Raspberry Pi do worker, não só do
--      navegador. `worker.py` não muda: o valor que ele envia em
--      `atualizado_em` (via `now_iso()`) é simplesmente sobrescrito.
--   2. View `impressora_status_publica` (mesmo padrão de `security_invoker`
--      de `fila_publica`, migration 0008) que expõe `idade_ms`, a idade do
--      heartbeat já calculada inteiramente no servidor
--      (`now() - atualizado_em`, ambos os lados no relógio do Postgres).
--      O client-side hook deixa de fazer QUALQUER aritmética de relógio de
--      parede contra o timestamp gravado; só extrapola `idade_ms` entre
--      fetches usando `performance.now()` (relógio monotônico do
--      navegador, não afetado por o usuário mudar a data/hora do SO).
--
-- Sem novas policies de RLS: a view roda com `security_invoker = on`, ou
-- seja, com os direitos de quem consulta — o SELECT do anon passa pela
-- policy `impressora_status_anon_select` já existente (0008) na tabela
-- base. Só é preciso o grant explícito de SELECT na própria view (mesmo
-- padrão de `fila_publica`: o grant automático de projeto para `anon`/
-- `authenticated` em tabelas novas não cobre views).
--
-- Rollback:
--   drop view if exists public.impressora_status_publica;
--   drop trigger if exists impressora_status_relogio_servidor on public.impressora_status;
--   drop function if exists public.impressora_status_definir_relogio_servidor();

-- =====================================================================
-- 1. Trigger: `atualizado_em` sempre no relógio do Postgres
-- =====================================================================
create or replace function public.impressora_status_definir_relogio_servidor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists impressora_status_relogio_servidor
  on public.impressora_status;

create trigger impressora_status_relogio_servidor
  before insert or update on public.impressora_status
  for each row
  execute function public.impressora_status_definir_relogio_servidor();

-- =====================================================================
-- 2. View impressora_status_publica: idade do heartbeat calculada no servidor
-- =====================================================================
-- Não usa LIMIT/ORDER BY: replica 1:1 as linhas da tabela base (hoje só uma,
-- "fila" é PK) e preserva a semântica atual do client, que já faz
-- `.limit(1).maybeSingle()` na query — nenhuma decisão de "qual fila mostrar"
-- é embutida na view.
create or replace view public.impressora_status_publica
  with (security_invoker = on) as
select
  estado,
  detalhes,
  atualizado_em,
  extract(epoch from (now() - atualizado_em)) * 1000 as idade_ms
from public.impressora_status;

grant select on public.impressora_status_publica to anon, authenticated;
