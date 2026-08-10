"use server";

import { cookies } from "next/headers";
import {
  saveGallerySelection,
  submitGallerySelection,
} from "@/lib/pb/gallery";
import { sessionCookieName } from "./access";
import { notifySelectionSubmitted } from "@/lib/notifications";

async function sessionFor(token: string): Promise<string | null> {
  const jar = await cookies();
  return jar.get(sessionCookieName(token))?.value ?? null;
}

export async function saveSelectionAction(
  token: string,
  mediaIds: string[],
): Promise<{ ok?: boolean; error?: string }> {
  const session = await sessionFor(token);
  if (!session) return { error: "Sessão inválida." };
  return saveGallerySelection(session, mediaIds);
}

/** Salva e ENVIA a seleção (trava). A fotógrafa passa a ver como "enviada". */
export async function submitSelectionAction(
  token: string,
  mediaIds: string[],
): Promise<{ ok?: boolean; error?: string }> {
  const session = await sessionFor(token);
  if (!session) return { error: "Sessão inválida." };

  const res = await submitGallerySelection(session, mediaIds);
  if (res.error) return res;

  await notifySelectionSubmitted(session);
  return { ok: true };
}
