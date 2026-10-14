import { NextResponse, type NextRequest } from "next/server";
import { getPayment, MercadoPagoError, verifyWebhookSignature } from "@/lib/mercadopago";
import { processPayment } from "@/lib/pb/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const body = await readBody(req);
  const bodyData = (body?.data ?? null) as { id?: string | number } | null;

  const type = params.get("type") ?? params.get("topic") ?? body?.type ?? body?.topic;
  const queryDataId = params.get("data.id");
  const paymentId = queryDataId ?? params.get("id") ?? (bodyData?.id != null ? String(bodyData.id) : null);

  if (type !== "payment" || !paymentId) {
    return NextResponse.json({ ignored: true });
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const signature = req.headers.get("x-signature");
  if (secret && signature) {
    const valid = verifyWebhookSignature({
      signatureHeader: signature,
      requestId: req.headers.get("x-request-id"),
      dataId: queryDataId ?? paymentId,
      secret,
    });
    if (!valid) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  try {
    const payment = await getPayment(paymentId);
    const outcome = await processPayment(payment);
    return NextResponse.json({ outcome });
  } catch (err) {
    if (err instanceof MercadoPagoError && err.status === 404) {
      return NextResponse.json({ ignored: true });
    }
    console.error("[webhook] mercadopago:", err);
    return NextResponse.json({ error: "falha ao processar" }, { status: 500 });
  }
}
