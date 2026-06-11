# Print Worker — HP Laser MFP 135w

Serviço Python que roda na máquina da sede ligada à impressora. Ele consome pedidos
**PAGO** da tabela `fila_impressao` do Supabase, baixa o PDF do bucket privado,
reconfere a contagem de páginas, imprime via CUPS e marca o pedido como **IMPRESSO**
(ou **ERRO** em caso de falha).

Fluxo de status: `PAGO` → `IMPRIMINDO` (claim atômico) → `IMPRESSO` / `ERRO`.

> **NUNCA** commite o `.env` com valores reais. Ele contém a `service_role` key, que
> dá acesso total ao projeto Supabase. Mantenha-o com permissão `0600`.

## Pré-requisitos

Antes de tudo, a migration `supabase/migrations/0004_print_worker.sql` precisa ter sido
rodada no Supabase (adiciona o status `IMPRIMINDO`).

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

5. **Python 3.10+** disponível.

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

## Failover entre filas (anti-duplicação)

Quando `PRINTER_NAME_FALLBACK` está configurada, o worker tenta a fila primária
(Wi-Fi) e, **só se ela falhar antes de o CUPS aceitar o job**, submete o mesmo
arquivo à fila de fallback. Nesses casos é seguro afirmar que **nada foi
impresso**. Contam como falha de pré-submissão: fila insalubre no health-check,
**destino de rede inalcançável**, `lp` com erro, ou job id não extraível.

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

Depois que o CUPS aceita o job, o worker **nunca** faz failover: um timeout de
conclusão cancela o job e marca `ERRO`. Como o worker materializa N cópias no
próprio PDF, reimprimir um job já aceito poderia duplicar **dezenas** de folhas —
por isso, na dúvida, o pedido vira `ERRO` para intervenção manual. Sem
`PRINTER_NAME_FALLBACK`, o worker opera só com a primária, como antes.

## Operação: pedidos em ERRO

O worker marca `status = 'ERRO'` (sem retry automático) quando:

- o **download** do PDF falha após retentativas;
- o **PDF é inválido/criptografado**;
- a **contagem real de páginas diverge** de `num_paginas` (proteção contra fraude);
- **nenhuma fila aceita o job** (primária e fallback falham na pré-submissão);
- a **impressão não conclui** dentro de `PRINT_TIMEOUT` após a aceitação
  (impressora offline, sem papel, atolada) — **sem** failover, para não duplicar.

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
