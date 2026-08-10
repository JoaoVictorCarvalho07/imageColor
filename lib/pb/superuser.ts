import PocketBase from "pocketbase";

/**
 * Cliente PocketBase autenticado como superuser — IGNORA as regras de acesso.
 * Use APENAS no servidor. Nunca importe em código de cliente.
 *
 * Ocupa o lugar que o `service_role` + funções `SECURITY DEFINER` ocupavam no
 * Supabase: as coleções são todas fechadas, e o gating (senha da galeria,
 * validade da sessão, dono do ensaio) é feito aqui no código do servidor.
 */

let cached: PocketBase | null = null;
let inFlight: Promise<PocketBase> | null = null;

async function authenticate(): Promise<PocketBase> {
  const url = process.env.POCKETBASE_URL;
  const email = process.env.POCKETBASE_ADMIN_EMAIL;
  const password = process.env.POCKETBASE_ADMIN_PASSWORD;

  if (!url || !email || !password) {
    throw new Error(
      "PocketBase não configurado: faltam POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL ou POCKETBASE_ADMIN_PASSWORD.",
    );
  }

  const pb = new PocketBase(url);
  // Em ambiente serverless a instância é compartilhada entre requisições;
  // o auto-cancel do SDK abortaria chamadas concorrentes umas das outras.
  pb.autoCancellation(false);

  await pb.collection("_superusers").authWithPassword(email, password);
  cached = pb;
  return pb;
}

/** Instância superuser, reaproveitada enquanto o token for válido. */
export async function superuserPb(): Promise<PocketBase> {
  if (cached?.authStore.isValid) return cached;
  // evita que N requisições simultâneas disparem N autenticações
  inFlight ??= authenticate().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
