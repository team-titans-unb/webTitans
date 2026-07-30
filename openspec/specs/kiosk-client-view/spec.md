# kiosk-client-view Specification

## Purpose
Definir a visão pública do kiosk (`/kiosk`): uma tela cheia, touch e sem a navegação padrão
do site, que exibe a fila de impressão em tempo real identificada por protocolo, o estado de
saúde da impressora, overlays de preços/QR code/ajuda e uma tela idle com branding TITANS.
A capability descreve o que o cliente vê a partir das views e tabelas públicas
(`fila_publica`, `impressora_status`), sem expor dados sensíveis de pedidos ou pagamento.
## Requirements
### Requirement: Rota /kiosk fullscreen dedicada
O site SHALL servir a rota pública `/kiosk` com layout próprio, sem Header, Footer ou
ScrollToTop, ocupando a tela inteira e adequada a uso touch (alvos de toque grandes,
cursor irrelevante, sem scroll horizontal).

#### Scenario: Acesso à rota
- **WHEN** um navegador abre `/kiosk`
- **THEN** a página renderiza em tela cheia sem a navegação padrão do site

### Requirement: Fila ao vivo identificada por protocolo
A tela principal SHALL exibir a fila de impressão em ordem FIFO (`paid_at` crescente),
lendo a view `fila_publica`, com cada pedido identificado exclusivamente pelo protocolo
existente (8 primeiros caracteres do UUID, maiúsculos — mesma derivação de
`TelaSucesso.tsx`, extraída para helper compartilhado). Nome de arquivo, UUID completo e
dados de pagamento MUST NOT aparecer. Cada item SHALL mostrar protocolo, número de
páginas, quantidade de cópias, modo de cor e status com distinção visual clara. O pedido
com status `IMPRIMINDO` SHALL receber destaque ("Imprimindo agora").

#### Scenario: Fila com pedidos ativos
- **WHEN** existem pedidos `PAGO` e um pedido `IMPRIMINDO`
- **THEN** o kiosk lista os pedidos em ordem de pagamento, com o `IMPRIMINDO` destacado e
  cada um identificado pelo protocolo de 8 caracteres

#### Scenario: Pedido recém-concluído permanece visível
- **WHEN** um pedido muda para `IMPRESSO` ou `ERRO`
- **THEN** ele permanece visível na fila com o novo status por uma janela curta definida
  na view (para o cliente ver a conclusão) e some depois

### Requirement: Atualização em tempo real com fallback de polling
A fila SHALL atualizar-se automaticamente: assinatura Supabase Realtime em
`fila_impressao` usada como gatilho para refetch da view `fila_publica` (com debounce),
mais polling periódico de fallback para cobrir perda da conexão realtime.

#### Scenario: Mudança de status na fila
- **WHEN** o worker atualiza o status de um pedido
- **THEN** o kiosk reflete a mudança em poucos segundos sem interação e sem recarregar a
  página

#### Scenario: Conexão realtime perdida
- **WHEN** a assinatura realtime cai silenciosamente
- **THEN** o polling de fallback mantém a fila atualizada no intervalo configurado

### Requirement: Indicador de estado da impressora
A tela principal SHALL exibir permanentemente o estado da impressora a partir de
`impressora_status`: estado reportado pelo worker (`OK`, `IMPRIMINDO`, `PAUSADA`,
`INALCANCAVEL`) com texto amigável ao cliente. Quando `atualizado_em` for mais antigo que
3× o intervalo de heartbeat, o kiosk SHALL exibir "sistema de impressão offline"
independentemente do estado gravado.

#### Scenario: Impressora saudável
- **WHEN** o heartbeat é recente e o estado é `OK`
- **THEN** o kiosk indica que a impressora está pronta

#### Scenario: Worker parado
- **WHEN** o heartbeat está mais velho que 3× o intervalo esperado
- **THEN** o kiosk indica sistema offline, mesmo que o último estado gravado seja `OK`

### Requirement: Painéis sobrepostos (overlays) com fechamento explícito
Preços, QR code de nova impressão e ajuda SHALL abrir como painéis sobrepostos à tela
principal (overlay com fundo escurecido), abertos por botões grandes fixos na tela
principal, cada um com um botão X visível para fechar e retorno à tela principal. Apenas
um overlay SHALL estar aberto por vez. Um overlay sem interação por 60 segundos SHALL
fechar automaticamente.

#### Scenario: Abrir e fechar um overlay
- **WHEN** o cliente toca no botão "Preços"
- **THEN** o painel de preços sobrepõe a fila e um toque no X o fecha, revelando a tela
  principal intacta

#### Scenario: Overlay abandonado
- **WHEN** um overlay fica 60 segundos sem nenhum toque
- **THEN** ele fecha sozinho e a tela volta ao estado principal

### Requirement: Overlay de preços
O overlay de preços SHALL exibir a tabela vigente lida de `config_precos` (P&B e
colorido, valor por página em reais), reutilizando a formatação de preço existente do
projeto.

#### Scenario: Consulta de preços
- **WHEN** o cliente abre o overlay de preços
- **THEN** vê os valores por página de P&B e colorido conforme o banco, formatados em BRL

### Requirement: QR code para nova impressão
O kiosk SHALL oferecer um QR code (gerado com a dependência `qrcode.react` já existente)
apontando para a página `/impressao` do site, disponível no overlay "Imprimir" e na tela
idle.

#### Scenario: Cliente quer imprimir na hora
- **WHEN** o cliente escaneia o QR code exibido
- **THEN** o celular abre a página `/impressao` para iniciar um pedido

### Requirement: Tela idle com branding TITANS
Quando não houver pedidos visíveis na fila pública, o kiosk SHALL exibir uma tela idle
com identidade visual TITANS (gradiente `titans-red → titans-orange`, logo, animação
sutil), QR code em destaque e chamada para imprimir. Qualquer toque ou o surgimento de um
pedido na fila SHALL retornar à tela principal.

#### Scenario: Fila esvazia
- **WHEN** o último pedido sai da janela de exibição da fila
- **THEN** o kiosk transiciona para a tela idle com branding e QR code

#### Scenario: Novo pedido chega durante idle
- **WHEN** um pedido entra na fila pública enquanto a tela idle está ativa
- **THEN** o kiosk volta automaticamente para a tela principal com a fila

### Requirement: Mensagens específicas por estado de saúde na faixa da impressora
A faixa de estado da impressora (`FaixaImpressora`) SHALL exibir texto amigável e distinto para
cada novo estado de saúde lido de `impressora_status.estado`: `SEM_PAPEL` ("Sem papel — a
equipe já foi avisada"), `SEM_TONER` ("Toner esgotado — a equipe já foi avisada") e
`MANUTENCAO` ("Impressora em manutenção — a equipe já foi avisada"), cada um com cor semântica
apropriada. A condição `offline` (heartbeat mais velho que 3× o intervalo) MUST manter
prioridade máxima sobre qualquer estado de saúde. Nenhuma rota, endpoint ou dependência nova
SHALL ser necessária — o Realtime existente de `impressora_status` entrega os dados.

#### Scenario: Impressora sem papel
- **WHEN** `impressora_status.estado` é `SEM_PAPEL` e o heartbeat está recente
- **THEN** a faixa mostra "Sem papel — a equipe já foi avisada" com destaque visual de alerta

#### Scenario: Offline domina o estado de saúde
- **WHEN** o último estado gravado é `SEM_PAPEL` mas o heartbeat está mais velho que 3× o
  intervalo
- **THEN** a faixa mostra "Sistema de impressão offline", não a mensagem de sem papel

### Requirement: Aviso discreto de toner baixo
Quando `detalhes.toner_baixo` for `true`, o kiosk SHALL exibir um aviso discreto de toner
acabando, independentemente do `estado` ser `OK` ou `IMPRIMINDO`. O aviso MUST ser ortogonal ao
estado (não substitui a mensagem principal da faixa) e MUST desaparecer quando `toner_baixo`
voltar a `false`.

#### Scenario: Toner baixo com impressora pronta
- **WHEN** o estado é `OK` e `detalhes.toner_baixo` é `true`
- **THEN** a faixa indica que a impressora está pronta e adiciona um aviso discreto de toner
  acabando

#### Scenario: Toner reposto
- **WHEN** `detalhes.toner_baixo` volta a `false`
- **THEN** o aviso de toner acabando deixa de aparecer no kiosk
