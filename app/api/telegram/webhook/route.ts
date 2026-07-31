import crypto from "node:crypto";
import { PROTOCOLO_RE } from "@/lib/protocolo";
import { enviarMensagemTelegram } from "@/lib/server/telegram";
import {
  reimprimirPedido,
  avaliarElegibilidade,
  type MotivoRecusaReimpressao,
} from "@/lib/server/reimpressao";
import { resolverPedidoPorProtocolo } from "@/lib/server/pedido-protocolo";
import { gerarCodigoReimpressao, JANELA_EXPIRACAO_HORAS } from "@/lib/server/reimpressao-tokens";

// Webhook de ENTRADA do bot do Telegram — infraestrutura nova: até aqui o
// sistema só enviava mensagens (sendMessage em /api/kiosk/help). Trata os
// comandos administrativos de reimpressão (/reimprimir, /gerar_codigo).
// node:crypto (comparação em tempo constante do secret_token) e supabase-js
// (via módulos de reimpressão) exigem o runtime Node; force-dynamic porque
// depende do corpo do request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramUpdate = {
  message?: {
    text?: string;
    from?: { id?: number };
    chat?: { id?: number };
  };
};

// Comparação em tempo constante do secret_token (evita timing attacks),
// mesmo padrão já usado em cleanup-fila e mp-signature.
function segredoConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function parseAdminIds(raw: string | undefined): Set<number> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n))
  );
}

// Extrai "/comando" e o argumento seguinte, tolerando o sufixo @NomeDoBot que
// o Telegram anexa a comandos usados dentro de grupos.
function parseComando(texto: string): { comando: string; argumento: string } | null {
  const partes = texto.trim().split(/\s+/);
  const primeira = partes[0];
  if (!primeira || !primeira.startsWith("/")) return null;
  const comando = primeira.slice(1).split("@")[0]?.toLowerCase() ?? "";
  return { comando, argumento: partes[1] ?? "" };
}

const MENSAGEM_USO =
  "Uso:\n/reimprimir <protocolo de 8 dígitos>\n/gerar_codigo <protocolo de 8 dígitos>";

const MENSAGEM_POR_MOTIVO: Record<MotivoRecusaReimpressao, string> = {
  NAO_ENCONTRADO: "Protocolo não encontrado.",
  STATUS_NAO_ELEGIVEL:
    "Esse pedido não está elegível para reimpressão (precisa estar ERRO ou IMPRESSO).",
  PDF_EXPIRADO:
    "O arquivo desse pedido já expirou (retenção de 7 dias). É preciso um novo envio.",
  JA_PROCESSADO: "Esse pedido já foi processado por outra solicitação — nada a fazer.",
  CODIGO_INVALIDO: "Código inválido.",
  ERRO_INTERNO: "Erro interno. Tente novamente em instantes.",
};

async function tratarReimprimir(chatId: number, argumento: string, adminId: number) {
  const protocolo = argumento.toUpperCase();
  if (!PROTOCOLO_RE.test(protocolo)) {
    await enviarMensagemTelegram({ chatId: String(chatId), texto: MENSAGEM_USO });
    return;
  }

  const resultado = await reimprimirPedido({
    protocolo,
    origem: "bot",
    telegramUserId: adminId,
  });

  // === true (não truthy simples): sem strictNullChecks, o TypeScript não
  // estreita uniões discriminadas por booleano em ternários com condição
  // implícita — só com comparação explícita (ver nota em reimpressao.ts).
  const texto =
    resultado.ok === true
      ? `✅ Pedido ${protocolo} reimpresso.` +
        (resultado.posicaoNaFila != null
          ? ` Posição na fila: ${resultado.posicaoNaFila}º.`
          : "")
      : `❌ ${MENSAGEM_POR_MOTIVO[resultado.motivo]}`;

  await enviarMensagemTelegram({ chatId: String(chatId), texto });
}

async function tratarGerarCodigo(chatId: number, argumento: string, adminId: number) {
  const protocolo = argumento.toUpperCase();
  if (!PROTOCOLO_RE.test(protocolo)) {
    await enviarMensagemTelegram({ chatId: String(chatId), texto: MENSAGEM_USO });
    return;
  }

  // Checagem prévia de elegibilidade, sem mutar nada: se não elegível, nenhum
  // token é criado (spec).
  const resolucao = await resolverPedidoPorProtocolo(protocolo);
  // === false (não negação): ver nota em reimpressao.ts sobre estreitamento
  // de uniões discriminadas por booleano sem strictNullChecks.
  if (resolucao.encontrado === false) {
    await enviarMensagemTelegram({
      chatId: String(chatId),
      texto: `❌ ${MENSAGEM_POR_MOTIVO.NAO_ENCONTRADO}`,
    });
    return;
  }
  const motivoRecusa = avaliarElegibilidade(resolucao.pedido);
  if (motivoRecusa) {
    await enviarMensagemTelegram({
      chatId: String(chatId),
      texto: `❌ ${MENSAGEM_POR_MOTIVO[motivoRecusa]}`,
    });
    return;
  }

  const codigo = await gerarCodigoReimpressao({
    pedidoId: resolucao.pedido.id,
    criadoPor: adminId,
  });
  if (!codigo) {
    await enviarMensagemTelegram({
      chatId: String(chatId),
      texto: `❌ ${MENSAGEM_POR_MOTIVO.ERRO_INTERNO}`,
    });
    return;
  }

  await enviarMensagemTelegram({
    chatId: String(chatId),
    texto:
      `🔑 Código de reimpressão: ${codigo}\n` +
      `Válido por ${JANELA_EXPIRACAO_HORAS}h, uso único. \n\n` + 
      `Cliente:\nClique no botão de "Ajuda", role a tela que abrir ` +
      `para baixo, clique em "Tenho um código de reimpressão" ` +
      `e preencha os campos corretamente. \n\n` + 
      `Protocolo: ${protocolo}\nCódigo: ${codigo}\n` + 
      `Após isso, a reimpressão deve ser feita.`,
  });
}

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    console.error("TELEGRAM_WEBHOOK_SECRET ausente");
    return Response.json({ error: "config" }, { status: 500 });
  }

  // Autenticidade primeiro, antes de sequer olhar o corpo do request.
  const recebido = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!recebido || !segredoConfere(recebido, secret)) {
    console.warn("[telegram-webhook] secret_token inválido ou ausente");
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }

  const update = (await req.json().catch(() => undefined)) as TelegramUpdate | undefined;
  const message = update?.message;
  const texto = message?.text;
  const fromId = message?.from?.id;
  const chatId = message?.chat?.id;

  // Update sem texto, remetente ou chat: nada a fazer, mas o Telegram exige
  // 200 para não reentregar.
  if (!texto || fromId == null || chatId == null) {
    return Response.json({ ok: true });
  }

  const comando = parseComando(texto);
  if (!comando || (comando.comando !== "reimprimir" && comando.comando !== "gerar_codigo")) {
    // Mensagens comuns do grupo não são comandos nossos — ignora em silêncio
    // (responder a toda mensagem do grupo seria spam).
    return Response.json({ ok: true });
  }

  // Autorização por allowlist de user IDs — nunca por "estar no grupo"
  // (design D3). Fora da allowlist: recusa silenciosa, sem mensagem no chat,
  // para não confirmar a um estranho que o comando existiria para um admin.
  const adminIds = parseAdminIds(process.env.TELEGRAM_ADMIN_IDS);
  if (!adminIds.has(fromId)) {
    console.warn("[telegram-webhook] from.id fora da allowlist:", fromId);
    return Response.json({ ok: true });
  }

  try {
    if (comando.comando === "reimprimir") {
      await tratarReimprimir(chatId, comando.argumento, fromId);
    } else {
      await tratarGerarCodigo(chatId, comando.argumento, fromId);
    }
  } catch (err) {
    console.error("Erro processando comando do telegram-webhook:", err);
  }

  // Sempre 200 para updates reconhecidos — evita reentrega do Telegram; a
  // ação em si é idempotente (guarda de estado + UPDATE condicional), então
  // uma eventual reentrega não duplica o efeito.
  return Response.json({ ok: true });
}
