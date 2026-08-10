import { superuserPb } from "@/lib/pb/superuser";
import { sendEmail } from "@/lib/email";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

/**
 * E-mail da fotógrafa. Antes vinha de `auth.users` via `galleries.user_id`;
 * como só existe uma dona, é o primeiro endereço da allowlist do admin.
 */
function photographerEmail(): string | null {
  const first = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim();
  return first || null;
}

/** Avisa a fotógrafa que a cliente enviou a seleção. */
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
      // sem seleção gravada ainda — segue com 0
    }

    await sendEmail({
      to,
      subject: `Seleção recebida — ${g.title}`,
      html: `
        <p>${g.client_name || "A cliente"} confirmou a seleção do ensaio <strong>${g.title}</strong>.</p>
        <p><strong>${count}</strong> foto(s) selecionada(s).</p>
        <p><a href="${APP_URL}/admin/ensaios/${g.id}">Abrir no painel</a></p>`,
    });
  } catch (e) {
    console.error("[notify] selection submitted:", e);
  }
}

/** Avisa a cliente que a entrega foi publicada. */
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

    await sendEmail({
      to: g.client_email,
      subject: `Suas fotos estão prontas — ${g.title}`,
      html: `
        <p>Olá ${g.client_name || ""}! Suas fotos do ensaio <strong>${g.title}</strong> já estão prontas. 🎉</p>
        <p><a href="${APP_URL}/g/${g.access_token}">Acessar e baixar</a></p>`,
    });
  } catch (e) {
    console.error("[notify] delivery published:", e);
  }
}
