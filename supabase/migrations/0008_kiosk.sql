-- Kiosk (totem da Sala 208): view pública da fila + estado da impressora + chamados
-- de ajuda (add-kiosk-client-view).
-- Rode este arquivo no SQL Editor do Supabase (produção) ou via `supabase db push`.
--
-- O que esta migration faz:
--   1. Cria a view `fila_publica`: contrato mínimo de leitura da fila para o kiosk,
--      expondo o protocolo derivado (8 primeiros caracteres do UUID) em vez do UUID
--      completo — que funciona como token de leitura do pedido e não pode vazar na
--      tela pública.
--   2. Cria `impressora_status`: heartbeat gravado pelo print-worker a cada ciclo,
--      lido pelo kiosk (anon SELECT; escrita só via service_role).
--   3. Cria `chamados_ajuda`: registros do botão "Chamar a equipe" do kiosk,
--      acessível apenas via service_role (API route server-side).

-- =====================================================================
-- 1. View fila_publica
-- =====================================================================
-- security_invoker: a view roda com os direitos de quem consulta; o SELECT do
-- anon passa pela policy `fila_impressao_anon_select` existente. Janela de
-- exibição pós-conclusão: IMPRESSO fica 15 min após printed_at (cliente vê o
-- pedido concluir); ERRO não tem timestamp de transição próprio, então usa
-- paid_at numa janela de 60 min — na prática o erro acontece minutos após o
-- pagamento, pois a fila é curta.
create view public.fila_publica
  with (security_invoker = on) as
select
  upper(left(id::text, 8)) as protocolo,
  status,
  num_paginas,
  quantidade_copias,
  modo_cor,
  paid_at,
  printed_at
from public.fila_impressao
where
  status in ('PAGO', 'IMPRIMINDO')
  or (status = 'IMPRESSO' and printed_at > now() - interval '15 minutes')
  or (status = 'ERRO' and paid_at > now() - interval '60 minutes')
order by paid_at asc;

grant select on public.fila_publica to anon, authenticated;

-- =====================================================================
-- 2. Tabela impressora_status (heartbeat do worker)
-- =====================================================================
create table public.impressora_status (
  fila text primary key,
  estado text not null check (estado in ('OK', 'IMPRIMINDO', 'PAUSADA', 'INALCANCAVEL')),
  detalhes jsonb,
  atualizado_em timestamptz not null default now()
);

alter table public.impressora_status enable row level security;

-- anon só lê; sem policy de escrita = INSERT/UPDATE/DELETE negados.
-- O worker escreve via service_role (bypassa RLS).
create policy impressora_status_anon_select
  on public.impressora_status
  for select
  to anon
  using (true);

-- Realtime: o kiosk assina mudanças para refletir o estado sem polling agressivo.
alter publication supabase_realtime add table public.impressora_status;

-- =====================================================================
-- 3. Tabela chamados_ajuda
-- =====================================================================
create table public.chamados_ajuda (
  id uuid primary key default gen_random_uuid(),
  protocolo text check (protocolo is null or protocolo ~ '^[0-9A-F]{8}$'),
  categoria text not null check (categoria in ('NAO_SAIU', 'SAIU_COM_DEFEITO', 'OUTRO')),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);

-- Índice para o rate-limit da API (busca por protocolo+categoria recentes).
create index chamados_ajuda_recentes_idx
  on public.chamados_ajuda (criado_em desc);

-- RLS habilitado sem nenhuma policy: todo acesso anon é negado por padrão.
-- Só a API route do kiosk (service_role) escreve e lê.
alter table public.chamados_ajuda enable row level security;
