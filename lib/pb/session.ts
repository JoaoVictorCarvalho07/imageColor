import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PocketBase from "pocketbase";

export const ADMIN_COOKIE = "pb_admin";

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
}

/**
 * E-mails autorizados a entrar no /admin.
 *
 * O login é Google OAuth e o PocketBase cria um registro para QUALQUER conta
 * Google que complete o fluxo. A allowlist é o que impede uma conta qualquer
 * de virar admin — a existência do registro não basta. Sem a env definida,
 * ninguém entra (fail-closed).
 */
function allowedEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Verifica de verdade a sessão da fotógrafa: valida o token CONTRA o
 * PocketBase (assinatura + expiração) e confere a allowlist.
 *
 * É esta função — não o middleware — que autoriza acesso aos dados. Chame no
 * layout protegido e no início de toda server action / route handler do admin.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_COOKIE)?.value;
  if (!raw) return null;

  let token: string;
  try {
    token = JSON.parse(decodeURIComponent(raw))?.token;
    if (typeof token !== "string" || !token) return null;
  } catch {
    return null;
  }

  try {
    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
    pb.autoCancellation(false);
    pb.authStore.save(token, null);

    // Bate no servidor: se a assinatura for forjada ou o token revogado, falha.
    const { record } = await pb.collection("users").authRefresh();

    const email = String(record?.email ?? "").toLowerCase();
    if (!email) return null;

    const allow = allowedEmails();
    if (!allow.includes(email)) return null;

    return {
      id: String(record.id),
      email,
      name: record.name ? String(record.name) : undefined,
    };
  } catch {
    return null;
  }
}

/** Igual a `getAdminUser`, mas redireciona para o login em vez de devolver null. */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
