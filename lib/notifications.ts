import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

/** Avisa a fotógrafa que a cliente enviou a seleção. */
export async function notifySelectionSubmitted(sessionToken: string) {
  try {
    const admin = createAdminClient();

    const { data: sess } = await admin
      .from("gallery_sessions")
      .select("gallery_id")
      .eq("session_token", sessionToken)
      .maybeSingle();
    if (!sess) return;

    const { data: g } = await admin
      .from("galleries")
      .select("id, title, user_id, client_id")
      .eq("id", sess.gallery_id)
      .single();
    if (!g) return;

    const { data: userRes } = await admin.auth.admin.getUserById(g.user_id);
    const ownerEmail = userRes?.user?.email;
    if (!ownerEmail) return;

    const { data: sel } = await admin
      .from("selections")
      .select("id")
      .eq("gallery_id", g.id)
      .eq("session_token", sessionToken)
      .maybeSingle();
    let count = 0;
    if (sel) {
      const { count: c } = await admin
        .from("selection_items")
        .select("id", { count: "exact", head: true })
        .eq("selection_id", sel.id);
      count = c ?? 0;
    }

    let clientName: string | null = null;
    if (g.client_id) {
      const { data: client } = await admin
        .from("clients")
        .select("name")
        .eq("id", g.client_id)
        .maybeSingle();
      clientName = client?.name ?? null;
    }

    await sendEmail({
      to: ownerEmail,
      subject: `Seleção recebida — ${g.title}`,
      html: `
        <p>${clientName ?? "A cliente"} confirmou a seleção do ensaio <strong>${g.title}</strong>.</p>
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
    const admin = createAdminClient();
    const { data: g } = await admin
      .from("galleries")
      .select("title, access_token, client_id")
      .eq("id", galleryId)
      .single();
    if (!g || !g.client_id) return;

    const { data: client } = await admin
      .from("clients")
      .select("name, email")
      .eq("id", g.client_id)
      .maybeSingle();
    if (!client?.email) return;

    await sendEmail({
      to: client.email,
      subject: `Suas fotos estão prontas — ${g.title}`,
      html: `
        <p>Olá ${client.name ?? ""}! Suas fotos do ensaio <strong>${g.title}</strong> já estão prontas. 🎉</p>
        <p><a href="${APP_URL}/g/${g.access_token}">Acessar e baixar</a></p>`,
    });
  } catch (e) {
    console.error("[notify] delivery published:", e);
  }
}
