// Edge Function: cleanup-fila
// Limpeza periódica da fila de impressão (retenção). Acionada de hora em hora
// pelo pg_cron via net.http_post (ver migration 0003), autenticada por um
// segredo compartilhado (CLEANUP_FUNCTION_SECRET).
//
// Três regras (nunca toca em PAGO não impresso):
//   1. AGUARDANDO_PAGAMENTO há mais de 1h  -> remove PDF + apaga linha.
//   2. IMPRESSO com printed_at > 7 dias    -> remove PDF, anula pdf_path.
//   3. IMPRESSO com printed_at > 6 meses   -> apaga a linha (PDF já saiu em 2).
//
// Deploy:  supabase functions deploy cleanup-fila
// Secret:  supabase secrets set CLEANUP_FUNCTION_SECRET=<valor-aleatorio-longo>

import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "pdfs-impressao";

// Comparação em tempo constante para o segredo (evita timing attacks).
function segredoConfere(recebido: string, esperado: string): boolean {
  if (recebido.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < recebido.length; i++) {
    diff |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  const segredo = Deno.env.get("CLEANUP_FUNCTION_SECRET");
  if (!segredo) {
    console.error("CLEANUP_FUNCTION_SECRET não configurado");
    return new Response(JSON.stringify({ error: "Função mal configurada" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Authorization: Bearer <segredo>
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !segredoConfere(token, segredo)) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const agora = Date.now();
  const umaHoraAtras = new Date(agora - 60 * 60 * 1000).toISOString();
  const seteDiasAtras = new Date(agora - 7 * 24 * 60 * 60 * 1000).toISOString();
  const seisMesesAtras = new Date(agora);
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
  const seisMesesAtrasIso = seisMesesAtras.toISOString();

  const resumo = { orfaos_removidos: 0, pdfs_impressos_removidos: 0, impressos_apagados: 0 };

  try {
    // ---- Regra 1: órfãos AGUARDANDO_PAGAMENTO há mais de 1h ----------------
    const { data: orfaos, error: errOrfaos } = await supabase
      .from("fila_impressao")
      .select("id, pdf_path")
      .eq("status", "AGUARDANDO_PAGAMENTO")
      .lt("created_at", umaHoraAtras);
    if (errOrfaos) throw errOrfaos;

    if (orfaos && orfaos.length > 0) {
      const paths = orfaos.map((o) => o.pdf_path).filter(Boolean) as string[];
      if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
      const { error } = await supabase
        .from("fila_impressao")
        .delete()
        .in("id", orfaos.map((o) => o.id));
      if (error) throw error;
      resumo.orfaos_removidos = orfaos.length;
    }

    // ---- Regra 2: IMPRESSO há mais de 7 dias -> remove o PDF ---------------
    const { data: impressos, error: errImpressos } = await supabase
      .from("fila_impressao")
      .select("id, pdf_path")
      .eq("status", "IMPRESSO")
      .lt("printed_at", seteDiasAtras)
      .not("pdf_path", "is", null);
    if (errImpressos) throw errImpressos;

    if (impressos && impressos.length > 0) {
      const paths = impressos.map((o) => o.pdf_path).filter(Boolean) as string[];
      if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
      const { error } = await supabase
        .from("fila_impressao")
        .update({ pdf_path: null })
        .in("id", impressos.map((o) => o.id));
      if (error) throw error;
      resumo.pdfs_impressos_removidos = impressos.length;
    }

    // ---- Regra 3: IMPRESSO há mais de 6 meses -> apaga a linha -------------
    // Nesse ponto o pdf_path já é nulo (removido na regra 2); só resta a linha.
    const { data: antigos, error: errAntigos } = await supabase
      .from("fila_impressao")
      .select("id")
      .eq("status", "IMPRESSO")
      .lt("printed_at", seisMesesAtrasIso);
    if (errAntigos) throw errAntigos;

    if (antigos && antigos.length > 0) {
      const { error } = await supabase
        .from("fila_impressao")
        .delete()
        .in("id", antigos.map((o) => o.id));
      if (error) throw error;
      resumo.impressos_apagados = antigos.length;
    }

    console.log("cleanup-fila ok:", resumo);
    return new Response(JSON.stringify(resumo), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cleanup-fila falhou:", err);
    return new Response(JSON.stringify({ error: "Falha na limpeza" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
