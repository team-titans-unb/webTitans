-- Web-to-Print: opera o banco no fuso de Brasília.
-- Rode este arquivo no SQL Editor do Supabase (produção).
--
-- Motivo: a equipe está em Brasília e o banco operava em UTC, dificultando a
-- leitura operacional dos horários em queries e no dashboard.
--
-- Efeito: muda apenas a EXIBIÇÃO e o `now()::timestamp`. As colunas
-- `timestamptz` continuam armazenadas em UTC — nada é convertido nem reescrito.
-- O cron de limpeza (`'0 * * * *'`) alinha no minuto 0 em qualquer fuso e os
-- intervalos da cleanup-fila (`now() - interval`) são tz-independentes em
-- `timestamptz`, então o comportamento de limpeza não muda.
--
-- Atenção: o novo default vale para conexões NOVAS; conexões em pool podem
-- demorar a pegar. Confira numa sessão nova com `show timezone;` e `select now();`.

alter database postgres set timezone to 'America/Sao_Paulo';
