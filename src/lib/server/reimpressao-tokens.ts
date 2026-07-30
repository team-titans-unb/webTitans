import crypto from "node:crypto";
import { supabaseAdmin } from "./supabase-admin";
import { PROTOCOLO_RE } from "@/lib/protocolo";
import { resolverPedidoPorProtocolo } from "./pedido-protocolo";
import { reimprimirPedido, type ResultadoReimpressao } from "./reimpressao";

// Janela de validade do código de uso único do totem (default acordado: 24h).
export const JANELA_EXPIRACAO_HORAS = 24;

const CODIGO_RE = /^R-[0-9A-F]{8}$/;

function hashCodigo(codigo: string): string {
  return crypto.createHash("sha256").update(codigo).digest("hex");
}

// Gera um código de uso único (fluxo B — totem): 8 hex de entropia
// criptográfica real (nunca Math.random), prefixo `R-` para nunca colidir com
// um protocolo (hex puro de 8). O banco guarda só o hash; o texto puro só
// existe neste retorno — a resposta do bot ao administrador, exibida uma
// única vez.
export async function gerarCodigoReimpressao(args: {
  pedidoId: string;
  criadoPor: number;
}): Promise<string | null> {
  const codigo = `R-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const expiraEm = new Date(
    Date.now() + JANELA_EXPIRACAO_HORAS * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabaseAdmin.from("reimpressao_tokens").insert({
    token_hash: hashCodigo(codigo),
    pedido_id: args.pedidoId,
    expira_em: expiraEm,
    criado_por: args.criadoPor,
  });
  if (error) {
    console.error("Erro gerando código de reimpressão:", error);
    return null;
  }
  return codigo;
}

// Resgata um código de uso único e, se válido, invoca o núcleo de
// reimpressão. A condição inteira (hash + pedido + não usado + não expirado)
// vive num único UPDATE atômico: nenhuma leitura prévia decide o resultado,
// RETURNING confirma se a linha existia e atendia tudo. Erros de resgate são
// deliberadamente genéricos (CODIGO_INVALIDO) — nunca distinguem inexistente,
// expirado, usado ou de outro pedido — para não virar oráculo de força bruta
// (design D5).
export async function resgatarCodigoReimpressao(args: {
  protocolo: string;
  codigo: string;
}): Promise<ResultadoReimpressao> {
  const protocolo = args.protocolo.toUpperCase();
  const codigo = args.codigo.toUpperCase();

  if (!PROTOCOLO_RE.test(protocolo) || !CODIGO_RE.test(codigo)) {
    return { ok: false, motivo: "CODIGO_INVALIDO" };
  }

  const resolucao = await resolverPedidoPorProtocolo(protocolo);
  // === false (não negação): ver nota em reimpressao.ts sobre estreitamento
  // de uniões discriminadas por booleano sem strictNullChecks.
  if (resolucao.encontrado === false) {
    return { ok: false, motivo: "CODIGO_INVALIDO" };
  }

  const agora = new Date().toISOString();
  const { data: tokenResgatado, error } = await supabaseAdmin
    .from("reimpressao_tokens")
    .update({ usado_em: agora })
    .eq("token_hash", hashCodigo(codigo))
    .eq("pedido_id", resolucao.pedido.id)
    .is("usado_em", null)
    .gt("expira_em", agora)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Erro resgatando código de reimpressão:", error);
    return { ok: false, motivo: "ERRO_INTERNO" };
  }
  if (!tokenResgatado) {
    return { ok: false, motivo: "CODIGO_INVALIDO" };
  }

  return reimprimirPedido({ protocolo, origem: "totem" });
}
