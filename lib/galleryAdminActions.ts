"use server";

import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/pb/session";
import { superuserPb } from "@/lib/pb/superuser";
import { setGalleryPassword } from "@/lib/pb/gallery";
import { notifyDeliveryPublished } from "@/lib/notifications";

export interface ActionState {
  error?: string;
  ok?: boolean;
}

const SESSION_EXPIRED = { error: "Sessão expirada." } as const;

export async function updateGalleryAction(
  galleryId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await getAdminUser())) return SESSION_EXPIRED;

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

  try {
    const pb = await superuserPb();
    await pb.collection("galleries").update(galleryId, {
      title,
      status,
      // PocketBase limpa campo de data com string vazia, não com null.
      access_expires_at: accessExpiresAt
        ? new Date(`${accessExpiresAt}T23:59:59`).toISOString()
        : "",
      download_expires_days: Number.isFinite(downloadDays) ? downloadDays : 30,
      selection_mode: selectionMode,
      selection_limit: selectionLimit,
      extra_photo_cents: extraPhotoCents,
      delivery_mode: deliveryMode,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao salvar." };
  }

  revalidatePath(`/admin/ensaios/${galleryId}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function setPasswordAction(
  galleryId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // O original não checava sessão aqui — qualquer um podia trocar a senha
  // de um ensaio sabendo o id.
  if (!(await getAdminUser())) return SESSION_EXPIRED;

  const password = String(formData.get("password") ?? "").trim();
  if (password.length < 4) {
    return { error: "A senha deve ter ao menos 4 caracteres." };
  }
  return setGalleryPassword(galleryId, password);
}

export async function setDeliveryPublishedAction(
  galleryId: string,
  published: boolean,
): Promise<ActionState> {
  if (!(await getAdminUser())) return SESSION_EXPIRED;

  try {
    const pb = await superuserPb();
    await pb.collection("galleries").update(galleryId, {
      delivered_at: published ? new Date().toISOString() : "",
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao publicar." };
  }

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
  if (!(await getAdminUser())) return SESSION_EXPIRED;

  try {
    const pb = await superuserPb();

    // Substitui o conjunto inteiro de planos da galeria. `contracted_plan` nas
    // seleções não tem cascade, então uma seleção existente só perde a
    // referência ao pacote — as fotos escolhidas ficam intactas.
    const current = await pb.collection("pricing_plans").getFullList<{ id: string }>({
      filter: pb.filter("gallery = {:g}", { g: galleryId }),
    });
    await Promise.all(
      current.map((p) => pb.collection("pricing_plans").delete(p.id)),
    );

    for (const p of plans) {
      await pb.collection("pricing_plans").create({
        gallery: galleryId,
        media_type: p.mediaType,
        kind: p.kind,
        name: p.name,
        included_qty: p.includedQty,
        price_cents: p.priceCents,
        extra_item_cents: p.extraItemCents,
      });
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao salvar preços." };
  }

  revalidatePath(`/admin/ensaios/${galleryId}`);
  return { ok: true };
}
