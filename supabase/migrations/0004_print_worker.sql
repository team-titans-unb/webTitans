-- Print worker: adiciona o status IMPRIMINDO à fila_impressao.
-- O worker da sede usa esse estado para "reivindicar" (claim atômico) um pedido
-- PAGO antes de imprimir, garantindo impressão exatamente uma vez.
-- Rode este arquivo no SQL Editor do Supabase (produção).
--
-- Numeração: na branch do hardening existem 0002/0003. Esta migration usa 0004
-- para coexistir sem colisão quando as branches forem mescladas.

alter table public.fila_impressao
  drop constraint if exists fila_impressao_status_check;

alter table public.fila_impressao
  add constraint fila_impressao_status_check
  check (status in (
    'AGUARDANDO_PAGAMENTO',
    'PAGO',
    'IMPRIMINDO',
    'IMPRESSO',
    'ERRO',
    'CANCELADO'
  ));
