-- Kiosk: amplia a janela de exibição da fila pública para 24 horas
-- (kiosk-queue-24h-help-date-telegram).
-- Rode este arquivo no SQL Editor do Supabase (produção) ou via `supabase db push`.
--
-- Antes (0008): IMPRESSO visível por 15 min após printed_at; ERRO por 60 min após
-- paid_at. Agora ambos ficam 24 h, para o cliente que volta mais tarde (ou no dia
-- seguinte) ainda encontrar seu pedido na fila do totem. PAGO/IMPRIMINDO seguem
-- sempre visíveis. Colunas e security_invoker não mudam, então `create or replace`
-- é suficiente e os grants existentes (anon, authenticated) são preservados.
-- A retenção do cleanup-fila (linhas IMPRESSO vivem 6 meses) comporta a janela.

create or replace view public.fila_publica
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
  or (status = 'IMPRESSO' and printed_at > now() - interval '24 hours')
  or (status = 'ERRO' and paid_at > now() - interval '24 hours')
order by paid_at asc;
