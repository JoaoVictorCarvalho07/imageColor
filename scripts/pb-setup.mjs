const PB_URL = process.env.POCKETBASE_URL;
const EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!PB_URL || !EMAIL || !PASSWORD) {
  console.error(
    "Faltam POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL ou POCKETBASE_ADMIN_PASSWORD.\n" +
      "Rode com: node --env-file=.env.local scripts/pb-setup.mjs",
  );
  process.exit(1);
}

const autodate = [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
];

const rel = (
  name,
  target,
  { required = true, maxSelect = 1, cascadeDelete = true } = {},
) => ({
  name,
  type: "relation",
  required,
  maxSelect,
  cascadeDelete,
  __target: target,
});

const collections = [
  {
    name: "galleries",
    fields: [
      { name: "title", type: "text", required: true, max: 200 },
      { name: "client_name", type: "text", max: 200 },
      { name: "client_email", type: "email" },
      { name: "access_token", type: "text", required: true, max: 64 },
      { name: "password_hash", type: "text", max: 255 },
      {
        name: "status",
        type: "select",
        maxSelect: 1,
        values: ["draft", "processing", "ready", "closed"],
      },
      { name: "access_expires_at", type: "date" },
      { name: "download_expires_days", type: "number" },
      {
        name: "selection_mode",
        type: "select",
        maxSelect: 1,
        values: ["free", "quota"],
      },
      { name: "selection_limit", type: "number" },
      { name: "extra_photo_cents", type: "number" },
      {
        name: "delivery_mode",
        type: "select",
        maxSelect: 1,
        values: ["edit", "direct"],
      },
      { name: "delivered_at", type: "date" },
      { name: "drive_folder_id", type: "text", max: 200 },
      ...autodate,
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_galleries_access_token` ON `galleries` (`access_token`)",
    ],
  },

  {
    name: "media_items",
    fields: [
      rel("gallery", "galleries"),
      {
        name: "type",
        type: "select",
        maxSelect: 1,
        required: true,
        values: ["photo", "video"],
      },
      {
        name: "status",
        type: "select",
        maxSelect: 1,
        values: ["pending", "ready", "failed"],
      },
      { name: "filename", type: "text", max: 500 },
      { name: "preview_key", type: "text", max: 500 },
      { name: "thumb_key", type: "text", max: 500 },
      { name: "original_key", type: "text", max: 500 },
      { name: "drive_file_id", type: "text", max: 200 },
      { name: "position", type: "number" },
      { name: "duration_sec", type: "number" },
      { name: "width", type: "number" },
      { name: "height", type: "number" },
      ...autodate,
    ],
    indexes: [
      "CREATE INDEX `idx_media_gallery` ON `media_items` (`gallery`)",
      "CREATE INDEX `idx_media_drive_file` ON `media_items` (`gallery`, `drive_file_id`)",
    ],
  },

  {
    name: "pricing_plans",
    fields: [
      rel("gallery", "galleries"),
      {
        name: "media_type",
        type: "select",
        maxSelect: 1,
        required: true,
        values: ["photo", "video"],
      },
      {
        name: "kind",
        type: "select",
        maxSelect: 1,
        required: true,
        values: ["single", "package", "full"],
      },
      { name: "name", type: "text", required: true, max: 200 },
      { name: "included_qty", type: "number" },
      { name: "price_cents", type: "number" },
      { name: "extra_item_cents", type: "number" },
      ...autodate,
    ],
    indexes: ["CREATE INDEX `idx_plans_gallery` ON `pricing_plans` (`gallery`)"],
  },

  {
    name: "final_assets",
    fields: [
      rel("gallery", "galleries"),
      { name: "storage_key", type: "text", required: true, max: 500 },
      { name: "filename", type: "text", max: 500 },
      ...autodate,
    ],
    indexes: ["CREATE INDEX `idx_finals_gallery` ON `final_assets` (`gallery`)"],
  },

  {
    name: "gallery_sessions",
    fields: [
      rel("gallery", "galleries"),
      { name: "token", type: "text", required: true, max: 100 },
      { name: "expires_at", type: "date", required: true },
      ...autodate,
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_sessions_token` ON `gallery_sessions` (`token`)",
    ],
  },

  {
    name: "selections",
    fields: [
      rel("gallery", "galleries"),
      {
        name: "status",
        type: "select",
        maxSelect: 1,
        values: ["open", "submitted", "paid"],
      },
      rel("media", "media_items", {
        required: false,
        maxSelect: 2000,
        cascadeDelete: false,
      }),
      rel("contracted_plan", "pricing_plans", {
        required: false,
        cascadeDelete: false,
      }),
      rel("video_plan", "pricing_plans", {
        required: false,
        cascadeDelete: false,
      }),
      { name: "submitted_at", type: "date" },
      { name: "amount_cents", type: "number" },
      ...autodate,
    ],
    indexes: [
      "CREATE INDEX `idx_selections_gallery` ON `selections` (`gallery`)",
      "CREATE UNIQUE INDEX `idx_selections_gallery_unique` ON `selections` (`gallery`)",
    ],
  },

  {
    name: "drive_connections",
    fields: [
      { name: "google_account_email", type: "email", required: false },
      { name: "refresh_token_encrypted", type: "text", required: true, max: 2000 },
      ...autodate,
    ],
  },

  {
    name: "login_attempts",
    fields: [
      { name: "key", type: "text", required: true, max: 200 },
      { name: "count", type: "number" },
      { name: "window_start", type: "date", required: true },
      { name: "blocked_until", type: "date" },
      ...autodate,
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_login_attempts_key` ON `login_attempts` (`key`)",
    ],
  },

  {
    name: "orders",
    fields: [
      rel("gallery", "galleries"),
      rel("selection", "selections", { required: false, cascadeDelete: false }),
      {
        name: "status",
        type: "select",
        maxSelect: 1,
        required: true,
        values: ["pending", "paid", "cancelled", "refunded"],
      },
      { name: "amount_cents", type: "number", required: true },
      { name: "media", type: "json", maxSize: 200000 },
      { name: "photo_plan", type: "text", max: 50 },
      { name: "video_plan", type: "text", max: 50 },
      { name: "quote", type: "json", maxSize: 20000 },
      { name: "preference_id", type: "text", max: 200 },
      { name: "checkout_url", type: "url" },
      { name: "payment_id", type: "text", max: 100 },
      { name: "payment_status", type: "text", max: 50 },
      { name: "payment_method", type: "text", max: 50 },
      { name: "paid_at", type: "date" },
      ...autodate,
    ],
    indexes: [
      "CREATE INDEX `idx_orders_gallery` ON `orders` (`gallery`)",
      "CREATE INDEX `idx_orders_status` ON `orders` (`gallery`, `status`)",
    ],
  },

  {
    name: "payment_events",
    fields: [
      { name: "key", type: "text", required: true, max: 200 },
      rel("order", "orders", { required: false }),
      { name: "payment_id", type: "text", max: 100 },
      { name: "status", type: "text", max: 50 },
      ...autodate,
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_payment_events_key` ON `payment_events` (`key`)",
    ],
  },
];

const USERS_LOCKDOWN = {
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null,
};

function indexName(sql) {
  const m = /INDEX\s+(?:IF NOT EXISTS\s+)?[`"\[]?([A-Za-z0-9_]+)/i.exec(sql);
  return m ? m[1] : sql;
}

function resolveFields(col, idByName) {
  return col.fields.map((f) => {
    if (!f.__target) return f;
    const collectionId = idByName.get(f.__target);
    if (!collectionId) {
      throw new Error(
        `Relação ${col.name}.${f.name} aponta para "${f.__target}", que ainda não existe.`,
      );
    }
    const { __target, ...rest } = f;
    return { ...rest, collectionId };
  });
}

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(
      `${method} ${path} → ${res.status}\n${JSON.stringify(json, null, 2)}`,
    );
  }
  return json;
}

async function ensureCollection(col, current, idByName, token) {
  const haveFields = new Set(current.fields.map((f) => f.name));
  const missingFields = resolveFields(col, idByName).filter(
    (f) => !haveFields.has(f.name),
  );

  if (missingFields.length) {
    await api(`/api/collections/${current.id}`, {
      method: "PATCH",
      token,
      body: { fields: [...current.fields, ...missingFields] },
    });
    console.log(
      `✓ ${col.name} — campos adicionados: ${missingFields.map((f) => f.name).join(", ")}`,
    );
  }

  const currentIndexes = current.indexes ?? [];
  const haveIndexes = new Set(currentIndexes.map(indexName));
  const missingIndexes = (col.indexes ?? []).filter(
    (i) => !haveIndexes.has(indexName(i)),
  );

  if (missingIndexes.length) {
    try {
      await api(`/api/collections/${current.id}`, {
        method: "PATCH",
        token,
        body: { indexes: [...currentIndexes, ...missingIndexes] },
      });
      console.log(
        `✓ ${col.name} — índices adicionados: ${missingIndexes.map(indexName).join(", ")}`,
      );
    } catch (err) {
      process.exitCode = 1;
      const idx = missingIndexes.map(indexName).join(", ");
      console.error(`✗ ${col.name} — não foi possível criar o índice ${idx}.`);
      console.error(
        "  Se há registros duplicados na coluna do índice único, remova as duplicatas e rode de novo.",
      );
      console.error(err.message);
    }
  }

  if (!missingFields.length && !missingIndexes.length) {
    console.log(`· ${col.name} — em dia`);
  }
}

async function lockDownUsers(token) {
  const users = await api("/api/collections/users", { token });
  const changes = [];
  const body = {};

  for (const [rule, wanted] of Object.entries(USERS_LOCKDOWN)) {
    if (users[rule] !== wanted) {
      body[rule] = wanted;
      changes.push(`${rule}: ${JSON.stringify(users[rule])} → null`);
    }
  }

  if (users.passwordAuth?.enabled !== false) {
    body.passwordAuth = { ...users.passwordAuth, enabled: false };
    changes.push("passwordAuth.enabled: true → false");
  }

  if (changes.length) {
    await api(`/api/collections/${users.id}`, { method: "PATCH", token, body });
    console.log("✓ users — travada:");
    for (const c of changes) console.log(`    ${c}`);
  } else {
    console.log("· users — em dia");
  }

  if (users.oauth2?.enabled !== true) {
    console.warn(
      "! users.oauth2 está DESLIGADO — o login do admin por Google não vai funcionar. Ative no painel do PocketBase.",
    );
  }
}

async function main() {
  console.log(`→ Autenticando em ${PB_URL}`);
  const auth = await api("/api/collections/_superusers/auth-with-password", {
    method: "POST",
    body: { identity: EMAIL, password: PASSWORD },
  });
  const token = auth.token;
  console.log("  ✓ autenticado\n");

  const existing = await api("/api/collections?perPage=200", { token });
  const idByName = new Map(existing.items.map((c) => [c.name, c.id]));
  const currentByName = new Map(existing.items.map((c) => [c.name, c]));

  for (const col of collections) {
    const current = currentByName.get(col.name);
    if (current) {
      await ensureCollection(col, current, idByName, token);
      continue;
    }

    const created = await api("/api/collections", {
      method: "POST",
      token,
      body: {
        name: col.name,
        type: "base",
        fields: resolveFields(col, idByName),
        indexes: col.indexes ?? [],
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
      },
    });

    idByName.set(col.name, created.id);
    console.log(`✓ ${col.name} — criada (${created.id})`);
  }

  await lockDownUsers(token);

  console.log("\nSchema pronto.");
}

main().catch((err) => {
  console.error("\n✗ Falhou:\n" + err.message);
  process.exit(1);
});
