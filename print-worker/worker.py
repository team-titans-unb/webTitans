"""Print worker para a fila web-to-print.

Roda continuamente numa máquina Linux ligada à HP Laser MFP 135w. A cada ciclo:
  1. devolve para PAGO pedidos presos em IMPRIMINDO (recuperação de travados);
  2. pega o pedido PAGO mais antigo (FIFO);
  3. reivindica-o atomicamente (PAGO -> IMPRIMINDO);
  4. baixa o PDF do bucket privado, reconfere a contagem de páginas;
  5. imprime via CUPS (lp) e acompanha a conclusão do job;
  6. marca IMPRESSO (sucesso) ou ERRO (falha/divergência).

Configuração por variáveis de ambiente — ver .env.example.
"""

from __future__ import annotations

import io
import logging
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from pypdf import PdfReader, PdfWriter
from supabase import Client, create_client

TABLE = "fila_impressao"
BUCKET = "pdfs-impressao"

# Locale neutro nos utilitários do CUPS: a saída do `lp` é localizada
# (ex.: "id de requisição é ..." em pt-BR), e o parsing do job id depende
# do texto em inglês ("request id is ...").
CUPS_ENV = {**os.environ, "LC_ALL": "C"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("print-worker")


class FalhaPreSubmissao(Exception):
    """Falha ocorrida ANTES de o CUPS aceitar o job (nada foi impresso).

    Sinaliza que é seguro tentar a próxima fila (failover): a fila estava
    insalubre, o `lp` retornou erro de submissão, ou retornou sucesso mas sem
    job id rastreável. Distinta de qualquer falha pós-aceitação, em que o
    failover é proibido para não duplicar a impressão.
    """


class Config:
    def __init__(self) -> None:
        self.supabase_url = os.environ.get("SUPABASE_URL", "").strip()
        self.service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        self.printer_name = os.environ.get("PRINTER_NAME", "").strip()
        self.printer_name_fallback = os.environ.get("PRINTER_NAME_FALLBACK", "").strip()
        self.poll_interval = int(os.environ.get("POLL_INTERVAL", "10"))
        self.print_timeout = int(os.environ.get("PRINT_TIMEOUT", "180"))
        self.stuck_timeout = int(os.environ.get("STUCK_TIMEOUT", "900"))
        self.reachability_timeout = int(os.environ.get("REACHABILITY_TIMEOUT", "3"))

        missing = [
            name
            for name, value in (
                ("SUPABASE_URL", self.supabase_url),
                ("SUPABASE_SERVICE_ROLE_KEY", self.service_role_key),
                ("PRINTER_NAME", self.printer_name),
            )
            if not value
        ]
        if missing:
            raise SystemExit(
                "Variáveis de ambiente obrigatórias ausentes: " + ", ".join(missing)
            )


def filas_candidatas(cfg: Config) -> list[str]:
    """Filas a tentar, em ordem de prioridade: primária e, se houver, fallback.

    Retorna `[primária]` ou `[primária, fallback]`. A fallback é ignorada
    quando vazia ou idêntica à primária (failover para a mesma fila é inócuo e
    só confundiria os logs). Sem fallback, o comportamento é o de fila única.
    """
    filas = [cfg.printer_name]
    if cfg.printer_name_fallback and cfg.printer_name_fallback != cfg.printer_name:
        filas.append(cfg.printer_name_fallback)
    return filas


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def mark(sb: Client, pedido_id: str, status: str, extra: dict | None = None) -> None:
    payload = {"status": status}
    if extra:
        payload.update(extra)
    sb.table(TABLE).update(payload).eq("id", pedido_id).execute()


def recuperar_travados(sb: Client, cfg: Config) -> None:
    """Devolve para PAGO pedidos presos em IMPRIMINDO além do STUCK_TIMEOUT."""
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=cfg.stuck_timeout)).isoformat()
    res = (
        sb.table(TABLE)
        .select("id")
        .eq("status", "IMPRIMINDO")
        .lt("paid_at", cutoff)
        .execute()
    )
    for row in res.data or []:
        pedido_id = row["id"]
        sb.table(TABLE).update({"status": "PAGO"}).eq("id", pedido_id).eq(
            "status", "IMPRIMINDO"
        ).execute()
        log.warning("Pedido %s travado em IMPRIMINDO -> re-fila como PAGO", pedido_id)


def proximo_pago(sb: Client):
    res = (
        sb.table(TABLE)
        .select("*")
        .eq("status", "PAGO")
        .order("paid_at", desc=False)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def reivindicar(sb: Client, pedido_id: str) -> bool:
    """Claim atômico PAGO -> IMPRIMINDO. True se este worker venceu."""
    res = (
        sb.table(TABLE)
        .update({"status": "IMPRIMINDO"})
        .eq("id", pedido_id)
        .eq("status", "PAGO")
        .execute()
    )
    return bool(res.data)


def baixar_pdf(sb: Client, pdf_path: str, tentativas: int = 3) -> bytes:
    ultimo_erro: Exception | None = None
    for tentativa in range(1, tentativas + 1):
        try:
            return sb.storage.from_(BUCKET).download(pdf_path)
        except Exception as err:  # noqa: BLE001 - logado e re-tentado
            ultimo_erro = err
            log.warning("Falha ao baixar %s (tentativa %d/%d): %s", pdf_path, tentativa, tentativas, err)
            time.sleep(2)
    raise RuntimeError(f"Download falhou após {tentativas} tentativas") from ultimo_erro


def contar_paginas(pdf_bytes: bytes) -> int:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    if reader.is_encrypted:
        raise ValueError("PDF criptografado")
    return len(reader.pages)


def quantidade_copias_do_pedido(pedido: dict) -> int:
    """Lê quantidade_copias da linha com fallback 1 (linhas legadas/None) e piso 1."""
    valor = pedido.get("quantidade_copias")
    if not isinstance(valor, int) or valor < 1:
        return 1
    return valor


def replicar_pdf(pdf_bytes: bytes, copias: int) -> bytes:
    """Concatena o documento `copias` vezes num único PDF (cópias intercaladas).

    Driver-independente: a HP Laser 135w ignora a opção de cópias do CUPS
    (`lp -n` / `-o copies`), então replicamos as páginas no próprio arquivo e
    imprimimos um único job de 1 cópia. Para `copias <= 1` retorna o original.
    """
    if copias <= 1:
        return pdf_bytes
    writer = PdfWriter()
    for _ in range(copias):
        # Reabrir o reader a cada volta evita reutilizar os mesmos objetos de
        # página (referências compartilhadas) entre as cópias.
        writer.append(PdfReader(io.BytesIO(pdf_bytes)))
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


# Esquemas de device-uri que apontam para um destino de REDE (alcançabilidade
# real é verificável por resolução de host + TCP-connect). Filas USB/locais
# (usb://, hp:/usb/..., file://) não entram aqui: a checagem de rede não se aplica.
REDE_SCHEMES = {"ipp", "ipps", "http", "https", "socket"}
PORTA_PADRAO = {"ipp": 631, "ipps": 631, "http": 631, "https": 631, "socket": 9100}


def device_uri_da_fila(fila: str) -> str | None:
    """Retorna o device-uri da fila via `lpstat -v <fila>`, ou None se indisponível.

    Saída típica (locale C): "device for Titans_Laser: ipp://Host.local:631/ipp/print".
    """
    try:
        proc = subprocess.run(
            ["lpstat", "-v", fila],
            capture_output=True,
            text=True,
            timeout=10,
            env=CUPS_ENV,
        )
    except Exception as err:  # noqa: BLE001 - timeout/erro => degrada p/ health-check
        log.warning("Não consegui obter device-uri da fila %s: %s", fila, err)
        return None
    if proc.returncode != 0:
        return None
    # "device for <fila>: <uri>" — o primeiro ':' encerra o nome da fila.
    match = re.search(r"device for [^:]+:\s*(\S+)", proc.stdout)
    return match.group(1) if match else None


def parse_device_uri(uri: str) -> tuple[str, str, int] | None:
    """Extrai (esquema, host, porta) do device-uri; None se não interpretável.

    Porta padrão por esquema (631 IPP/HTTP, 9100 socket). Esquemas sem host de
    rede (usb://, hp:/usb/...) retornam host vazio e são tratados como não-rede.
    """
    try:
        parsed = urlparse(uri)
    except Exception:  # noqa: BLE001 - uri malformado => não interpretável
        return None
    scheme = (parsed.scheme or "").lower()
    if not scheme:
        return None
    host = parsed.hostname or ""
    try:
        porta = parsed.port or PORTA_PADRAO.get(scheme, 631)
    except ValueError:
        porta = PORTA_PADRAO.get(scheme, 631)
    return scheme, host, porta


def resolver_host(host: str, timeout: int) -> str | None:
    """Resolve `host` (mDNS `.local` incluído) para um IP; None se não resolver.

    Tenta `getent hosts` (cobre mDNS quando o nsswitch tem `mdns`) e, se falhar,
    `avahi-resolve-host-name -4`. Um IP literal passa direto pelo getent.
    """
    try:
        proc = subprocess.run(
            ["getent", "hosts", host],
            capture_output=True,
            text=True,
            timeout=timeout,
            env=CUPS_ENV,
        )
        if proc.returncode == 0 and proc.stdout.split():
            return proc.stdout.split()[0]
    except Exception as err:  # noqa: BLE001 - tenta o próximo resolvedor
        log.debug("getent hosts %s falhou: %s", host, err)
    try:
        proc = subprocess.run(
            ["avahi-resolve-host-name", "-4", host],
            capture_output=True,
            text=True,
            timeout=timeout,
            env=CUPS_ENV,
        )
        partes = proc.stdout.split()
        if proc.returncode == 0 and len(partes) >= 2:
            return partes[1]
    except Exception as err:  # noqa: BLE001 - avahi ausente/timeout => não resolve
        log.debug("avahi-resolve-host-name %s falhou: %s", host, err)
    return None


def fila_alcancavel(cfg: Config, fila: str) -> bool:
    """Para filas de REDE, prova alcançabilidade real do destino antes de submeter.

    Diferente de `fila_saudavel` (que só vê o estado CUPS `enabled`, o qual
    permanece `enabled` mesmo com o host Wi-Fi caído), resolve o host do
    device-uri (mDNS `.local` incluído) e faz um TCP-connect curto à porta do
    destino. Retorna:
      - True  para filas USB/locais, filas de rede alcançáveis e também quando o
        device-uri não é legível/interpretável (degrada com segurança: nunca
        bloqueia a impressão por falha de parsing);
      - False só quando a fila é comprovadamente de rede e o host não resolve ou a
        porta recusa conexão -> classificar como PRÉ-SUBMISSÃO (nada enviado),
        autorizando o failover seguro para a fila de fallback.
    """
    uri = device_uri_da_fila(fila)
    if not uri:
        return True  # sem device-uri legível: degrada para o health-check
    parsed = parse_device_uri(uri)
    if not parsed:
        log.debug("Fila %s: device-uri %r não interpretável -> degrada", fila, uri)
        return True
    scheme, host, porta = parsed
    if scheme not in REDE_SCHEMES or not host:
        return True  # fila USB/local: checagem de rede não se aplica
    ip = resolver_host(host, cfg.reachability_timeout)
    if not ip:
        log.warning(
            "Fila %s: host %s não resolve (mDNS/DNS) -> destino inalcançável", fila, host
        )
        return False
    try:
        with socket.create_connection((ip, porta), timeout=cfg.reachability_timeout):
            log.debug("Fila %s: destino %s:%s alcançável", fila, host, porta)
            return True
    except OSError as err:
        log.warning(
            "Fila %s: %s:%s não aceita conexão (%s) -> destino inalcançável",
            fila,
            host,
            porta,
            err,
        )
        return False


def fila_saudavel(fila: str) -> bool:
    """Best-effort: a fila existe e está habilitada (`enabled`) no CUPS.

    Usa `lpstat -p <fila>`. Uma fila habilitada reporta "is idle"/"now printing";
    uma desabilitada/parada reporta "disabled". Erro/timeout do comando é tratado
    como insalubre. NÃO é a garantia anti-duplicação — só ajuda a escolher uma
    fila viva antes de submeter; a segurança vem da classificação de erro.
    """
    try:
        proc = subprocess.run(
            ["lpstat", "-p", fila],
            capture_output=True,
            text=True,
            timeout=10,
            env=CUPS_ENV,
        )
    except Exception as err:  # noqa: BLE001 - timeout/erro => insalubre
        log.warning("Health-check da fila %s falhou: %s", fila, err)
        return False
    if proc.returncode != 0:
        return False
    return "disabled" not in proc.stdout


def enviar_para_impressora(fila: str, caminho: str) -> str:
    """Envia o arquivo via lp (1 job) na `fila` e retorna o job id do CUPS.

    Levanta `FalhaPreSubmissao` se o `lp` retornar erro ou se o job id não for
    extraível — ambos casos em que o CUPS NÃO aceitou o job (nada impresso),
    logo é seguro tentar a próxima fila.
    """
    proc = subprocess.run(
        ["lp", "-d", fila, caminho],
        capture_output=True,
        text=True,
        env=CUPS_ENV,
    )
    if proc.returncode != 0:
        raise FalhaPreSubmissao(f"lp falhou: {proc.stderr.strip() or proc.stdout.strip()}")
    # Saída típica (locale C): "request id is Printer-42 (1 file(s))"
    match = re.search(r"request id is (\S+)", proc.stdout)
    if not match:
        raise FalhaPreSubmissao(f"Não consegui extrair job id de: {proc.stdout.strip()!r}")
    return match.group(1)


def aguardar_conclusao(cfg: Config, fila: str, job_id: str) -> bool:
    """Espera o job sumir da fila de não-concluídos. True se concluiu no tempo."""
    deadline = time.monotonic() + cfg.print_timeout
    while time.monotonic() < deadline:
        proc = subprocess.run(
            ["lpstat", "-o", fila],
            capture_output=True,
            text=True,
            env=CUPS_ENV,
        )
        ativos = proc.stdout
        if job_id not in ativos:
            return True
        time.sleep(2)
    return False


def cancelar_job(job_id: str) -> None:
    """Cancela o job pelo seu id (único no CUPS, já inclui a fila no nome)."""
    try:
        subprocess.run(["cancel", job_id], capture_output=True, text=True, timeout=10, env=CUPS_ENV)
    except Exception as err:  # noqa: BLE001
        log.warning("Falha ao cancelar job %s: %s", job_id, err)


def processar(sb: Client, cfg: Config, pedido: dict) -> None:
    pedido_id = pedido["id"]
    pdf_path = pedido["pdf_path"]
    num_paginas = pedido["num_paginas"]
    modo_cor = pedido.get("modo_cor")
    quantidade_copias = quantidade_copias_do_pedido(pedido)

    # Download + reconferência de páginas.
    try:
        pdf_bytes = baixar_pdf(sb, pdf_path)
    except Exception as err:  # noqa: BLE001
        log.error("Pedido %s: download falhou: %s", pedido_id, err)
        mark(sb, pedido_id, "ERRO")
        return

    try:
        paginas_reais = contar_paginas(pdf_bytes)
    except Exception as err:  # noqa: BLE001
        log.error("Pedido %s: PDF inválido/ilegível: %s", pedido_id, err)
        mark(sb, pedido_id, "ERRO")
        return

    if paginas_reais != num_paginas:
        log.error(
            "Pedido %s: divergência de páginas (declarado=%s, real=%s) -> ERRO",
            pedido_id,
            num_paginas,
            paginas_reais,
        )
        mark(sb, pedido_id, "ERRO")
        return

    if modo_cor == "COLORIDO":
        log.warning(
            "Pedido %s marcado COLORIDO, mas a 135w é mono: será impresso em tons de cinza.",
            pedido_id,
        )

    # Impressão. A 135w ignora a opção de cópias do CUPS, então as cópias são
    # materializadas no próprio PDF e enviadas como um único job.
    pdf_para_imprimir = replicar_pdf(pdf_bytes, quantidade_copias)

    fd, caminho = tempfile.mkstemp(suffix=".pdf", prefix="print-worker-")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(pdf_para_imprimir)

        # Failover restrito à PRÉ-SUBMISSÃO. Tentamos as filas em ordem; uma
        # falha antes de o CUPS aceitar o job (fila insalubre, destino de rede
        # inalcançável, lp com erro, ou job id não extraível) é segura para
        # tentar a próxima. Uma vez aceito o job, NUNCA tentamos outra fila — o
        # pedido resolve em IMPRESSO ou ERRO naquela fila, evitando reimpressão
        # duplicada das N cópias.
        filas = filas_candidatas(cfg)
        for indice, fila in enumerate(filas):
            tem_proxima = indice + 1 < len(filas)
            if not fila_saudavel(fila):
                log.warning(
                    "Pedido %s: fila %s insalubre (health-check) -> %s",
                    pedido_id,
                    fila,
                    "tentando fallback" if tem_proxima else "sem mais filas",
                )
                continue  # falha de pré-submissão implícita: nada submetido

            # Alcançabilidade real do destino (cobre o host de rede Wi-Fi caído
            # que o health-check `enabled` não enxerga). Inalcançável = nada foi
            # enviado à impressora => pré-submissão segura => pode fazer failover.
            if not fila_alcancavel(cfg, fila):
                log.warning(
                    "Pedido %s: fila %s de rede inalcançável (pré-submissão, nada impresso) -> %s",
                    pedido_id,
                    fila,
                    "failover para fallback" if tem_proxima else "sem mais filas",
                )
                continue

            try:
                job_id = enviar_para_impressora(fila, caminho)
            except FalhaPreSubmissao as err:
                log.warning(
                    "Pedido %s: pré-submissão à fila %s falhou (%s) -> %s",
                    pedido_id,
                    fila,
                    err,
                    "failover para fallback" if tem_proxima else "sem mais filas",
                )
                continue  # seguro: nada impresso -> próxima fila

            # A PARTIR DAQUI o CUPS aceitou o job: sem failover.
            log.info(
                "Pedido %s: aceito pela fila %s (job %s, %s páginas, %s cópias)",
                pedido_id,
                fila,
                job_id,
                paginas_reais,
                quantidade_copias,
            )

            if aguardar_conclusao(cfg, fila, job_id):
                mark(sb, pedido_id, "IMPRESSO", {"printed_at": now_iso()})
                log.info("Pedido %s: IMPRESSO (fila %s)", pedido_id, fila)
            else:
                log.error(
                    "Pedido %s: timeout após aceitação na fila %s (job %s) -> ERRO "
                    "(failover deliberadamente evitado para não duplicar)",
                    pedido_id,
                    fila,
                    job_id,
                )
                cancelar_job(job_id)
                mark(sb, pedido_id, "ERRO")
            return

        # Esgotou todas as filas só com falhas de pré-submissão: nada impresso.
        log.error(
            "Pedido %s: nenhuma fila aceitou o job (%s) -> ERRO (nada impresso)",
            pedido_id,
            ", ".join(filas),
        )
        mark(sb, pedido_id, "ERRO")
    finally:
        try:
            os.unlink(caminho)
        except OSError:
            pass


def main() -> None:
    cfg = Config()
    sb = create_client(cfg.supabase_url, cfg.service_role_key)
    log.info(
        "Print worker iniciado (impressora=%s, fallback=%s, poll=%ss, print_timeout=%ss, stuck_timeout=%ss)",
        cfg.printer_name,
        cfg.printer_name_fallback or "(nenhuma)",
        cfg.poll_interval,
        cfg.print_timeout,
        cfg.stuck_timeout,
    )

    while True:
        try:
            recuperar_travados(sb, cfg)
            pedido = proximo_pago(sb)
            if pedido and reivindicar(sb, pedido["id"]):
                processar(sb, cfg, pedido)
                continue  # busca o próximo imediatamente, sem dormir
        except Exception as err:  # noqa: BLE001 - ciclo nunca encerra por erro transitório
            log.exception("Erro no ciclo: %s", err)
        time.sleep(cfg.poll_interval)


if __name__ == "__main__":
    main()
