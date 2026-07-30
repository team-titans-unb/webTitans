# Delta: web-to-print-checkout

## ADDED Requirements

### Requirement: Status da impressora visível antes do pagamento
A página `/impressao` SHALL exibir o estado atual da impressora — a mesma informação publicada pelo worker na tabela `impressora_status` e exibida no kiosk — em uma faixa de status posicionada antes do fluxo de upload/pagamento. O estado SHALL ser atualizado em tempo real via Supabase Realtime com fallback de polling, e SHALL ser considerado "sistema de impressão offline" quando o heartbeat (`atualizado_em`) estiver mais velho que o timeout definido (30 s). O status é informativo e MUST NOT bloquear o fluxo de checkout.

#### Scenario: Impressora pronta
- **WHEN** o usuário acessa `/impressao` e a linha de `impressora_status` tem `estado = OK` com heartbeat recente
- **THEN** a faixa exibe "Impressora pronta" com cor semântica verde, e o fluxo de upload segue disponível

#### Scenario: Impressora com problema antes do pagamento
- **WHEN** o estado é `SEM_PAPEL`, `SEM_TONER`, `MANUTENCAO`, `PAUSADA` ou `INALCANCAVEL` enquanto o usuário está em qualquer passo anterior à confirmação do PIX
- **THEN** a faixa exibe a mensagem amigável correspondente (a mesma usada no kiosk, ex.: "Sem papel — a equipe já foi avisada") com cor semântica âmbar/vermelha, permanecendo visível durante os passos de upload, configuração e pagamento

#### Scenario: Worker/Pi fora do ar
- **WHEN** não há linha em `impressora_status` ou `atualizado_em` está mais velho que 30 segundos
- **THEN** a faixa exibe "Sistema de impressão offline" com cor semântica vermelha

#### Scenario: Mudança de estado em tempo real
- **WHEN** o worker atualiza `impressora_status` enquanto a página está aberta
- **THEN** a faixa reflete o novo estado sem recarregar a página (Realtime; na ausência dele, o polling atualiza em até 15 s)

#### Scenario: Carregamento inicial
- **WHEN** a página ainda não completou o primeiro fetch do status
- **THEN** nenhuma faixa de status é exibida (sem flash de estado incorreto)

#### Scenario: Toner baixo com impressora operante
- **WHEN** `detalhes.toner_baixo` é true e o estado é `OK` ou `IMPRIMINDO`
- **THEN** a faixa exibe, além do estado, o aviso de toner acabando (com percentual quando disponível)

### Requirement: Cabeçalho da página sem sobreposição de textos
No cabeçalho da página `/impressao`, o link "Voltar ao início" e o badge "Serviço de Impressão" SHALL ser renderizados em linhas distintas, sem sobreposição ou colisão visual entre os textos, em qualquer largura de viewport suportada.

#### Scenario: Página carregada em desktop e mobile
- **WHEN** o usuário abre `/impressao` em qualquer largura de tela (mobile a desktop)
- **THEN** "Voltar ao início" aparece em uma linha própria acima do badge "Serviço de Impressão", ambos totalmente legíveis e clicáveis
