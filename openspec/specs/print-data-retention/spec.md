# print-data-retention Specification

## Purpose

Manter o Storage e a tabela `fila_impressao` enxutos por meio de limpeza automática periódica (Edge Function `cleanup-fila` agendada via pg_cron, de hora em hora): pedidos não pagos são descartados após 1 hora, o PDF de pedidos impressos é removido após 7 dias e a própria linha é apagada após 6 meses — nunca tocando em pedidos `PAGO` ainda não impressos. A função é protegida por um segredo compartilhado (`CLEANUP_FUNCTION_SECRET`).

## Requirements
### Requirement: Limpeza de pedidos não pagos órfãos

O sistema SHALL remover automaticamente, de forma periódica (no mínimo de hora em hora), os pedidos em `status='AGUARDANDO_PAGAMENTO'` criados há mais de 1 hora, apagando tanto a linha em `fila_impressao` quanto o arquivo correspondente em `pdfs-impressao`.

#### Scenario: Pedido não pago expira
- **WHEN** existe um pedido `AGUARDANDO_PAGAMENTO` com `created_at` há mais de 1 hora
- **THEN** na próxima execução da limpeza, o PDF é removido do Storage e a linha é apagada

#### Scenario: Pedido não pago recente é preservado
- **WHEN** existe um pedido `AGUARDANDO_PAGAMENTO` criado há 10 minutos
- **THEN** a limpeza não o toca

### Requirement: Remoção de PDFs de pedidos impressos antigos

O sistema SHALL apagar o PDF (do Storage) de pedidos em `status='IMPRESSO'` cujo `printed_at` seja anterior a 7 dias, mantendo a linha em `fila_impressao` como histórico e anulando `pdf_path`.

#### Scenario: PDF de impressão antiga é removido
- **WHEN** um pedido está `IMPRESSO` com `printed_at` há 8 dias e `pdf_path` não nulo
- **THEN** a limpeza remove o arquivo do Storage e seta `pdf_path = NULL`, sem apagar a linha

#### Scenario: Impressão recente preserva o PDF
- **WHEN** um pedido está `IMPRESSO` com `printed_at` há 2 dias
- **THEN** a limpeza não remove o PDF

### Requirement: Remoção da linha de pedidos impressos após a janela de retenção

O sistema SHALL apagar a linha em `fila_impressao` de pedidos em `status='IMPRESSO'` cujo `printed_at` seja anterior a 6 meses, completando a retenção em dois estágios (PDF removido aos 7 dias, linha removida aos 6 meses). Nesse ponto o `pdf_path` já deve estar nulo, então a remoção só descarta o registro histórico.

#### Scenario: Pedido impresso além da retenção é apagado
- **WHEN** um pedido está `IMPRESSO` com `printed_at` há mais de 6 meses
- **THEN** a limpeza apaga a linha de `fila_impressao`

#### Scenario: Pedido impresso dentro da retenção é preservado
- **WHEN** um pedido está `IMPRESSO` com `printed_at` há 30 dias (PDF já removido aos 7 dias)
- **THEN** a limpeza mantém a linha como histórico e não a apaga

### Requirement: Pedidos pagos não impressos nunca são removidos

A limpeza SHALL **nunca** apagar a linha ou o PDF de pedidos em `status='PAGO'` que ainda não foram impressos, para não perder trabalho já pago.

#### Scenario: Pedido pago aguardando impressão é intocável
- **WHEN** existe um pedido `PAGO` há 3 dias ainda não impresso
- **THEN** a limpeza não remove nem a linha nem o PDF

### Requirement: Limpeza protegida por segredo

A função de limpeza SHALL exigir um segredo compartilhado (`CLEANUP_FUNCTION_SECRET`) no cabeçalho de autorização e SHALL rejeitar com 401 qualquer invocação sem o segredo correto.

#### Scenario: Invocação sem segredo é rejeitada
- **WHEN** alguém chama a URL da função de limpeza sem o header de autorização correto
- **THEN** a função responde 401 e não apaga nada

#### Scenario: Invocação agendada com segredo executa
- **WHEN** o job agendado chama a função com o `CLEANUP_FUNCTION_SECRET` correto
- **THEN** a limpeza roda normalmente

