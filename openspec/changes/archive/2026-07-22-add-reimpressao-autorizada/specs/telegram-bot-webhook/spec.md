# Delta — telegram-bot-webhook (add-reimpressao-autorizada)

## ADDED Requirements

### Requirement: Webhook de entrada autenticado por secret_token

O sistema SHALL expor `POST /api/telegram/webhook` (runtime `nodejs`, dinâmico) para
receber updates do Telegram. Toda requisição SHALL ser autenticada comparando o header
`X-Telegram-Bot-Api-Secret-Token` com `TELEGRAM_WEBHOOK_SECRET` (definido no `setWebhook`).
Requisições sem o header correto SHALL ser rejeitadas com `401`/`403` sem processar o
corpo. O segredo e o `TELEGRAM_BOT_TOKEN` MUST permanecer apenas no servidor, nunca no
cliente. O webhook SHALL sempre responder `200` rapidamente para updates que reconhece
(mesmo quando recusa a ação por autorização), evitando reentregas do Telegram.

#### Scenario: Update sem secret_token correto é rejeitado
- **WHEN** chega um `POST` sem o header `X-Telegram-Bot-Api-Secret-Token` ou com valor
  diferente de `TELEGRAM_WEBHOOK_SECRET`
- **THEN** a route responde negando o acesso e não processa comandos nem consulta o banco

#### Scenario: Update autêntico é aceito
- **WHEN** chega um `POST` com o secret_token correto e um update válido
- **THEN** a route processa o update e responde `200`

### Requirement: Autorização por allowlist de user IDs

O webhook SHALL autorizar comandos comparando `message.from.id` do update contra a
allowlist `TELEGRAM_ADMIN_IDS` (lista de Telegram user IDs no ambiente). Pertencer ao grupo
NÃO SHALL ser aceito como autorização. Um `from.id` fora da allowlist SHALL ter o comando
recusado com uma resposta neutra, sem executar reimpressão nem gerar código.

#### Scenario: Administrador na allowlist executa comando
- **WHEN** um update de comando chega com `from.id` presente em `TELEGRAM_ADMIN_IDS`
- **THEN** o comando é executado

#### Scenario: Usuário fora da allowlist é recusado
- **WHEN** um update de comando chega com `from.id` ausente de `TELEGRAM_ADMIN_IDS`
- **THEN** o comando não é executado e a resposta não revela detalhes de pedidos

### Requirement: Comando `/reimprimir <protocolo>`

O webhook SHALL tratar `/reimprimir <protocolo>` chamando o núcleo de reimpressão com
origem `bot` e o `telegram_user_id` do solicitante. Em sucesso, SHALL responder no chat com
confirmação e a posição na fila do pedido; em recusa (status não elegível, PDF expirado,
protocolo inexistente), SHALL responder com a mensagem de erro correspondente. Entradas
malformadas (protocolo ausente ou não-hex de 8 caracteres) SHALL receber orientação de
uso, sem tocar no banco.

#### Scenario: Reimpressão direta bem-sucedida
- **WHEN** um administrador envia `/reimprimir A1B2C3D4` para um pedido elegível
- **THEN** o pedido é re-enfileirado e o bot responde com a posição na fila

#### Scenario: Protocolo malformado
- **WHEN** um administrador envia `/reimprimir 123` (menos de 8 hex)
- **THEN** o bot responde com a forma correta de uso e nada é alterado

### Requirement: Comando `/gerar_codigo <protocolo>`

O webhook SHALL tratar `/gerar_codigo <protocolo>` verificando primeiro a elegibilidade do
pedido (mesma guarda de estado do núcleo: `status ∈ {ERRO, IMPRESSO}` e `pdf_path` presente)
e, se elegível, gerando um código de uso único conforme a capability `pedido-reimpressao`
(entropia real, hash no banco, formato `R-XXXXXXXX`, expiração padrão de 24h). O código em
texto puro SHALL ser exibido **uma única vez** na resposta, com instrução para o cliente
digitá-lo no totem. Se o pedido não for elegível, nenhum código SHALL ser gerado.

#### Scenario: Código gerado para pedido elegível
- **WHEN** um administrador envia `/gerar_codigo A1B2C3D4` para um pedido elegível
- **THEN** o bot responde com um código `R-XXXXXXXX` exibido uma vez, e o banco guarda
  apenas o hash com expiração de 24h

#### Scenario: Pedido não elegível não gera código
- **WHEN** um administrador pede código para um pedido em `PAGO` ou com PDF expirado
- **THEN** o bot informa que o pedido não está elegível e nenhum token é criado
