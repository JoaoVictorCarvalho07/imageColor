import { superuserPb } from "@/lib/pb/superuser";
import { sendEmail } from "@/lib/email";
import { formatBRL } from "@/lib/format";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const APP_URL = process.env.APP_URL || "http://localhost:3000";

function photographerEmail(): string | null {
  const first = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim();
  return first || null;
}

export async function notifySelectionSubmitted(sessionToken: string) {
  try {
    const to = photographerEmail();
    if (!to) return;

    const pb = await superuserPb();

    const sess = await pb
      .collection("gallery_sessions")
      .getFirstListItem<{ gallery: string }>(
        pb.filter("token = {:t}", { t: sessionToken }),
      );

    const g = await pb
      .collection("galleries")
      .getOne<{ id: string; title: string; client_name: string }>(sess.gallery);

    let count = 0;
    try {
      const sel = await pb
        .collection("selections")
        .getFirstListItem<{ media: string[] }>(
          pb.filter("gallery = {:g}", { g: g.id }),
        );
      count = sel.media?.length ?? 0;
    } catch {
      count = 0;
    }

    await sendEmail({
      to,
      subject: `Seleção recebida — ${g.title}`,
      html: `
        <p>${esc(g.client_name || "A cliente")} confirmou a seleção do ensaio <strong>${esc(g.title)}</strong>.</p>
        <p><strong>${count}</strong> foto(s) selecionada(s).</p>
        <p><a href="${esc(APP_URL)}/admin/ensaios/${esc(g.id)}">Abrir no painel</a></p>`,
    });
  } catch (e) {
    console.error("[notify] selection submitted:", e);
  }
}

export async function notifyDeliveryPublished(galleryId: string) {
  try {
    const pb = await superuserPb();
    const g = await pb.collection("galleries").getOne<{
      title: string;
      access_token: string;
      client_name: string;
      client_email: string;
    }>(galleryId);

    if (!g.client_email) return;

    const unpaid = await pb
      .collection("selections")
      .getFirstListItem<{ status: string; amount_cents: number | null }>(
        pb.filter("gallery = {:g}", { g: galleryId }),
      )
      .then((sel) => sel.status !== "paid" && (sel.amount_cents ?? 0) > 0)
      .catch(() => false);
    if (unpaid) return;

    await sendEmail({
      to: g.client_email,
      subject: `Suas fotos estão prontas — ${g.title}`,
      html: `
        <p>Olá ${esc(g.client_name || "")}! Suas fotos do ensaio <strong>${esc(g.title)}</strong> já estão prontas. 🎉</p>
        <p><a href="${esc(APP_URL)}/g/${esc(g.access_token)}">Acessar e baixar</a></p>`,
    });
  } catch (e) {
    console.error("[notify] delivery published:", e);
  }
}

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Pix",
  credit_card: "cartão de crédito",
  debit_card: "cartão de débito",
  prepaid_card: "cartão pré-pago",
  account_money: "saldo Mercado Pago",
};

export async function notifyPaymentApproved(
  galleryId: string,
  amountCents: number,
  paymentType: string,
) {
  try {
    const pb = await superuserPb();
    const g = await pb.collection("galleries").getOne<{
      id: string;
      title: string;
      access_token: string;
      client_name: string;
      client_email: string;
      delivery_mode: "edit" | "direct";
      delivered_at: string;
    }>(galleryId);

    const amount = formatBRL(amountCents);
    const method = METHOD_LABEL[paymentType] ?? "Mercado Pago";
    const photographer = photographerEmail();

    if (photographer) {
      await sendEmail({
        to: photographer,
        subject: `Pagamento recebido — ${g.title}`,
        html: `
          <p>${esc(g.client_name || "A cliente")} pagou <strong>${esc(amount)}</strong> via ${esc(method)} pelo ensaio <strong>${esc(g.title)}</strong>.</p>
          <p><a href="${esc(APP_URL)}/admin/ensaios/${esc(g.id)}">Abrir no painel</a></p>`,
      });
    }

    if (g.client_email) {
      const ready = g.delivery_mode === "direct" || !!g.delivered_at;
      await sendEmail({
        to: g.client_email,
        subject: `Pagamento confirmado — ${g.title}`,
        html: `
          <p>Olá ${esc(g.client_name || "")}! Recebemos seu pagamento de <strong>${esc(amount)}</strong>.</p>
          <p>${ready ? "Suas fotos já estão liberadas para download." : "Agora é com a gente: você será avisada quando as fotos editadas estiverem prontas."}</p>
          <p><a href="${esc(APP_URL)}/g/${esc(g.access_token)}">Acessar o ensaio</a></p>`,
      });
    }
  } catch (e) {
    console.error("[notify] payment approved:", e);
  }
}
