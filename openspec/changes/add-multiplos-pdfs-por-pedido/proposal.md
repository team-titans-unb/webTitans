# Proposal: add-multiplos-pdfs-por-pedido

## Why

Hoje `/impressao` aceita **um** PDF por pedido: quem chega com vários arquivos (o caso
comum de quem imprime uma lista de exercícios, um capítulo e um formulário na mesma ida à
sede) precisa repetir todo o fluxo — upload, PIX, protocolo, espera na fila — uma vez por
arquivo, pagando N cobranças separadas e recebendo N protocolos para guardar. Isso
multiplica o atrito para o cliente e o número de pedidos na fila do totem sem nenhum ganho
operacional.

## What Changes

- O passo de upload passa a aceitar **vários PDFs** (clique ou arraste, em uma ou mais
  seleções), exibindo a lista com nome, tamanho e páginas de cada arquivo, o total de
  páginas do pedido e ações de **remover** e **reordenar** antes de prosseguir.
- Os arquivos escolhidos são **mesclados no navegador** (via `pdf-lib`, já dependência do
  projeto) num único PDF, na ordem definida pelo cliente, e só o arquivo mesclado é enviado
  ao Storage. O pedido continua sendo **uma linha** em `fila_impressao`, com **um**
  `pdf_path` e `num_paginas` igual à soma das páginas.
- **Pedido de um único arquivo permanece idêntico ao de hoje**: o arquivo original é
  enviado byte a byte, sem passar pela mesclagem e sem re-encode.
- Novos limites do pedido: no máximo **10 arquivos** e PDF mesclado de no máximo **30 MB**
  (o mesmo teto do bucket `pdfs-impressao`), com mensagens de erro que identificam o
  arquivo problemático.
- Validação por arquivo antes da mesclagem (tipo `application/pdf`, legibilidade,
  contagem de páginas): um PDF ilegível ou protegido é apontado **pelo nome** e pode ser
  removido sem descartar a seleção inteira.
- Sem **BREAKING**: nenhum contrato de banco, API, worker ou totem muda. `create-pix`
  continua sendo a autoridade de preço contando as páginas do arquivo que efetivamente
  subiu; o worker continua reconferindo `num_paginas` e imprimindo um único job.

## Capabilities

### New Capabilities

Nenhuma. A mudança estende o comportamento de uma capability existente.

### Modified Capabilities

- `web-to-print-checkout`: o upload deixa de ser de arquivo único e passa a aceitar uma
  lista ordenável de PDFs; a contagem de páginas passa a ser por arquivo **e** somada no
  pedido; entram os requisitos de mesclagem no navegador, de preservação byte a byte do
  fluxo de arquivo único e dos limites de 10 arquivos / 30 MB no arquivo mesclado.

## Impact

- **Frontend (todo o código afetado vive aqui)**:
  - `src/components/impressao/UploadPDF.tsx` — seleção múltipla (`multiple`), lista com
    remover/reordenar, contagem por arquivo e total, estados de erro por arquivo.
  - `src/lib/pdf-utils.ts` — validação da lista (quantidade, tipo, tamanho) e
    `mesclarPDFs` com `pdf-lib`; `contarPaginas` e `validarArquivoPDF` seguem existindo
    com a mesma assinatura.
  - `src/views/Impressao.tsx` — recebe a lista de arquivos e o total de páginas; o
    `INSERT` em `fila_impressao` e a chamada de `create-pix` não mudam de forma.
  - `src/components/impressao/ConfiguracaoImpressao.tsx` — o "Total de páginas" passa a
    ser a soma; o cálculo `páginas × cópias × preço` permanece intacto.
- **Sem alterações** (verificado arquivo a arquivo, e é isto que mantém o risco baixo):
  `app/api/payments/create-pix/route.ts`, `print-worker/worker.py`,
  `supabase/functions/cleanup-fila/index.ts`, `src/lib/server/reimpressao.ts`,
  `src/lib/server/pedido-protocolo.ts`, a view `fila_publica` e os componentes do totem,
  as policies de RLS e o bucket `pdfs-impressao`. Nenhuma migration nova.
- **Capabilities vizinhas preservadas**: `print-payment-integrity` (o servidor continua
  recontando as páginas do PDF real), `print-worker` (recontagem + job único),
  `print-upload-abuse-protection` (um objeto por pedido, `application/pdf`, ≤ 30 MB),
  `print-data-retention` (um `pdf_path` por pedido) e `pedido-reimpressao` (guarda por
  `pdf_path IS NOT NULL`).
- **Documentação**: `docs/web-to-print/03-checkout.md` precisa descrever o novo passo de
  upload e a mesclagem (requisito da capability `web-to-print-docs`, cujos requisitos não
  mudam).
- **Dependências**: nenhuma nova — `pdf-lib@^1.17.1` já está no `package.json` (hoje usado
  no servidor pelo `create-pix`) e roda no navegador.
