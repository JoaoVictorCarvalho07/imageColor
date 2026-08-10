"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/pb/session";
import { createGallery } from "@/lib/pb/gallery";

export interface CreateGalleryState {
  error?: string;
}

export async function createGalleryAction(
  _prev: CreateGalleryState,
  formData: FormData,
): Promise<CreateGalleryState> {
  if (!(await getAdminUser())) {
    return { error: "Sessão expirada. Entre novamente." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim();
  const clientEmail = String(formData.get("clientEmail") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const accessDays = Number(formData.get("accessDays") ?? 15);

  if (!title) return { error: "Informe o título do ensaio." };
  if (password && password.length < 4) {
    return { error: "A senha deve ter ao menos 4 caracteres." };
  }

  const res = await createGallery({
    title,
    clientName,
    clientEmail,
    password,
    accessDays: Number.isFinite(accessDays) ? accessDays : 15,
  });

  if (res.error) return { error: res.error };

  revalidatePath("/admin");
  redirect("/admin");
}
