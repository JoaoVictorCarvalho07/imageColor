/**
 * Teste direto do Resend — confirma que a API key está válida e que
 * o envio funciona para o e-mail do dono da conta.
 *
 * Uso: node scripts/test-email.mjs
 * (precisa de RESEND_API_KEY e EMAIL_FROM no .env.local, ou definidos abaixo)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Carrega .env.local manualmente (sem depender de dotenv instalado)
const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=").map((p) => p.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join("=")]),
);

const RESEND_API_KEY = env.RESEND_API_KEY;
const EMAIL_FROM = env.EMAIL_FROM || "Isabel Pontes <onboarding@resend.dev>";
// onboarding@resend.dev só entrega para o dono da conta Resend — use seu e-mail real
const TO = "joaogotado@gmail.com";

if (!RESEND_API_KEY) {
  console.error("❌  RESEND_API_KEY não encontrada no .env.local");
  process.exit(1);
}

console.log(`🔑  API key: ${RESEND_API_KEY.slice(0, 12)}…`);
console.log(`📧  De: ${EMAIL_FROM}`);
console.log(`📬  Para: ${TO}`);
console.log("Enviando…\n");

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: EMAIL_FROM,
    to: TO,
    subject: "✅ imageColor — teste de e-mail",
    html: `
      <h2>Teste do imageColor 📸</h2>
      <p>Se chegou aqui, a integração com o <strong>Resend</strong> está funcionando.</p>
      <p>API key: <code>${RESEND_API_KEY.slice(0, 12)}…</code></p>
      <p>Hora: ${new Date().toISOString()}</p>
    `,
  }),
});

const body = await res.json();

if (res.ok) {
  console.log("✅  E-mail enviado com sucesso!");
  console.log("   ID:", body.id);
} else {
  console.error("❌  Erro ao enviar:");
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}
