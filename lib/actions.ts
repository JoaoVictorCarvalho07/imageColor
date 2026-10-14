"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { openGallerySession } from "@/lib/pb/gallery";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/pb/session";
import {
  attemptKey,
  isBlocked,
  registerFailure,
  resetAttempts,
} from "@/lib/pb/rateLimit";
import { sessionCookieName } from "./access";

export interface LoginState {
  error?: string;
}

const ADMIN_FALLBACK_MAX_AGE = 60 * 60 * 24 * 7;

function tokenMaxAge(token: string): number {
  try {
    const part = token.split(".")[1] ?? "";
    const payload = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    const seconds = Math.floor(payload.exp - Date.now() / 1000);
    return seconds > 0 ? seconds : ADMIN_FALLBACK_MAX_AGE;
  } catch {
    return ADMIN_FALLBACK_MAX_AGE;
  }
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  const key = await attemptKey(token);
  if (await isBlocked(key)) {
    return { error: "Muitas tentativas. Tente novamente em alguns minutos." };
  }

  const session = await openGallerySession(token, password);
  if (!session) {
    await registerFailure(key);
    return { error: "Senha incorreta ou acesso expirado." };
  }

  await resetAttempts(key);

  const jar = await cookies();
  jar.set(sessionCookieName(token), session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/g/${token}`,
    maxAge: 60 * 60 * 12,
  });

  redirect(`/g/${token}/galeria`);
}

export async function createAdminSession(
  pbToken: string,
): Promise<{ ok: boolean }> {
  const verified = await verifyAdminToken(String(pbToken ?? ""));
  if (!verified) return { ok: false };

  const jar = await cookies();
  jar.set(
    ADMIN_COOKIE,
    JSON.stringify({ token: verified.token }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: tokenMaxAge(verified.token),
    },
  );
  return { ok: true };
}

export async function clearAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
