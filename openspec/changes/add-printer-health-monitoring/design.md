# Design: add-printer-health-monitoring

## Context

`add-kiosk-client-view` (ainda não archivada) já entregou o heartbeat: o `print-worker`
publica em `impressora_status` uma linha singleton `{fila, estado, detalhes jsonb,
atualizado_em}`, com `estado` derivado de dois health-checks locais — `fila_saudavel`
(`lpstat -p`, vê `enabled`/`disabled`) e `fila_alcancavel` (resolve o host do device URI e faz
TCP-connect). O kiosk (`/kiosk`, Next.js) lê essa linha por Realtime e mostra a
`FaixaImpressora`; a equipe é notificada via Telegram Bot API, mas hoje **só** pela API route
`/api/kiosk/help` (chamado manual do cliente), com envs `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`.

O que falta: o worker não enxerga falhas físicas (papel, toner, atolamento, tampa). Já
validamos com a HP Laser 135w real (fila CUPS `Titans_Laser`) que o IPP `get-printer-attributes`
devolve `printer-state-reasons` (media-empty, media-jam, cover-open, toner-empty…) e
`marker-levels` (percentual real do toner, marcador único preto, limiar low = 5). O CUPS local
também responde esses atributos pela fila (`ipp://localhost:631/printers/Titans_Laser`), e
`lpstat -v <fila>` já revela o device URI do equipamento. SNMP também funciona, mas o IPP
cobre tudo — evitamos a dependência nova.

Constraint central: o worker roda na mesma Pi da impressora, já conhece o nome da fila
(`PRINTER_NAME`) e nunca deve receber um IP de impressora configurado à mão. Toda a coleta de
saúde tem de ser derivada do nome da fila.

## Goals / Non-Goals

**Goals:**

- Detectar sem papel, sem toner, atolamento e tampa aberta a partir do IPP da própria fila.
- Expor nível de toner e razões de estado no `detalhes` do heartbeat existente.
- Não deixar pedidos caírem em `ERRO` por falha física: enquanto a impressora está bloqueada,
  o worker segura os pedidos `PAGO` e retoma sozinho quando a razão some.
- Avisar a equipe (Telegram) na transição para um estado de problema e na queda para toner
  baixo — sem spam por heartbeat.
- Mensagens claras e específicas no totem por estado, mais um aviso discreto de toner baixo.

**Non-Goals:**

- Bloquear novos pagamentos no site quando a impressora está parada (fluxo futuro).
- Métricas de vida útil de peças / consumo histórico via SNMP.
- Dashboard administrativo de saúde da impressora.
- Trocar o mecanismo de heartbeat, o failover entre filas ou o contrato exactly-once.

## Decisions

### D1 — Coleta de saúde por IPP `get-printer-attributes` via `ipptool`, não SNMP

O worker consulta os atributos IPP com `ipptool` (subprocess), consistente com o uso atual de
`lpstat`/`lp`/`cancel` — nenhuma lib Python nova, nenhuma porta SNMP. Pré-requisito de sistema:
pacote `cups-ipp-utils` (fornece `ipptool`), documentado no README como os demais utilitários
CUPS. Um arquivo de teste IPP mínimo (`get-printer-attributes.test`, gerado em tempo de
execução em `tempfile` ou embutido) pede `printer-state-reasons` e `marker-*`. Alternativa:
`pysnmp`. Rejeitada — dependência nova + necessidade de descobrir OIDs por modelo; o IPP já
entrega tudo de forma padronizada e independente de fabricante.

### D2 — Device URI derivado da fila, com fallback para o CUPS local; zero IP hardcoded

A coleta tenta, em ordem:

1. o **device URI do equipamento**, obtido de `device_uri_da_fila(fila)` (função já existente,
   `lpstat -v`), quando o esquema é de rede (`ipp`/`ipps`/`http`/`https`);
2. **fallback**: a própria fila CUPS local, `ipp://localhost:631/printers/<fila>`.

Assim nenhum IP de impressora é configurado — tudo deriva de `PRINTER_NAME`. Consultar direto o
equipamento evita a camada de cache do CUPS; o fallback local cobre filas cujo device URI não é
IPP (usb://, hp:/usb/…) ou não é legível. Alternativa: só o CUPS local. Rejeitada como padrão —
o CUPS pode reportar atributos defasados; preferimos a fonte direta quando ela é de rede, com o
local como rede de segurança.

### D3 — Mapeamento de `state-reasons` + toner para `estado`, com prioridade fixa

O worker normaliza cada razão (removendo sufixos IPP `-report`/`-warning`/`-error`) e mapeia:

- `media-empty` / `media-needed` → `SEM_PAPEL`
- `toner-empty` (ou `marker-level ≤ limiar low`) → `SEM_TONER`
- `media-jam` / `cover-open` / `door-open` → `MANUTENCAO`

Quando várias razões coexistem, aplica a prioridade única:
`SEM_TONER > SEM_PAPEL > MANUTENCAO > PAUSADA > IMPRIMINDO > OK`. Toner e papel vêm primeiro
porque exigem reposição física de insumo (a equipe precisa levar algo); manutenção
(atolamento/tampa) costuma ser resolvível na hora. `PAUSADA`/`INALCANCAVEL` continuam vindo dos
health-checks existentes: se a fila está `disabled` ou o destino não responde, nem faz sentido
ler razões IPP — esses estados têm precedência operacional sobre as razões (uma impressora
inalcançável não tem razões confiáveis). Concretamente: `INALCANCAVEL` domina tudo (sem IPP,
sem dados); entre os demais, a lista acima decide.

**Toner baixo é aviso, não estado.** `marker-level ≤ 10%` (acima do limiar `SEM_TONER`) não
muda `estado` — apenas marca `detalhes.toner_baixo = true`. A impressora ainda imprime; forçar
`SEM_TONER` a 10% pararia a fila sem necessidade.

### D4 — `detalhes` jsonb como contrato de saúde; migração 0009 só estende o CHECK

O heartbeat passa a gravar `detalhes = { toner_pct: int, state_reasons: string[],
toner_baixo: bool }`. A tabela `impressora_status` não muda de forma — só o CHECK de `estado`
ganha os três valores novos, numa migração `0009_printer_health.sql` que faz
`drop constraint` + `add constraint` com a lista estendida. Sem novas tabelas, colunas ou
policies: a RLS existente (anon SELECT, escrita só service_role) já cobre os campos novos,
pois `detalhes` já era jsonb livre. Reversível: a migração de rollback restaura o CHECK antigo
(exige que nenhuma linha esteja nos estados novos no momento do rollback).

### D5 — Estado bloqueante segura o pedido em PAGO, sem marcá-lo ERRO

Antes de `proximo_pago`/`reivindicar`, o loop consulta o estado de saúde corrente. Se for
bloqueante (`SEM_PAPEL`/`SEM_TONER`/`MANUTENCAO`/`INALCANCAVEL`), o worker **não reivindica**:
dorme o ciclo e reavalia. O pedido `PAGO` permanece intacto na fila (nada de `ERRO`), e assim
que a razão física some o worker volta a reivindicar normalmente — recuperação automática, sem
toque humano além de repor o insumo. Isso reaproveita a garantia exactly-once: como o pedido
nunca é reivindicado, não há job submetido nem risco de duplicação. Alternativa: reivindicar e
deixar o job enfileirado no CUPS até repor o papel. Rejeitada — o job preso estoura o
`STUCK_TIMEOUT`/`PRINT_TIMEOUT` e cai em `ERRO`, degradando a experiência; segurar em `PAGO` é
mais limpo e observável no kiosk.

A leitura de saúde para essa decisão reusa a mesma coleta do heartbeat (uma consulta IPP por
ciclo, cacheável dentro do ciclo) — custo marginal desprezível no poll de 10 s.

**Refinamento (descoberto na implementação):** `INALCANCAVEL` só retém quando NÃO existe fila
de fallback utilizável (saudável e alcançável). Com fallback viável, reter quebraria o
failover pré-submissão já garantido pela spec do worker — o pedido imprime na fallback em vez
de esperar a primária voltar. Os estados físicos (`SEM_PAPEL`/`SEM_TONER`/`MANUTENCAO`) retêm
sempre: a fila primária ainda ACEITA jobs nesses casos (o CUPS enfileira), então o failover
nunca dispararia e o job preso estouraria o timeout rumo a `ERRO`.

### D6 — Notificação Telegram só na transição de estado, direto do worker

O worker mantém em memória o último `estado` publicado e o último `toner_baixo`. A notificação
dispara **apenas** quando:

- `estado` muda para um estado de problema (ex.: `OK → SEM_PAPEL`, `SEM_PAPEL → MANUTENCAO`);
- `toner_baixo` passa de `false → true`.

Nunca a cada heartbeat (evita spam). A volta ao normal (`SEM_PAPEL → OK`) pode opcionalmente
enviar um "resolvido", mas o mínimo é notificar a entrada no problema. Reusa exatamente o
padrão de `/api/kiosk/help` (`POST https://api.telegram.org/bot<token>/sendMessage`,
`AbortSignal`/timeout curto), com as mesmas envs `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` na
config do worker. Best-effort: try/except em volta, falha só loga e **nunca** interrompe o
ciclo (mesma regra do upsert do heartbeat). Alternativa: notificar pela API route do site
(o worker chamaria `/api/kiosk/help`). Rejeitada — acoplaria o worker a uma rota HTTP do site,
misturaria "chamado do cliente" com "alerta de máquina" na mesma tabela, e o worker já fala
direto com o Supabase; falar direto com o Telegram é simétrico e sem dependência do site no ar.

Onde disparar: dentro do `Heartbeat._publicar`, comparando o estado recém-derivado com o
anterior, **após** o upsert bem-sucedido — a fonte da verdade é o que foi publicado. O envio é
delegado a um helper `notificar_transicao(estado_antigo, estado_novo, toner_baixo_antigo,
toner_baixo_novo)` para manter `_publicar` legível (função pequena, responsabilidade única).

### D7 — Kiosk: mensagens por estado na faixa, lendo `detalhes`

`faixaImpressora` (em `src/components/kiosk/status.ts`) ganha ramos para `SEM_PAPEL`,
`SEM_TONER` e `MANUTENCAO`, com texto amigável ("Sem papel — a equipe já foi avisada",
"Toner esgotado — a equipe já foi avisada", "Impressora em manutenção — a equipe já foi
avisada") e cor semântica (âmbar/vermelho conforme gravidade). O aviso de toner baixo é
discreto e **ortogonal** ao estado: quando `detalhes.toner_baixo`, a faixa (ou um sub-rótulo)
mostra "Toner acabando" mesmo com estado `OK`/`IMPRIMINDO`. `useImpressoraStatus` passa a
selecionar e expor `detalhes` além de `estado`. `EstadoImpressora` (o union type) ganha os três
valores. Nenhuma rota, endpoint ou dependência nova — o Realtime de `impressora_status` já
entrega `detalhes`. `offline` (heartbeat velho) continua tendo prioridade máxima na UI.

## Risks / Trade-offs

- [`ipptool` ausente na Pi] → sem `cups-ipp-utils` a coleta falha; tratada como best-effort
  (try/except): o worker degrada para o comportamento atual (só `OK/PAUSADA/INALCANCAVEL`),
  loga e segue imprimindo. README lista o pacote como pré-requisito.
- [Nomes de `state-reasons` variam por firmware] → normalizamos sufixos
  (`-warning`/`-error`/`-report`) e mapeamos por conjunto conhecido; razões desconhecidas vão
  para `detalhes.state_reasons` (visíveis para diagnóstico) sem mudar o estado (fail-safe: na
  dúvida, não bloqueia a fila).
- [Falso "sem papel" transitório durante a troca de bandeja] → o worker só segura pedidos
  enquanto a razão persiste; assim que some, retoma no ciclo seguinte. Sem retentativa
  destrutiva.
- [Spam de Telegram por oscilação de estado] → notifica só na transição *para* o problema;
  memória do último estado evita repetição. Oscilação rápida (flapping) é limitada pela
  granularidade do poll (10 s) e, se incomodar, um debounce pode entrar depois (fora do escopo).
- [Consulta IPP direto no equipamento adiciona latência ao ciclo] → timeout curto no `ipptool`
  (alinhado a `REACHABILITY_TIMEOUT`); em falha, cai no fallback local ou degrada. O heartbeat
  já roda em thread própria, então não atrasa a impressão.
- [Toner reportado impreciso em cartuchos remanufaturados] → tratamos `marker-level` como
  dica; o limiar `SEM_TONER` respeita a razão IPP `toner-empty` quando presente (mais confiável
  que o percentual).
- [Migração 0009 e rollback com estados novos gravados] → o rollback do CHECK exige que nenhuma
  linha esteja em `SEM_PAPEL`/`SEM_TONER`/`MANUTENCAO`; documentar que se deve normalizar a
  linha (ou apagá-la, o worker recria) antes de reverter.

## Migration Plan

1. Instalar `cups-ipp-utils` na Pi (pré-requisito de `ipptool`).
2. Rodar `supabase/migrations/0009_printer_health.sql` (estende o CHECK de
   `impressora_status.estado`). Retrocompatível: o worker atual continua gravando só os estados
   antigos até ser atualizado.
3. Deploy do worker atualizado (coleta IPP + estados + transições Telegram). Se `ipptool` não
   estiver instalado, degrada para o comportamento atual sem quebrar.
4. Deploy do site com as mensagens novas da faixa (aditivo; estados desconhecidos já caíam no
   ramo default "Impressora pronta", então não há regressão durante a janela de deploy).
5. Configurar `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` na config do worker (as mesmas do site).
6. Verificação no laboratório com a impressora real (tirar papel da bandeja e observar
   kiosk + Telegram).

Rollback: reverter o deploy do worker (volta a gravar só estados antigos); a migração pode
ficar (o CHECK estendido é inerte para o worker antigo) ou ser revertida após normalizar linhas
nos estados novos.

## Open Questions

- Notificar também a **resolução** (`SEM_PAPEL → OK`) no Telegram, ou só a entrada no problema?
  (Padrão proposto: notificar a entrada; a resolução é opcional e barata de adicionar.)
- Limiar de toner baixo: `≤ 10%` para o aviso e o `low` do IPP (≈5%) para `SEM_TONER` — validar
  os números com o cartucho real durante a verificação de laboratório.
- Debounce/flapping de estado: necessário já, ou o poll de 10 s basta? (Decidir só se a
  verificação real mostrar oscilação incômoda.)
