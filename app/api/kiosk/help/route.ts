import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { enviarMensagemTelegram } from "@/lib/server/telegram";
import { PROTOCOLO_RE } from "@/lib/protocolo";

// Registro de chamados de ajuda do kiosk. Server-side (service_role): a tabela
// chamados_ajuda não tem policy anon, e o segredo do webhook fica no servidor.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIAS = ["NAO_SAIU", "SAIU_COM_DEFEITO", "OUTRO"] as const;
type Categoria = (typeof CATEGORIAS)[number];

const RATE_LIMIT_MS = 5 * 60 * 1000; // chamado idêntico dentro de 5 min é rejeitado

const DESCRICAO_CATEGORIA: Record<Categoria, string> = {
  NAO_SAIU: "Impressão não saiu",
  SAIU_COM_DEFEITO: "Impressão saiu com defeito",
  OUTRO: "Outro problema",
};

// Best-effort: falha na notificação nunca impede a persistência do chamado
// nem retorna erro ao cliente.
async function notificarEquipe(protocolo: string | null, categoria: Categoria) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;
  const quando = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const texto =
    `🖨️ Chamado de ajuda no totem\n` +
    `Categoria: ${DESCRICAO_CATEGORIA[categoria]}\n` +
    `Protocolo: ${protocolo ?? "(não informado)"}\n` +
    `Horário: ${quando}`;
  await enviarMensagemTelegram({ chatId, texto });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => undefined)) as
    | { protocolo?: unknown; categoria?: unknown }
    | undefined;

  const categoria = body?.categoria;
  if (typeof categoria !== "string" || !CATEGORIAS.includes(categoria as Categoria)) {
    return Response.json({ error: "categoria inválida" }, { status: 400 });
  }

  let protocolo: string | null = null;
  if (body?.protocolo != null && body.protocolo !== "") {
    if (typeof body.protocolo !== "string" || !PROTOCOLO_RE.test(body.protocolo)) {
      return Response.json(
        { error: "protocolo inválido — 8 caracteres hexadecimais" },
        { status: 400 }
      );
    }
    protocolo = body.protocolo.toUpperCase();
  }

  // Rate-limit contra toques repetidos: chamado com mesmo protocolo e
  // categoria dentro da janela é rejeitado (o kiosk apresenta como "a equipe
  // já foi avisada").
  const desde = new Date(Date.now() - RATE_LIMIT_MS).toISOString();
  let recentes = supabaseAdmin
    .from("chamados_ajuda")
    .select("id", { count: "exact", head: true })
    .eq("categoria", categoria)
    .gte("criado_em", desde);
  recentes =
    protocolo === null ? recentes.is("protocolo", null) : recentes.eq("protocolo", protocolo);

  const { count, error: rateError } = await recentes;
  if (rateError) {
    console.error("Erro no rate-limit de chamados:", rateError);
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
  if ((count ?? 0) > 0) {
    return Response.json(
      { error: "A equipe já foi avisada há pouco" },
      { status: 429 }
    );
  }

  const { error: insertError } = await supabaseAdmin
    .from("chamados_ajuda")
    .insert({ protocolo, categoria });
  if (insertError) {
    console.error("Erro registrando chamado:", insertError);
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }

  await notificarEquipe(protocolo, categoria as Categoria);

  return Response.json({ ok: true }, { status: 201 });
}
