import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Inicialização preguiçosa: o `next build` importa este módulo ao coletar os
// dados das rotas, mas as envs só existem em runtime. Validar/instanciar no
// primeiro uso (request) evita quebrar o build quando SUPABASE_* faltam no CI.
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidas nas envs da Vercel"
    );
  }

  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

// Proxy mantém a API `supabaseAdmin.from(...)` / `supabaseAdmin.storage` sem
// instanciar o client até o primeiro acesso.
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const c = getClient();
    const value = Reflect.get(c, prop, receiver);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
