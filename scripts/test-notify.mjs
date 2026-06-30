/**
 * Testa o fluxo completo de notificação:
 * - notifySelectionSubmitted (fotógrafa recebe aviso da seleção)
 * - notifyDeliveryPublished  (cliente recebe aviso da entrega)
 *
 * Uso: node scripts/test-notify.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Carrega .env.local
const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=").map((p) => p.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join("=")]),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = env.RESEND_API_KEY;
const FROM = env.EMAIL_FROM || "Isabel Pontes <onboarding@resend.dev>";
const APP_URL = env.APP_URL || "http://localhost:3000";

if (!SUPABASE_URL || !SERVICE_KEY || !RESEND_KEY) {
  console.error("❌  Variáveis de ambiente faltando no .env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function sendEmail(to, subject, html) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body.id;
}

// ── Teste 1: notifySelectionSubmitted ──────────────────────────────────────
console.log("\n── Teste 1: notifySelectionSubmitted ──");

// Busca uma sessão real com seleção
const { data: sess } = await admin
  .from("gallery_sessions")
  .select("session_token, gallery_id")
  .gt("expires_at", new Date().toISOString())
  .limit(1)
  .maybeSingle();

if (!sess) {
  console.log("⚠️  Nenhuma sessão ativa encontrada. Pulando teste 1.");
} else {
  const { data: g } = await admin
    .from("galleries")
    .select("id, title, user_id, client_id")
    .eq("id", sess.gallery_id)
    .single();

  const { data: userRes } = await admin.auth.admin.getUserById(g.user_id);
  const ownerEmail = userRes?.user?.email;
  console.log(`   Galeria : ${g.title}`);
  console.log(`   Fotógrafa: ${ownerEmail}`);

  if (!ownerEmail) {
    console.log("❌  E-mail da fotógrafa não encontrado.");
  } else {
    const { data: sel } = await admin
      .from("selections")
      .select("id")
      .eq("gallery_id", g.id)
      .eq("session_token", sess.session_token)
      .maybeSingle();
    let count = 0;
    if (sel) {
      const { count: c } = await admin
        .from("selection_items")
        .select("id", { count: "exact", head: true })
        .eq("selection_id", sel.id);
      count = c ?? 0;
    }

    let clientName = null;
    if (g.client_id) {
      const { data: cl } = await admin
        .from("clients")
        .select("name")
        .eq("id", g.client_id)
        .maybeSingle();
      clientName = cl?.name;
    }

    try {
      const id = await sendEmail(
        ownerEmail,
        `[TESTE] Seleção recebida — ${g.title}`,
        `<p>${clientName ?? "A cliente"} confirmou a seleção do ensaio <strong>${g.title}</strong>.</p>
         <p><strong>${count}</strong> foto(s) selecionada(s).</p>
         <p><a href="${APP_URL}/admin/ensaios/${g.id}">Abrir no painel</a></p>
         <p style="color:#888;font-size:12px">(e-mail de teste — não disparado por ação real)</p>`,
      );
      console.log(`✅  Enviado para ${ownerEmail} · ID: ${id}`);
    } catch (e) {
      console.error("❌  Erro:", e.message);
    }
  }
}

// ── Teste 2: notifyDeliveryPublished ──────────────────────────────────────
console.log("\n── Teste 2: notifyDeliveryPublished ──");

// Busca uma galeria com cliente que tem e-mail cadastrado
const { data: galleries } = await admin
  .from("galleries")
  .select("id, title, access_token, client_id");

let found = false;
for (const g of galleries ?? []) {
  if (!g.client_id) continue;
  const { data: cl } = await admin
    .from("clients")
    .select("name, email")
    .eq("id", g.client_id)
    .maybeSingle();
  if (!cl?.email) continue;

  console.log(`   Galeria : ${g.title}`);
  console.log(`   Cliente  : ${cl.name} <${cl.email}>`);

  try {
    const id = await sendEmail(
      cl.email,
      `[TESTE] Suas fotos estão prontas — ${g.title}`,
      `<p>Olá ${cl.name ?? ""}! Suas fotos do ensaio <strong>${g.title}</strong> já estão prontas. 🎉</p>
       <p><a href="${APP_URL}/g/${g.access_token}">Acessar e baixar</a></p>
       <p style="color:#888;font-size:12px">(e-mail de teste — não disparado por ação real)</p>`,
    );
    console.log(`✅  Enviado para ${cl.email} · ID: ${id}`);
  } catch (e) {
    console.error("❌  Erro:", e.message);
  }
  found = true;
  break;
}

if (!found) {
  console.log("⚠️  Nenhuma cliente com e-mail cadastrado. Pulando teste 2.");
  console.log("   → Para testar: cadastre uma cliente com e-mail no painel admin.");
}

console.log("\nPronto.\n");
