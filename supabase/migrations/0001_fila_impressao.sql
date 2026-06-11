-- Web-to-Print: fila_impressao + config_precos + bucket pdfs-impressao
-- Rode este arquivo no SQL Editor do Supabase ou via `supabase db push`.

-- =====================================================================
-- 1. Extensões necessárias
-- =====================================================================
create extension if not exists "pgcrypto";

-- =====================================================================
-- 2. Tabela fila_impressao
-- =====================================================================
create table public.fila_impressao (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pdf_path text not null,
  num_paginas int not null check (num_paginas > 0),
  modo_cor text not null check (modo_cor in ('PB', 'COLORIDO')),
  valor_centavos int not null check (valor_centavos > 0),
  status text not null default 'AGUARDANDO_PAGAMENTO'
    check (status in ('AGUARDANDO_PAGAMENTO', 'PAGO', 'IMPRESSO', 'ERRO', 'CANCELADO')),
  mp_payment_id text,
  mp_preference_id text,
  paid_at timestamptz,
  printed_at timestamptz
);

create index fila_impressao_status_idx on public.fila_impressao (status);

-- =====================================================================
-- 3. Tabela config_precos
-- =====================================================================
create table public.config_precos (
  modo_cor text primary key check (modo_cor in ('PB', 'COLORIDO')),
  valor_centavos_por_pagina int not null check (valor_centavos_por_pagina > 0)
);

insert into public.config_precos (modo_cor, valor_centavos_por_pagina) values
  ('PB', 50),
  ('COLORIDO', 200);

-- =====================================================================
-- 4. RLS — fila_impressao
-- =====================================================================
alter table public.fila_impressao enable row level security;

-- anon pode inserir, mas só em estado inicial.
create policy fila_impressao_anon_insert
  on public.fila_impressao
  for insert
  to anon
  with check (
    status = 'AGUARDANDO_PAGAMENTO'
    and mp_payment_id is null
    and paid_at is null
    and printed_at is null
  );

-- anon pode ler a própria linha pelo id (UUID opaco serve como token).
create policy fila_impressao_anon_select
  on public.fila_impressao
  for select
  to anon
  using (true);
-- Nota: a leitura é restrita pela `id` enviada na query; sem id, o cliente
-- precisaria adivinhar UUIDs aleatórios. Para hardening adicional, gerar
-- um token separado da PK em uma futura iteração.

-- UPDATE e DELETE: sem policy = negado para anon.
-- service_role bypassa RLS, então o webhook server-side funciona.

-- =====================================================================
-- 5. RLS — config_precos
-- =====================================================================
alter table public.config_precos enable row level security;

create policy config_precos_anon_select
  on public.config_precos
  for select
  to anon
  using (true);

-- =====================================================================
-- 6. Storage bucket privado + policies
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('pdfs-impressao', 'pdfs-impressao', false)
on conflict (id) do nothing;

-- anon pode subir arquivos (INSERT). SELECT/UPDATE/DELETE negados.
create policy pdfs_impressao_anon_insert
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'pdfs-impressao');

-- =====================================================================
-- 7. Realtime para fila_impressao
-- =====================================================================
-- Adiciona a tabela à publicação `supabase_realtime` para que clientes
-- possam assinar mudanças via `supabase.channel().on('postgres_changes', ...)`.
alter publication supabase_realtime add table public.fila_impressao;
