# kiosk-help-requests — Delta Spec

## ADDED Requirements

### Requirement: Consulta de pedido por protocolo no kiosk
O overlay de ajuda SHALL permitir ao cliente digitar seu protocolo (8 caracteres
hexadecimais) num teclado touch próprio da interface (teclas `0-9`/`A-F` + apagar, sem
depender de teclado do sistema) e consultar o pedido via `GET /api/kiosk/pedido`. A API
route SHALL buscar server-side (service_role) por prefixo do UUID
(case-insensitive), retornar apenas `{ status, paid_at, printed_at, posicao_na_fila }` e,
em caso de colisão de prefixo, resolver pelo pedido mais recente. O UUID completo MUST
NOT ser retornado.

#### Scenario: Protocolo válido encontrado
- **WHEN** o cliente digita um protocolo existente e confirma
- **THEN** o kiosk mostra o status do pedido e, se estiver na fila, sua posição

#### Scenario: Protocolo inexistente
- **WHEN** o cliente digita um protocolo que não corresponde a nenhum pedido
- **THEN** o kiosk informa claramente que o pedido não foi encontrado e orienta conferir
  o código

### Requirement: Orientação por status do pedido
Para cada status retornado, o overlay SHALL exibir uma orientação específica ao cliente:
`AGUARDANDO_PAGAMENTO` → pagamento ainda não confirmado; `PAGO` → posição na fila e que é
só aguardar; `IMPRIMINDO` → está saindo agora; `IMPRESSO` → já pode retirar (com
horário); `ERRO`/`CANCELADO` → orientar a chamar a equipe pelo botão de chamado.

#### Scenario: Pedido com erro
- **WHEN** a consulta retorna status `ERRO`
- **THEN** o kiosk explica que houve falha na impressão e destaca o botão "Chamar a
  equipe"

### Requirement: Registro de chamados de ajuda
O kiosk SHALL oferecer a ação "Chamar a equipe" (com protocolo opcional e categoria:
"não saiu", "saiu com defeito", "outro") via `POST /api/kiosk/help`. A route SHALL
inserir o chamado na tabela `chamados_ajuda` usando service_role e responder confirmação
ao kiosk, que SHALL exibir mensagem de que a equipe foi avisada. Chamados repetidos
(mesmo protocolo e categoria) dentro de 5 minutos SHALL ser rejeitados com mensagem
amigável, para conter toques repetidos.

#### Scenario: Chamado registrado
- **WHEN** o cliente toca "Chamar a equipe" com uma categoria selecionada
- **THEN** o chamado é persistido em `chamados_ajuda` e o kiosk confirma que a equipe foi
  notificada

#### Scenario: Chamado duplicado em janela curta
- **WHEN** um chamado idêntico ao anterior chega em menos de 5 minutos
- **THEN** a API rejeita o duplicado e o kiosk informa que a equipe já foi avisada

### Requirement: Notificação da equipe via Telegram
Quando as variáveis de ambiente `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` estiverem
configuradas, a route de chamados SHALL enviar uma mensagem via Bot API do Telegram
(`sendMessage`) contendo protocolo, categoria e horário. A notificação é best-effort:
falha no envio MUST NOT impedir a persistência do chamado nem retornar erro ao cliente.

#### Scenario: Telegram configurado e disponível
- **WHEN** um chamado é registrado com `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` definidas
- **THEN** a equipe recebe a mensagem no Telegram com protocolo, categoria e horário

#### Scenario: Telegram fora do ar
- **WHEN** o envio da mensagem falha
- **THEN** o chamado permanece salvo em `chamados_ajuda` e o cliente ainda recebe a
  confirmação
