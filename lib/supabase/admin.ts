import { createClient } from "@supabase/supabase-js";

/**
 * Client com a chave service_role — IGNORA o RLS. Use APENAS no servidor
 * (ex.: gerar URLs assinadas da entrega). Nunca importe em código de cliente.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
