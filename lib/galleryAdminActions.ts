"use server";

import { revalidatePath } from "next/cache";
import { getAdminUser } from "@/lib/pb/session";
import { superuserPb } from "@/lib/pb/superuser";
import { MIN_PASSWORD, setGalleryPassword } from "@/lib/pb/gallery";
import { markSelectionPaid, reopenSelection } from "@/lib/pb/orders";
import { parseBRLToCents } from "@/lib/format";
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
    selectionMode === "quota" && extraRaw ? parseBRLToCents(extraRaw) : null;

  if (!title) return { error: "O título é obrigatório." };
  if (selectionMode === "quota" && (selectionLimit === null || !(selectionLimit >= 0))) {
    return { error: "Informe quantas fotos estão inclusas na cota." };
  }

  try {
    const pb = await superuserPb();
    await pb.collection("galleries").update(galleryId, {
      title,
      status,
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
  if (!(await getAdminUser())) return SESSION_EXPIRED;

  const password = String(formData.get("password") ?? "").trim();
  if (password.length < MIN_PASSWORD) {
    return { error: `A senha deve ter ao menos ${MIN_PASSWORD} caracteres.` };
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
  id: string | null;
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
): Promise<ActionState & { ids?: string[] }> {
  if (!(await getAdminUser())) return SESSION_EXPIRED;

  const invalid = plans.find(
    (p) =>
      p.priceCents < 0 ||
      (p.kind === "package" && !(p.includedQty && p.includedQty > 0)),
  );
  if (invalid) {
    return { error: `Revise o plano "${invalid.name}": pacote precisa de quantidade inclusa.` };
  }

  try {
    const pb = await superuserPb();
    const current = await pb.collection("pricing_plans").getFullList<{ id: string }>({
      filter: pb.filter("gallery = {:g}", { g: galleryId }),
      fields: "id",
    });
    const currentIds = new Set(current.map((p) => p.id));
    const keep: string[] = [];

    for (const p of plans) {
      const data = {
        gallery: galleryId,
        media_type: p.mediaType,
        kind: p.kind,
        name: p.name,
        included_qty: p.includedQty,
        price_cents: p.priceCents,
        extra_item_cents: p.extraItemCents,
      };
      if (p.id && currentIds.has(p.id)) {
        await pb.collection("pricing_plans").update(p.id, data);
        keep.push(p.id);
      } else {
        const created = await pb.collection("pricing_plans").create<{ id: string }>(data);
        keep.push(created.id);
      }
    }

    for (const id of currentIds) {
      if (!keep.includes(id)) await pb.collection("pricing_plans").delete(id);
    }

    revalidatePath(`/admin/ensaios/${galleryId}`);
    return { ok: true, ids: keep };
  } catch (err) {
    console.error("[plans] save failed:", err);
    return { error: "Erro ao salvar preços." };
  }
}

export async function reopenSelectionAction(galleryId: string): Promise<ActionState> {
  if (!(await getAdminUser())) return SESSION_EXPIRED;
  try {
    const res = await reopenSelection(galleryId);
    if (res.error) return res;
  } catch (err) {
    console.error("[selection] reopen failed:", err);
    return { error: "Erro ao reabrir a seleção." };
  }
  revalidatePath(`/admin/ensaios/${galleryId}`);
  return { ok: true };
}

export async function markPaidAction(galleryId: string): Promise<ActionState> {
  if (!(await getAdminUser())) return SESSION_EXPIRED;
  try {
    const res = await markSelectionPaid(galleryId);
    if (res.error) return res;
  } catch (err) {
    console.error("[selection] mark paid failed:", err);
    return { error: "Erro ao marcar como pago." };
  }
  revalidatePath(`/admin/ensaios/${galleryId}`);
  return { ok: true };
}
