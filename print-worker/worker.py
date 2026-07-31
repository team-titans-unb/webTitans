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
import json
import logging
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from urllib.request import Request, urlopen

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
        # Notificação da equipe via Telegram Bot API (opcional): sem as duas
        # envs, as transições de saúde são apenas logadas — nada quebra.
        self.telegram_bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
        self.telegram_chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
        # Opções `-o` passadas ao `lp`. Padrão `fit-to-page`: escala cada página
        # para a área imprimível preservando a proporção e auto-rotaciona páginas
        # em paisagem, evitando que PDFs deitados saiam cortados nas bordas em
        # filas driverless (IPP Everywhere). Tokens separados por espaço viram um
        # `-o <token>` cada (ex.: "fit-to-page media=A4"). Vazio = sem opções.
        self.lp_options = os.environ.get("LP_OPTIONS", "fit-to-page").split()

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


def estado_da_fila(cfg: Config, fila: str) -> str:
    """Deriva o estado do heartbeat a partir dos mesmos sinais dos health-checks.

    - PAUSADA: a fila CUPS existe mas está `disabled` (pausada por um humano);
    - INALCANCAVEL: `lpstat` falhou/fila inexistente, o destino de rede não
      resolve/não aceita conexão (mesmo critério de `fila_alcancavel`), ou o
      firmware não está pronto (stopped/sem estado IPP legível na janela de
      boot) — assim a retenção segura os pedidos em PAGO até o idle, em vez de
      reivindicar e falhar. `processing` NÃO bloqueia: é o job do próprio
      worker, e o heartbeat precisa publicar IMPRIMINDO, não INALCANCAVEL.
      Atenção: `stopped` também é como o firmware apresenta falta de papel/
      toner/atolamento com job bloqueado — `saude_da_impressora` reexamina o
      INALCANCAVEL via IPP direto antes de publicá-lo;
    - OK: fila habilitada, destino alcançável e firmware pronto.
    """
    try:
        proc = subprocess.run(
            ["lpstat", "-p", fila],
            capture_output=True,
            text=True,
            timeout=10,
            env=CUPS_ENV,
        )
    except Exception as err:  # noqa: BLE001 - timeout/erro => indisponível
        log.debug("Heartbeat: lpstat -p %s falhou: %s", fila, err)
        return "INALCANCAVEL"
    if proc.returncode != 0:
        return "INALCANCAVEL"
    if "disabled" in proc.stdout:
        return "PAUSADA"
    if not fila_alcancavel(cfg, fila):
        return "INALCANCAVEL"
    if _printer_state_equipamento(cfg, fila) in (STOPPED, SEM_ESTADO):
        return "INALCANCAVEL"
    return "OK"


# --- Saúde física da impressora via IPP -------------------------------------
#
# A cada heartbeat o worker lê `printer-state-reasons` e `marker-levels` via
# `ipptool` (pacote cups-ipp-utils) e deriva estados de falha física:
# SEM_PAPEL, SEM_TONER e MANUTENCAO. Tudo best-effort: sem `ipptool`, timeout
# ou atributos ilegíveis, degrada para os health-checks existentes.

# Esquemas consultáveis diretamente por IPP. `dnssd://`/`usb://` etc. não são —
# nesses casos consultamos a fila CUPS local, que responde pelos equipamentos.
IPP_SCHEMES = {"ipp", "ipps", "http", "https"}

RAZOES_SEM_PAPEL = {"media-empty", "media-needed"}
RAZOES_MANUTENCAO = {"media-jam", "cover-open", "door-open"}

# Aviso (não bloqueia): toner a até 10% liga `detalhes.toner_baixo`.
TONER_BAIXO_PCT = 10

# Estados em que o worker NÃO deve reivindicar pedidos (ver deve_segurar_pedidos).
ESTADOS_BLOQUEANTES = {"SEM_PAPEL", "SEM_TONER", "MANUTENCAO", "INALCANCAVEL"}

# Pedido IPP mínimo para o `ipptool`: só os atributos de saúde que usamos.
ARQUIVO_IPP_SAUDE = """{
    NAME "Atributos de saude da impressora"
    OPERATION Get-Printer-Attributes
    GROUP operation-attributes-tag
    ATTR charset attributes-charset utf-8
    ATTR naturalLanguage attributes-natural-language en
    ATTR uri printer-uri $uri
    ATTR keyword requested-attributes printer-state,printer-state-reasons,marker-levels,marker-low-levels
}
"""

_ipp_test_path: str | None = None


def _arquivo_ipp_teste() -> str:
    """Materializa (uma vez) o pedido IPP num arquivo temporário para o ipptool."""
    global _ipp_test_path
    if _ipp_test_path is None or not os.path.exists(_ipp_test_path):
        fd, caminho = tempfile.mkstemp(suffix=".test", prefix="print-worker-ipp-")
        with os.fdopen(fd, "w") as fh:
            fh.write(ARQUIVO_IPP_SAUDE)
        _ipp_test_path = caminho
    return _ipp_test_path


def alvo_ipp_da_fila(fila: str) -> str:
    """URI IPP a consultar, derivado do nome da fila — nunca um IP configurado.

    Preferência: o device URI do equipamento (fonte direta, sem o cache do
    CUPS) quando for um esquema IPP de rede; senão, a própria fila CUPS local.
    """
    uri = device_uri_da_fila(fila)
    if uri:
        parsed = parse_device_uri(uri)
        if parsed and parsed[0] in IPP_SCHEMES and parsed[1]:
            return uri
    return f"ipp://localhost:631/printers/{fila}"


# Enum IPP `printer-state` (RFC 8011) e os nomes que o ipptool imprime por eles.
IDLE, PROCESSING, STOPPED = 3, 4, 5
PRINTER_STATE_POR_NOME = {"idle": IDLE, "processing": PROCESSING, "stopped": STOPPED}


def _parse_atributos_ipp(saida: str) -> dict:
    """Extrai razões, níveis e printer-state da saída `-tv` do ipptool (tolerante).

    Linhas típicas: `printer-state-reasons (keyword) = media-empty-error`,
    `marker-levels (integer) = 100` e `printer-state (enum) = idle` (algumas
    versões imprimem o número, ex.: `= 3`). Valores negativos de marker-levels
    significam "desconhecido" no IPP e viram None.
    """
    razoes: list[str] = []
    m = re.search(r"printer-state-reasons\s*\([^)]*\)\s*=\s*(.+)", saida)
    if m:
        razoes = [r.strip() for r in m.group(1).split(",") if r.strip()]

    def _inteiro(atributo: str) -> int | None:
        m = re.search(rf"{atributo}\s*\([^)]*\)\s*=\s*(-?\d+)", saida)
        if not m:
            return None
        valor = int(m.group(1))
        return valor if valor >= 0 else None

    def _printer_state() -> int | None:
        # `printer-state\s*\(` não casa com "printer-state-reasons" (segue "-").
        m = re.search(r"printer-state\s*\([^)]*\)\s*=\s*([\w-]+)", saida)
        if not m:
            return None
        bruto = m.group(1).lower()
        if bruto.isdigit():
            return int(bruto)
        return PRINTER_STATE_POR_NOME.get(bruto)

    return {
        "state_reasons": razoes,
        "toner_pct": _inteiro("marker-levels"),
        "toner_low_pct": _inteiro("marker-low-levels"),
        "printer_state": _printer_state(),
    }


def _consultar_ipp(cfg: Config, alvo: str) -> dict | None:
    """Roda o ipptool contra `alvo`; None em falha (best-effort, só loga)."""
    try:
        proc = subprocess.run(
            ["ipptool", "-tv", alvo, _arquivo_ipp_teste()],
            capture_output=True,
            text=True,
            timeout=max(cfg.reachability_timeout * 2, 5),
            env=CUPS_ENV,
        )
    except FileNotFoundError:
        log.warning(
            "ipptool ausente (instale cups-ipp-utils) — coleta de saúde IPP desativada"
        )
        return None
    except Exception as err:  # noqa: BLE001 - timeout/erro => degrada
        log.debug("ipptool contra %s falhou: %s", alvo, err)
        return None
    # Mesmo com returncode != 0 (status IPP inesperado) o `-tv` imprime os
    # atributos recebidos; só desistimos quando nada foi parseável.
    atributos = _parse_atributos_ipp(proc.stdout)
    if (
        not atributos["state_reasons"]
        and atributos["toner_pct"] is None
        and atributos["printer_state"] is None
    ):
        return None
    return atributos


def _uri_com_host_resolvido(cfg: Config, uri: str) -> str:
    """Reescreve o URI com o host resolvido para IP, preservando o caminho.

    O `ipptool` usa getaddrinfo e não resolve mDNS `.local` em sistemas sem
    nss-mdns; `resolver_host` (getent + avahi) cobre isso. Sem resolução,
    devolve o URI original (o ipptool ainda pode resolver DNS comum).
    """
    parsed = parse_device_uri(uri)
    if not parsed or not parsed[1]:
        return uri
    scheme, host, porta = parsed
    ip = resolver_host(host, cfg.reachability_timeout)
    if not ip or ip == host:
        return uri
    if ":" in ip:  # IPv6 precisa de colchetes no URI
        ip = f"[{ip}]"
    caminho = urlparse(uri).path or ""
    return f"{scheme}://{ip}:{porta}{caminho}"


def coletar_saude_ipp(cfg: Config, fila: str) -> dict | None:
    """Atributos de saúde da impressora: device URI direto, fallback fila local."""
    local = f"ipp://localhost:631/printers/{fila}"
    alvo = alvo_ipp_da_fila(fila)
    if alvo != local:
        alvo = _uri_com_host_resolvido(cfg, alvo)
    atributos = _consultar_ipp(cfg, alvo)
    if atributos is not None:
        return atributos
    if alvo != local:
        return _consultar_ipp(cfg, local)
    return None


def saude_ipp_direta(cfg: Config, fila: str) -> dict | None:
    """Atributos de saúde lidos SÓ do equipamento (sem fallback à fila local).

    Usada quando os health-checks dizem INALCANCAVEL: a fila CUPS local
    responde mesmo com a impressora desligada (estado em cache), então razões
    vindas dela não provam nada — só a resposta do próprio equipamento vale.
    """
    alvo = alvo_ipp_da_fila(fila)
    if alvo == f"ipp://localhost:631/printers/{fila}":
        return None
    return _consultar_ipp(cfg, _uri_com_host_resolvido(cfg, alvo))


# Sentinelas de _printer_state_equipamento para os casos sem enum legível.
SEM_ESTADO = "SEM_ESTADO"
NAO_CONSULTAVEL = "NAO_CONSULTAVEL"


def _printer_state_equipamento(cfg: Config, fila: str) -> int | str:
    """`printer-state` lido DIRETO do equipamento (nunca da fila CUPS local).

    A fila local responde pelo daemon e não prova o estado do firmware — a HP
    135w abre a porta IPP segundos antes de estar pronta, e um job enviado
    nessa janela sai como lixo binário. Retorna:
      - 3/4/5 (idle/processing/stopped): estado lido do equipamento;
      - SEM_ESTADO: a consulta ao equipamento falhou ou veio sem o atributo
        (janela de boot do firmware com a porta TCP já aberta);
      - NAO_CONSULTAVEL: sem como consultar com confiança (ipptool ausente, ou
        fila USB/local sem device URI IPP de rede) -> degradar para TCP-connect.
    """
    if shutil.which("ipptool") is None:
        return NAO_CONSULTAVEL
    alvo = alvo_ipp_da_fila(fila)
    if alvo == f"ipp://localhost:631/printers/{fila}":
        return NAO_CONSULTAVEL
    atributos = _consultar_ipp(cfg, _uri_com_host_resolvido(cfg, alvo))
    if atributos is None or atributos["printer_state"] is None:
        return SEM_ESTADO
    return atributos["printer_state"]


def impressora_pronta(cfg: Config, fila: str) -> bool | None:
    """Gate de prontidão pré-submissão: firmware precisa aceitar jobs.

    - True: equipamento reporta idle (3) ou processing (4) — enfileirar atrás
      de um job ativo (ex.: impressão manual por outra fila na mesma impressora
      física) é comportamento normal do IPP e não corrompe o nosso job;
    - False: reporta stopped (5), ou está alcançável por TCP mas a consulta
      IPP falha/sem estado (janela de boot do firmware, exatamente quando um
      job sairia como lixo binário). Falha de PRÉ-SUBMISSÃO: nada enviado,
      elegível a failover/retenção;
    - None: prontidão não consultável -> vale só o TCP-connect existente.
    """
    estado = _printer_state_equipamento(cfg, fila)
    if estado == NAO_CONSULTAVEL:
        return None
    return estado in (IDLE, PROCESSING)


def normalizar_razoes(razoes: list[str]) -> list[str]:
    """Remove sufixos IPP de severidade e ruído ("none"), preservando a ordem."""
    resultado = []
    for razao in razoes:
        razao = re.sub(r"-(report|warning|error)$", "", razao.strip())
        if razao and razao != "none":
            resultado.append(razao)
    return resultado


def estado_de_saude(
    razoes: list[str], toner_pct: int | None, toner_low_pct: int | None
) -> str | None:
    """Mapeia razões normalizadas + toner para um estado de falha física.

    Prioridade interna: SEM_TONER > SEM_PAPEL > MANUTENCAO. Razões
    desconhecidas não bloqueiam (fail-safe): ficam só em detalhes.state_reasons.
    `toner-empty` é a fonte mais confiável para SEM_TONER; o percentual no
    limiar `low` do equipamento (ou zerado) cobre firmwares que não emitem a razão.
    """
    conjunto = set(razoes)
    toner_esgotado = "toner-empty" in conjunto or (
        toner_pct is not None
        and (toner_pct == 0 or (toner_low_pct is not None and toner_pct <= toner_low_pct))
    )
    if toner_esgotado:
        return "SEM_TONER"
    if conjunto & RAZOES_SEM_PAPEL:
        return "SEM_PAPEL"
    if conjunto & RAZOES_MANUTENCAO:
        return "MANUTENCAO"
    return None


def derivar_fisico(saude: dict) -> tuple[str | None, dict]:
    """Estado físico (ou None) + `detalhes` a partir dos atributos IPP coletados."""
    razoes = normalizar_razoes(saude["state_reasons"])
    toner_pct = saude["toner_pct"]
    fisico = estado_de_saude(razoes, toner_pct, saude["toner_low_pct"])
    detalhes = {
        "toner_pct": toner_pct,
        "state_reasons": razoes,
        "toner_baixo": toner_pct is not None and toner_pct <= TONER_BAIXO_PCT,
    }
    return fisico, detalhes


def saude_da_impressora(cfg: Config, fila: str) -> tuple[str, dict]:
    """Estado do heartbeat + `detalhes`, combinando health-checks e IPP.

    INALCANCAVEL dos health-checks NÃO é definitivo: `printer-state = stopped`
    também cai nele (regra da janela de boot), e é exatamente como o firmware
    apresenta "parada por falta de papel/toner/atolamento" com job bloqueado.
    Por isso, antes de publicar INALCANCAVEL, consultamos o equipamento DIRETO
    (sem o cache da fila local): se ele responde e as razões mapeiam para uma
    falha física, publicamos a falha física — senão, INALCANCAVEL fica (a
    impressora está mesmo fora do ar ou em boot). Entre os demais estados, a
    prioridade é SEM_TONER > SEM_PAPEL > MANUTENCAO > PAUSADA > OK — falha
    física vence PAUSADA porque exige reposição/ação na impressora. Sem coleta
    IPP (best-effort), degrada para o estado dos health-checks, detalhes vazios.
    """
    estado = estado_da_fila(cfg, fila)
    if estado == "INALCANCAVEL":
        saude = saude_ipp_direta(cfg, fila)
        if saude is None:
            return estado, {}
        fisico, detalhes = derivar_fisico(saude)
        if fisico is None:
            return estado, {}
        return fisico, detalhes
    saude = coletar_saude_ipp(cfg, fila)
    if saude is None:
        return estado, {}
    fisico, detalhes = derivar_fisico(saude)
    return fisico or estado, detalhes


# Estados cuja ENTRADA aciona o aviso à equipe. PAUSADA/INALCANCAVEL ficam de
# fora: oscilam com Wi-Fi/ação humana deliberada e virariam ruído no Telegram.
ESTADOS_NOTIFICAVEIS = {"SEM_PAPEL", "SEM_TONER", "MANUTENCAO"}

# Estados que provam a impressora operando — só eles encerram um problema
# pendente com o aviso de recuperação (INALCANCAVEL/PAUSADA não provam reposição).
ESTADOS_OPERANTES = {"OK", "IMPRIMINDO"}

MENSAGEM_ESTADO = {
    "SEM_PAPEL": "🟡 Sem papel na bandeja — repor para a fila andar.",
    "SEM_TONER": "🔴 Toner esgotado — trocar o cartucho.",
    "MANUTENCAO": "🟠 Impressora precisa de atenção (atolamento ou tampa aberta).",
}

MENSAGEM_RECUPERACAO = {
    "SEM_PAPEL": "🟢 Papel reposto — impressora pronta e fila retomada.",
    "SEM_TONER": "🟢 Toner reposto — impressora pronta e fila retomada.",
    "MANUTENCAO": "🟢 Impressora normalizada — fila retomada.",
}


def linhas_de_transicao(
    estado_antigo: str | None,
    estado_novo: str,
    problema_pendente: str | None,
    toner_baixo_antigo: bool,
    toner_baixo_novo: bool,
) -> tuple[list[str], str | None]:
    """Mensagens a enviar nesta transição + novo problema pendente (função pura).

    - ENTRADA em problema notificável: avisa e registra o problema como
      pendente. A reentrada do MESMO problema ainda pendente (ex.: SEM_PAPEL ->
      INALCANCAVEL -> SEM_PAPEL num blip de rede, sem reposição no meio) não
      repete o aviso.
    - RECUPERAÇÃO: ao voltar a operar (OK/IMPRIMINDO) com problema pendente,
      avisa que foi resolvido — a equipe sabe da reposição sem ir ao local.
    - Toner baixo: aviso ortogonal na subida False -> True, como antes.

    Nunca dispara por heartbeat repetido de um mesmo estado.
    """
    linhas: list[str] = []
    pendente = problema_pendente
    if estado_novo in ESTADOS_NOTIFICAVEIS:
        if estado_novo != estado_antigo and estado_novo != problema_pendente:
            linhas.append(MENSAGEM_ESTADO[estado_novo])
        pendente = estado_novo
    elif estado_novo in ESTADOS_OPERANTES and problema_pendente is not None:
        linhas.append(MENSAGEM_RECUPERACAO[problema_pendente])
        pendente = None
    if toner_baixo_novo and not toner_baixo_antigo:
        linhas.append(f"🟡 Toner acabando (≤ {TONER_BAIXO_PCT}%) — providenciar reposição.")
    return linhas, pendente


def enviar_aviso_telegram(cfg: Config, linhas: list[str]) -> None:
    """Envia o aviso de saúde à equipe via Telegram Bot API.

    Best-effort: envs ausentes ou falha de rede apenas logam; o heartbeat e a
    impressão nunca são afetados.
    """
    if not linhas:
        return
    if not cfg.telegram_bot_token or not cfg.telegram_chat_id:
        log.info("Aviso de saúde sem Telegram configurado — pulado: %s", " / ".join(linhas))
        return
    texto = "🖨️ Impressora do totem\n" + "\n".join(linhas) + f"\nFila: {cfg.printer_name}"
    try:
        req = Request(
            f"https://api.telegram.org/bot{cfg.telegram_bot_token}/sendMessage",
            data=json.dumps({"chat_id": cfg.telegram_chat_id, "text": texto}).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urlopen(req, timeout=5) as resp:
            if resp.status >= 300:
                log.warning("Telegram sendMessage retornou HTTP %s", resp.status)
    except Exception as err:  # noqa: BLE001 - best-effort: nunca derruba o ciclo
        log.warning("Notificação Telegram falhou (best-effort): %s", err)


def deve_segurar_pedidos(cfg: Config, estado_saude: str | None) -> bool:
    """True quando o worker NÃO deve reivindicar pedidos neste ciclo.

    - None: o heartbeat ainda não fez a primeira leitura (worker recém-
      iniciado); espera um ciclo em vez de imprimir às cegas.
    - SEM_PAPEL/SEM_TONER/MANUTENCAO: falha física na impressora primária.
      Submeter deixaria o job preso até PRINT_TIMEOUT e o pedido cairia em
      ERRO — reter em PAGO é exatamente o que a spec exige.
    - INALCANCAVEL: retém apenas quando NÃO há fila de fallback utilizável.
      Com fallback saudável e alcançável, o failover pré-submissão existente
      resolve melhor: o pedido imprime na fallback em vez de esperar.
    """
    if estado_saude is None:
        return True
    if estado_saude in ("SEM_PAPEL", "SEM_TONER", "MANUTENCAO"):
        return True
    if estado_saude == "INALCANCAVEL":
        return not any(
            fila_saudavel(fila)
            and fila_alcancavel(cfg, fila)
            and impressora_pronta(cfg, fila) is not False
            for fila in filas_candidatas(cfg)[1:]
        )
    return False


class Heartbeat:
    """Publica o estado da impressora em `impressora_status` (best-effort).

    Roda numa thread daemon com o mesmo período do poll, em vez de dentro do
    loop principal: durante uma impressão o loop fica bloqueado em
    `aguardar_conclusao` (até PRINT_TIMEOUT) e o heartbeat envelheceria — o
    kiosk considera o sistema offline com `atualizado_em` além de 3× o período,
    e isso só pode acontecer quando o worker realmente morreu.

    Usa um client Supabase próprio: o client síncrono não é garantidamente
    thread-safe para uso concorrente com o do loop principal. Toda falha de
    publicação é logada e engolida — o heartbeat nunca afeta a impressão.
    """

    def __init__(self, cfg: Config) -> None:
        self._cfg = cfg
        self._sb = create_client(cfg.supabase_url, cfg.service_role_key)
        self._imprimindo = threading.Event()
        # Último estado de SAÚDE derivado (sem o override IMPRIMINDO), lido
        # pelo loop principal para decidir se reivindica pedidos neste ciclo.
        # None = nenhuma leitura ainda (worker recém-iniciado).
        self.estado_saude: str | None = None
        # Memória de transição para a notificação (só do que foi PUBLICADO com
        # sucesso — a fonte da verdade é o que o kiosk vê). `_problema_pendente`
        # é o problema já avisado e ainda não resolvido: dedup da reentrada e
        # gatilho do aviso de recuperação quando a impressora volta a operar.
        self._ultimo_publicado: str | None = None
        self._ultimo_toner_baixo = False
        self._problema_pendente: str | None = None
        self._semear_memoria()

    def _semear_memoria(self) -> None:
        """Continua a memória de transição da última linha publicada (best-effort).

        Sem isso, todo restart do worker re-avisaria um problema já notificado
        (None -> SEM_PAPEL) e esqueceria a recuperação pendente de antes do
        restart — a reposição do papel ficaria sem aviso.
        """
        try:
            res = (
                self._sb.table("impressora_status")
                .select("estado, detalhes")
                .limit(1)
                .execute()
            )
            row = res.data[0] if res.data else None
        except Exception as err:  # noqa: BLE001 - best-effort: memória zerada
            log.warning("Heartbeat: leitura inicial de impressora_status falhou: %s", err)
            return
        if not row:
            return
        estado = row.get("estado")
        self._ultimo_publicado = estado
        if estado in ESTADOS_NOTIFICAVEIS:
            self._problema_pendente = estado
        self._ultimo_toner_baixo = bool((row.get("detalhes") or {}).get("toner_baixo"))

    def marcar_imprimindo(self, ativo: bool) -> None:
        if ativo:
            self._imprimindo.set()
        else:
            self._imprimindo.clear()

    def _publicar(self) -> None:
        estado, detalhes = saude_da_impressora(self._cfg, self._cfg.printer_name)
        self.estado_saude = estado
        # IMPRIMINDO só sobrepõe OK: uma falha física detectada no meio de um
        # job (ex.: papel acabou) tem prioridade na faixa do kiosk.
        publicado = "IMPRIMINDO" if estado == "OK" and self._imprimindo.is_set() else estado
        # Sem coleta IPP (detalhes vazios, ex.: INALCANCAVEL) não há leitura de
        # toner — manter a memória evita re-avisar "toner acabando" a cada blip.
        toner_baixo = (
            bool(detalhes.get("toner_baixo")) if detalhes else self._ultimo_toner_baixo
        )
        try:
            self._sb.table("impressora_status").upsert(
                {
                    "fila": self._cfg.printer_name,
                    "estado": publicado,
                    "detalhes": detalhes,
                    "atualizado_em": now_iso(),
                }
            ).execute()
        except Exception as err:  # noqa: BLE001 - best-effort: nunca derruba o worker
            log.warning("Heartbeat: upsert em impressora_status falhou: %s", err)
            return
        linhas, problema_pendente = linhas_de_transicao(
            self._ultimo_publicado,
            publicado,
            self._problema_pendente,
            self._ultimo_toner_baixo,
            toner_baixo,
        )
        enviar_aviso_telegram(self._cfg, linhas)
        self._ultimo_publicado = publicado
        self._ultimo_toner_baixo = toner_baixo
        self._problema_pendente = problema_pendente

    def _loop(self) -> None:
        while True:
            self._publicar()
            time.sleep(self._cfg.poll_interval)

    def start(self) -> None:
        threading.Thread(target=self._loop, daemon=True, name="heartbeat").start()


def enviar_para_impressora(fila: str, caminho: str, opcoes: list[str]) -> str:
    """Envia o arquivo via lp (1 job) na `fila` e retorna o job id do CUPS.

    `opcoes` são os tokens de `LP_OPTIONS`; cada um vira um `-o <token>` (ex.:
    `fit-to-page`, `media=A4`), controlando escala/mídia para que PDFs em
    paisagem não saiam cortados.

    Levanta `FalhaPreSubmissao` se o `lp` retornar erro ou se o job id não for
    extraível — ambos casos em que o CUPS NÃO aceitou o job (nada impresso),
    logo é seguro tentar a próxima fila.
    """
    cmd = ["lp", "-d", fila]
    for opcao in opcoes:
        cmd += ["-o", opcao]
    cmd.append(caminho)
    proc = subprocess.run(
        cmd,
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


def purgar_spool(filas: list[str], momento: str) -> None:
    """Cancela TODOS os jobs das filas (spool é transporte; a verdade é o Supabase).

    Um job órfão retido no spool (ex.: transmissão interrompida por desligamento
    ou queda de rede) é retransmitido pelo CUPS sem o cabeçalho do fluxo PCLm, e
    a impressora o despeja como páginas de lixo binário. As filas configuradas
    são de uso exclusivo do worker, então cancelar tudo é seguro. NUNCA chamar
    entre a aceitação de um job e sua conclusão/cancelamento. Best-effort:
    qualquer falha vira warning e não bloqueia o processamento.
    """
    for fila in filas:
        try:
            proc = subprocess.run(
                ["cancel", "-a", fila],
                capture_output=True,
                text=True,
                timeout=10,
                env=CUPS_ENV,
            )
        except Exception as err:  # noqa: BLE001 - best-effort
            log.warning("Purga do spool da fila %s (%s) falhou: %s", fila, momento, err)
            continue
        if proc.returncode != 0:
            log.warning(
                "Purga do spool da fila %s (%s) falhou: %s",
                fila,
                momento,
                proc.stderr.strip() or proc.stdout.strip(),
            )


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

    # Higiene do spool: nenhum job órfão pode sobrar para ser retransmitido como
    # lixo binário. Roda antes de qualquer submissão deste pedido; o fluxo
    # sequencial abaixo garante que a purga jamais alcança o job ativo do worker.
    purgar_spool(filas_candidatas(cfg), f"pré-submissão do pedido {pedido_id}")

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

            # Prontidão do firmware: porta TCP aberta não significa impressora
            # pronta (janela de boot). Não-pronta = pré-submissão, nada enviado.
            if impressora_pronta(cfg, fila) is False:
                log.warning(
                    "Pedido %s: fila %s alcançável mas impressora não pronta "
                    "(printer-state stopped/ilegível; pré-submissão, nada impresso) -> %s",
                    pedido_id,
                    fila,
                    "failover para fallback" if tem_proxima else "sem mais filas",
                )
                continue

            try:
                job_id = enviar_para_impressora(fila, caminho, cfg.lp_options)
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
    # Jobs órfãos de antes do reboot seriam retransmitidos pelo CUPS assim que a
    # impressora respondesse — purgar antes de qualquer ciclo.
    purgar_spool(filas_candidatas(cfg), "boot do worker")
    heartbeat = Heartbeat(cfg)
    heartbeat.start()
    log.info(
        "Print worker iniciado (impressora=%s, fallback=%s, poll=%ss, print_timeout=%ss, stuck_timeout=%ss)",
        cfg.printer_name,
        cfg.printer_name_fallback or "(nenhuma)",
        cfg.poll_interval,
        cfg.print_timeout,
        cfg.stuck_timeout,
    )

    segurando = False  # evita logar a retenção a cada ciclo de 10s
    while True:
        try:
            recuperar_travados(sb, cfg)

            # Retenção: com falha física/destino fora, NÃO reivindica — o
            # pedido PAGO espera intacto (nada de ERRO) e a impressão retoma
            # sozinha no ciclo seguinte à reposição (ver deve_segurar_pedidos).
            if deve_segurar_pedidos(cfg, heartbeat.estado_saude):
                if not segurando:
                    log.warning(
                        "Impressora em %s — segurando pedidos PAGO até normalizar",
                        heartbeat.estado_saude or "(aguardando 1ª leitura de saúde)",
                    )
                    segurando = True
                time.sleep(cfg.poll_interval)
                continue
            if segurando:
                log.info("Impressora normalizada (%s) — retomando a fila", heartbeat.estado_saude)
                segurando = False

            pedido = proximo_pago(sb)
            if pedido and reivindicar(sb, pedido["id"]):
                heartbeat.marcar_imprimindo(True)
                try:
                    processar(sb, cfg, pedido)
                finally:
                    heartbeat.marcar_imprimindo(False)
                continue  # busca o próximo imediatamente, sem dormir
        except Exception as err:  # noqa: BLE001 - ciclo nunca encerra por erro transitório
            log.exception("Erro no ciclo: %s", err)
        time.sleep(cfg.poll_interval)


if __name__ == "__main__":
    main()
