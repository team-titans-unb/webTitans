import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin.js";
import { mpPayment } from "../_lib/mercadopago.js";
import { verificarAssinaturaMP } from "../_lib/mp-signature.js";

type MPWebhookBody = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("MERCADOPAGO_WEBHOOK_SECRET ausente");
    return res.status(500).json({ error: "config" });
  }

  const body = (req.body ?? {}) as MPWebhookBody;
  // O MP assina o manifest com o data.id da query string; caímos no body se faltar.
  const queryDataId = req.query?.["data.id"] ?? req.query?.id;
  const bodyDataId = body.data?.id != null ? String(body.data.id) : undefined;
  const dataId = String(
    (Array.isArray(queryDataId) ? queryDataId[0] : queryDataId) ?? bodyDataId ?? ""
  ).toLowerCase();
  if (!dataId) {
    return res.status(400).json({ error: "data.id ausente" });
  }

  const assinatura = verificarAssinaturaMP({
    headers: req.headers,
    dataId,
    secret,
  });
  if (!assinatura.ok) {
    console.warn("[webhook] assinatura rejeitada:", assinatura.reason);
    return res.status(401).json({ error: "assinatura inválida" });
  }

  if (body.type && body.type !== "payment") {
    return res.status(200).json({ ignored: true });
  }

  let pagamento;
  try {
    pagamento = await mpPayment.get({ id: dataId });
  } catch (err) {
    console.error("Falha ao buscar pagamento no MP:", err);
    return res.status(502).json({ error: "MP indisponível" });
  }

  const externalReference = pagamento.external_reference;
  const status = pagamento.status;

  if (!externalReference) {
    console.warn("Pagamento sem external_reference:", dataId);
    return res.status(200).json({ ignored: true });
  }

  if (status === "approved") {
    const { error } = await supabaseAdmin
      .from("fila_impressao")
      .update({ status: "PAGO", paid_at: new Date().toISOString() })
      .eq("id", externalReference)
      .eq("status", "AGUARDANDO_PAGAMENTO");
    if (error) {
      console.error("Erro UPDATE PAGO:", error);
      return res.status(500).json({ error: "db" });
    }
    return res.status(200).json({ ok: true });
  }

  if (status === "cancelled" || status === "rejected") {
    const { error } = await supabaseAdmin
      .from("fila_impressao")
      .update({ status: "CANCELADO" })
      .eq("id", externalReference)
      .eq("status", "AGUARDANDO_PAGAMENTO");
    if (error) {
      console.error("Erro UPDATE CANCELADO:", error);
      return res.status(500).json({ error: "db" });
    }
    return res.status(200).json({ ok: true });
  }

  // pending, in_process, etc → no-op, ainda esperando confirmação.
  return res.status(200).json({ ignored: true, status });
}
