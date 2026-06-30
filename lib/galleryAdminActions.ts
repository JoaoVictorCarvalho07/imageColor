"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyDeliveryPublished } from "@/lib/notifications";

export interface ActionState {
  error?: string;
  ok?: boolean;
}

export async function updateGalleryAction(
  galleryId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const title = String(formData.get("title") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");
  const accessExpiresAt = String(formData.get("accessExpiresAt") ?? "");
  const downloadDays = Number(formData.get("downloadDays") ?? 30);

  const selectionMode =
    String(formData.get("selectionMode") ?? "free") === "quota"
      ? "quota"
      : "free";
  const deliveryMode =
    String(formData.get("deliveryMode") ?? "edit") === "direct"
      ? "direct"
      : "edit";
  const limitRaw = String(formData.get("selectionLimit") ?? "").trim();
  const extraRaw = String(formData.get("extraPhoto") ?? "").trim();
  const selectionLimit =
    selectionMode === "quota" && limitRaw ? parseInt(limitRaw, 10) : null;
  const extraPhotoCents =
    selectionMode === "quota" && extraRaw
      ? Math.round((parseFloat(extraRaw.replace(",", ".")) || 0) * 100)
      : null;

  if (!title) return { error: "O título é obrigatório." };

  const { error } = await supabase
    .from("galleries")
    .update({
      title,
      status,
      access_expires_at: accessExpiresAt
        ? new Date(`${accessExpiresAt}T23:59:59`).toISOString()
        : null,
      download_expires_days: Number.isFinite(downloadDays) ? downloadDays : 30,
      selection_mode: selectionMode,
      selection_limit: selectionLimit,
      extra_photo_cents: extraPhotoCents,
      delivery_mode: deliveryMode,
    })
    .eq("id", galleryId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/ensaios/${galleryId}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function setPasswordAction(
  galleryId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const password = String(formData.get("password") ?? "").trim();
  if (password.length < 4) {
    return { error: "A senha deve ter ao menos 4 caracteres." };
  }
  const { error } = await supabase.rpc("set_gallery_password", {
    p_gallery_id: galleryId,
    p_password: password,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function setDeliveryPublishedAction(
  galleryId: string,
  published: boolean,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase
    .from("galleries")
    .update({ delivered_at: published ? new Date().toISOString() : null })
    .eq("id", galleryId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/ensaios/${galleryId}`);
  if (published) await notifyDeliveryPublished(galleryId);
  return { ok: true };
}

export interface PlanInput {
  mediaType: "photo" | "video";
  kind: "single" | "package" | "full";
  name: string;
  includedQty: number | null;
  priceCents: number;
  extraItemCents: number | null;
}

export async function savePlansAction(
  galleryId: string,
  plans: PlanInput[],
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  // Substitui o conjunto de planos da galeria (RLS garante a propriedade).
  const { error: delError } = await supabase
    .from("pricing_plans")
    .delete()
    .eq("gallery_id", galleryId);
  if (delError) return { error: delError.message };

  if (plans.length > 0) {
    const rows = plans.map((p) => ({
      gallery_id: galleryId,
      media_type: p.mediaType,
      kind: p.kind,
      name: p.name,
      included_qty: p.includedQty,
      price_cents: p.priceCents,
      extra_item_cents: p.extraItemCents,
    }));
    const { error } = await supabase.from("pricing_plans").insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath(`/admin/ensaios/${galleryId}`);
  return { ok: true };
}
