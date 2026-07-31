import { supabaseAdmin } from "./supabase-admin";
import { intervaloDoProtocolo } from "@/lib/protocolo";

export type PedidoParaReimpressao = {
  id: string;
  status: string;
  pdfPath: string | null;
  paidAt: string | null;
};

export type ResolucaoPedido =
  | { encontrado: true; pedido: PedidoParaReimpressao }
  | { encontrado: false; erroConsulta: boolean };

// Resolve um protocolo (8 hex) para os campos mínimos necessários à guarda de
// estado e ao re-enfileiramento de reimpressão. Só os campos aqui
// selecionados saem desta função — o UUID completo nunca chega ao chamador
// do núcleo de reimpressão (ele só circula internamente, entre módulos
// server-side, para montar as próprias queries).
export async function resolverPedidoPorProtocolo(
  protocolo: string
): Promise<ResolucaoPedido> {
  const { de, ate } = intervaloDoProtocolo(protocolo);

  // Colisão de prefixo (improvável): resolve pelo pedido mais recente, mesmo
  // critério de /api/kiosk/pedido.
  const { data, error } = await supabaseAdmin
    .from("fila_impressao")
    .select("id, status, pdf_path, paid_at")
    .gte("id", de)
    .lte("id", ate)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro resolvendo pedido por protocolo:", error);
    return { encontrado: false, erroConsulta: true };
  }
  if (!data) {
    return { encontrado: false, erroConsulta: false };
  }
  return {
    encontrado: true,
    pedido: {
      id: data.id,
      status: data.status,
      pdfPath: data.pdf_path,
      paidAt: data.paid_at,
    },
  };
}
