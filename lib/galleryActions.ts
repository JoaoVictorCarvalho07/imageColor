"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CreateGalleryState {
  error?: string;
}

export async function createGalleryAction(
  _prev: CreateGalleryState,
  formData: FormData,
): Promise<CreateGalleryState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const title = String(formData.get("title") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const accessDays = Number(formData.get("accessDays") ?? 15);

  if (!title) return { error: "Informe o título do ensaio." };
  if (password && password.length < 4) {
    return { error: "A senha deve ter ao menos 4 caracteres." };
  }

  const { error } = await supabase.rpc("create_gallery", {
    p_title: title,
    p_client_name: clientName || null,
    p_password: password || "",
    p_access_days: Number.isFinite(accessDays) ? accessDays : 15,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  redirect("/admin");
}
