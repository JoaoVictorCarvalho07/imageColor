import "server-only";

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { superuserPb } from "./superuser";
import { previewUrl } from "@/lib/storageUrl";
import { STUDIO_NAME } from "@/lib/studio";
import {
  exceedsLimit,
  findPlan,
  quoteSelection,
  type SelectionQuote,
} from "@/lib/pricing";
import type {
  MediaType,
  PlanKind,
  PricingPlan,
  PaymentState,
  PublicGallery,
  SelectionDraft,
  SelectionStatus,
} from "@/lib/types";

const scrypt = promisify(scryptCb) as (
  pw: string,
  salt: Buffer,
  len: number,
) => Promise<Buffer>;

const SESSION_HOURS = 12;
export const MIN_PASSWORD = 6;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(plain, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(
  plain: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(plain, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const PHOTO_COLORS = [
  "#C9B078", "#8FA08A", "#B89A82", "#D9C3A5", "#A98C6B",
  "#C2B5A0", "#9DAE9A", "#CDB68F", "#B0A188", "#A9B0A0",
];

export function colorFromId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PHOTO_COLORS[h % PHOTO_COLORS.length];
}

const orNull = (v: unknown): string | null => (v ? String(v) : null);

const isExpired = (iso: string | null): boolean =>
  !!iso && new Date(iso).getTime() < Date.now();

interface GalleryRecord {
  id: string;
  title: string;
  client_name: string;
  client_email: string;
  access_token: string;
  password_hash: string;
  status: string;
  access_expires_at: string;
  download_expires_days: number;
  selection_mode: "free" | "quota";
  selection_limit: number | null;
  extra_photo_cents: number | null;
  delivery_mode: "edit" | "direct";
  delivered_at: string;
  drive_folder_id: string;
}

interface PlanRecord {
  id: string;
  media_type: MediaType;
  kind: PlanKind;
  name: string;
  included_qty: number | null;
  price_cents: number;
  extra_item_cents: number | null;
}

const toPricingPlan = (p: PlanRecord): PricingPlan => ({
  id: p.id,
  mediaType: p.media_type,
  kind: p.kind,
  name: p.name,
  includedQty: p.included_qty ?? undefined,
  priceCents: p.price_cents,
  extraItemCents: p.extra_item_cents ?? undefined,
});

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
  const pb = await superuserPb();
  try {
    const g = await pb
      .collection("galleries")
      .getFirstListItem<GalleryRecord>(
        pb.filter("access_token = {:token}", { token }),
      );

    const expiresAt = orNull(g.access_expires_at);
    return {
      title: g.title,
      studioName: STUDIO_NAME,
      clientName: g.client_name || null,
      accessExpiresAt: expiresAt,
      expired: isExpired(expiresAt),
    };
  } catch {
    return null;
  }
}

export async function openGallerySession(
  token: string,
  password: string,
): Promise<string | null> {
  if (!password) return null;
  const pb = await superuserPb();

  let gallery: GalleryRecord;
  try {
    gallery = await pb
      .collection("galleries")
      .getFirstListItem<GalleryRecord>(
        pb.filter("access_token = {:token}", { token }),
      );
  } catch {
    return null;
  }

  if (isExpired(orNull(gallery.access_expires_at))) return null;
  if (!(await verifyPassword(password, gallery.password_hash))) return null;

  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);

  await pb.collection("gallery_sessions").create({
    gallery: gallery.id,
    token: sessionToken,
    expires_at: expiresAt.toISOString(),
  });

  return sessionToken;
}

export async function galleryIdFromSession(sessionToken: string): Promise<string | null> {
  const pb = await superuserPb();
  try {
    const s = await pb
      .collection("gallery_sessions")
      .getFirstListItem<{ gallery: string; expires_at: string }>(
        pb.filter("token = {:t}", { t: sessionToken }),
      );
    if (isExpired(orNull(s.expires_at))) return null;
    return s.gallery;
  } catch {
    return null;
  }
}

export async function isSessionActive(sessionToken: string): Promise<boolean> {
  const galleryId = await galleryIdFromSession(sessionToken);
  if (!galleryId) return false;
  const pb = await superuserPb();
  try {
    const g = await pb
      .collection("galleries")
      .getOne<GalleryRecord>(galleryId, { fields: "access_expires_at" });
    return !isExpired(orNull(g.access_expires_at));
  } catch {
    return false;
  }
}

export async function getSessionGallery(
  sessionToken: string,
): Promise<PublicGallery | null> {
  const galleryId = await galleryIdFromSession(sessionToken);
  if (!galleryId) return null;

  const pb = await superuserPb();

  let g: GalleryRecord;
  try {
    g = await pb.collection("galleries").getOne<GalleryRecord>(galleryId);
  } catch {
    return null;
  }
  if (isExpired(orNull(g.access_expires_at))) return null;

  const [mediaRows, planRows, selection] = await Promise.all([
    pb.collection("media_items").getFullList<{
      id: string;
      type: MediaType;
      preview_key: string;
      thumb_key: string;
      original_key: string;
      filename: string;
      duration_sec: number | null;
    }>({
      filter: pb.filter("gallery = {:g} && status = 'ready'", { g: galleryId }),
      sort: "position",
    }),
    pb.collection("pricing_plans").getFullList<PlanRecord>({
      filter: pb.filter("gallery = {:g}", { g: galleryId }),
      sort: "created",
    }),
    findSelection(galleryId),
  ]);

  const deliveredAt = orNull(g.delivered_at);
  const downloads = await resolveDownloads(g, mediaRows, selection);

  return {
    token: g.access_token,
    studioName: STUDIO_NAME,
    title: g.title,
    clientName: g.client_name ?? "",
    expiresAt: (orNull(g.access_expires_at) ?? "").slice(0, 10),
    selectionMode: g.selection_mode,
    selectionLimit: g.selection_limit,
    extraPhotoCents: g.extra_photo_cents,
    deliveryMode: g.delivery_mode,
    selection: {
      mediaIds: selection?.media ?? [],
      photoPlanId: selection?.contracted_plan || null,
      videoPlanId: selection?.video_plan || null,
    },
    selectionStatus: (selection?.status as SelectionStatus) ?? null,
    payment: paymentState(selection),
    deliveredAt,
    downloadReady: downloads.length > 0,
    media: mediaRows.map((m) => ({
      id: m.id,
      type: m.type,
      color: m.type === "video" ? "#3A3A30" : colorFromId(m.id),
      previewUrl: previewUrl(m.preview_key) ?? undefined,
      thumbUrl: previewUrl(m.thumb_key) ?? undefined,
      durationSec: m.duration_sec ?? undefined,
    })),
    plans: planRows.map(toPricingPlan),
  };
}

export interface DownloadFile {
  storageKey: string;
  filename: string | null;
  bucket: "finals" | "originals";
}

async function resolveDownloads(
  g: GalleryRecord,
  media: { id: string; original_key: string; filename: string }[],
  selection: SelectionRecord | null,
): Promise<DownloadFile[]> {
  const submitted = selection?.status === "submitted" || selection?.status === "paid";
  if (paymentBlocksDelivery(selection)) return [];

  if (g.delivery_mode === "direct") {
    if (!submitted) return [];
    const chosen = new Set(selection?.media ?? []);
    return media
      .filter((m) => chosen.has(m.id) && m.original_key)
      .map((m) => ({
        storageKey: m.original_key,
        filename: m.filename || null,
        bucket: "originals",
      }));
  }

  if (!orNull(g.delivered_at)) return [];
  const pb = await superuserPb();
  const assets = await pb
    .collection("final_assets")
    .getFullList<{ storage_key: string; filename: string }>({
      filter: pb.filter("gallery = {:g}", { g: g.id }),
      sort: "created",
    });
  return assets.map((f) => ({
    storageKey: f.storage_key,
    filename: f.filename || null,
    bucket: "finals",
  }));
}

export async function getSessionDownloads(
  sessionToken: string,
): Promise<DownloadFile[] | null> {
  const galleryId = await galleryIdFromSession(sessionToken);
  if (!galleryId) return null;

  const pb = await superuserPb();
  let g: GalleryRecord;
  try {
    g = await pb.collection("galleries").getOne<GalleryRecord>(galleryId);
  } catch {
    return null;
  }
  if (isExpired(orNull(g.access_expires_at))) return null;

  const [media, selection] = await Promise.all([
    pb.collection("media_items").getFullList<{
      id: string;
      original_key: string;
      filename: string;
    }>({
      filter: pb.filter("gallery = {:g} && status = 'ready'", { g: galleryId }),
      fields: "id,original_key,filename",
      sort: "position",
    }),
    findSelection(galleryId),
  ]);
  return resolveDownloads(g, media, selection);
}

export interface SelectionRecord {
  id: string;
  status: SelectionStatus;
  media: string[];
  contracted_plan: string;
  video_plan: string;
  submitted_at: string;
  amount_cents: number | null;
}

function paymentState(selection: SelectionRecord | null): PaymentState {
  const amountCents = selection?.amount_cents ?? 0;
  if (selection?.status === "paid") return { status: "paid", amountCents };
  if (selection?.status === "submitted" && amountCents > 0) {
    return { status: "pending", amountCents };
  }
  return { status: "none", amountCents };
}

function paymentBlocksDelivery(selection: SelectionRecord | null): boolean {
  return (
    !!selection && selection.status !== "paid" && (selection.amount_cents ?? 0) > 0
  );
}

export async function findSelection(galleryId: string): Promise<SelectionRecord | null> {
  const pb = await superuserPb();
  try {
    return await pb
      .collection("selections")
      .getFirstListItem<SelectionRecord>(
        pb.filter("gallery = {:g}", { g: galleryId }),
        { sort: "created" },
      );
  } catch {
    return null;
  }
}

export interface SelectionResult {
  ok?: boolean;
  error?: string;
  quote?: SelectionQuote;
}

const LOCKED_MESSAGE =
  "Sua seleção já foi enviada. Para alterar, fale com a fotógrafa.";

async function writeSelection(
  sessionToken: string,
  draft: SelectionDraft,
  submit: boolean,
): Promise<SelectionResult> {
  const galleryId = await galleryIdFromSession(sessionToken);
  if (!galleryId) return { error: "Sessão inválida." };

  const pb = await superuserPb();

  let g: GalleryRecord;
  try {
    g = await pb.collection("galleries").getOne<GalleryRecord>(galleryId);
  } catch {
    return { error: "Sessão inválida." };
  }
  if (isExpired(orNull(g.access_expires_at))) {
    return { error: "O acesso a este ensaio expirou." };
  }

  const [media, planRows, existing] = await Promise.all([
    pb.collection("media_items").getFullList<{ id: string; type: MediaType }>({
      filter: pb.filter("gallery = {:g} && status = 'ready'", { g: galleryId }),
      fields: "id,type",
    }),
    pb.collection("pricing_plans").getFullList<PlanRecord>({
      filter: pb.filter("gallery = {:g}", { g: galleryId }),
    }),
    findSelection(galleryId),
  ]);

  if (existing && existing.status !== "open") return { error: LOCKED_MESSAGE };

  const plans = planRows.map(toPricingPlan);
  const photoPlan = findPlan(plans, draft.photoPlanId, "photo");
  const videoPlan = findPlan(plans, draft.videoPlanId, "video");
  if ((draft.photoPlanId && !photoPlan) || (draft.videoPlanId && !videoPlan)) {
    return { error: "Pacote indisponível. Recarregue a página." };
  }

  const typeById = new Map(media.map((m) => [m.id, m.type]));
  const requested = new Set(draft.mediaIds.filter((id) => typeById.has(id)));
  const allOf = (type: MediaType) =>
    media.filter((m) => m.type === type).map((m) => m.id);
  const pick = (type: MediaType) =>
    [...requested].filter((id) => typeById.get(id) === type);

  const photoIds = photoPlan?.kind === "full" ? allOf("photo") : pick("photo");
  const videoIds = videoPlan?.kind === "full" ? allOf("video") : pick("video");

  const quote = quoteSelection(
    {
      selectionMode: g.selection_mode,
      selectionLimit: g.selection_limit,
      extraPhotoCents: g.extra_photo_cents,
      plans,
    },
    {
      photoCount: photoIds.length,
      videoCount: videoIds.length,
      photoPlanId: photoPlan?.id ?? null,
      videoPlanId: videoPlan?.id ?? null,
    },
  );

  if (exceedsLimit(quote.photos)) {
    return { error: `Você pode escolher até ${quote.photos.limit} foto(s).` };
  }
  if (exceedsLimit(quote.videos)) {
    return { error: `Você pode escolher até ${quote.videos.limit} vídeo(s).` };
  }
  if (submit && photoIds.length + videoIds.length === 0) {
    return { error: "Escolha ao menos uma foto ou vídeo." };
  }

  const data = {
    gallery: galleryId,
    media: [...photoIds, ...videoIds],
    contracted_plan: photoPlan?.id ?? "",
    video_plan: videoPlan?.id ?? "",
    amount_cents: quote.totalCents,
    status: submit ? "submitted" : "open",
    ...(submit ? { submitted_at: new Date().toISOString() } : {}),
  };

  try {
    if (existing) {
      await pb.collection("selections").update(existing.id, data);
    } else {
      try {
        await pb.collection("selections").create(data);
      } catch (err) {
        const raced = await findSelection(galleryId);
        if (!raced) throw err;
        if (raced.status !== "open") return { error: LOCKED_MESSAGE };
        await pb.collection("selections").update(raced.id, data);
      }
    }
    return { ok: true, quote };
  } catch (err) {
    console.error("[selection] write failed:", err);
    return { error: "Não foi possível salvar sua seleção. Tente novamente." };
  }
}

export const saveGallerySelection = (session: string, draft: SelectionDraft) =>
  writeSelection(session, draft, false);

export const submitGallerySelection = (session: string, draft: SelectionDraft) =>
  writeSelection(session, draft, true);

export async function createGallery(input: {
  title: string;
  clientName?: string;
  clientEmail?: string;
  password: string;
  accessDays: number;
}): Promise<{ id?: string; token?: string; error?: string }> {
  const pb = await superuserPb();

  const accessToken = randomBytes(9).toString("base64url");
  const expiresAt = new Date(Date.now() + input.accessDays * 86_400_000);

  try {
    const g = await pb.collection("galleries").create<{ id: string }>({
      title: input.title,
      client_name: input.clientName ?? "",
      client_email: input.clientEmail ?? "",
      access_token: accessToken,
      password_hash: await hashPassword(input.password),
      status: "draft",
      access_expires_at: expiresAt.toISOString(),
      download_expires_days: 30,
      selection_mode: "free",
      delivery_mode: "edit",
    });
    return { id: g.id, token: accessToken };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao criar ensaio." };
  }
}

export async function setGalleryPassword(
  galleryId: string,
  password: string,
): Promise<{ ok?: boolean; error?: string }> {
  const pb = await superuserPb();
  try {
    await pb.collection("galleries").update(galleryId, {
      password_hash: await hashPassword(password),
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao definir senha." };
  }
}
