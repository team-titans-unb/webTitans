import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { mpPayment } from "@/lib/server/mercadopago";
import { verificarAssinaturaMP } from "@/lib/server/mp-signature";

// node:crypto (assinatura), mercadopago e supabase-js exigem o runtime Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MPWebhookBody = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

export async function POST(req: Request) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("MERCADOPAGO_WEBHOOK_SECRET ausente");
    return Response.json({ error: "config" }, { status: 500 });
  }

  const body = ((await req.json().catch(() => ({}))) ?? {}) as MPWebhookBody;
  // O MP assina o manifest com o data.id da query string; caímos no body se faltar.
  const searchParams = new URL(req.url).searchParams;
  const queryDataId = searchParams.get("data.id") ?? searchParams.get("id");
  const bodyDataId = body.data?.id != null ? String(body.data.id) : undefined;
  const dataId = String(queryDataId ?? bodyDataId ?? "").toLowerCase();
  if (!dataId) {
    return Response.json({ error: "data.id ausente" }, { status: 400 });
  }

  // A lib mp-signature espera um Record<string, string | string[]>; o Headers
  // do Next vira esse formato com Object.fromEntries (mantém a lib verbatim).
  // O manifest usa apenas data.id, x-request-id e ts — não depende do corpo
  // cru, então await req.json() acima é seguro.
  const assinatura = verificarAssinaturaMP({
    headers: Object.fromEntries(req.headers),
    dataId,
    secret,
  });
  if (!assinatura.ok) {
    console.warn("[webhook] assinatura rejeitada:", assinatura.reason);
    return Response.json({ error: "assinatura inválida" }, { status: 401 });
  }

  if (body.type && body.type !== "payment") {
    return Response.json({ ignored: true });
  }

  let pagamento;
  try {
    pagamento = await mpPayment.get({ id: dataId });
  } catch (err) {
    console.error("Falha ao buscar pagamento no MP:", err);
    return Response.json({ error: "MP indisponível" }, { status: 502 });
  }

  const externalReference = pagamento.external_reference;
  const status = pagamento.status;

  if (!externalReference) {
    console.warn("Pagamento sem external_reference:", dataId);
    return Response.json({ ignored: true });
  }

  if (status === "approved") {
    const { error } = await supabaseAdmin
      .from("fila_impressao")
      .update({ status: "PAGO", paid_at: new Date().toISOString() })
      .eq("id", externalReference)
      .eq("status", "AGUARDANDO_PAGAMENTO");
    if (error) {
      console.error("Erro UPDATE PAGO:", error);
      return Response.json({ error: "db" }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  if (status === "cancelled" || status === "rejected") {
    const { error } = await supabaseAdmin
      .from("fila_impressao")
      .update({ status: "CANCELADO" })
      .eq("id", externalReference)
      .eq("status", "AGUARDANDO_PAGAMENTO");
    if (error) {
      console.error("Erro UPDATE CANCELADO:", error);
      return Response.json({ error: "db" }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  // pending, in_process, etc → no-op, ainda esperando confirmação.
  return Response.json({ ignored: true, status });
}
