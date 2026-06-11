-- Web-to-Print: torna pdf_path nullable.
-- Rode este arquivo no SQL Editor do Supabase (produção).
--
-- Motivo: a Edge Function cleanup-fila, na regra de 7 dias, remove o PDF do
-- Storage e faz `update ... set pdf_path = null` no pedido IMPRESSO, mantendo a
-- linha como histórico. A coluna foi criada NOT NULL em 0001, então esse UPDATE
-- falharia (e derrubaria a limpeza com erro). Esta migration corrige isso.
--
-- O caminho de criação do pedido continua sempre enviando pdf_path; a coluna só
-- fica nula após a limpeza do arquivo.

alter table public.fila_impressao
  alter column pdf_path drop not null;
