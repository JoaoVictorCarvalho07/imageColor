"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sessionCookieName } from "./access";
import { notifySelectionSubmitted } from "@/lib/notifications";

export async function saveSelectionAction(
  token: string,
  mediaIds: string[],
): Promise<{ ok?: boolean; error?: string }> {
  const jar = await cookies();
  const session = jar.get(sessionCookieName(token))?.value;
  if (!session) return { error: "Sessão inválida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_gallery_selection", {
    p_session: session,
    p_media_ids: mediaIds,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

/** Salva e ENVIA a seleção (trava). A fotógrafa passa a ver como "enviada". */
export async function submitSelectionAction(
  token: string,
  mediaIds: string[],
): Promise<{ ok?: boolean; error?: string }> {
  const jar = await cookies();
  const session = jar.get(sessionCookieName(token))?.value;
  if (!session) return { error: "Sessão inválida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_gallery_selection", {
    p_session: session,
    p_media_ids: mediaIds,
  });
  if (error) return { error: error.message };

  await notifySelectionSubmitted(session);
  return { ok: true };
}
