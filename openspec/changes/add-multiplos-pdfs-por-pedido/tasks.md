# Tasks: add-multiplos-pdfs-por-pedido

## 1. Utilitários de PDF (`src/lib/pdf-utils.ts`)

- [x] 1.1 Adicionar `MAX_ARQUIVOS_POR_PEDIDO = 10` e manter `MAX_PDF_BYTES` (30 MB) como o
      teto único, aplicado por arquivo na seleção e ao arquivo final antes do upload
- [x] 1.2 Criar `validarSelecao(files, jaSelecionados)`: separa aceitos de recusados
      devolvendo o motivo por arquivo (tipo inválido, acima de 30 MB, duplicado por
      nome+tamanho, excede o limite de 10), sem lançar exceção — arquivo ruim não
      invalida a seleção inteira
- [x] 1.3 Criar `mesclarPDFs(files): Promise<File>` com `pdf-lib`
      (`PDFDocument.create` + `copyPages` na ordem recebida), lançando um erro que carrega
      o **nome do arquivo** que falhou ao ser copiado
- [x] 1.4 Garantir que `mesclarPDFs` só é chamada com 2+ arquivos; com 1, o `File` original
      é devolvido sem reescrita (comportamento atual byte a byte)
- [x] 1.5 Manter `validarArquivoPDF` e `contarPaginas` com a mesma assinatura e
      comportamento (são reusados pelo caminho de arquivo único)

## 2. Passo de upload (`src/components/impressao/UploadPDF.tsx`)

- [x] 2.1 Trocar o estado de arquivo único por uma lista de itens
      `{ file, paginas, id }`, com `input multiple` e `handleDrop` aceitando
      `dataTransfer.files` inteiro
- [x] 2.2 Acumular novas seleções na lista existente (sem substituir), aplicando
      `validarSelecao` e mostrando um toast por arquivo recusado, com o nome
- [x] 2.3 Contar as páginas de cada arquivo aceito com `contarPaginas`, exibindo estado
      "analisando…" por item e removendo da lista o arquivo que o `pdfjs` não conseguir ler
- [x] 2.4 Renderizar a lista com nome, tamanho, páginas e botões **remover**, **↑** e
      **↓** (desabilitados nas extremidades), acessíveis por toque e teclado
- [x] 2.5 Exibir o rodapé com total de arquivos e total de páginas do pedido
- [x] 2.6 No "Continuar": mesclar quando houver 2+ arquivos (com indicação
      "preparando arquivo…" e o botão desabilitado), recontar o resultado com
      `contarPaginas`, comparar com a soma e bloquear com erro se divergir
- [x] 2.7 Validar o tamanho do arquivo final contra `MAX_PDF_BYTES` e, ao exceder, orientar
      a remover ou dividir arquivos sem descartar a lista
- [x] 2.8 Entregar `{ file, numPaginas, nomeSugerido }` ao chamador — `nomeSugerido` é o
      nome original com 1 arquivo e `pedido-<N>-arquivos.pdf` com vários

## 3. Orquestração do checkout (`src/views/Impressao.tsx`)

- [x] 3.1 Guardar o arquivo final e o total de páginas vindos do upload; usar
      `nomeSugerido` (sanitizado como hoje) na montagem de `pdfPath`
- [x] 3.2 Garantir que voltar de `CONFIG` para `UPLOAD` descarta o resultado da mesclagem,
      forçando nova mesclagem se a lista mudar
- [x] 3.3 Confirmar que o `INSERT` em `fila_impressao` e a chamada de
      `POST /api/payments/create-pix` continuam com o mesmo formato de payload (uma linha,
      um `pdf_path`, sem `valor_centavos`)

## 4. Configuração e preço (`src/components/impressao/ConfiguracaoImpressao.tsx`)

- [x] 4.1 Confirmar que "Total de páginas" exibe a soma vinda do arquivo já mesclado e que
      `calcularValor(numPaginas, quantidadeCopias, MODO_COR, precos)` permanece intacto
- [x] 4.2 Ajustar o rótulo/legenda para indicar que o total cobre todos os arquivos do
      pedido (sem alterar o cálculo)

## 5. Verificação de não-regressão (o ponto crítico da mudança)

- [ ] 5.1 Pedido de **1 arquivo**: confirmar que o objeto no Storage é byte a byte igual ao
      original (comparar tamanho e hash) e que o fluxo até o PIX não mudou
- [ ] 5.2 Pedido de **3 arquivos** ponta a ponta em ambiente real: conferir que
      `create-pix` grava `num_paginas` igual à soma e o `valor_centavos` correspondente
- [x] 5.3 Confirmar no worker que a reconferência de páginas passa (sem `ERRO`) e que a
      impressão sai como **um único job**, com as cópias replicadas sobre o documento
      completo
- [ ] 5.4 Conferir o totem: `fila_publica` mostra o pedido com o total de páginas somado,
      sem mudança de layout ou de contrato
- [ ] 5.5 Conferir reimpressão (`/reimprimir` ou código no totem) e a limpeza de 7 dias
      sobre um pedido multi-arquivo — ambos operam sobre o `pdf_path` único
- [ ] 5.6 Testar recusas: `.png` na seleção, PDF de 42 MB, 11º arquivo, PDF criptografado
      (deve nomear o arquivo e manter os demais) e mesclado acima de 30 MB
- [x] 5.7 Rodar `npm run lint` e `npm run build`

## 6. Documentação

- [x] 6.1 Atualizar `docs/web-to-print/03-checkout.md`: passo 1 (seleção múltipla, lista
      ordenável, limites) e passo 2 (mesclagem no navegador, verificação de contagem,
      arquivo único sem re-encode)
- [x] 6.2 Registrar em "Decisões e pontos de atenção" do mesmo documento por que a
      mesclagem é feita no cliente e por que o pedido continua sendo uma linha com um
      `pdf_path`
- [x] 6.3 Conferir se `docs/web-to-print/05-supabase.md` e `09-diagramas.md` precisam de
      ajuste de texto (o contrato de dados não muda; só a origem do PDF)
