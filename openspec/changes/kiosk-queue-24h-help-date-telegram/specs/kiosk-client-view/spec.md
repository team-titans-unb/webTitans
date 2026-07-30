# kiosk-client-view — Delta

## MODIFIED Requirements

### Requirement: Fila ao vivo identificada por protocolo
A tela principal SHALL exibir a fila de impressão em ordem FIFO (`paid_at` crescente),
lendo a view `fila_publica`, com cada pedido identificado exclusivamente pelo protocolo
existente (8 primeiros caracteres do UUID, maiúsculos — mesma derivação de
`TelaSucesso.tsx`, extraída para helper compartilhado). Nome de arquivo, UUID completo e
dados de pagamento MUST NOT aparecer. Cada item SHALL mostrar protocolo, número de
páginas, quantidade de cópias, modo de cor e status com distinção visual clara. O pedido
com status `IMPRIMINDO` SHALL receber destaque ("Imprimindo agora").

A view `fila_publica` SHALL manter visíveis os pedidos `IMPRESSO` por 24 horas após
`printed_at` e os pedidos `ERRO` por 24 horas após `paid_at`; `PAGO` e `IMPRIMINDO`
permanecem sempre visíveis. Como a janela cruza a meia-noite, o rótulo de horário de cada
item SHALL indicar a data quando o timestamp não for do dia corrente: "ontem" para o dia
anterior e "dd/MM" para dias mais antigos (ex.: "impresso ontem às 22:10"); itens de hoje
mantêm apenas o horário.

#### Scenario: Fila com pedidos ativos
- **WHEN** existem pedidos `PAGO` e um pedido `IMPRIMINDO`
- **THEN** o kiosk lista os pedidos em ordem de pagamento, com o `IMPRIMINDO` destacado e
  cada um identificado pelo protocolo de 8 caracteres

#### Scenario: Pedido concluído permanece visível por 24 horas
- **WHEN** um pedido muda para `IMPRESSO` ou `ERRO`
- **THEN** ele permanece visível na fila com o novo status por 24 horas (contadas de
  `printed_at` para `IMPRESSO` e de `paid_at` para `ERRO`) e some depois

#### Scenario: Pedido impresso ontem mostra a data
- **WHEN** a fila contém um pedido `IMPRESSO` cujo `printed_at` é do dia anterior
- **THEN** o rótulo de horário do item indica "ontem" junto ao horário (ex.: "impresso
  ontem às 22:10")

### Requirement: Tela idle com branding TITANS
O kiosk SHALL exibir a tela idle — identidade visual TITANS (gradiente
`titans-red → titans-orange`, logo, animação sutil), QR code em destaque e chamada para
imprimir — após 3 minutos sem nenhum toque na tela, independentemente de haver pedidos na
fila. Ao entrar em idle, qualquer overlay aberto SHALL ser fechado. O kiosk SHALL sair da
idle e voltar à tela principal quando: (a) a tela idle for tocada; ou (b) um novo pedido
ativo (`PAGO` ou `IMPRIMINDO`) surgir na fila pública. A saída de um pedido `IMPRESSO`
antigo da janela de 24 horas MUST NOT acordar a tela.

#### Scenario: Inatividade com fila não vazia
- **WHEN** a fila contém pedidos das últimas 24 horas e ninguém toca na tela por 3 minutos
- **THEN** o kiosk transiciona para a tela idle com branding e QR code

#### Scenario: Toque durante idle
- **WHEN** a tela idle está ativa e o cliente toca na tela
- **THEN** o kiosk volta para a tela principal com a fila, sem que o toque acione botões
  da tela principal

#### Scenario: Novo pedido chega durante idle
- **WHEN** um novo pedido `PAGO` ou `IMPRIMINDO` entra na fila pública enquanto a tela
  idle está ativa
- **THEN** o kiosk volta automaticamente para a tela principal com a fila

#### Scenario: Pedido antigo sai da janela durante idle
- **WHEN** um pedido `IMPRESSO` completa 24 horas e some da view durante a tela idle
- **THEN** o kiosk permanece na tela idle
