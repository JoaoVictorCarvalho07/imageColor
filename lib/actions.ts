"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { openGallerySession } from "@/lib/pb/gallery";
import { sessionCookieName } from "./access";

export interface LoginState {
  error?: string;
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  const session = await openGallerySession(token, password);
  if (!session) return { error: "Senha incorreta ou acesso expirado." };

  const jar = await cookies();
  jar.set(sessionCookieName(token), session, {
    httpOnly: true,
    sameSite: "lax",
    path: `/g/${token}`,
    maxAge: 60 * 60 * 12, // 12h
  });

  redirect(`/g/${token}/galeria`);
}
