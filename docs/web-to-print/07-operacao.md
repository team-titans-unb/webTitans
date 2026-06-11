# 07 — Operação (runbook)

[← Índice](README.md)

Guia prático para quem opera a impressão na sede. O passo a passo completo de instalação
está em `print-worker/README.md`; aqui fica o essencial e o dia a dia.

## Instalar o worker na sede

**Pré-requisito:** a migration `supabase/migrations/0004_print_worker.sql` precisa ter sido
rodada no Supabase (adiciona o status `IMPRIMINDO`). Sem ela, o claim atômico viola o
CHECK constraint.

1. **CUPS + filas (sem HPLIP):** a HP Laser MFP 131/133/135/138 imprime driverless (IPP
   Everywhere). **Não** use `hp-setup`/HPLIP — a fila USB driverless travava e cuspia lixo,
   então use a impressora por **Wi-Fi**.
   ```bash
   sudo apt install cups
   sudo systemctl enable --now cups
   avahi-browse -rt _ipp._tcp        # descubra o nome .local da impressora
   # Fila primária Wi-Fi (use o nome .local, não o IP — DHCP muda):
   sudo lpadmin -p Titans_Laser -E -v ipp://NOME.local/ipp/print -m everywhere
   # (Opcional) fila USB de fallback driverless: HP_Laser_MFP_131_133_135_138
   lpstat -p                         # confira os nomes das filas
   lp -d Titans_Laser /usr/share/cups/data/testprint   # teste físico (saída limpa)
   ```
2. **Worker em caminho estável + venv:**
   ```bash
   sudo cp -r print-worker /opt/print-worker
   cd /opt/print-worker
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   cp .env.example .env && chmod 600 .env
   # edite .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PRINTER_NAME (Titans_Laser)
   # e, opcionalmente, PRINTER_NAME_FALLBACK (fila USB)
   ```
3. **systemd:**
   ```bash
   sudo cp print-worker.service /etc/systemd/system/print-worker.service
   sudo nano /etc/systemd/system/print-worker.service   # ajuste User=, paths
   sudo systemctl daemon-reload
   sudo systemctl enable --now print-worker
   journalctl -u print-worker -f
   ```

## Atualizar o worker após uma correção

O worker quase sempre muda só código (`worker.py`); só é preciso recriar a `.venv` quando
o `requirements.txt` muda.

**Se `/opt/print-worker` foi instalado por cópia (`cp`):** leve o `worker.py` novo até a
máquina e
```bash
sudo cp /caminho/worker.py /opt/print-worker/worker.py
sudo chown <usuario-de-servico>:<usuario-de-servico> /opt/print-worker/worker.py
sudo systemctl restart print-worker
```

**Se `/opt/print-worker` for um clone git:**
```bash
sudo -u <usuario-de-servico> git -C /opt/print-worker pull
sudo systemctl restart print-worker
```
(`-C` roda o git dentro da pasta; `sudo -u` mantém os arquivos com o dono certo.)

## Pedidos em `ERRO`

O worker marca `ERRO` (sem retry automático) quando: o download falha após retentativas; o
PDF é inválido/criptografado; **a contagem real diverge** de `num_paginas`; **nenhuma fila
aceita o job** (primária e fallback falham na pré-submissão); ou a impressão não conclui
dentro de `PRINT_TIMEOUT` após a aceitação (impressora offline, sem papel, atolada) — nesse
caso **sem** failover, para não duplicar as cópias.

**Diagnóstico:**
```bash
journalctl -u print-worker | grep <id-do-pedido>
```
A linha de log indica a causa (download, PDF inválido, divergência, fila escolhida/failover,
timeout) e, em caso de aceitação, a fila e o job id.

**Tratamento:**

- **Causa resolvível** (papel/toner/atolamento, impressora estava offline): volte o pedido
  para a fila —
  ```sql
  update fila_impressao set status='PAGO' where id='<id>';
  ```
  o worker o pega no próximo ciclo.
- **PDF inválido ou divergência de páginas:** mantenha em `ERRO` e trate com o cliente
  (reembolso/contato). Não force a impressão.
- **Já imprimiu mas ficou `ERRO`** (timeout pós-aceitação, ou parsing pós-impressão): o log
  mostra o job **aceito** numa fila mas sem conclusão confirmada (failover é evitado de
  propósito para não duplicar). Confirme fisicamente a folha; se saiu correta, marque como
  impresso para não reimprimir —
  ```sql
  update fila_impressao set status='IMPRESSO', printed_at=now() where id='<id>';
  ```

**Impressora Wi-Fi inalcançável (failover automático):** se o Wi-Fi da impressora cai, o
worker detecta o destino inalcançável **antes de submeter** (resolução mDNS do nome `.local` +
TCP-connect à porta IPP, timeout `REACHABILITY_TIMEOUT`, padrão 3 s) e faz failover para a fila
USB de fallback **sem nada ter sido impresso na Wi-Fi** — o log mostra `fila <Wi-Fi> de rede
inalcançável (pré-submissão, nada impresso) -> failover para fallback`. Sem fila de fallback,
o pedido vira `ERRO` "nada impresso" (re-filar para `PAGO` é seguro). Isso depende do
`avahi-daemon` ativo para resolver o `.local`.

> **Runbook de teste do failover:** desligue o Wi-Fi da impressora e submeta um pedido.
> Confirme nos logs que a primária foi considerada **inalcançável (pré-submissão)** e que a
> impressão saiu pela **USB sem duplicar** páginas. Religue o Wi-Fi e confirme que a impressão
> volta a sair pela fila Wi-Fi.

> Pedidos presos em `IMPRIMINDO` voltam sozinhos para `PAGO` só após `STUCK_TIMEOUT`
> (padrão 15 min). Para reprocessar antes, mude o status para `PAGO` manualmente.

## Monitoramento no dia a dia

- **Logs ao vivo:** `journalctl -u print-worker -f`.
- **Saúde do serviço:** `systemctl status print-worker`.
- **Fila da impressora:** `lpstat -o <PRINTER_NAME>`.
- **Fila de pedidos:** no Supabase, observar linhas em `PAGO` que não avançam (worker
  parado?) e acúmulo de `ERRO`.
- **Worker fantasma:** garanta que o worker rode em **uma** máquina só. Uma instância
  esquecida (ex.: num notebook) compete pelos pedidos e pode gerar `ERRO`/estados
  inesperados. O claim atômico evita impressão dupla, mas dois workers ainda confundem o
  diagnóstico.

---

Anterior: [06 — Print worker](06-print-worker.md) · Próximo: [08 — Segurança](08-seguranca.md)
