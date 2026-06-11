## MODIFIED Requirements

### Requirement: Documento de arquitetura

A documentação SHALL conter um documento de arquitetura descrevendo os quatro componentes
(checkout, pagamento, Supabase, worker), as três fronteiras de execução (navegador,
**servidor Next.js hospedado na Vercel** — com Docker como execução local opcional — e sede) e quais segredos vivem em cada fronteira, com um diagrama de componentes.

#### Scenario: Entender por que o PDF não passa pelo servidor de aplicação
- **WHEN** o leitor consulta o documento de arquitetura
- **THEN** encontra a explicação de que o upload vai direto do navegador ao Storage e o
  motivo (manter o servidor Next leve e fora do caminho de arquivos grandes)

### Requirement: Documento por subsistema com anatomia consistente

A documentação SHALL conter um documento para cada um dos quatro subsistemas (checkout,
pagamento PIX, armazenamento Supabase, print worker), e cada um SHALL cobrir:
responsabilidade, arquivos no repositório, fluxo, decisões/pontos de atenção e link para a
spec canônica correspondente em `openspec/specs/`. O documento de pagamento SHALL refletir que os endpoints são **Next.js Route Handlers** (`app/api/**/route.ts`, `runtime = "nodejs"`) — que na Vercel são deployados como funções serverless — e não mais os handlers estilo `@vercel/node` (`api/*.ts`) do stack antigo.

#### Scenario: Manutenção em um subsistema específico
- **WHEN** alguém precisa alterar o print worker
- **THEN** o documento do worker indica os arquivos em `print-worker/`, o fluxo de
  polling/claim/impressão e linka para a spec `print-worker`

#### Scenario: Documentação não duplica os requisitos das specs
- **WHEN** um documento de subsistema descreve um comportamento já normatizado por uma spec
- **THEN** ele resume e linka para a spec canônica em vez de recopiar os requisitos

### Requirement: Documento de segurança

A documentação SHALL conter um documento de segurança descrevendo a distribuição de
segredos por ambiente (anon key `NEXT_PUBLIC_*` no cliente; `service_role` e segredos do Mercado Pago nas **envs de servidor da Vercel** e na sede), a validação de assinatura do webhook e as garantias de RLS.

#### Scenario: Onde vive a service_role
- **WHEN** o leitor pergunta onde a `service_role` key é usada
- **THEN** o documento indica que ela vive apenas como env de servidor (Project Settings da Vercel), consumida pelos Route Handlers, e na
  máquina da sede (`.env` 0600), nunca no bundle do cliente
