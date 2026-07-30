# Design: add-multiplos-pdfs-por-pedido

## Context

O pedido de impressão é hoje rigidamente **1 arquivo = 1 linha em `fila_impressao`**, e o
PDF desse pedido é lido e analisado em cinco pontos independentes, dois deles com poder de
recusar a impressão:

| Onde | O que faz com o PDF |
| --- | --- |
| `UploadPDF.tsx` + `pdf-utils.ts` | valida MIME e 30 MB, conta páginas com `pdfjs-dist` |
| `Impressao.tsx` | sobe para `pdfs-impressao/<uuid>/<nome>.pdf` e insere a linha com `pdf_path`/`num_paginas` |
| `create-pix/route.ts` | **autoridade de preço**: baixa o PDF, reconta com `pdf-lib`, sobrescreve `num_paginas` e grava `valor_centavos` |
| `print-worker/worker.py` | baixa, reconta com `pypdf` e **manda o pedido para `ERRO` se divergir de `num_paginas`**; replica por cópias e envia um único job `lp` |
| `fila_publica` → totem | exibe `num_paginas · quantidade_copias · modo_cor` |

Além desses, `cleanup-fila` (retenção: apaga o objeto e anula `pdf_path`) e a guarda de
reimpressão (`pdf_path IS NOT NULL`) assumem **um caminho de arquivo por pedido**.

A restrição central da mudança é: qualquer desenho que faça `num_paginas` deixar de
corresponder exatamente ao PDF apontado por `pdf_path` quebra a reconferência do worker e
transforma pedidos pagos em `ERRO`.

## Goals / Non-Goals

**Goals:**

- Permitir que um cliente com vários PDFs faça **um** pedido, **um** PIX e receba **um**
  protocolo.
- Manter o invariante `num_paginas == páginas reais do objeto em pdf_path`, verificado
  ainda no navegador, antes do upload.
- Não alterar nenhum contrato de banco, API, worker, totem ou retenção — zero migration,
  zero deploy na Raspberry Pi.
- Manter o pedido de arquivo único com comportamento **idêntico** ao de hoje.

**Non-Goals:**

- Preservar a identidade individual dos arquivos após o upload (nomes por arquivo no
  totem, retenção ou reimpressão por arquivo).
- Configuração por arquivo (cópias, frente-e-verso ou modo de cor diferentes por
  documento) — o pedido continua tendo uma única configuração.
- Elevar o teto de 30 MB do bucket ou aceitar formatos além de PDF (imagens, DOCX).
- Reordenação por arrastar-e-soltar.

## Decisions

### D1. Mesclar no navegador, mantendo um objeto por pedido

Os arquivos selecionados são concatenados em **um único PDF no próprio navegador**, com
`pdf-lib`, e apenas esse arquivo sobe ao Storage. O pedido continua sendo uma linha com um
`pdf_path` e `num_paginas` igual à soma.

*Por quê:* toda a cadeia a jusante (`create-pix`, worker, retenção, reimpressão, totem,
RLS) já sabe lidar com "um pedido, um PDF de N páginas" — um pedido de 3 arquivos vira,
para ela, indistinguível de um PDF de N páginas enviado hoje. A autoridade de preço não é
enfraquecida: o `create-pix` continua baixando e recontando **o arquivo que realmente
subiu**, então uma mesclagem adulterada no cliente seria cobrada pelo que ela realmente é.

*Alternativas consideradas:*

- **Tabela filha `pedido_arquivos` (N linhas por pedido).** Preservaria cada arquivo, mas
  exigiria mudar simultaneamente `create-pix` (baixar N objetos dentro do orçamento de
  tempo da função), `worker.py` (baixar N, reconferir N, concatenar), `cleanup-fila`,
  a guarda de reimpressão e a RLS — cinco componentes no caminho crítico de preço e de
  impressão, dois deles fora da Vercel (Deno e Python na sede), cada um com seu próprio
  ciclo de deploy e rollback. Custo de risco desproporcional ao ganho.
- **Um pedido por arquivo, agrupados por `grupo_id` com um PIX único.** Quebraria a
  relação 1:1 entre pedido e pagamento, que hoje é a espinha do fluxo:
  `external_reference = pedido.id` no Mercado Pago, `idempotencyKey = pedido.id`, o
  webhook atualizando uma linha, o protocolo derivado do UUID e a posição na fila.

### D2. Arquivo único não passa pela mesclagem

Com exatamente um arquivo selecionado, o `File` original é enviado byte a byte — sem
`pdf-lib`, sem re-encode, sem qualquer caminho de código novo entre a seleção e o upload.

*Por quê:* é o fluxo que atende praticamente todos os pedidos hoje. Mantê-lo intocado
garante que a mudança não pode regredir o caso dominante, e elimina classes inteiras de
risco (PDFs que o `pdf-lib` não reescreve fielmente) para quem não usa a feature nova.

### D3. `pdfjs-dist` conta, `pdf-lib` mescla

A contagem por arquivo continua com `pdfjs-dist` (mesma `contarPaginas` de hoje) e a
mesclagem usa `pdf-lib` (`PDFDocument.create` + `copyPages`).

*Por quê:* ambos já são dependências do projeto (`pdfjs-dist` no navegador, `pdf-lib` no
`create-pix`), nenhum pacote novo entra. O `pdfjs` é o parser mais tolerante dos dois e já
é a régua do que o checkout aceita; o `pdf-lib` é o único dos dois que sabe **escrever**
PDF. Usar cada um para o que ele faz bem evita trocar o parser de contagem — o que mudaria
o conjunto de PDFs aceitos hoje.

### D4. Verificação de integridade da mesclagem antes do upload

Após mesclar, o navegador reconta as páginas do PDF resultante (com `pdfjs-dist`, o mesmo
parser da contagem por arquivo) e SÓ prossegue se o resultado for igual à soma das
contagens individuais.

*Por quê:* `num_paginas` divergente do PDF real é justamente o que faz o worker marcar
`ERRO` — depois do pagamento. Verificar no navegador transforma uma falha pós-pagamento
(cliente pagou e não imprime) em uma falha pré-pagamento (mensagem na tela, nada cobrado).

### D5. A mesclagem acontece ao sair do passo de upload

O botão "Continuar" do passo `UPLOAD` executa validação → mesclagem → verificação, com
indicação de progresso, e só então avança para `CONFIG`. A tela de configuração passa a
receber o arquivo final e o total de páginas **desse** arquivo. Voltar para `UPLOAD`
descarta o resultado da mesclagem, que é refeita se a lista mudar.

*Por quê:* o total de páginas exibido, o preço estimado e o `num_paginas` do `INSERT`
passam a vir todos do mesmo artefato que será enviado — não há janela em que a UI mostre
uma contagem e o Storage receba outra.

### D6. Nome do objeto no Storage

Mantém-se o formato `<uuid>/<nome-sanitizado>.pdf`. Com um arquivo, o nome continua sendo
o do arquivo original (comportamento atual). Com vários, o objeto é nomeado
`pedido-<N>-arquivos.pdf`.

*Por quê:* `pdf_path` aparece nos logs do worker e nas consultas de operação; um nome que
denuncia a natureza do pedido ajuda no diagnóstico, sem alterar o formato que a retenção e
o worker consomem.

### D7. Reordenar com botões ↑ / ↓

A ordem das páginas no PDF final é a ordem da lista, ajustável por botões de subir/descer
em cada item, mais um botão de remover.

*Por quê:* funciona por toque no celular (o dispositivo real do fluxo `/impressao`) e no
desktop, é acessível por teclado e não adiciona dependência de drag-and-drop.

### D8. Limites: 10 arquivos e 30 MB no arquivo mesclado

A validação é em duas frentes: a quantidade é barrada na seleção; o tamanho é verificado
no **resultado da mesclagem**, contra o mesmo teto de 30 MB (`MAX_PDF_BYTES`) já aplicado
hoje por arquivo e replicado no `file_size_limit` do bucket.

*Por quê:* o teto do objeto é do bucket e existe para o `create-pix` conseguir baixar e
contar dentro do orçamento de tempo da função — mesclar não pode contorná-lo. Checar o
tamanho depois da mesclagem (e não somando as entradas) dá o número verdadeiro, já que a
saída costuma ser menor que a soma das entradas por deduplicação de objetos. O teto de 10
arquivos limita o pico de memória do navegador e mantém a lista legível numa tela de
celular.

## Risks / Trade-offs

- **PDF que o `pdfjs` lê mas o `pdf-lib` não consegue copiar** (criptografado, estrutura
  incomum) → a mesclagem falha **nomeando o arquivo culpado**, que pode ser removido sem
  perder o resto da seleção. O pedido de arquivo único não passa por esse caminho (D2), e
  PDFs criptografados já eram recusados pelo `create-pix` com 422 — a falha só muda de
  lugar, para antes do pagamento.
- **Fidelidade da reescrita**: `copyPages` preserva conteúdo de página e anotações, mas o
  documento resultante perde estruturas de nível de documento (marcadores, campos de
  formulário interativos, assinaturas). → Irrelevante para o produto entregue, que é papel
  impresso; e, por D2, quem envia um arquivo só nunca é afetado.
- **Memória e tempo no celular** ao mesclar até 10 arquivos → limites de D8, feedback de
  "preparando arquivo…" durante a operação e mensagem explícita quando o resultado passa
  de 30 MB, indicando remover ou dividir arquivos.
- **Selecionar mais arquivos em rodadas** (o seletor nativo substitui a seleção anterior)
  → a lista acumula entre seleções em vez de substituir, e arquivos idênticos (mesmo nome
  e tamanho) são recusados como duplicados, com aviso.
- **Contagem somada divergindo do arquivo final** → coberto por D4; o pedido não avança
  para o pagamento sem a verificação passar.
- **Perda da identidade individual dos arquivos** (não dá para reimprimir só o terceiro
  documento) → aceito conscientemente como Non-Goal; a reimpressão continua sendo do
  pedido inteiro, como já é hoje.

## Migration Plan

- Sem migration de banco, sem alteração de RLS, sem deploy do worker na sede e sem
  alteração da Edge Function de limpeza. O deploy é exclusivamente do frontend na Vercel.
- Pedidos criados antes, durante e depois do deploy têm exatamente a mesma forma no banco
  e no Storage: uma linha, um objeto PDF.
- **Rollback**: reverter o commit do frontend. Nenhum estado persistido precisa ser
  desfeito — os pedidos gerados enquanto a feature esteve no ar são PDFs comuns de N
  páginas e seguem imprimíveis, reimprimíveis e limpáveis pelas rotinas atuais.

## Open Questions

- A spec atual de `web-to-print-checkout` diz "50 MB" no requisito de upload, enquanto o
  código (`MAX_PDF_BYTES`), o bucket e a spec `print-upload-abuse-protection` usam 30 MB.
  Esta mudança corrige o texto para 30 MB ao reescrever o requisito; é uma correção de
  documentação, sem alteração de comportamento.
- Exibir "3 arquivos" no totem exigiria um campo novo em `fila_impressao` e uma migration.
  Fica de fora desta mudança (Non-Goal) e pode ser proposto depois, se a operação sentir
  falta.
