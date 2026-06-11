import { PDFDocument } from "pdf-lib";
import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { mpPayment } from "@/lib/server/mercadopago";

// Usa node:crypto (mercadopago), pdf-lib e @supabase/supabase-js — incompatíveis
// com o runtime Edge. force-dynamic: a rota depende do request, nunca é cacheada.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "pdfs-impressao";

const PIX_VALIDADE_MS = 30 * 60 * 1000; // 30 minutos

// O Mercado Pago exige date_of_expiration em ISO com offset de fuso explícito
// (ex.: 2026-06-02T15:04:05.000-03:00); o "Z" do toISOString() é recusado.
// O servidor roda em UTC, então montamos a representação no fuso de Brasília
// (-03:00, sem horário de verão) a partir do instante desejado.
function isoComOffsetBrasilia(date: Date): string {
  const offsetMin = -180; // -03:00
  const local = new Date(date.getTime() + offsetMin * 60 * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const yyyy = local.getUTCFullYear();
  const MM = p(local.getUTCMonth() + 1);
  const dd = p(local.getUTCDate());
  const HH = p(local.getUTCHours());
  const mm = p(local.getUTCMinutes());
  const ss = p(local.getUTCSeconds());
  const ms = p(local.getUTCMilliseconds(), 3);
  return `${yyyy}-${MM}-${dd}T${HH}:${mm}:${ss}.${ms}-03:00`;
}

// A notification_url tem como fonte de verdade PUBLIC_BASE_URL (o domínio
// canônico de produção), evitando que um deploy de preview efêmero registre
// uma URL que o Mercado Pago não conseguiria reconfirmar. Em dev/Docker local,
// onde a env não está definida, cai nos headers x-forwarded-*.
function resolverNotificationUrl(req: Request): string {
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (base) {
    return `${base}/api/webhooks/mercadopago`;
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const protocol = req.headers.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}/api/webhooks/mercadopago`;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => undefined)) as
    | { pedidoId?: unknown }
    | undefined;
  const pedidoId = body?.pedidoId;
  if (typeof pedidoId !== "string" || pedidoId.length === 0) {
    return Response.json({ error: "pedidoId obrigatório" }, { status: 400 });
  }

  const { data: pedido, error: pedidoError } = await supabaseAdmin
    .from("fila_impressao")
    .select("id, status, pdf_path, modo_cor, quantidade_copias")
    .eq("id", pedidoId)
    .maybeSingle();

  if (pedidoError) {
    console.error("Erro buscando pedido:", pedidoError);
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
  if (!pedido) {
    return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
  if (pedido.status !== "AGUARDANDO_PAGAMENTO") {
    return Response.json(
      { error: "Pedido não está aguardando pagamento" },
      { status: 409 }
    );
  }

  // ----------------------------------------------------------------------
  // Autoridade do servidor: contar páginas e calcular o preço a partir do
  // PDF real e de config_precos. O que o cliente declarou é ignorado.
  // ----------------------------------------------------------------------
  const { data: pdfBlob, error: downloadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .download(pedido.pdf_path);

  if (downloadError || !pdfBlob) {
    console.error("Erro baixando PDF do pedido:", pedido.id, downloadError);
    return Response.json(
      { error: "Não foi possível acessar o arquivo do pedido" },
      { status: 502 }
    );
  }

  let paginasReais: number;
  try {
    const bytes = new Uint8Array(await pdfBlob.arrayBuffer());
    // Sem ignoreEncryption: PDFs criptografados lançam e são rejeitados (422).
    const doc = await PDFDocument.load(bytes);
    paginasReais = doc.getPageCount();
  } catch (err) {
    console.error("PDF inválido/ilegível no pedido:", pedido.id, err);
    return Response.json(
      { error: "Arquivo PDF inválido, criptografado ou ilegível" },
      { status: 422 }
    );
  }

  if (!Number.isInteger(paginasReais) || paginasReais < 1) {
    return Response.json({ error: "PDF sem páginas válidas" }, { status: 422 });
  }

  const { data: preco, error: precoError } = await supabaseAdmin
    .from("config_precos")
    .select("valor_centavos_por_pagina")
    .eq("modo_cor", pedido.modo_cor)
    .maybeSingle();

  if (precoError || !preco) {
    console.error("Erro buscando preço para modo_cor:", pedido.modo_cor, precoError);
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }

  // A quantidade vem da própria linha (autoridade do servidor), nunca do request.
  // Linhas legadas sem o campo caem no piso 1.
  const quantidadeCopias =
    Number.isInteger(pedido.quantidade_copias) && pedido.quantidade_copias >= 1
      ? pedido.quantidade_copias
      : 1;

  const valorCentavos = paginasReais * quantidadeCopias * preco.valor_centavos_por_pagina;

  const notificationUrl = resolverNotificationUrl(req);

  try {
    const result = await mpPayment.create({
      body: {
        transaction_amount: valorCentavos / 100,
        description: `Impressão TITANS — ${paginasReais} págs x ${quantidadeCopias} cópias ${pedido.modo_cor}`,
        payment_method_id: "pix",
        payer: {
          email: "cliente@titans.unb.br",
          first_name: "Cliente",
        },
        external_reference: pedido.id,
        notification_url: notificationUrl,
        date_of_expiration: isoComOffsetBrasilia(new Date(Date.now() + PIX_VALIDADE_MS)),
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
      return Response.json(
        { error: "Mercado Pago não devolveu dados de PIX" },
        { status: 502 }
      );
    }

    // Grava o valor e a contagem autoritativos (do servidor) junto do mp_payment_id.
    const { error: updateError } = await supabaseAdmin
      .from("fila_impressao")
      .update({
        mp_payment_id: mpPaymentId,
        num_paginas: paginasReais,
        valor_centavos: valorCentavos,
      })
      .eq("id", pedido.id);

    if (updateError) {
      console.error("Erro atualizando pedido pós-cobrança:", updateError);
    }

    return Response.json({
      qr_code_base64: qrCodeBase64,
      qr_code_copia_cola: qrCodeCopiaCola,
      expiration_date_to: expiration,
      mp_payment_id: mpPaymentId,
      valor_centavos: valorCentavos,
      num_paginas: paginasReais,
    });
  } catch (err) {
    console.error("Erro chamando Mercado Pago:", err);
    return Response.json({ error: "Falha ao gerar PIX" }, { status: 502 });
  }
}
