# web-to-print-docs Specification

## Purpose
Garantir que o repositório mantenha uma documentação humana e navegável da feature web-to-print, sob `docs/web-to-print/`, cobrindo arquitetura, fluxo do pedido, cada subsistema, operação e segurança — complementando (sem duplicar) as specs canônicas das quatro capabilities de implementação.

## Requirements
### Requirement: Índice e visão geral da feature

O repositório SHALL conter `docs/web-to-print/README.md` que serve de ponto de entrada da
documentação, apresentando uma visão geral de uma página da feature (objetivo, os quatro
subsistemas e o diagrama de componentes) e linkando para todos os demais documentos.

#### Scenario: Leitor abre a documentação pela primeira vez
- **WHEN** um membro da equipe abre `docs/web-to-print/README.md`
- **THEN** entende em uma página o que a feature faz e quais são os quatro subsistemas, e
  encontra links para os documentos detalhados

### Requirement: Documento de arquitetura

A documentação SHALL conter um documento de arquitetura descrevendo os quatro componentes
(checkout, pagamento, Supabase, worker), as três fronteiras de execução (navegador,
Vercel, sede) e quais segredos vivem em cada fronteira, com um diagrama de componentes.

#### Scenario: Entender por que o PDF não passa pela Vercel
- **WHEN** o leitor consulta o documento de arquitetura
- **THEN** encontra a explicação de que o upload vai direto do navegador ao Storage e o
  motivo (limites do plano gratuito da Vercel)

### Requirement: Documento de fluxo do pedido e máquina de estados

A documentação SHALL conter um documento dedicado ao ciclo de vida de um pedido e à
máquina de estados de `fila_impressao.status`, cobrindo todas as transições
(`AGUARDANDO_PAGAMENTO`, `PAGO`, `IMPRIMINDO`, `IMPRESSO`, `ERRO`, `CANCELADO`) e quem
escreve cada uma, com um diagrama de estados.

#### Scenario: Rastrear o caminho de um pedido pago
- **WHEN** o leitor quer saber o que acontece após o pagamento ser aprovado
- **THEN** o documento mostra a transição `PAGO → IMPRIMINDO → IMPRESSO` e qual subsistema
  realiza cada passo

### Requirement: Documento por subsistema com anatomia consistente

A documentação SHALL conter um documento para cada um dos quatro subsistemas (checkout,
pagamento PIX, armazenamento Supabase, print worker), e cada um SHALL cobrir:
responsabilidade, arquivos no repositório, fluxo, decisões/pontos de atenção e link para a
spec canônica correspondente em `openspec/specs/`.

#### Scenario: Manutenção em um subsistema específico
- **WHEN** alguém precisa alterar o print worker
- **THEN** o documento do worker indica os arquivos em `print-worker/`, o fluxo de
  polling/claim/impressão e linka para a spec `print-worker`

#### Scenario: Documentação não duplica os requisitos das specs
- **WHEN** um documento de subsistema descreve um comportamento já normatizado por uma spec
- **THEN** ele resume e linka para a spec canônica em vez de recopiar os requisitos

### Requirement: Runbook operacional

A documentação SHALL conter um documento de operação cobrindo, no mínimo: instalar e
atualizar o print worker na máquina da sede, diagnosticar e tratar pedidos em `ERRO`,
recolocar um pedido na fila, e onde encontrar logs.

#### Scenario: Pedido ficou em ERRO
- **WHEN** um operador encontra um pedido com `status = 'ERRO'`
- **THEN** o runbook explica onde ver os logs do worker e como recolocar o pedido na fila
  ou marcá-lo como impresso conforme o caso

#### Scenario: Atualizar o worker após uma correção
- **WHEN** uma correção do worker é publicada no repositório
- **THEN** o runbook descreve como atualizar o código na sede e reiniciar o serviço

### Requirement: Documento de segurança

A documentação SHALL conter um documento de segurança descrevendo a distribuição de
segredos por ambiente (anon key no cliente; `service_role` e segredos do Mercado Pago na
Vercel e na sede), a validação de assinatura do webhook e as garantias de RLS.

#### Scenario: Onde vive a service_role
- **WHEN** o leitor pergunta onde a `service_role` key é usada
- **THEN** o documento indica que ela vive apenas na Vercel (Serverless Functions) e na
  máquina da sede (`.env` 0600), nunca no bundle do cliente
