/**
 * Confere o schema REAL no servidor contra o que o app espera.
 *
 *   node --env-file=.env.local scripts/pb-verify.mjs
 *
 * Existe porque `pb-setup.mjs` pula coleções já criadas: se o schema mudou
 * depois da primeira execução, o setup diz "ok" sem aplicar nada.
 */

const PB_URL = process.env.POCKETBASE_URL;
const EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!PB_URL || !EMAIL || !PASSWORD) {
  console.error("Faltam POCKETBASE_URL / _ADMIN_EMAIL / _ADMIN_PASSWORD.");
  process.exit(1);
}

/** relação → cascadeDelete esperado. */
const expected = {
  "media_items.gallery": { cascadeDelete: true },
  "pricing_plans.gallery": { cascadeDelete: true },
  "final_assets.gallery": { cascadeDelete: true },
  "gallery_sessions.gallery": { cascadeDelete: true },
  "selections.gallery": { cascadeDelete: true },
  // Referências laterais: apagar a foto/plano NÃO pode apagar a seleção.
  "selections.media": { cascadeDelete: false },
  "selections.contracted_plan": { cascadeDelete: false },
};

const auth = await fetch(
  `${PB_URL}/api/collections/_superusers/auth-with-password`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
  },
).then((r) => r.json());

if (!auth.token) {
  console.error("Falha ao autenticar:", auth);
  process.exit(1);
}

const { items } = await fetch(`${PB_URL}/api/collections?perPage=200`, {
  headers: { Authorization: auth.token },
}).then((r) => r.json());

const problems = [];

for (const col of items) {
  for (const f of col.fields ?? []) {
    if (f.type !== "relation") continue;
    const key = `${col.name}.${f.name}`;
    const want = expected[key];
    if (!want) continue;

    const actual = Boolean(f.cascadeDelete);
    const ok = actual === want.cascadeDelete;
    console.log(
      `${ok ? "✓" : "✗"} ${key.padEnd(34)} cascadeDelete=${String(actual).padEnd(5)}` +
        (ok ? "" : `  ESPERADO ${want.cascadeDelete}`),
    );
    if (!ok) problems.push({ collectionId: col.id, col: col.name, field: f.name, want });
    delete expected[key];
  }
}

for (const missing of Object.keys(expected)) {
  console.log(`✗ ${missing.padEnd(34)} NÃO ENCONTRADA`);
  problems.push({ missing });
}

if (problems.length === 0) {
  console.log("\nSchema confere.");
  process.exit(0);
}

console.log(`\n${problems.length} divergência(s).`);
if (process.argv.includes("--fix")) {
  console.log("Corrigindo…");
  for (const p of problems) {
    if (p.missing) continue;
    const col = items.find((c) => c.id === p.collectionId);
    const fields = col.fields.map((f) =>
      f.name === p.field ? { ...f, cascadeDelete: p.want.cascadeDelete } : f,
    );
    const res = await fetch(`${PB_URL}/api/collections/${col.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth.token,
      },
      body: JSON.stringify({ fields }),
    });
    console.log(
      res.ok
        ? `  ✓ ${p.col}.${p.field} → cascadeDelete=${p.want.cascadeDelete}`
        : `  ✗ ${p.col}.${p.field}: ${JSON.stringify(await res.json())}`,
    );
  }
} else {
  console.log("Rode de novo com --fix para aplicar.");
  process.exit(1);
}
