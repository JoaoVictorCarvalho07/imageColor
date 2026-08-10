import "server-only";

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { superuserPb } from "./superuser";
import { previewUrl } from "@/lib/storageUrl";
import { STUDIO_NAME } from "@/lib/studio";
import type {
  MediaType,
  PlanKind,
  PricingPlan,
  PublicGallery,
  SelectionStatus,
} from "@/lib/types";

/**
 * Acesso aos dados de galeria — o que antes eram funções `SECURITY DEFINER`
 * no Postgres. As coleções do PocketBase são todas fechadas; o gating (senha,
 * validade da sessão, expiração do acesso) acontece aqui.
 */

const scrypt = promisify(scryptCb) as (
  pw: string,
  salt: Buffer,
  len: number,
) => Promise<Buffer>;

const SESSION_HOURS = 12;

// ─── senha da galeria ──────────────────────────────────────────────────────

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

// ─── helpers ───────────────────────────────────────────────────────────────

const PHOTO_COLORS = [
  "#C9B078", "#8FA08A", "#B89A82", "#D9C3A5", "#A98C6B",
  "#C2B5A0", "#9DAE9A", "#CDB68F", "#B0A188", "#A9B0A0",
];

/** Cor placeholder determinística por id (enquanto o preview não carrega). */
export function colorFromId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PHOTO_COLORS[h % PHOTO_COLORS.length];
}

/** PocketBase devolve "" para datas vazias; normalizamos para null. */
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

// ─── tela de acesso (antes: get_gallery_public_info) ───────────────────────

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

// ─── abrir sessão (antes: open_gallery_session) ────────────────────────────

/** Valida a senha e cria a sessão. Retorna o token de sessão, ou null. */
export async function openGallerySession(
  token: string,
  password: string,
): Promise<string | null> {
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

/** Resolve o id da galeria a partir de um token de sessão válido. */
async function galleryIdFromSession(sessionToken: string): Promise<string | null> {
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

// ─── carregar a galeria (antes: get_gallery_session) ───────────────────────

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
      duration_sec: number | null;
    }>({
      filter: pb.filter("gallery = {:g} && status = 'ready'", { g: galleryId }),
      sort: "position",
    }),
    pb.collection("pricing_plans").getFullList<{
      id: string;
      media_type: MediaType;
      kind: PlanKind;
      name: string;
      included_qty: number | null;
      price_cents: number;
      extra_item_cents: number | null;
    }>({
      filter: pb.filter("gallery = {:g}", { g: galleryId }),
      sort: "created",
    }),
    findSelection(galleryId),
  ]);

  const deliveredAt = orNull(g.delivered_at);
  const submitted = selection?.status === "submitted" || selection?.status === "paid";
  const isDirect = g.delivery_mode === "direct";

  // Modo direto: a cliente baixa os ORIGINAIS do que escolheu, assim que envia.
  // Modo edição: baixa as finais que a fotógrafa publicou.
  let finals: PublicGallery["finals"] = [];
  if (isDirect && submitted) {
    const chosen = new Set(selection?.media ?? []);
    finals = mediaRows
      .filter((m) => chosen.has(m.id) && m.original_key)
      .map((m) => ({
        storageKey: m.original_key,
        filename: null,
        bucket: "originals" as const,
      }));
  } else if (!isDirect && deliveredAt) {
    const assets = await pb
      .collection("final_assets")
      .getFullList<{ storage_key: string; filename: string }>({
        filter: pb.filter("gallery = {:g}", { g: galleryId }),
        sort: "created",
      });
    finals = assets.map((f) => ({
      storageKey: f.storage_key,
      filename: f.filename || null,
      bucket: "finals" as const,
    }));
  }

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
    selectionStatus: (selection?.status as SelectionStatus) ?? null,
    deliveredAt,
    downloadReady: finals.length > 0,
    finals,
    media: mediaRows.map((m) => ({
      id: m.id,
      type: m.type,
      color: m.type === "video" ? "#3A3A30" : colorFromId(m.id),
      previewUrl: previewUrl(m.preview_key) ?? undefined,
      thumbUrl: previewUrl(m.thumb_key) ?? undefined,
      durationSec: m.duration_sec ?? undefined,
    })),
    plans: planRows.map(
      (p): PricingPlan => ({
        id: p.id,
        mediaType: p.media_type,
        kind: p.kind,
        name: p.name,
        includedQty: p.included_qty ?? undefined,
        priceCents: p.price_cents,
        extraItemCents: p.extra_item_cents ?? undefined,
      }),
    ),
  };
}

// ─── seleção (antes: save_ / submit_gallery_selection) ─────────────────────

interface SelectionRecord {
  id: string;
  status: SelectionStatus;
  media: string[];
  submitted_at: string;
}

/** Uma seleção por galeria — criada na primeira gravação. */
async function findSelection(galleryId: string): Promise<SelectionRecord | null> {
  const pb = await superuserPb();
  try {
    return await pb
      .collection("selections")
      .getFirstListItem<SelectionRecord>(
        pb.filter("gallery = {:g}", { g: galleryId }),
      );
  } catch {
    return null;
  }
}

async function writeSelection(
  sessionToken: string,
  mediaIds: string[],
  submit: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  const galleryId = await galleryIdFromSession(sessionToken);
  if (!galleryId) return { error: "Sessão inválida." };

  const pb = await superuserPb();
  const existing = await findSelection(galleryId);

  // Uma seleção enviada está travada: só a fotógrafa reabre.
  if (existing?.status === "paid") return { error: "Seleção já finalizada." };

  const data = {
    gallery: galleryId,
    media: mediaIds,
    status: submit ? "submitted" : (existing?.status ?? "open"),
    ...(submit ? { submitted_at: new Date().toISOString() } : {}),
  };

  try {
    if (existing) {
      await pb.collection("selections").update(existing.id, data);
    } else {
      await pb.collection("selections").create(data);
    }
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao salvar." };
  }
}

export const saveGallerySelection = (session: string, mediaIds: string[]) =>
  writeSelection(session, mediaIds, false);

export const submitGallerySelection = (session: string, mediaIds: string[]) =>
  writeSelection(session, mediaIds, true);

// ─── admin (antes: create_gallery / set_gallery_password) ──────────────────

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
