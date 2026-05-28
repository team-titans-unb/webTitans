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
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone

from pypdf import PdfReader
from supabase import Client, create_client

TABLE = "fila_impressao"
BUCKET = "pdfs-impressao"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("print-worker")


class Config:
    def __init__(self) -> None:
        self.supabase_url = os.environ.get("SUPABASE_URL", "").strip()
        self.service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        self.printer_name = os.environ.get("PRINTER_NAME", "").strip()
        self.poll_interval = int(os.environ.get("POLL_INTERVAL", "10"))
        self.print_timeout = int(os.environ.get("PRINT_TIMEOUT", "180"))
        self.stuck_timeout = int(os.environ.get("STUCK_TIMEOUT", "900"))

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


def enviar_para_impressora(cfg: Config, caminho: str) -> str:
    """Envia o arquivo via lp e retorna o job id do CUPS."""
    proc = subprocess.run(
        ["lp", "-d", cfg.printer_name, "-n", "1", caminho],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"lp falhou: {proc.stderr.strip() or proc.stdout.strip()}")
    # Saída típica: "request id is Printer-42 (1 file(s))"
    match = re.search(r"request id is (\S+)", proc.stdout)
    if not match:
        raise RuntimeError(f"Não consegui extrair job id de: {proc.stdout.strip()!r}")
    return match.group(1)


def aguardar_conclusao(cfg: Config, job_id: str) -> bool:
    """Espera o job sumir da fila de não-concluídos. True se concluiu no tempo."""
    deadline = time.monotonic() + cfg.print_timeout
    while time.monotonic() < deadline:
        proc = subprocess.run(
            ["lpstat", "-o", cfg.printer_name],
            capture_output=True,
            text=True,
        )
        ativos = proc.stdout
        if job_id not in ativos:
            return True
        time.sleep(2)
    return False


def cancelar_job(job_id: str) -> None:
    try:
        subprocess.run(["cancel", job_id], capture_output=True, text=True, timeout=10)
    except Exception as err:  # noqa: BLE001
        log.warning("Falha ao cancelar job %s: %s", job_id, err)


def processar(sb: Client, cfg: Config, pedido: dict) -> None:
    pedido_id = pedido["id"]
    pdf_path = pedido["pdf_path"]
    num_paginas = pedido["num_paginas"]
    modo_cor = pedido.get("modo_cor")

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

    # Impressão.
    fd, caminho = tempfile.mkstemp(suffix=".pdf", prefix="print-worker-")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(pdf_bytes)

        try:
            job_id = enviar_para_impressora(cfg, caminho)
        except Exception as err:  # noqa: BLE001
            log.error("Pedido %s: envio para impressora falhou: %s", pedido_id, err)
            mark(sb, pedido_id, "ERRO")
            return

        log.info("Pedido %s: enviado ao CUPS (job %s, %s páginas)", pedido_id, job_id, paginas_reais)

        if aguardar_conclusao(cfg, job_id):
            mark(sb, pedido_id, "IMPRESSO", {"printed_at": now_iso()})
            log.info("Pedido %s: IMPRESSO", pedido_id)
        else:
            log.error("Pedido %s: timeout de impressão (job %s) -> ERRO", pedido_id, job_id)
            cancelar_job(job_id)
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
        "Print worker iniciado (impressora=%s, poll=%ss, print_timeout=%ss, stuck_timeout=%ss)",
        cfg.printer_name,
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
