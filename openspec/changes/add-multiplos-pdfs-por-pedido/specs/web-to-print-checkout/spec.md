# web-to-print-checkout (delta)

## ADDED Requirements

### Requirement: Lista ordenável de arquivos do pedido

O passo de upload SHALL manter uma lista dos PDFs escolhidos, exibindo para cada item o
nome, o tamanho e a contagem de páginas, e SHALL exibir o total de páginas do pedido. O
cliente SHALL poder **remover** qualquer item e **reordenar** a lista (mover um item para
cima ou para baixo). A ordem da lista SHALL determinar a ordem das páginas no PDF enviado
para impressão. Seleções sucessivas SHALL acumular na lista em vez de substituí-la, e um
arquivo já presente (mesmo nome e mesmo tamanho) SHALL ser recusado como duplicado, com
aviso, sem alterar a lista.

#### Scenario: Cliente adiciona arquivos em duas seleções
- **WHEN** o cliente seleciona `a.pdf` e `b.pdf` e, em seguida, seleciona `c.pdf`
- **THEN** a lista contém os três arquivos, na ordem `a.pdf`, `b.pdf`, `c.pdf`, com o total
  de páginas somado dos três

#### Scenario: Cliente reordena a lista
- **WHEN** o cliente move `c.pdf` para a primeira posição
- **THEN** a lista passa a ser `c.pdf`, `a.pdf`, `b.pdf` e o PDF enviado para impressão
  começa pelas páginas de `c.pdf`

#### Scenario: Cliente remove um arquivo
- **WHEN** o cliente remove `b.pdf` de uma lista de três arquivos
- **THEN** `b.pdf` sai da lista, os demais permanecem na ordem em que estavam e o total de
  páginas é recalculado sem as páginas de `b.pdf`

#### Scenario: Arquivo duplicado
- **WHEN** o cliente seleciona novamente um arquivo com o mesmo nome e tamanho de um item
  já presente na lista
- **THEN** o sistema avisa que o arquivo já foi adicionado e a lista permanece inalterada

### Requirement: Mesclagem dos PDFs no navegador antes do upload

Quando o pedido tiver **mais de um** arquivo, o sistema SHALL mesclá-los em um único PDF
**no navegador**, na ordem da lista, sem enviar os arquivos individuais a nenhum servidor,
e SHALL enviar ao Storage apenas o arquivo mesclado. Quando o pedido tiver **exatamente
um** arquivo, o sistema SHALL enviar o arquivo original sem reescrevê-lo.

A mesclagem SHALL ocorrer ao concluir o passo de upload, antes da tela de configuração, com
indicação visual de progresso, de modo que o total de páginas exibido, o preço estimado e o
`num_paginas` do pedido derivem todos do mesmo arquivo que será enviado. Se a lista mudar
depois de mesclada, o sistema SHALL refazer a mesclagem antes de prosseguir.

#### Scenario: Três PDFs viram um pedido
- **WHEN** o cliente conclui o upload com `a.pdf` (4 páginas), `b.pdf` (12 páginas) e
  `c.pdf` (2 páginas), nessa ordem
- **THEN** o navegador produz um único PDF de 18 páginas com as páginas de `a`, depois `b`,
  depois `c`, e apenas esse arquivo é enviado ao bucket `pdfs-impressao`

#### Scenario: Pedido de arquivo único não é reescrito
- **WHEN** o cliente conclui o upload com apenas `a.pdf`
- **THEN** o sistema envia o `File` original ao Storage, byte a byte, sem passar pela
  mesclagem

#### Scenario: Arquivo que não pode ser mesclado
- **WHEN** a mesclagem falha ao copiar as páginas de `b.pdf`
- **THEN** o sistema informa qual arquivo causou a falha, mantém os demais na lista e não
  avança para a configuração

#### Scenario: Lista alterada após a mesclagem
- **WHEN** o cliente volta da configuração para o upload e remove um arquivo
- **THEN** o resultado da mesclagem anterior é descartado e um novo PDF é produzido ao
  concluir o upload novamente

### Requirement: Integridade da contagem do PDF mesclado

Antes de enviar o arquivo mesclado, o sistema SHALL recontar as páginas do PDF resultante e
SHALL prosseguir apenas se a contagem for igual à soma das contagens dos arquivos
individuais. Divergindo, o sistema SHALL bloquear o avanço e exibir erro, sem criar pedido
nem cobrar.

#### Scenario: Contagem do arquivo mesclado confere
- **WHEN** a soma das páginas dos arquivos é 18 e o PDF mesclado tem 18 páginas
- **THEN** o fluxo avança para a configuração com `num_paginas = 18`

#### Scenario: Contagem do arquivo mesclado diverge
- **WHEN** a soma das páginas dos arquivos é 18 mas o PDF mesclado tem 17 páginas
- **THEN** o sistema exibe erro, não faz upload, não cria pedido em `fila_impressao` e não
  gera PIX

### Requirement: Limites do pedido com múltiplos arquivos

O sistema SHALL aceitar no máximo **10 arquivos** por pedido e SHALL exigir que o PDF
efetivamente enviado (mesclado ou original) tenha no máximo **30 MB**, o mesmo teto do
bucket `pdfs-impressao`. Exceder qualquer um dos limites SHALL bloquear o avanço com
mensagem que explique o limite atingido.

#### Scenario: Décimo primeiro arquivo
- **WHEN** o cliente tenta adicionar um arquivo a uma lista que já tem 10
- **THEN** o sistema recusa a inclusão informando o limite de 10 arquivos por pedido e
  mantém a lista com os 10 itens

#### Scenario: Mesclado acima de 30 MB
- **WHEN** o PDF mesclado resulta em 42 MB
- **THEN** o sistema informa que o pedido excede 30 MB, orienta a remover ou dividir
  arquivos e não faz upload

## MODIFIED Requirements

### Requirement: Upload local de PDF com validação

O sistema SHALL aceitar **um ou mais** arquivos PDF do usuário via seletor de arquivo ou
arraste, validar cada arquivo quanto ao tipo MIME (`application/pdf`) e ao tamanho máximo
(30 MB), e rejeitar com mensagem clara — identificando o arquivo pelo nome — qualquer outro
tipo ou arquivo acima do limite. Arquivos recusados NÃO SHALL invalidar os demais da mesma
seleção.

#### Scenario: Usuário seleciona um PDF válido
- **WHEN** o usuário escolhe um arquivo `documento.pdf` de 3 MB
- **THEN** o sistema mostra o nome e tamanho do arquivo e habilita o próximo passo

#### Scenario: Usuário seleciona vários PDFs válidos
- **WHEN** o usuário escolhe `a.pdf` (3 MB) e `b.pdf` (5 MB) numa mesma seleção
- **THEN** o sistema lista os dois arquivos com nome, tamanho e páginas, e habilita o
  próximo passo

#### Scenario: Usuário tenta enviar um arquivo não-PDF
- **WHEN** o usuário escolhe `imagem.png`
- **THEN** o sistema mostra um toast de erro "Apenas arquivos PDF são aceitos" e não avança

#### Scenario: Usuário tenta enviar PDF maior que 30 MB
- **WHEN** o usuário escolhe um PDF de 42 MB
- **THEN** o sistema mostra um toast informando o limite de 30 MB e bloqueia o avanço

#### Scenario: Seleção mista de válidos e inválidos
- **WHEN** o usuário seleciona `a.pdf` (válido), `imagem.png` e `enorme.pdf` (42 MB) de uma
  vez
- **THEN** `a.pdf` entra na lista e o sistema informa, pelo nome, que `imagem.png` e
  `enorme.pdf` foram recusados

### Requirement: Contagem de páginas no cliente via pdfjs-dist

O sistema SHALL contar o número de páginas de **cada** PDF selecionado **localmente no
navegador** usando `pdfjs-dist`, sem enviar o arquivo ao servidor para essa operação, e
SHALL usar a **soma** das contagens como o total de páginas do pedido.

#### Scenario: PDF de 12 páginas carregado
- **WHEN** o usuário seleciona um PDF de 12 páginas válido
- **THEN** o sistema exibe "12 páginas" na tela de configuração antes de qualquer upload

#### Scenario: Vários PDFs somam o total do pedido
- **WHEN** o usuário seleciona PDFs de 4, 12 e 2 páginas
- **THEN** o sistema exibe a contagem de cada arquivo na lista e "18 páginas" como total do
  pedido na tela de configuração

#### Scenario: PDF corrompido
- **WHEN** o `pdfjs-dist` falha ao abrir um dos arquivos
- **THEN** o sistema mostra "Não foi possível ler este PDF", identifica o arquivo pelo nome
  e mantém os demais arquivos da lista

### Requirement: Upload direto para Supabase Storage e criação do pedido

O sistema SHALL fazer upload do PDF do pedido — o arquivo mesclado quando houver mais de um
arquivo, ou o arquivo original quando houver apenas um — diretamente do navegador para o
bucket `pdfs-impressao` do Supabase Storage usando a anon key, como **um único objeto** por
pedido. Ao concluir, SHALL inserir **uma única linha** em `fila_impressao` com
`status='AGUARDANDO_PAGAMENTO'`, `pdf_path` apontando para esse objeto, `num_paginas` igual
ao total de páginas do arquivo enviado, `quantidade_copias` e `modo_cor`, sem
`valor_centavos` (definido pelo servidor).

#### Scenario: Upload bem-sucedido
- **WHEN** o cliente clica em "Pagar" e o upload do PDF conclui sem erro
- **THEN** uma nova linha aparece em `fila_impressao` com `quantidade_copias` preenchido
  (>= 1) e status `AGUARDANDO_PAGAMENTO`, e o cliente recebe o `id` do pedido

#### Scenario: Pedido com vários arquivos gera um único registro
- **WHEN** o cliente conclui um pedido com 3 PDFs somando 18 páginas
- **THEN** existe exatamente um objeto no bucket e exatamente uma linha em `fila_impressao`
  com `num_paginas = 18`, e o cliente recebe um único `id` de pedido

#### Scenario: Falha de rede durante upload
- **WHEN** o upload do PDF falha por timeout/conexão
- **THEN** nenhum registro é criado em `fila_impressao` e o cliente vê "Falha no envio,
  tente novamente"
