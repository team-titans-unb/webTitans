# Delta — kiosk-help-requests (add-reimpressao-autorizada)

## ADDED Requirements

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
