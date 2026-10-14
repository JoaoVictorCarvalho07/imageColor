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

function allowedEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export interface VerifiedAdminToken {
  user: AdminUser;
  token: string;
}

export async function verifyAdminToken(
  token: string,
): Promise<VerifiedAdminToken | null> {
  if (!token) return null;

  try {
    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
    pb.autoCancellation(false);
    pb.authStore.save(token, null);

    const { record, token: refreshed } = await pb
      .collection("users")
      .authRefresh();

    if (record?.verified !== true) return null;

    const email = String(record.email ?? "").toLowerCase();
    if (!email) return null;
    if (!allowedEmails().includes(email)) return null;

    return {
      user: {
        id: String(record.id),
        email,
        name: record.name ? String(record.name) : undefined,
      },
      token: refreshed || token,
    };
  } catch {
    return null;
  }
}

export async function getAdminUser(): Promise<AdminUser | null> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_COOKIE)?.value;
  if (!raw) return null;

  let token: unknown;
  try {
    token = JSON.parse(decodeURIComponent(raw))?.token;
  } catch {
    return null;
  }
  if (typeof token !== "string" || !token) return null;

  return (await verifyAdminToken(token))?.user ?? null;
}

export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
