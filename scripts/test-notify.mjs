import PocketBase from "pocketbase";

const {
  POCKETBASE_URL,
  POCKETBASE_ADMIN_EMAIL,
  POCKETBASE_ADMIN_PASSWORD,
  ADMIN_EMAILS,
  RESEND_API_KEY,
} = process.env;
const FROM = process.env.EMAIL_FROM || "Isabel Pontes <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

if (
  !POCKETBASE_URL ||
  !POCKETBASE_ADMIN_EMAIL ||
  !POCKETBASE_ADMIN_PASSWORD ||
  !RESEND_API_KEY
) {
  console.error(
    "Faltam POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD ou RESEND_API_KEY.\n" +
      "Rode com: node --env-file=.env.local scripts/test-notify.mjs",
  );
  process.exit(1);
}

const pb = new PocketBase(POCKETBASE_URL);
pb.autoCancellation(false);
await pb
  .collection("_superusers")
  .authWithPassword(POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD);

async function sendEmail(to, subject, html) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body.id;
}

const footer =
  '<p style="color:#888;font-size:12px">(e-mail de teste, não disparado por ação real)</p>';

console.log("\nTeste 1: seleção enviada (aviso à fotógrafa)");

const ownerEmail = (ADMIN_EMAILS ?? "").split(",")[0]?.trim();

if (!ownerEmail) {
  console.log("ADMIN_EMAILS vazio, pulando o teste 1.");
} else {
  const selections = await pb.collection("selections").getList(1, 1, {
    filter: "status = 'submitted' || status = 'paid'",
    sort: "-submitted_at",
    expand: "gallery",
  });
  const selection = selections.items[0];

  if (!selection) {
    console.log("Nenhuma seleção enviada encontrada, pulando o teste 1.");
  } else {
    const gallery = selection.expand?.gallery;
    const count = selection.media?.length ?? 0;
    console.log(`Ensaio: ${gallery?.title}`);
    console.log(`Fotógrafa: ${ownerEmail}`);
    try {
      const id = await sendEmail(
        ownerEmail,
        `[TESTE] Seleção recebida — ${gallery?.title}`,
        `<p>${gallery?.client_name || "A cliente"} confirmou a seleção do ensaio <strong>${gallery?.title}</strong>.</p>
         <p><strong>${count}</strong> foto(s) selecionada(s).</p>
         <p><a href="${APP_URL}/admin/ensaios/${gallery?.id}">Abrir no painel</a></p>
         ${footer}`,
      );
      console.log(`Enviado para ${ownerEmail} (id ${id})`);
    } catch (e) {
      console.error("Erro:", e.message);
    }
  }
}

console.log("\nTeste 2: entrega publicada (aviso à cliente)");

const galleries = await pb.collection("galleries").getList(1, 1, {
  filter: "client_email != ''",
  sort: "-created",
});
const gallery = galleries.items[0];

if (!gallery) {
  console.log("Nenhum ensaio com e-mail da cliente, pulando o teste 2.");
  console.log("Cadastre o e-mail da cliente ao criar o ensaio no painel.");
} else {
  console.log(`Ensaio: ${gallery.title}`);
  console.log(`Cliente: ${gallery.client_name} <${gallery.client_email}>`);
  try {
    const id = await sendEmail(
      gallery.client_email,
      `[TESTE] Suas fotos estão prontas — ${gallery.title}`,
      `<p>Olá ${gallery.client_name || ""}! Suas fotos do ensaio <strong>${gallery.title}</strong> já estão prontas.</p>
       <p><a href="${APP_URL}/g/${gallery.access_token}">Acessar e baixar</a></p>
       ${footer}`,
    );
    console.log(`Enviado para ${gallery.client_email} (id ${id})`);
  } catch (e) {
    console.error("Erro:", e.message);
  }
}

console.log("\nPronto.\n");
