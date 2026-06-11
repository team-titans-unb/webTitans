# print-payment-integrity Specification

## Purpose

Garantir que a contagem de páginas e o valor cobrado de um pedido de impressão sejam sempre determinados pelo servidor: o `create-pix` baixa o PDF do Storage, conta as páginas com `pdf-lib` e recalcula `valor_centavos = páginas reais × config_precos[modo_cor]`, ignorando o que o cliente declarou. Assim o cliente não influencia nem o número de páginas nem o preço, e PDFs inválidos ou criptografados são recusados (422) sem gerar cobrança.

## Requirements
### Requirement: Contagem de páginas é determinada pelo servidor

O endpoint `create-pix` SHALL baixar o PDF do Storage (via service_role), contar as páginas com `pdf-lib`, e usar **essa** contagem (não o `num_paginas` declarado pelo cliente) como base para o cálculo do preço, gravando o valor real em `num_paginas`.

#### Scenario: Página subdeclarada é corrigida pelo servidor
- **WHEN** o cliente cria um pedido declarando `num_paginas=1` para um PDF que na verdade tem 500 páginas
- **THEN** o `create-pix` conta 500 páginas a partir do arquivo e cobra com base em 500, não em 1

#### Scenario: PDF inválido ou ilegível é rejeitado sem cobrança
- **WHEN** o arquivo no Storage não é um PDF válido ou está criptografado e o `pdf-lib` não consegue abri-lo
- **THEN** o `create-pix` responde 422 e não cria cobrança no Mercado Pago

### Requirement: Valor cobrado é calculado pelo servidor

O endpoint `create-pix` SHALL calcular `valor_centavos = paginasReais × config_precos[modo_cor]` no servidor (usando service_role e a contagem feita a partir do PDF), ignorando qualquer valor de preço enviado pelo cliente, e SHALL cobrar exatamente esse valor no Mercado Pago.

#### Scenario: Preço recalculado a partir do pedido
- **WHEN** o `create-pix` conta 10 páginas, `modo_cor='PB'` e `config_precos.PB=50`
- **THEN** o servidor cobra R$ 5,00 no MP e grava `valor_centavos=500` na linha, independentemente do que o cliente tenha tentado enviar

#### Scenario: Preço gravado é o do servidor
- **WHEN** o `create-pix` conclui com sucesso
- **THEN** a coluna `valor_centavos` da linha reflete o cálculo do servidor, não um valor fornecido pelo cliente

### Requirement: Cliente não pode definir o preço no INSERT

A RLS de INSERT anônimo em `fila_impressao` SHALL exigir `valor_centavos IS NULL`, e a coluna SHALL ser nullable até que o `create-pix` a preencha.

#### Scenario: INSERT com valor_centavos preenchido é rejeitado
- **WHEN** o cliente tenta inserir uma linha com `valor_centavos=1`
- **THEN** a RLS rejeita o INSERT

#### Scenario: INSERT sem valor_centavos é aceito
- **WHEN** o cliente insere `{ pdf_path, num_paginas, modo_cor }` sem `valor_centavos`
- **THEN** o INSERT é aceito com `valor_centavos = NULL`

### Requirement: Tentativa de fraude de preço ou de páginas não reduz o valor cobrado

O sistema SHALL garantir que manipular o `valor_centavos` ou o `num_paginas` (por qualquer meio acessível ao cliente) não reduza o valor efetivamente cobrado pelo Mercado Pago.

#### Scenario: Pedido grande com tentativa de preço baixo
- **WHEN** o cliente tenta forçar `valor_centavos=1` no INSERT
- **THEN** o INSERT é bloqueado pela RLS, e o `create-pix` cobra com base na contagem real de páginas × preço

#### Scenario: Pedido grande com páginas subdeclaradas
- **WHEN** o cliente declara `num_paginas=1` para um PDF colorido de 500 páginas
- **THEN** o `create-pix` lê 500 páginas do arquivo e cobra `500 × config_precos.COLORIDO`, não 1 página

