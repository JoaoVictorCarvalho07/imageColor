"use server";

import { cookies } from "next/headers";
import { saveGallerySelection, type SelectionResult } from "@/lib/pb/gallery";
import {
  cancelCheckout,
  resumeCheckout,
  startCheckout,
  syncSessionPayments,
  type CheckoutResult,
} from "@/lib/pb/orders";
import { sessionCookieName } from "./access";
import type { SelectionDraft } from "@/lib/types";

const INVALID_SESSION = { error: "Sessão inválida." };

async function sessionFor(token: string): Promise<string | null> {
  const jar = await cookies();
  return jar.get(sessionCookieName(token))?.value ?? null;
}

export async function saveSelectionAction(
  token: string,
  draft: SelectionDraft,
): Promise<SelectionResult> {
  const session = await sessionFor(token);
  if (!session) return INVALID_SESSION;
  return saveGallerySelection(session, draft);
}

export async function checkoutAction(
  token: string,
  draft: SelectionDraft,
): Promise<CheckoutResult> {
  const session = await sessionFor(token);
  if (!session) return INVALID_SESSION;
  return startCheckout(session, draft);
}

export async function resumeCheckoutAction(token: string): Promise<CheckoutResult> {
  const session = await sessionFor(token);
  if (!session) return INVALID_SESSION;
  return resumeCheckout(session);
}

export async function cancelCheckoutAction(token: string): Promise<CheckoutResult> {
  const session = await sessionFor(token);
  if (!session) return INVALID_SESSION;
  return cancelCheckout(session);
}

export async function refreshPaymentAction(token: string): Promise<{ ok?: boolean; error?: string }> {
  const session = await sessionFor(token);
  if (!session) return INVALID_SESSION;
  try {
    await syncSessionPayments(session);
    return { ok: true };
  } catch (err) {
    console.error("[payment] refresh failed:", err);
    return { error: "Não foi possível consultar o pagamento agora." };
  }
}
