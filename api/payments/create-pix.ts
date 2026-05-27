import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_lib/supabase-admin.js";
import { mpPayment } from "../_lib/mercadopago.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body as { pedidoId?: unknown } | undefined;
  const pedidoId = body?.pedidoId;
  if (typeof pedidoId !== "string" || pedidoId.length === 0) {
    return res.status(400).json({ error: "pedidoId obrigatório" });
  }

  const { data: pedido, error: pedidoError } = await supabaseAdmin
    .from("fila_impressao")
    .select("id, status, valor_centavos, num_paginas, modo_cor")
    .eq("id", pedidoId)
    .maybeSingle();

  if (pedidoError) {
    console.error("Erro buscando pedido:", pedidoError);
    return res.status(500).json({ error: "Erro interno" });
  }
  if (!pedido) {
    return res.status(404).json({ error: "Pedido não encontrado" });
  }
  if (pedido.status !== "AGUARDANDO_PAGAMENTO") {
    return res.status(409).json({ error: "Pedido não está aguardando pagamento" });
  }

  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const protocol = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const notificationUrl = `${protocol}://${host}/api/webhooks/mercadopago`;

  try {
    const result = await mpPayment.create({
      body: {
        transaction_amount: pedido.valor_centavos / 100,
        description: `Impressão TITANS — ${pedido.num_paginas} págs ${pedido.modo_cor}`,
        payment_method_id: "pix",
        payer: {
          email: "cliente@titans.unb.br",
          first_name: "Cliente",
        },
        external_reference: pedido.id,
        notification_url: notificationUrl,
      },
      requestOptions: { idempotencyKey: pedido.id },
    });

    const transactionData = result.point_of_interaction?.transaction_data;
    const qrCodeBase64 = transactionData?.qr_code_base64;
    const qrCodeCopiaCola = transactionData?.qr_code;
    const expiration = result.date_of_expiration;
    const mpPaymentId = result.id ? String(result.id) : null;

    if (!qrCodeBase64 || !qrCodeCopiaCola || !mpPaymentId) {
      console.error("Resposta do MP sem dados de PIX:", result);
      return res.status(502).json({ error: "Mercado Pago não devolveu dados de PIX" });
    }

    const { error: updateError } = await supabaseAdmin
      .from("fila_impressao")
      .update({ mp_payment_id: mpPaymentId })
      .eq("id", pedido.id);

    if (updateError) {
      console.error("Erro atualizando mp_payment_id:", updateError);
    }

    return res.status(200).json({
      qr_code_base64: qrCodeBase64,
      qr_code_copia_cola: qrCodeCopiaCola,
      expiration_date_to: expiration,
      mp_payment_id: mpPaymentId,
    });
  } catch (err) {
    console.error("Erro chamando Mercado Pago:", err);
    return res.status(502).json({ error: "Falha ao gerar PIX" });
  }
}
