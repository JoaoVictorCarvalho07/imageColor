import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "Isabel Pontes <onboarding@resend.dev>";

export interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
}

/** Envia e-mail via Resend. Sem RESEND_API_KEY, apenas registra (no-op). */
export async function sendEmail(
  opts: SendEmailOpts,
): Promise<{ ok?: boolean; skipped?: boolean; error?: string }> {
  if (!opts.to) return { skipped: true };
  if (!apiKey) {
    console.log(
      `[email] (sem RESEND_API_KEY) simulado → ${opts.to} | ${opts.subject}`,
    );
    return { skipped: true };
  }
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      console.error("[email] erro Resend:", error);
      return { error: String(error) };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] exceção:", e);
    return { error: e instanceof Error ? e.message : "erro" };
  }
}
