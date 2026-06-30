import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sessionCookieName } from "@/lib/access";
import { previewUrl } from "@/lib/storageUrl";
import type { MediaType, PlanKind, PublicGallery } from "@/lib/types";

const PHOTO_COLORS = [
  "#C9B078",
  "#8FA08A",
  "#B89A82",
  "#D9C3A5",
  "#A98C6B",
  "#C2B5A0",
  "#9DAE9A",
  "#CDB68F",
  "#B0A188",
  "#A9B0A0",
];

/** Cor placeholder determinística por id (até integrarmos imagens reais do Drive/R2). */
export function colorFromId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PHOTO_COLORS[h % PHOTO_COLORS.length];
}

interface RpcGallery {
  gallery: {
    token: string;
    title: string;
    studio_name: string;
    client_name: string | null;
    access_expires_at: string | null;
    selection_mode: "free" | "quota";
    selection_limit: number | null;
    extra_photo_cents: number | null;
    delivery_mode: "edit" | "direct";
    delivered_at: string | null;
  };
  selection_status: "open" | "submitted" | "paid" | null;
  download_ready: boolean;
  finals: {
    storage_key: string;
    filename: string | null;
    bucket: "finals" | "originals";
  }[];
  media: {
    id: string;
    type: MediaType;
    duration_sec: number | null;
    preview_key: string | null;
    thumb_key: string | null;
  }[];
  plans: {
    id: string;
    media_type: MediaType;
    kind: PlanKind;
    name: string;
    included_qty: number | null;
    price_cents: number;
    extra_item_cents: number | null;
  }[];
}

function mapGallery(data: RpcGallery): PublicGallery {
  return {
    token: data.gallery.token,
    studioName: data.gallery.studio_name,
    title: data.gallery.title,
    clientName: data.gallery.client_name ?? "",
    expiresAt: (data.gallery.access_expires_at ?? "").slice(0, 10),
    selectionMode: data.gallery.selection_mode,
    selectionLimit: data.gallery.selection_limit,
    extraPhotoCents: data.gallery.extra_photo_cents,
    deliveryMode: data.gallery.delivery_mode,
    selectionStatus: data.selection_status,
    deliveredAt: data.gallery.delivered_at,
    downloadReady: data.download_ready,
    finals: (data.finals ?? []).map((f) => ({
      storageKey: f.storage_key,
      filename: f.filename,
      bucket: f.bucket,
    })),
    media: data.media.map((m) => ({
      id: m.id,
      type: m.type,
      color: m.type === "video" ? "#3A3A30" : colorFromId(m.id),
      previewUrl: previewUrl(m.preview_key) ?? undefined,
      thumbUrl: previewUrl(m.thumb_key) ?? undefined,
      durationSec: m.duration_sec ?? undefined,
    })),
    plans: data.plans.map((p) => ({
      id: p.id,
      mediaType: p.media_type,
      kind: p.kind,
      name: p.name,
      includedQty: p.included_qty ?? undefined,
      priceCents: p.price_cents,
      extraItemCents: p.extra_item_cents ?? undefined,
    })),
  };
}

export interface GalleryPublicInfo {
  title: string;
  studioName: string;
  clientName: string | null;
  accessExpiresAt: string | null;
  expired: boolean;
}

export async function getGalleryPublicInfo(
  token: string,
): Promise<GalleryPublicInfo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_gallery_public_info", {
    p_token: token,
  });
  if (error || !data) return null;
  const d = data as {
    title: string;
    studio_name: string;
    client_name: string | null;
    access_expires_at: string | null;
    expired: boolean;
  };
  return {
    title: d.title,
    studioName: d.studio_name,
    clientName: d.client_name,
    accessExpiresAt: d.access_expires_at,
    expired: d.expired,
  };
}

export async function getSessionGallery(
  token: string,
): Promise<PublicGallery | null> {
  const jar = await cookies();
  const session = jar.get(sessionCookieName(token))?.value;
  if (!session) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_gallery_session", {
    p_session: session,
  });
  if (error || !data) return null;
  return mapGallery(data as RpcGallery);
}
