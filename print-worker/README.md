# Print Worker — HP Laser MFP 135w

Serviço Python que roda na máquina da sede ligada à impressora. Ele consome pedidos
**PAGO** da tabela `fila_impressao` do Supabase, baixa o PDF do bucket privado,
reconfere a contagem de páginas, imprime via CUPS e marca o pedido como **IMPRESSO**
(ou **ERRO** em caso de falha).

Fluxo de status: `PAGO` → `IMPRIMINDO` (claim atômico) → `IMPRESSO` / `ERRO`.

Além da fila, o worker publica um **heartbeat** do estado da impressora na tabela
`impressora_status` (migrations `0008_kiosk.sql` e `0009_printer_health.sql`),
consumido pelo totem `/kiosk`: uma thread daemon grava, a cada `POLL_INTERVAL`, o
estado da fila primária — `OK`, `IMPRIMINDO`, `PAUSADA`, `INALCANCAVEL` ou, via
leitura IPP (`ipptool`) dos atributos físicos da impressora, `SEM_PAPEL`,
`SEM_TONER` ou `MANUTENCAO` — usando a mesma `service_role`. Detalhes completos
(estados, contrato de `detalhes`, retenção de pedidos e aviso via Telegram) na
seção "Heartbeat e saúde da impressora" abaixo. A escrita é best-effort — se a
tabela não existir ou o upsert falhar, o worker apenas loga e **continua
imprimindo normalmente**.

> **NUNCA** commite o `.env` com valores reais. Ele contém a `service_role` key, que
> dá acesso total ao projeto Supabase. Mantenha-o com permissão `0600`.

## Pré-requisitos

Antes de tudo, a migration `supabase/migrations/0004_print_worker.sql` precisa ter sido
rodada no Supabase (adiciona o status `IMPRIMINDO`). Para o heartbeat do kiosk, rode
também `supabase/migrations/0008_kiosk.sql` (cria `impressora_status`) e
`supabase/migrations/0009_printer_health.sql` (estende o CHECK de `estado` com
`SEM_PAPEL`/`SEM_TONER`/`MANUTENCAO`). **Aplique a 0009 antes de atualizar o worker**
para esta versão: sem ela, o upsert do heartbeat falha ao tentar gravar um estado que
o CHECK ainda não aceita. Sem nenhuma das duas, o worker funciona igual, só logando a
falha do heartbeat.

Na máquina (Linux):

1. **CUPS (sem HPLIP).** A HP Laser MFP 131/133/135/138 imprime por CUPS
   **driverless** (IPP Everywhere) — **não** use `hp-setup`/HPLIP. A fila USB
   driverless deste modelo travava e cuspia páginas com lixo; por isso a
   impressora é usada por **Wi-Fi**.
   ```bash
   sudo apt install cups
   sudo systemctl enable --now cups
   ```

2. **Crie a fila de rede primária (Wi-Fi / IPP Everywhere).** Ligue a impressora
   no Wi-Fi e crie a fila apontando para o nome **mDNS `.local`** dela — não use
   o IP, que é DHCP na rede da faculdade (`10.74.x.x`) e muda:
   ```bash
   # Descubra o nome .local da impressora na rede:
   avahi-browse -rt _ipp._tcp
   # Crie a fila driverless (ajuste NOME.local):
   sudo lpadmin -p Titans_Laser -E -v ipp://NOME.local/ipp/print -m everywhere
   ```

3. **(Opcional) Fila USB de fallback.** Mantenha a fila USB driverless como rede
   de segurança (`HP_Laser_MFP_131_133_135_138`). O worker só cai para ela
   quando a fila Wi-Fi falha **antes** de o CUPS aceitar o job (failover seguro).

4. **Confirme as filas e imprima um teste manual:**
   ```bash
   lpstat -p              # lista as filas; anote os nomes exatos
   lp -d Titans_Laser /usr/share/cups/data/testprint
   ```
   Se sair papel **limpo**, o CUPS está ok.

5. **(Opcional, recomendado) `cups-ipp-utils` para saúde da impressora.** Fornece
   o `ipptool`, usado pelo heartbeat para ler `printer-state-reasons` e
   `marker-levels` (papel, toner, atolamento, tampa) direto da fila IPP — sem IP
   configurado, sempre a partir do nome da fila. Sem o pacote o worker degrada
   sozinho: heartbeat só com os estados antigos (`OK`/`PAUSADA`/`INALCANCAVEL`) e
   a impressão continua normalmente.
   ```bash
   sudo apt install cups-ipp-utils
   which ipptool   # confirma a instalação
   ```

6. **Python 3.10+** disponível.

## Instalação do worker

```bash
# Coloque o worker em um caminho estável (ex.: /opt/print-worker).
sudo cp -r print-worker /opt/print-worker
cd /opt/print-worker

# Ambiente virtual + dependências.
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Configuração (NUNCA commitar este arquivo).
cp .env.example .env
chmod 600 .env
# edite .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PRINTER_NAME (fila Wi-Fi
# Titans_Laser) e, opcionalmente, PRINTER_NAME_FALLBACK (fila USB de fallback)
```

Teste rodando em primeiro plano antes de instalar como serviço:
```bash
set -a; source .env; set +a
.venv/bin/python worker.py
```

## Serviço systemd

```bash
# Edite o unit: ajuste User=, WorkingDirectory=, EnvironmentFile=, ExecStart=.
sudo cp print-worker.service /etc/systemd/system/print-worker.service
sudo nano /etc/systemd/system/print-worker.service

sudo systemctl daemon-reload
sudo systemctl enable --now print-worker

# Acompanhar logs:
journalctl -u print-worker -f
```

O serviço tem `Restart=always`: sobe no boot e se recupera de crashes. Pedidos presos
em `IMPRIMINDO` por mais de `STUCK_TIMEOUT` (padrão 15 min) voltam sozinhos para `PAGO`.

## Configuração (.env)

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `SUPABASE_URL` | sim | — | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | — | service_role key (segredo; bypassa RLS) |
| `PRINTER_NAME` | sim | — | Fila CUPS primária (Wi-Fi `Titans_Laser`; `lpstat -p`) |
| `PRINTER_NAME_FALLBACK` | não | — | Fila CUPS de fallback (USB); failover só na pré-submissão |
| `POLL_INTERVAL` | não | `10` | Segundos entre consultas à fila |
| `PRINT_TIMEOUT` | não | `180` | Segundos de espera pela conclusão do job |
| `STUCK_TIMEOUT` | não | `900` | Segundos até re-filar um pedido travado em IMPRIMINDO |
| `REACHABILITY_TIMEOUT` | não | `3` | Timeout (s) da checagem de alcançabilidade do destino de filas de rede antes de submeter |
| `LP_OPTIONS` | não | `fit-to-page` | Opções `-o` do `lp` (tokens separados por espaço). Padrão escala à área imprimível e auto-rotaciona paisagem, evitando PDFs deitados cortados. Vazio = sem opções |
| `TELEGRAM_BOT_TOKEN` | não | — | Token do Bot do Telegram; ativa o aviso de saúde da impressora (mesma env usada por `/api/kiosk/help` no site). Ausente = a transição só é logada, nada quebra |
| `TELEGRAM_CHAT_ID` | não | — | Chat/grupo do Telegram que recebe o aviso. Ausente = idem acima |

## Higiene do spool CUPS (purga de jobs órfãos)

O worker executa `cancel -a <fila>` em **todas as filas candidatas** (`PRINTER_NAME` e, se
configurada, `PRINTER_NAME_FALLBACK`) em dois momentos: **no boot do processo** (antes de o
heartbeat e o loop principal começarem) e **imediatamente antes de cada submissão de pedido**
(início de `processar`, antes até do download do PDF).

Motivo: o CUPS persiste jobs em disco entre reinicializações. Se a máquina desliga ou a rede cai
no meio de uma transmissão, ao religar o CUPS **retoma sozinho** o envio do job órfão — sem o
worker participar. A impressora recebe o fluxo PCLm/URF sem o cabeçalho, o auto-sense de
linguagem falha, e o firmware despeja os bytes como texto: páginas inteiras de lixo binário
(caracteres CP437 tipo ☺ ☻ ♦ ♥ ●), desperdiçando papel e toner de pedidos já pagos. O caso já
ocorreu mesmo sem desligamento do sistema, por isso a purga roda também a cada pedido, não só
no boot.

Como o Supabase (`fila_impressao`) é a única fonte da verdade sobre o que deve ser impresso e o
worker é o único submissor legítimo, qualquer job presente no spool CUPS fora do fluxo ativo é
órfão e pode ser cancelado com segurança. Se o pedido correspondente ainda estava em
`IMPRIMINDO`, ele volta a `PAGO` sozinho pelo mecanismo existente de recuperação de travados
(`STUCK_TIMEOUT`, ver "Serviço systemd" acima) — a purga não cria estados novos.

A purga é **best-effort**: falha (timeout, `cancel` ausente/erro) só gera um warning no log e
nunca bloqueia a impressão — pior caso é o comportamento anterior a esta mudança. A purga também
**nunca** roda entre a aceitação de um job pelo CUPS e sua conclusão — o fluxo de `processar` é
sequencial, então o job ativo do próprio worker nunca é cancelado por engano.

> ⚠️ **Aviso operacional**: as filas CUPS configuradas em `PRINTER_NAME`/`PRINTER_NAME_FALLBACK`
> passam a ser de **uso exclusivo do worker**. Qualquer job enfileirado manualmente nelas (ex.:
> `lp -d Titans_Laser arquivo.pdf`) será cancelado no boot seguinte ou antes do próximo pedido
> processado. Para imprimir manualmente na mesma impressora física, crie **outra fila CUPS**
> apontando para o mesmo destino (`lpadmin -p <outra-fila> -E -v ipp://NOME.local/ipp/print -m
> everywhere`) e nunca use `Titans_Laser`/a fila de fallback para isso.

## Failover entre filas (anti-duplicação)

Quando `PRINTER_NAME_FALLBACK` está configurada, o worker tenta a fila primária
(Wi-Fi) e, **só se ela falhar antes de o CUPS aceitar o job**, submete o mesmo
arquivo à fila de fallback. Nesses casos é seguro afirmar que **nada foi
impresso**. Contam como falha de pré-submissão: fila insalubre no health-check,
**destino de rede inalcançável**, **impressora não pronta (`printer-state` via IPP, abaixo)**,
`lp` com erro, ou job id não extraível.

**Checagem de alcançabilidade do destino (antes de submeter).** Para filas de
rede (device-uri `ipp://`/`ipps://`/`http://`/`socket://`), o worker não confia
apenas no estado `enabled` do `lpstat -p` — ele **permanece `enabled` mesmo com a
impressora Wi-Fi desligada**, o que fazia o job ficar preso e cair em `ERRO` sem
failover. Antes de submeter, o worker resolve o host do device-uri (mDNS `.local`
via `getent`/`avahi-resolve-host-name`) e faz um TCP-connect curto à porta IPP
(timeout `REACHABILITY_TIMEOUT`, padrão 3 s). Se o host não resolve ou a porta
recusa conexão, a fila é tratada como **inalcançável (pré-submissão, nada
impresso)** e o worker faz failover para a USB **sem nunca submeter à Wi-Fi**.
Filas USB/locais (`usb://`, `hp:/usb/...`) **não** sofrem essa checagem de rede;
e se o device-uri não for interpretável, o worker degrada para o health-check
(`lpstat -p`) — nunca bloqueia a impressão por falha de parsing. Isso depende de
resolução **mDNS** (`avahi-daemon` ativo) para o nome `.local`.

**Gate de prontidão do firmware (`printer-state` via IPP).** Porta TCP aberta não prova que a
impressora está pronta para receber um job: a HP 135w abre a porta IPP **segundos antes** de o
firmware terminar de inicializar, e um job enviado nessa janela também pode sair como lixo
binário (mesma causa-raiz da purga de spool acima). Por isso, além do TCP-connect, o worker
consulta o atributo IPP `printer-state` **direto no equipamento** (nunca na fila CUPS local, que
responde pelo daemon do CUPS e não prova nada sobre o firmware) via `ipptool`. Submete quando o
estado é **idle (3)** ou **processing (4)** — enfileirar atrás de um job ativo (ex.: impressão
manual por outra fila apontando para a mesma impressora física) é comportamento normal do IPP e
não corrompe o job. Já **stopped (5)**, ou uma consulta que falha/vem sem estado com o
equipamento já alcançável por TCP (a janela de boot do firmware), conta como **não pronto** —
falha de pré-submissão (nada enviado), elegível a failover/retenção como as demais.

Degradação segura: sem `ipptool` instalado, ou quando o único alvo consultável é a fila CUPS
local (fila USB/local, ou sem device URI IPP de rede resolvível), a checagem de prontidão não é
possível e o worker volta a valer só o TCP-connect já existente — nunca bloqueia a fila
indefinidamente por falta de infraestrutura de consulta.

Depois que o CUPS aceita o job, o worker **nunca** faz failover: um timeout de
conclusão cancela o job e marca `ERRO`. Como o worker materializa N cópias no
próprio PDF, reimprimir um job já aceito poderia duplicar **dezenas** de folhas —
por isso, na dúvida, o pedido vira `ERRO` para intervenção manual. Sem
`PRINTER_NAME_FALLBACK`, o worker opera só com a primária, como antes.

### Diagnóstico: religando a impressora

Ao ligar a impressora depois de desligada (ou após queda de Wi-Fi), o fluxo esperado nos logs é:

1. Purga do spool ao subir/no ciclo seguinte (silenciosa se não houver jobs órfãos).
2. Alguns ciclos com a fila alcançável mas **não pronta**, enquanto o firmware inicializa (gate
   de prontidão acima segurando a submissão).
3. Assim que o firmware reporta `idle`, a submissão segue limpa, sem lixo binário.

Mensagens para procurar (`journalctl -u print-worker`):

| Mensagem (trecho) | Significado |
| --- | --- |
| `Purga do spool da fila ... falhou` | A purga teve problema (timeout, `cancel` ausente/erro). É só warning — **não bloqueia** a impressão. |
| `fila ... alcançável mas impressora não pronta (printer-state stopped/ilegível...)` | Gate de prontidão segurando a submissão — normal durante o boot da impressora; deve parar sozinho em poucos ciclos. |
| `fila ... de rede inalcançável (pré-submissão, nada impresso)` | TCP-connect falhou — caso distinto do acima (aqui nem a porta responde). |

Se a mensagem de "não pronta" persistir por muitos ciclos com a impressora visivelmente ligada e
na rede, suspeite de firmware travado ou problema de conectividade — não é mais o boot normal.

## Heartbeat e saúde da impressora

A cada `POLL_INTERVAL`, além do estado básico da fila (`OK`/`IMPRIMINDO`/`PAUSADA`/
`INALCANCAVEL`, vistos acima), o worker roda o `ipptool` contra a própria fila para
ler os atributos IPP `printer-state-reasons` e `marker-levels` — nenhum IP
configurado: o alvo é derivado do nome da fila (`lpstat -v`, com resolução mDNS via
`getent`/`avahi`), com fallback para a fila CUPS local
(`ipp://localhost:631/printers/<fila>`). Isso detecta falhas físicas que o
health-check de fila sozinho não via (papel, toner, atolamento, tampa aberta).

**Estados publicados em `impressora_status.estado`:**

| Estado | Origem | Descrição |
| --- | --- | --- |
| `OK` | health-check | Fila saudável e alcançável, sem problema físico. |
| `IMPRIMINDO` | health-check | Job em andamento (sobrepõe `OK`). |
| `PAUSADA` | health-check | Fila `disabled` no CUPS. |
| `INALCANCAVEL` | health-check | Destino de rede não resolve/recusa conexão. |
| `SEM_PAPEL` | IPP | Razão `media-empty`/`media-needed`. |
| `SEM_TONER` | IPP | Razão `toner-empty`, ou `marker-levels` ≤ limiar `low` do equipamento (ou 0%). |
| `MANUTENCAO` | IPP | Razão `media-jam`/`cover-open`/`door-open`. |

Quando várias condições coexistem, a prioridade fixa é **`SEM_TONER` > `SEM_PAPEL` >
`MANUTENCAO` > `PAUSADA` > `IMPRIMINDO` > `OK`**; `INALCANCAVEL` domina tudo (sem IPP
confiável, sem dados). Razões IPP desconhecidas não bloqueiam a fila — ficam só em
`detalhes.state_reasons` para diagnóstico (fail-safe: na dúvida, não bloqueia).

**Contrato de `detalhes` (jsonb):**

```json
{ "toner_pct": 42, "state_reasons": ["media-empty"], "toner_baixo": false }
```

- `toner_pct` — percentual de toner relatado por `marker-levels` (`null` se o
  equipamento não reportar).
- `state_reasons` — razões IPP normalizadas (sufixos `-report`/`-warning`/`-error`
  removidos), incluindo as que não mudam o estado.
- `toner_baixo` — `true` quando `toner_pct` ≤ 10%, **mesmo com `estado = OK`**; é só
  aviso (a fila continua aceitando/imprimindo), usado pelo kiosk para o selo "Toner
  acabando".

Sem `ipptool` instalado (ou em timeout/falha na consulta), a coleta degrada sozinha:
o worker publica só os estados antigos (`OK`/`PAUSADA`/`INALCANCAVEL`) com
`detalhes` vazio, e **continua imprimindo normalmente** — best-effort, igual ao
resto do heartbeat.

### Retenção de pedidos em estado bloqueante

Antes de reivindicar o próximo pedido `PAGO`, o worker consulta o estado de saúde
corrente. Em estado bloqueante — `SEM_PAPEL`, `SEM_TONER`, `MANUTENCAO`, ou
`INALCANCAVEL` **sem** uma fila de fallback saudável e alcançável — o worker **não
reivindica**: dorme o ciclo e reavalia no seguinte. O pedido `PAGO` fica intacto na
fila (**nunca** vira `ERRO`) e, assim que a razão física some, o worker retoma
sozinho, sem intervenção humana além de repor o insumo. Com uma fila de fallback
saudável disponível, `INALCANCAVEL` não retém — o failover pré-submissão (seção
acima) resolve melhor, imprimindo direto na fallback.

### Aviso via Telegram

Opcionalmente, o worker avisa a equipe via Bot API do Telegram (mesmo mecanismo da
rota `/api/kiosk/help` do site) quando:

- o estado muda **para** `SEM_PAPEL`, `SEM_TONER` ou `MANUTENCAO` — nunca a cada
  heartbeat, só na transição para o problema;
- `toner_baixo` passa de `false` para `true`.

Configure `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` (ver "Configuração (.env)" acima)
para habilitar. Sem essas envs, o worker apenas loga a transição e segue
normalmente — nada quebra.

## Operação: pedidos em ERRO

O worker marca `status = 'ERRO'` (sem retry automático) quando:

- o **download** do PDF falha após retentativas;
- o **PDF é inválido/criptografado**;
- a **contagem real de páginas diverge** de `num_paginas` (proteção contra fraude);
- **nenhuma fila aceita o job** (primária e fallback falham na pré-submissão);
- a **impressão não conclui** dentro de `PRINT_TIMEOUT` após a aceitação
  (impressora offline, sem papel, atolada) — **sem** failover, para não duplicar.

> Desde a coleta de saúde via IPP ("Heartbeat e saúde da impressora" acima), sem
> papel/sem toner/atolamento **antes** da reivindicação já são tratados por
> retenção — o pedido nem chega a ser reivindicado, então não vira `ERRO`. O
> último bullet acima cobre só o caso residual: a falha física surge **depois**
> que o job já foi aceito pelo CUPS (ex.: o papel acaba no meio da impressão).

> Se os logs mostram que o job foi **aceito** numa fila mas deu timeout, a folha
> pode ter saído mesmo assim (falso negativo). Confirme fisicamente: se a
> impressão saiu correta, marque o pedido como `IMPRESSO` manualmente em vez de
> re-filar para `PAGO` (re-filar reimprimiria todas as cópias).

Tratamento manual de um pedido em `ERRO`:

1. Veja o motivo nos logs: `journalctl -u print-worker | grep <id-do-pedido>`.
2. Resolva a causa (papel/toner/atolamento, ou contato com o cliente se o PDF for inválido).
3. Para reimprimir um pedido cuja causa foi resolvida, volte-o para `PAGO` no Supabase
   (Table Editor ou SQL): `update fila_impressao set status='PAGO' where id='<id>';` —
   o worker o pegará no próximo ciclo.
4. Pedidos com PDF realmente inválido ou divergência de páginas devem permanecer em
   `ERRO` e ser tratados com o cliente (reembolso/contato).

> Pedidos em `IMPRIMINDO` não voltam sozinhos antes do `STUCK_TIMEOUT`; se precisar
> reprocessar imediatamente, mude o status para `PAGO` manualmente.

## Limitações conhecidas

- A 135w é **monocromática**. Pedidos `COLORIDO` (legados) são impressos em tons de
  cinza, com aviso no log. A remoção da opção COLORIDO do checkout é uma mudança separada.
- O worker confirma que o CUPS **concluiu** o job, não a qualidade física da impressão.
