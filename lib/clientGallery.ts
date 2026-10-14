import { cookies } from "next/headers";
import { sessionCookieName } from "@/lib/access";
import {
  getSessionGallery as loadBySession,
  getSessionDownloads as loadDownloadsBySession,
  isSessionActive,
  getGalleryPublicInfo,
  colorFromId,
} from "@/lib/pb/gallery";
import type { PublicGallery } from "@/lib/types";

export type { GalleryPublicInfo, DownloadFile } from "@/lib/pb/gallery";
export { getGalleryPublicInfo, colorFromId };

export async function getSessionGallery(
  token: string,
): Promise<PublicGallery | null> {
  const jar = await cookies();
  const session = jar.get(sessionCookieName(token))?.value;
  if (!session) return null;
  return loadBySession(session);
}

export async function getSessionDownloads(token: string) {
  const jar = await cookies();
  const session = jar.get(sessionCookieName(token))?.value;
  if (!session) return null;
  return loadDownloadsBySession(session);
}

export async function hasActiveSession(token: string): Promise<boolean> {
  const jar = await cookies();
  const session = jar.get(sessionCookieName(token))?.value;
  return !!session && (await isSessionActive(session));
}
