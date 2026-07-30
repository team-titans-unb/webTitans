# kiosk-help-requests Specification

## Purpose
Definir a consulta de pedidos por protocolo e o registro de chamados de ajuda a partir do
kiosk: o teclado touch de protocolo, as API routes server-side (`/api/kiosk/pedido` e
`/api/kiosk/help`) que usam `service_role` sem expor o UUID completo, a orientação ao cliente
por status do pedido, a persistência em `chamados_ajuda` com anti-duplicação e a notificação
best-effort da equipe via Telegram.
## Requirements
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
A route de chamados SHALL enviar uma notificação à equipe via Bot API do Telegram
(`sendMessage`) — com protocolo, categoria e horário — sempre que as variáveis de
ambiente `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` estiverem configuradas. A notificação
é best-effort: falha no envio MUST NOT impedir a persistência do chamado nem retornar
erro ao cliente.

#### Scenario: Telegram configurado e disponível
- **WHEN** um chamado é registrado com `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` definidas
- **THEN** a equipe recebe a mensagem no Telegram com protocolo, categoria e horário

#### Scenario: Telegram fora do ar
- **WHEN** o envio da mensagem falha
- **THEN** o chamado permanece salvo em `chamados_ajuda` e o cliente ainda recebe a
  confirmação

### Requirement: Resgate de código de reimpressão no totem

O overlay de ajuda SHALL oferecer o caminho "Tenho um código de reimpressão", com um campo
de entrada **separado** do teclado de protocolo, onde o cliente digita o código `R-XXXXXXXX`
recebido da equipe. O envio SHALL usar um endpoint **dedicado** `POST /api/kiosk/reimpressao`
com corpo `{ protocolo, codigo }`, distinto de `/api/kiosk/pedido` (consulta) e
`/api/kiosk/help` (chamados). Essa separação é deliberada: o resgate NÃO SHALL compartilhar
route com a consulta, para que o caminho de "Ajuda" nunca funcione como oráculo de força
bruta de códigos.

A route SHALL, server-side (service_role): validar o formato de `protocolo` (8 hex) e de
`codigo` (`R-` + 8 hex); localizar o token pelo hash do código; verificar que o token
não está usado, não está expirado e pertence ao pedido do protocolo informado; aplicar a
guarda de estado; resgatar o token de forma atômica (`UPDATE ... WHERE usado_em IS NULL
RETURNING`) e só então invocar o núcleo de reimpressão com origem `totem`. Respostas de
erro SHALL ser genéricas o suficiente para não distinguir "código inexistente" de "código
de outro pedido". A route SHALL aplicar rate-limit por tentativas para conter força bruta.

#### Scenario: Código válido resgatado no totem
- **WHEN** o cliente digita o protocolo e um código válido, não usado e não expirado que
  pertence a esse pedido, e o pedido está elegível
- **THEN** o token é marcado como usado atomicamente, o pedido volta para a fila e o totem
  confirma que a reimpressão foi solicitada, com a posição na fila

#### Scenario: Código inválido ou de outro pedido
- **WHEN** o código não existe, está expirado, já foi usado, ou pertence a outro pedido
- **THEN** o totem exibe uma mensagem de erro genérica, sem revelar qual das condições
  falhou, e nada é alterado

#### Scenario: Endpoint de resgate é isolado da consulta
- **WHEN** um cliente tenta usar `/api/kiosk/pedido` ou `/api/kiosk/help` para resgatar um
  código
- **THEN** esses endpoints não aceitam nem validam códigos de reimpressão — o resgate só
  ocorre em `/api/kiosk/reimpressao`

#### Scenario: Força bruta é contida por rate-limit
- **WHEN** chegam muitas tentativas de resgate em curto intervalo
- **THEN** o endpoint passa a recusar novas tentativas com mensagem amigável, limitando a
  varredura de códigos

