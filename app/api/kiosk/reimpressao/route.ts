import { PROTOCOLO_RE } from "@/lib/protocolo";
import { resgatarCodigoReimpressao } from "@/lib/server/reimpressao-tokens";
import { excedeuLimite } from "@/lib/server/rate-limit";

// Resgate do código de reimpressão de uso único no totem. Server-side
// (service_role), em route SEPARADA de /api/kiosk/pedido (consulta) e
// /api/kiosk/help (chamados) — de propósito: se o resgate compartilhasse
// route com a consulta, respostas diferenciadas virariam um oráculo de força
// bruta de códigos (design D5).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODIGO_RE = /^R-[0-9a-fA-F]{8}$/;

// Janela de rate-limit por IP: contém varredura de códigos sem travar um
// cliente legítimo que erra a digitação algumas vezes.
const RATE_LIMIT_TENTATIVAS = 5;
const RATE_LIMIT_JANELA_MS = 5 * 60 * 1000;

const MENSAGEM_GENERICA =
  "Código inválido ou pedido não elegível para reimpressão. Confira com a equipe.";

function ipDoRequest(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconhecido";
}

export async function POST(req: Request) {
  const ip = ipDoRequest(req);
  if (excedeuLimite(`kiosk-reimpressao:${ip}`, RATE_LIMIT_TENTATIVAS, RATE_LIMIT_JANELA_MS)) {
    return Response.json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => undefined)) as
    | { protocolo?: unknown; codigo?: unknown }
    | undefined;

  const protocolo = body?.protocolo;
  const codigo = body?.codigo;
  if (
    typeof protocolo !== "string" ||
    !PROTOCOLO_RE.test(protocolo) ||
    typeof codigo !== "string" ||
    !CODIGO_RE.test(codigo)
  ) {
    return Response.json(
      { error: "Protocolo ou código em formato inválido" },
      { status: 400 }
    );
  }

  const resultado = await resgatarCodigoReimpressao({ protocolo, codigo });

  // === false (não negação): ver nota em reimpressao.ts sobre estreitamento
  // de uniões discriminadas por booleano sem strictNullChecks.
  if (resultado.ok === false) {
    // Nunca distingue código inexistente, expirado, usado, de outro pedido ou
    // pedido não elegível — mesma mensagem genérica para todos (design D5).
    // ERRO_INTERNO é a única exceção: não é sobre o código em si, então não
    // compromete o anti-oráculo, e vale reportar como falha de servidor.
    const status = resultado.motivo === "ERRO_INTERNO" ? 500 : 400;
    const mensagem =
      resultado.motivo === "ERRO_INTERNO"
        ? "Erro interno. Tente novamente em instantes."
        : MENSAGEM_GENERICA;
    return Response.json({ error: mensagem }, { status });
  }

  return Response.json({ ok: true, posicao_na_fila: resultado.posicaoNaFila });
}
