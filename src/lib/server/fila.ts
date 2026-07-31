import { supabaseAdmin } from "./supabase-admin";

// Posição na fila (1-based, FIFO por paid_at — mesmo critério do worker):
// quantos pedidos ativos foram pagos até este, inclusive ele. Compartilhado
// entre a consulta do kiosk e o núcleo de reimpressão para nunca duplicar o
// critério de ordenação da fila.
export async function contarPosicaoNaFila(paidAt: string | null): Promise<number | null> {
  if (!paidAt) return null;

  const { count, error } = await supabaseAdmin
    .from("fila_impressao")
    .select("id", { count: "exact", head: true })
    .in("status", ["PAGO", "IMPRIMINDO"])
    .lte("paid_at", paidAt);

  if (error) {
    console.error("Erro contando posição na fila:", error);
    return null;
  }
  return count;
}
