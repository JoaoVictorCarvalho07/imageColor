import { cookies } from "next/headers";
import { sessionCookieName } from "@/lib/access";
import {
  getSessionGallery as loadBySession,
  getGalleryPublicInfo,
  colorFromId,
} from "@/lib/pb/gallery";
import type { PublicGallery } from "@/lib/types";

export type { GalleryPublicInfo } from "@/lib/pb/gallery";
export { getGalleryPublicInfo, colorFromId };

/** Carrega a galeria da sessão ativa da cliente (cookie httpOnly do token). */
export async function getSessionGallery(
  token: string,
): Promise<PublicGallery | null> {
  const jar = await cookies();
  const session = jar.get(sessionCookieName(token))?.value;
  if (!session) return null;
  return loadBySession(session);
}
