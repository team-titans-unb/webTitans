# 09 — Diagramas (UML)

[← Índice](README.md)

Visões UML da feature web-to-print, em **Mermaid** — renderizam direto no GitHub (e no VS Code
com a extensão *Markdown Preview Mermaid Support*). Os diagramas refletem o estado **atual**:
frontend e Route Handlers em **Next.js (App Router)** na Vercel, Supabase como ponto de
encontro, e o `print-worker` na sede.

> Quatro vistas: **implantação** (onde roda), **atividades** (o fluxo de um pedido), **caso de
> uso** (quem faz o quê) e a **máquina de estados** do pedido (complementa o doc
> [02](02-fluxo-pedido.md)).

---

## Diagrama de implantação

Mostra os **nós de execução** (navegador, Vercel, Supabase, sede) e os artefatos que rodam em
cada um, com os canais de comunicação e qual credencial é usada em cada aresta. É o eixo de
segurança da arquitetura: o PDF nunca passa pela Vercel, e só ambientes confiáveis têm a
`service_role`.

```mermaid
flowchart TB
  MP["Mercado Pago"]

  subgraph CLIENTE["Navegador — não confiável"]
    UI["App Next.js / App Router<br/>rota /impressao<br/>anon key + pdfjs-dist"]
  end

  subgraph VERCEL["Vercel — Next.js"]
    RH1["Route Handler<br/>POST /api/payments/create-pix"]
    RH2["Route Handler<br/>POST /api/webhooks/mercadopago"]
  end

  subgraph SUPA["Supabase"]
    ST["Storage<br/>bucket privado pdfs-impressao"]
    DB[("Postgres<br/>fila_impressao + config_precos<br/>RLS + Realtime")]
  end

  subgraph SEDE["Sede — Linux + systemd"]
    PW["print-worker.py"]
    CW["CUPS — fila Wi-Fi primaria<br/>Titans_Laser - IPP Everywhere"]
    CU["CUPS — fila USB fallback<br/>failover so na pre-submissao"]
    HP["HP Laser MFP 135w"]
  end

  UI -->|"upload PDF direto (anon key)"| ST
  UI -->|"INSERT pedido / SELECT status (anon, RLS)"| DB
  UI -->|"POST { pedidoId }"| RH1
  RH1 -->|"service_role: baixa PDF, conta paginas, le preco"| ST
  RH1 -->|"service_role: grava mp_payment_id, num_paginas, valor_centavos"| DB
  RH1 -->|"cria cobranca PIX (idempotencyKey = pedidoId)"| MP
  RH1 -.->|"QR code + expiration_date_to"| UI
  MP -->|"webhook assinado (x-signature HMAC-SHA256)"| RH2
  RH2 -->|"service_role: status PAGO ou CANCELADO"| DB
  DB -->|"Realtime UPDATE + polling 5 s"| UI
  PW -->|"recupera travados + claim PAGO → IMPRIMINDO (service_role)"| DB
  PW -->|"baixa PDF (service_role, 3 tentativas)"| ST
  PW -->|"primaria: verifica alcancabilidade TCP + envia job"| CW
  PW -.->|"fallback: apenas se primaria falhar pre-submissao"| CU
  CW --> HP
  CU -.-> HP
```

> **Legenda:** setas contínuas = fluxo principal; setas tracejadas = retorno de dados ou
> caminho de fallback. O PDF nunca passa pela Vercel. O failover Wi-Fi→USB só ocorre se a
> fila primária falhar **antes** de o CUPS aceitar o job (pré-submissão); após a aceitação,
> não há failover para evitar duplicação. O MP dispara notificações por dois canais
> (`notification_url` no `create-pix` + webhook do painel) — ambos chegam em RH2.

---

## Diagrama de atividades

O ciclo de vida de um pedido, do upload à impressão, com os pontos de decisão e os desvios de
exceção (PDF inválido, assinatura inválida, expiração do PIX, falha de impressão). As
atividades atravessam quatro responsáveis: **cliente/navegador**, **Route Handlers**,
**Mercado Pago** e **worker da sede**.

```mermaid
flowchart TD
  A([Cliente abre /impressao]) --> B[Selecionar PDF]
  B --> C{"PDF valido?<br/>tipo application/pdf<br/>ate 30 MB"}
  C -->|nao| B
  C -->|sim| D["Contar paginas no navegador<br/>(pdfjs-dist)"]
  D --> E["Escolher modo de cor<br/>ver estimativa de preco (config_precos)"]
  E --> F["Upload PDF direto ao Storage (anon key)<br/>INSERT fila_impressao = AGUARDANDO_PAGAMENTO"]
  F --> G["POST /api/payments/create-pix<br/>{ pedidoId }"]

  subgraph SRV["Route Handler create-pix"]
    G --> SRV1{"Pedido existe e<br/>status = AGUARDANDO?"}
    SRV1 -->|nao encontrado| Z0(["404 — pedido nao existe"])
    SRV1 -->|status incorreto| Z0B(["409 — pedido ja processado"])
    SRV1 -->|sim| SRV2["Baixa PDF do Storage (service_role)<br/>Conta paginas com pdf-lib"]
    SRV2 --> SRV3{"PDF integro<br/>no servidor?"}
    SRV3 -->|invalido / criptografado| Z1(["422 — arquivo invalido"])
    SRV3 -->|Storage indisponivel| Z1B(["502 — storage fora"])
    SRV3 -->|sim| SRV4["Calcula valor_centavos<br/>paginas x config_precos(modo_cor) x copias<br/>Cria cobranca PIX no MP<br/>(idempotencyKey = pedidoId)"]
    SRV4 --> SRV5["Grava mp_payment_id,<br/>num_paginas, valor_centavos no DB"]
    SRV5 --> I["Devolve QR Code + expiration_date_to"]
  end

  I --> J["Exibir QR Code PIX<br/>UI monitora via Realtime + polling 5 s"]
  J --> JE{"Expirou<br/>expiration_date_to?"}
  JE -->|sim, sem pagamento| Z4(["UI: pagamento nao confirmado<br/>(linha no banco permanece)"])
  JE -->|nao| J2[Cliente paga no app do banco]

  subgraph WH["Route Handler webhook/mercadopago"]
    J2 --> K1{"Assinatura<br/>HMAC-SHA256<br/>valida?"}
    K1 -->|sem x-signature / hash errado| Z2(["401 — rejeitado"])
    K1 -->|ts fora de 5 min| Z2
    K1 -->|valida| K2["Busca pagamento atualizado<br/>na API do MP"]
    K2 --> K3{"Status do<br/>pagamento no MP?"}
    K3 -->|approved| L["UPDATE status = PAGO<br/>paid_at = now()<br/>(WHERE status = AGUARDANDO — idempotente)"]
    K3 -->|cancelled ou rejected| L2["UPDATE status = CANCELADO<br/>(WHERE status = AGUARDANDO — idempotente)"]
    K3 -->|pending / in_process / outro| Z3(["200 no-op — aguarda proximo webhook"])
    K3 -->|MP indisponivel| Z3B(["502 — MP fora, MP retentera"])
    L2 --> ZC(["CANCELADO — estado terminal"])
  end

  L --> M["Worker: recuperar_travados<br/>em cada ciclo (STUCK_TIMEOUT = 900 s)"]
  M --> M2["Worker: proximo_pago FIFO<br/>claim atomico PAGO → IMPRIMINDO"]
  M2 --> N1["Baixa PDF do Storage<br/>(service_role, 3 tentativas)"]
  N1 --> N2["Conta paginas (pypdf)<br/>verifica divergencia vs num_paginas"]
  N2 --> NP{"Paginas<br/>conferem?"}
  NP -->|divergencia ou PDF invalido| Z5(["ERRO — tratamento manual"])
  NP -->|sim| N3["Replica PDF x quantidade_copias<br/>(replicar_pdf — 135w ignora lp -n)"]
  N3 --> FA{"Fila primaria<br/>alcancavel?<br/>health-check + TCP-connect IPP"}
  FA -->|insalubre ou rede inalcancavel| FB{"Ha fila<br/>fallback USB?"}
  FB -->|nao| Z5
  FB -->|sim| FC["Submete job a fila USB<br/>(fallback pre-submissao)"]
  FA -->|sim| FD["Submete job a fila Wi-Fi primaria"]
  FD --> O{"Job aceito<br/>pelo CUPS?<br/>job id extraivel"}
  FC --> O
  O -->|FalhaPreSubmissao: lp falhou ou sem job id| FB
  O -->|job aceito| O2{"CUPS concluiu<br/>no PRINT_TIMEOUT?"}
  O2 -->|timeout| ZT["Cancela job<br/>marca ERRO"]
  ZT --> Z5
  O2 -->|sim| P(["IMPRESSO + printed_at"])
```

> **Legenda:** o diagrama segue as quatro responsabilidades: navegador (branco), Route
> Handler `create-pix` (subgrafo SRV), Route Handler `webhook` (subgrafo WH) e worker da
> sede. A expiração da UI usa `expiration_date_to` retornado pelo servidor (não um timer
> fixo de 30 min). O failover Wi-Fi→USB só ocorre na fase de pré-submissão; após o CUPS
> aceitar o job, não há failover (risco de duplicação).

---

## Diagrama de caso de uso

Os atores e o que cada um pode fazer no sistema. Note que **pagar via PIX** dispara, por
*include*, os casos internos do servidor (gerar cobrança, confirmar pagamento, imprimir) — o
cliente nunca os executa diretamente.

```mermaid
flowchart LR
  Cliente(["Cliente<br/>(navegador)"])
  Operador(["Operador da sede"])
  MP(["Mercado Pago<br/>(sistema externo)"])
  Worker(["Print Worker<br/>(sistema autonomo)"])

  subgraph Sistema["Sistema Web-to-Print"]
    UC1(["Enviar PDF"])
    UC2(["Configurar impressao e ver preco"])
    UC3(["Pagar via PIX"])
    UC4(["Acompanhar status do pedido<br/>(Realtime + polling)"])
    UC5(["Gerar cobranca PIX<br/>(create-pix)"])
    UC6(["Confirmar pagamento<br/>(webhook mercadopago)"])
    UC7(["Imprimir documento<br/>(CUPS + failover)"])
    UC8(["Recuperar pedidos travados<br/>(STUCK_TIMEOUT)"])
    UC9(["Retirar impressao"])
    UC10(["Tratar pedido com ERRO"])
  end

  Cliente --- UC1
  Cliente --- UC2
  Cliente --- UC3
  Cliente --- UC4
  Cliente --- UC9
  Operador --- UC9
  Operador --- UC10
  MP --- UC6
  Worker --- UC7
  Worker --- UC8
  UC3 -.->|"inclui"| UC5
  UC6 -.->|"dispara (via status PAGO no DB)"| UC7
```

> **Legenda:** setas sólidas = associação direta ator-caso-de-uso. Setas tracejadas marcam
> relações de disparo/include. O Worker é um ator de sistema autônomo (não humano); o MP é
> um ator externo que aciona o webhook. `UC7` e `UC8` são exclusivos do Worker.
> `UC10` (tratar ERRO) é responsabilidade do Operador — ver
> [07 — Operação](07-operacao.md).

---

## Máquina de estados do pedido (complemento)

A coluna `fila_impressao.status` é o único ponto de coordenação entre os subsistemas. Versão
renderizável do diagrama em ASCII do doc [02](02-fluxo-pedido.md).

```mermaid
stateDiagram-v2
  [*] --> AGUARDANDO_PAGAMENTO: checkout — anon INSERT

  AGUARDANDO_PAGAMENTO --> PAGO: webhook approved (service_role, idempotente)
  AGUARDANDO_PAGAMENTO --> CANCELADO: webhook cancelled/rejected (service_role, idempotente)

  PAGO --> IMPRIMINDO: worker — claim atomico (UPDATE WHERE status=PAGO)

  IMPRIMINDO --> IMPRESSO: CUPS concluiu + printed_at
  IMPRIMINDO --> ERRO: falha de download/PDF invalido/divergencia/timeout CUPS
  IMPRIMINDO --> PAGO: recuperacao de travados (preso mais de STUCK_TIMEOUT)

  note right of AGUARDANDO_PAGAMENTO
    Webhooks pending/in_process
    sao no-op (sem transicao).
    UI expira apos expiration_date_to
    (so na interface, nao no banco).
  end note

  note right of ERRO
    Estado terminal.
    Exige intervencao manual
    pelo Operador (doc 07).
    cleanup-fila pode arquivar
    linhas antigas via pg_cron.
  end note

  CANCELADO --> [*]
  IMPRESSO --> [*]
  ERRO --> [*]
```

> **Legenda:** a coluna `fila_impressao.status` é o único ponto de coordenação entre
> navegador, Vercel e worker. Todas as transições após `AGUARDANDO_PAGAMENTO` usam
> `service_role` (bypassa RLS). A transição `IMPRIMINDO → PAGO` é a recuperação de
> travados: o worker detecta pedidos presos além de `STUCK_TIMEOUT` e os re-fila para nova
> tentativa.

---

Anterior: [08 — Segurança](08-seguranca.md) · [↑ Índice](README.md)
