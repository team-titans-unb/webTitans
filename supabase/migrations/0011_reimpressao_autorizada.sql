-- Reimpressão autorizada (add-reimpressao-autorizada): permite à equipe
-- re-enfileirar um pedido já pago (ERRO/IMPRESSO) sem cobrar de novo, via bot
-- do Telegram (/reimprimir, /gerar_codigo) ou código de uso único no totem.
-- Rode este arquivo no SQL Editor do Supabase (produção) ou via `supabase db push`.
--
-- O que esta migration faz:
--   1. Adiciona `fila_impressao.reimpressao` — sinaliza pedidos re-enfileirados
--      para reimpressão (não altera o ciclo de status nem o FIFO por paid_at,
--      que continua sendo a autoridade do worker).
--   2. Cria `reimpressao_tokens` — códigos de uso único (`R-XXXXXXXX`) gerados
--      pelo bot para o cliente digitar no totem; só o hash é armazenado, nunca
--      o texto puro.
--   3. Cria `reimpressoes` — auditoria append-only de toda reimpressão bem-
--      sucedida (quem, quando, origem).
--
-- `pedido_id` em ambas as tabelas novas é uma referência LÓGICA a
-- `fila_impressao.id` (sem FK): a retenção (cleanup-fila) apaga pedidos
-- IMPRESSO com mais de 6 meses, e uma FK travaria esse DELETE para qualquer
-- pedido que algum dia tenha sido reimpresso. A integridade é garantida pela
-- aplicação (service_role), não pelo banco.
--
-- Ambas as tabelas novas têm RLS habilitado SEM policy para `anon`: acesso
-- exclusivo via service_role (routes server-side em app/api/*), mesmo padrão
-- de `chamados_ajuda` (migration 0008).
--
-- Rollback:
--   drop table if exists public.reimpressao_tokens;
--   drop table if exists public.reimpressoes;
--   alter table public.fila_impressao drop column if exists reimpressao;

-- =====================================================================
-- 1. fila_impressao.reimpressao
-- =====================================================================
alter table public.fila_impressao
  add column reimpressao boolean not null default false;

-- =====================================================================
-- 2. Tabela reimpressao_tokens (códigos de uso único do fluxo B — totem)
-- =====================================================================
create table public.reimpressao_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  pedido_id uuid not null,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_por bigint,
  criado_em timestamptz not null default now()
);

create index reimpressao_tokens_token_hash_idx
  on public.reimpressao_tokens (token_hash);

-- RLS habilitado sem nenhuma policy: todo acesso anon é negado por padrão.
-- Só as routes server-side (service_role) geram/resgatam tokens.
alter table public.reimpressao_tokens enable row level security;

-- =====================================================================
-- 3. Tabela reimpressoes (auditoria append-only)
-- =====================================================================
create table public.reimpressoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null,
  protocolo text not null check (protocolo ~ '^[0-9A-F]{8}$'),
  origem text not null check (origem in ('bot', 'totem')),
  telegram_user_id bigint,
  criado_em timestamptz not null default now()
);

create index reimpressoes_pedido_id_idx
  on public.reimpressoes (pedido_id);

-- RLS habilitado sem nenhuma policy: todo acesso anon é negado por padrão.
alter table public.reimpressoes enable row level security;
