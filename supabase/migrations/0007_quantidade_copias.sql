-- Web-to-Print: quantidade de cópias (add-print-copies)
-- Rode este arquivo no SQL Editor do Supabase (produção) ou via `supabase db push`.
--
-- O que esta migration faz:
--   1. Adiciona `quantidade_copias int not null default 1 check (>= 1)` à
--      `fila_impressao`. O default 1 mantém a retrocompatibilidade: pedidos
--      legados e qualquer INSERT que não informe o campo continuam valendo 1
--      cópia, preservando o comportamento atual.
--   2. Reforça a policy de INSERT anon para exigir `quantidade_copias >= 1`,
--      fechando o piso no banco e mantendo o servidor como autoridade de preço.

-- =====================================================================
-- 1. Coluna quantidade_copias (default 1, piso garantido no banco)
-- =====================================================================
alter table public.fila_impressao
  add column quantidade_copias int not null default 1
  check (quantidade_copias >= 1);

-- =====================================================================
-- 2. RLS — INSERT anon valida o piso de quantidade_copias
-- =====================================================================
-- Recria a policy preservando as condições atuais (incl. valor_centavos is null
-- da 0002) e acrescentando o piso de cópias.
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
    and quantidade_copias >= 1
  );
-- O preço continua sendo calculado pelo servidor (create-pix), que lê
-- quantidade_copias da própria linha. UPDATE/DELETE anon seguem negados.
