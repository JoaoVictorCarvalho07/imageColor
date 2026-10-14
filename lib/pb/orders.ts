import "server-only";

import { ClientResponseError } from "pocketbase";
import { superuserPb } from "./superuser";
import {
  findSelection,
  galleryIdFromSession,
  submitGallerySelection,
  type SelectionRecord,
} from "./gallery";
import {
  createPreference,
  isMercadoPagoConfigured,
  searchPayments,
  type MpPayment,
} from "@/lib/mercadopago";
import { notifyPaymentApproved, notifySelectionSubmitted } from "@/lib/notifications";
import { STUDIO_NAME } from "@/lib/studio";
import type { SelectionQuote } from "@/lib/pricing";
import type { SelectionDraft } from "@/lib/types";

export type OrderStatus = "pending" | "paid" | "cancelled" | "refunded";

export interface OrderRecord {
  id: string;
  gallery: string;
  selection: string;
  status: OrderStatus;
  amount_cents: number;
  media: string[] | null;
  photo_plan: string;
  video_plan: string;
  checkout_url: string;
  payment_id: string;
  payment_status: string;
  payment_method: string;
  paid_at: string;
  created: string;
}

export interface CheckoutResult {
  error?: string;
  checkoutUrl?: string;
  done?: boolean;
}

const CHECKOUT_FAILED = "Não foi possível iniciar o pagamento. Tente novamente em instantes.";
const REFUND_STATUSES = new Set(["refunded", "charged_back"]);

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof ClientResponseError) || err.status !== 400) return false;
  const fields = (err.response?.data ?? {}) as Record<string, { code?: string }>;
  return Object.values(fields).some((f) => f?.code === "validation_not_unique");
}

async function pendingOrders(galleryId: string): Promise<OrderRecord[]> {
  const pb = await superuserPb();
  return pb.collection("orders").getFullList<OrderRecord>({
    filter: pb.filter("gallery = {:g} && status = 'pending'", { g: galleryId }),
    sort: "-created",
  });
}

async function cancelPendingOrders(galleryId: string): Promise<void> {
  const pb = await superuserPb();
  for (const o of await pendingOrders(galleryId)) {
    await pb.collection("orders").update(o.id, { status: "cancelled" });
  }
}

async function createOrderCheckout(
  galleryId: string,
  selection: SelectionRecord,
  quote: SelectionQuote | null,
): Promise<string> {
  if (!isMercadoPagoConfigured()) throw new Error("Mercado Pago não configurado.");

  const pb = await superuserPb();
  const g = await pb.collection("galleries").getOne<{
    title: string;
    access_token: string;
    client_email: string;
  }>(galleryId);

  await cancelPendingOrders(galleryId);

  const amountCents = selection.amount_cents ?? 0;
  const order = await pb.collection("orders").create<OrderRecord>({
    gallery: galleryId,
    selection: selection.id,
    status: "pending",
    amount_cents: amountCents,
    media: selection.media,
    photo_plan: selection.contracted_plan,
    video_plan: selection.video_plan,
    quote,
  });

  const base = appUrl();
  try {
    const pref = await createPreference({
      orderId: order.id,
      title: `${STUDIO_NAME} · ${g.title}`,
      amountCents,
      payerEmail: g.client_email || undefined,
      backUrl: `${base}/g/${g.access_token}/selecao`,
      notificationUrl: base.startsWith("https://") ? `${base}/api/webhooks/mercadopago` : null,
    });
    await pb.collection("orders").update(order.id, {
      preference_id: pref.id,
      checkout_url: pref.checkoutUrl,
    });
    return pref.checkoutUrl;
  } catch (err) {
    await pb.collection("orders").update(order.id, { status: "cancelled" });
    throw err;
  }
}

export async function startCheckout(
  sessionToken: string,
  draft: SelectionDraft,
): Promise<CheckoutResult> {
  const res = await submitGallerySelection(sessionToken, draft);
  if (res.error || !res.quote) return { error: res.error ?? CHECKOUT_FAILED };

  if (res.quote.totalCents === 0) {
    await notifySelectionSubmitted(sessionToken);
    return { done: true };
  }

  const galleryId = await galleryIdFromSession(sessionToken);
  const selection = galleryId ? await findSelection(galleryId) : null;
  if (!galleryId || !selection) return { error: CHECKOUT_FAILED };

  try {
    return { checkoutUrl: await createOrderCheckout(galleryId, selection, res.quote) };
  } catch (err) {
    console.error("[checkout] start failed:", err);
    const pb = await superuserPb();
    await pb.collection("selections").update(selection.id, { status: "open" });
    return { error: CHECKOUT_FAILED };
  }
}

async function sessionSelection(
  sessionToken: string,
): Promise<{ galleryId: string; selection: SelectionRecord } | null> {
  const galleryId = await galleryIdFromSession(sessionToken);
  if (!galleryId) return null;
  const selection = await findSelection(galleryId);
  return selection ? { galleryId, selection } : null;
}

export async function resumeCheckout(sessionToken: string): Promise<CheckoutResult> {
  const ctx = await sessionSelection(sessionToken);
  if (!ctx) return { error: "Sessão inválida." };
  const { galleryId, selection } = ctx;

  if (selection.status === "paid") return { done: true };
  if (selection.status !== "submitted" || !(selection.amount_cents && selection.amount_cents > 0)) {
    return { error: "Não há pagamento pendente." };
  }

  const [latest] = await pendingOrders(galleryId);
  if (latest?.checkout_url && latest.amount_cents === selection.amount_cents) {
    return { checkoutUrl: latest.checkout_url };
  }

  try {
    return { checkoutUrl: await createOrderCheckout(galleryId, selection, null) };
  } catch (err) {
    console.error("[checkout] resume failed:", err);
    return { error: CHECKOUT_FAILED };
  }
}

export async function cancelCheckout(sessionToken: string): Promise<CheckoutResult> {
  const ctx = await sessionSelection(sessionToken);
  if (!ctx) return { error: "Sessão inválida." };

  await syncGalleryPayments(ctx.galleryId).catch((err) =>
    console.error("[checkout] sync before cancel failed:", err),
  );
  const selection = await findSelection(ctx.galleryId);
  if (selection?.status === "paid") return { error: "Seu pagamento já foi confirmado." };
  if (selection?.status !== "submitted" || !(selection.amount_cents && selection.amount_cents > 0)) {
    return { error: "Sua seleção já foi enviada. Para alterar, fale com a fotógrafa." };
  }

  await cancelPendingOrders(ctx.galleryId);
  const pb = await superuserPb();
  await pb.collection("selections").update(selection.id, { status: "open" });
  return { done: true };
}

async function recordEvent(order: OrderRecord, payment: MpPayment): Promise<boolean> {
  const pb = await superuserPb();
  try {
    await pb.collection("payment_events").create({
      key: `${payment.id}:${payment.status}`,
      order: order.id,
      payment_id: String(payment.id),
      status: payment.status,
    });
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}

export type ProcessOutcome = "ignored" | "paid" | "refunded" | "updated" | "amount_mismatch";

export async function processPayment(payment: MpPayment): Promise<ProcessOutcome> {
  const orderId = payment.external_reference;
  if (!orderId) return "ignored";

  const pb = await superuserPb();
  let order: OrderRecord;
  try {
    order = await pb.collection("orders").getOne<OrderRecord>(orderId);
  } catch (err) {
    if (err instanceof ClientResponseError && err.status === 404) return "ignored";
    throw err;
  }

  const paidCents = Math.round((payment.transaction_amount ?? 0) * 100);
  const amountOk = paidCents >= order.amount_cents && (payment.currency_id ?? "BRL") === "BRL";
  const approved = payment.status === "approved" && amountOk;
  const refunded = REFUND_STATUSES.has(payment.status);

  await pb.collection("orders").update(order.id, {
    payment_id: String(payment.id),
    payment_status: payment.status,
    payment_method: payment.payment_type_id ?? "",
    ...(approved
      ? { status: "paid", paid_at: payment.date_approved || new Date().toISOString() }
      : refunded && order.status === "paid"
        ? { status: "refunded" }
        : {}),
  });

  const selection = order.selection
    ? await pb.collection("selections").getOne<SelectionRecord>(order.selection).catch(() => null)
    : await findSelection(order.gallery);

  if (payment.status === "approved" && !amountOk) {
    console.error(
      `[payment] valor divergente no pedido ${order.id}: pago ${paidCents}, esperado ${order.amount_cents}`,
    );
    await recordEvent(order, payment);
    return "amount_mismatch";
  }

  if (approved) {
    if (selection) {
      await pb.collection("selections").update(selection.id, {
        status: "paid",
        media: order.media ?? selection.media,
        contracted_plan: order.photo_plan,
        video_plan: order.video_plan,
        amount_cents: order.amount_cents,
      });
    }
    if (await recordEvent(order, payment)) {
      await notifyPaymentApproved(order.gallery, order.amount_cents, payment.payment_type_id ?? "");
    }
    return "paid";
  }

  if (refunded) {
    if (selection?.status === "paid") {
      await pb.collection("selections").update(selection.id, { status: "submitted" });
    }
    await recordEvent(order, payment);
    return "refunded";
  }

  await recordEvent(order, payment);
  return "updated";
}

export async function syncGalleryPayments(galleryId: string): Promise<void> {
  if (!isMercadoPagoConfigured()) return;
  for (const order of (await pendingOrders(galleryId)).slice(0, 3)) {
    const payments = await searchPayments(order.id);
    const best =
      payments.find((p) => p.status === "approved") ??
      payments.find((p) => p.status !== "cancelled" && p.status !== "rejected") ??
      payments[0];
    if (best) await processPayment(best);
  }
}

export async function syncSessionPayments(sessionToken: string): Promise<void> {
  const galleryId = await galleryIdFromSession(sessionToken);
  if (galleryId) await syncGalleryPayments(galleryId);
}

export async function reopenSelection(galleryId: string): Promise<{ ok?: boolean; error?: string }> {
  const selection = await findSelection(galleryId);
  if (!selection) return { error: "Não há seleção para reabrir." };
  if (selection.status === "paid") {
    return { error: "Seleção já paga não pode ser reaberta." };
  }
  await cancelPendingOrders(galleryId);
  const pb = await superuserPb();
  await pb.collection("selections").update(selection.id, { status: "open" });
  return { ok: true };
}

export async function markSelectionPaid(galleryId: string): Promise<{ ok?: boolean; error?: string }> {
  const selection = await findSelection(galleryId);
  if (!selection) return { error: "Não há seleção." };
  if (selection.status === "paid") return { ok: true };
  if (selection.status !== "submitted") {
    return { error: "A cliente ainda não enviou a seleção." };
  }

  const pb = await superuserPb();
  const [latest, ...others] = await pendingOrders(galleryId);
  if (latest) {
    await pb.collection("orders").update(latest.id, {
      status: "paid",
      payment_method: "manual",
      paid_at: new Date().toISOString(),
    });
  }
  for (const o of others) {
    await pb.collection("orders").update(o.id, { status: "cancelled" });
  }
  await pb.collection("selections").update(selection.id, { status: "paid" });
  return { ok: true };
}
