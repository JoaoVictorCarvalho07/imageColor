"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const { data: session, error } = await supabase.rpc("open_gallery_session", {
    p_token: token,
    p_password: password,
  });

  if (error) return { error: "Não foi possível validar. Tente novamente." };
  if (!session) return { error: "Senha incorreta ou acesso expirado." };

  const jar = await cookies();
  jar.set(sessionCookieName(token), session as string, {
    httpOnly: true,
    sameSite: "lax",
    path: `/g/${token}`,
    maxAge: 60 * 60 * 12, // 12h
  });

  redirect(`/g/${token}/galeria`);
}
