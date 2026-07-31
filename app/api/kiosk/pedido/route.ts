import { supabaseAdmin } from "@/lib/server/supabase-admin";
import { contarPosicaoNaFila } from "@/lib/server/fila";
import { PROTOCOLO_RE, intervaloDoProtocolo } from "@/lib/protocolo";

// Consulta de pedido por protocolo para o kiosk. Server-side (service_role)
// para nunca expor o UUID completo — ele funciona como token de leitura do
// pedido — nem permitir varredura de índice pelo anon.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const protocolo = new URL(req.url).searchParams.get("protocolo");
  if (!protocolo || !PROTOCOLO_RE.test(protocolo)) {
    return Response.json(
      { error: "protocolo inválido — 8 caracteres hexadecimais" },
      { status: 400 }
    );
  }

  const { de, ate } = intervaloDoProtocolo(protocolo);

  // Colisão de prefixo (improvável): resolve pelo pedido mais recente.
  const { data: pedido, error } = await supabaseAdmin
    .from("fila_impressao")
    .select("status, paid_at, printed_at, created_at")
    .gte("id", de)
    .lte("id", ate)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro buscando pedido por protocolo:", error);
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
  if (!pedido) {
    return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const posicaoNaFila =
    pedido.status === "PAGO" ? await contarPosicaoNaFila(pedido.paid_at) : null;

  return Response.json({
    status: pedido.status,
    paid_at: pedido.paid_at,
    printed_at: pedido.printed_at,
    posicao_na_fila: posicaoNaFila,
  });
}
