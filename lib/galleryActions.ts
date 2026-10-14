"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/pb/session";
import { createGallery, MIN_PASSWORD } from "@/lib/pb/gallery";

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
  const accessDays = Math.trunc(Number(formData.get("accessDays") || 15));

  if (!title) return { error: "Informe o título do ensaio." };
  if (password.length < MIN_PASSWORD) {
    return { error: `A senha deve ter ao menos ${MIN_PASSWORD} caracteres.` };
  }
  if (!Number.isFinite(accessDays) || accessDays < 1 || accessDays > 365) {
    return { error: "Os dias de acesso devem ficar entre 1 e 365." };
  }

  const res = await createGallery({
    title,
    clientName,
    clientEmail,
    password,
    accessDays,
  });

  if (res.error) return { error: res.error };

  revalidatePath("/admin");
  redirect("/admin");
}
