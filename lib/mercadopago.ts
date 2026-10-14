import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.mercadopago.com";
const TIMEOUT_MS = 15_000;

export interface MpPayment {
  id: number | string;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  payment_type_id?: string;
  payment_method_id?: string;
  date_approved?: string | null;
}

export interface MpPreferenceInput {
  orderId: string;
  title: string;
  amountCents: number;
  payerEmail?: string;
  backUrl: string;
  notificationUrl: string | null;
}

export interface MpPreference {
  id: string;
  checkoutUrl: string;
}

export class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function accessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new MercadoPagoError("MERCADOPAGO_ACCESS_TOKEN não configurado.", 0);
  return token;
}

export function isMercadoPagoConfigured(): boolean {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN;
}

async function mp<T>(
  path: string,
  init: { method?: string; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new MercadoPagoError(`Mercado Pago ${init.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 500)}`, res.status);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export async function createPreference(input: MpPreferenceInput): Promise<MpPreference> {
  const isHttps = input.backUrl.startsWith("https://");
  const pref = await mp<{ id: string; init_point: string; sandbox_init_point?: string }>(
    "/checkout/preferences",
    {
      method: "POST",
      idempotencyKey: `preference-${input.orderId}`,
      body: {
        items: [
          {
            id: input.orderId,
            title: input.title.slice(0, 250),
            quantity: 1,
            currency_id: "BRL",
            unit_price: Math.round(input.amountCents) / 100,
          },
        ],
        external_reference: input.orderId,
        payer: input.payerEmail ? { email: input.payerEmail } : undefined,
        payment_methods: {
          excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
          installments: 12,
        },
        back_urls: {
          success: input.backUrl,
          pending: input.backUrl,
          failure: input.backUrl,
        },
        ...(isHttps ? { auto_return: "approved" } : {}),
        ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
        statement_descriptor: (process.env.NEXT_PUBLIC_STUDIO_NAME ?? "").slice(0, 22) || undefined,
      },
    },
  );
  const useSandbox = accessToken().startsWith("TEST-") && pref.sandbox_init_point;
  return { id: pref.id, checkoutUrl: useSandbox ? pref.sandbox_init_point! : pref.init_point };
}

export function getPayment(paymentId: string): Promise<MpPayment> {
  return mp<MpPayment>(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

export async function searchPayments(externalReference: string): Promise<MpPayment[]> {
  const params = new URLSearchParams({
    external_reference: externalReference,
    sort: "date_created",
    criteria: "desc",
  });
  const res = await mp<{ results?: MpPayment[] }>(`/v1/payments/search?${params}`);
  return res.results ?? [];
}

export function verifyWebhookSignature(opts: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  if (!opts.signatureHeader) return false;
  const parts = Object.fromEntries(
    opts.signatureHeader.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const id = opts.dataId && /^[a-z0-9]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId;
  const manifest = [
    id ? `id:${id};` : "",
    opts.requestId ? `request-id:${opts.requestId};` : "",
    `ts:${ts};`,
  ].join("");

  const expected = createHmac("sha256", opts.secret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
