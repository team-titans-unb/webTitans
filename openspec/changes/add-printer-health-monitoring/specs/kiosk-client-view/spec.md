# kiosk-client-view — Delta Spec

## ADDED Requirements

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
