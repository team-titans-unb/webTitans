# kiosk-help-requests — Delta

## MODIFIED Requirements

### Requirement: Orientação por status do pedido
Para cada status retornado, o overlay SHALL exibir uma orientação específica ao cliente:
`AGUARDANDO_PAGAMENTO` → pagamento ainda não confirmado; `PAGO` → posição na fila e que é
só aguardar; `IMPRIMINDO` → está saindo agora; `IMPRESSO` → já pode retirar, com data e
horário da impressão; `ERRO`/`CANCELADO` → orientar a chamar a equipe pelo botão de
chamado.

A data da impressão SHALL ser exibida em formato relativo ao dia corrente (horário local
America/Sao_Paulo, comparação por dia de calendário): "hoje" para pedidos do dia, "ontem"
para o dia anterior e "dd/MM" para mais antigos — ex.: "Impresso hoje às 14:32",
"Impresso ontem às 22:10", "Impresso em 12/07 às 09:15".

#### Scenario: Pedido impresso hoje
- **WHEN** a consulta retorna status `IMPRESSO` com `printed_at` do dia corrente
- **THEN** o kiosk informa que o pedido pode ser retirado, com o texto "Impresso hoje às
  HH:MM"

#### Scenario: Pedido impresso ontem
- **WHEN** a consulta retorna status `IMPRESSO` com `printed_at` do dia anterior
- **THEN** o texto exibe "Impresso ontem às HH:MM"

#### Scenario: Pedido impresso em dias anteriores
- **WHEN** a consulta retorna status `IMPRESSO` com `printed_at` de dois ou mais dias atrás
- **THEN** o texto exibe a data curta "Impresso em dd/MM às HH:MM"

#### Scenario: Pedido com erro
- **WHEN** a consulta retorna status `ERRO`
- **THEN** o kiosk explica que houve falha na impressão e destaca o botão "Chamar a
  equipe"

## ADDED Requirements

### Requirement: QR code de convite ao grupo de ajuda no Telegram
Quando a variável de ambiente `NEXT_PUBLIC_TELEGRAM_HELP_INVITE_URL` estiver configurada,
o overlay de ajuda SHALL exibir um botão "Falar com a equipe no Telegram" que abre, dentro
do próprio overlay (sem abrir um segundo overlay), um painel com um QR code apontando para
o link de convite do grupo. Se um protocolo completo (8 caracteres) estiver digitado no
visor, o painel SHALL exibir esse protocolo em destaque junto ao QR, com a instrução de
enviá-lo no grupo ao entrar; sem protocolo digitado, o painel SHALL orientar o cliente a
descrever o problema e informar o protocolo se tiver. Quando a variável não estiver
configurada, o botão MUST NOT ser renderizado. O link de convite MUST NOT conter segredos
(é público por natureza — qualquer pessoa com o QR pode entrar).

#### Scenario: QR com protocolo digitado
- **WHEN** o cliente digitou um protocolo completo e toca em "Falar com a equipe no
  Telegram"
- **THEN** o painel mostra o QR code do convite e o protocolo em destaque com a instrução
  de enviá-lo no grupo ao entrar

#### Scenario: QR sem protocolo
- **WHEN** o cliente toca no botão do Telegram sem ter digitado um protocolo completo
- **THEN** o painel mostra o QR code do convite e orienta descrever o problema no grupo

#### Scenario: Convite não configurado
- **WHEN** `NEXT_PUBLIC_TELEGRAM_HELP_INVITE_URL` não está definida no ambiente
- **THEN** o botão do Telegram não aparece no overlay de ajuda e o restante do overlay
  funciona normalmente
