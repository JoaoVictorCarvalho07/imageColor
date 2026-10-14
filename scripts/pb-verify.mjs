const PB_URL = process.env.POCKETBASE_URL;
const EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!PB_URL || !EMAIL || !PASSWORD) {
  console.error("Faltam POCKETBASE_URL / _ADMIN_EMAIL / _ADMIN_PASSWORD.");
  process.exit(1);
}

const expected = {
  "media_items.gallery": { cascadeDelete: true },
  "pricing_plans.gallery": { cascadeDelete: true },
  "final_assets.gallery": { cascadeDelete: true },
  "gallery_sessions.gallery": { cascadeDelete: true },
  "selections.gallery": { cascadeDelete: true },
  "selections.media": { cascadeDelete: false },
  "selections.contracted_plan": { cascadeDelete: false },
  "selections.video_plan": { cascadeDelete: false },
  "selections.amount_cents": {},
  "orders.gallery": { cascadeDelete: true },
  "orders.selection": { cascadeDelete: false },
  "orders.amount_cents": { required: true },
  "payment_events.key": { required: true },
  "login_attempts.key": { required: true },
  "login_attempts.window_start": { required: true },
  "drive_connections.google_account_email": { required: false },
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

const expectedIndexes = {
  selections: "idx_selections_gallery_unique",
  login_attempts: "idx_login_attempts_key",
  payment_events: "idx_payment_events_key",
};

const USERS_RULES = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"];

for (const [colName, idx] of Object.entries(expectedIndexes)) {
  const col = items.find((c) => c.name === colName);
  const ok = col?.indexes?.some((i) => i.includes(idx));
  console.log(`${ok ? "✓" : "✗"} ${(colName + " índice " + idx).padEnd(40)} ${ok ? "presente" : "AUSENTE (rode pb-setup.mjs)"}`);
  if (!ok) problems.push({ missing: `${colName} índice ${idx}` });
}

const users = items.find((c) => c.name === "users");
if (!users) {
  console.log("✗ users                                    NÃO ENCONTRADA");
  problems.push({ missing: "users" });
} else {
  const openRules = USERS_RULES.filter((r) => users[r] !== null);
  const passwordOn = users.passwordAuth?.enabled !== false;
  const usersOk = openRules.length === 0 && !passwordOn;
  console.log(
    `${usersOk ? "✓" : "✗"} ${"users regras/passwordAuth".padEnd(40)} ${usersOk ? "travada" : "ABERTA: " + [...openRules, ...(passwordOn ? ["passwordAuth"] : [])].join(", ")}`,
  );
  if (!usersOk) problems.push({ usersLock: true, openRules, passwordOn, id: users.id });
  if (users.oauth2?.enabled !== true) {
    console.log("! users.oauth2 desligado — login do admin por Google não funciona");
  }
}

for (const col of items) {
  for (const f of col.fields ?? []) {
    const key = `${col.name}.${f.name}`;
    const want = expected[key];
    if (!want) continue;
    delete expected[key];

    const wrong = Object.entries(want).filter(
      ([prop, value]) => Boolean(f[prop]) !== value,
    );

    const shown = Object.keys(want)
      .map((p) => `${p}=${Boolean(f[p])}`)
      .join(" ");

    if (wrong.length === 0) {
      console.log(`✓ ${key.padEnd(40)} ${shown}`);
    } else {
      const esperado = wrong.map(([p, v]) => `${p}=${v}`).join(" ");
      console.log(`✗ ${key.padEnd(40)} ${shown}  ESPERADO ${esperado}`);
      problems.push({ collectionId: col.id, col: col.name, field: f.name, want });
    }
  }
}

for (const missing of Object.keys(expected)) {
  console.log(`✗ ${missing.padEnd(40)} NÃO ENCONTRADO`);
  problems.push({ missing });
}

if (problems.length === 0) {
  console.log("\nSchema confere.");
  process.exit(0);
}

console.log(`\n${problems.length} divergência(s).`);

if (!process.argv.includes("--fix")) {
  console.log("Rode de novo com --fix para aplicar.");
  process.exit(1);
}

console.log("Corrigindo…");
for (const p of problems) {
  if (p.usersLock) {
    const body = Object.fromEntries(p.openRules.map((r) => [r, null]));
    if (p.passwordOn) {
      const current = users.passwordAuth ?? {};
      body.passwordAuth = { ...current, enabled: false };
    }
    const res = await fetch(`${PB_URL}/api/collections/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: auth.token },
      body: JSON.stringify(body),
    });
    console.log(res.ok ? "  ✓ users" : `  ✗ users: ${JSON.stringify(await res.json())}`);
    continue;
  }
  if (p.missing) continue;
  const col = items.find((c) => c.id === p.collectionId);
  const fields = col.fields.map((f) =>
    f.name === p.field ? { ...f, ...p.want } : f,
  );
  const res = await fetch(`${PB_URL}/api/collections/${col.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: auth.token },
    body: JSON.stringify({ fields }),
  });
  console.log(
    res.ok
      ? `  ✓ ${p.col}.${p.field}`
      : `  ✗ ${p.col}.${p.field}: ${JSON.stringify(await res.json())}`,
  );
}
