/**
 * Cria/atualiza o schema do PocketBase para o imageColor.
 *
 * Uso (lê as mesmas variáveis que a app usa):
 *   node --env-file=.env.local scripts/pb-setup.mjs
 *
 * Idempotente: coleções que já existem são puladas.
 *
 * NOTA sobre regras de acesso: todas as coleções ficam FECHADAS (rules = null,
 * só superuser). Todo acesso passa pelo servidor Next.js, que autentica como
 * superuser e faz o gating em código — mesmo papel que o `SECURITY DEFINER`
 * cumpria no Supabase. A cliente nunca fala direto com o PocketBase.
 */

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

/**
 * `rel(nome, alvo)` — relação para outra coleção.
 *
 * `cascadeDelete: true` apaga ESTE registro quando o alvo some — certo para
 * "filho de galeria" (apagou o ensaio, some tudo dele). Para referências
 * laterais (a seleção citando fotos ou um pacote) tem que ser `false`, senão
 * apagar uma foto levaria junto a seleção inteira da cliente.
 */
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
  __target: target, // resolvido para collectionId antes do POST
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
    // selection_items virou uma relação múltipla — o PocketBase resolve a
    // junção sozinho, então a tabela intermediária do Postgres some.
    name: "selections",
    fields: [
      rel("gallery", "galleries"),
      {
        name: "status",
        type: "select",
        maxSelect: 1,
        values: ["open", "submitted", "paid"],
      },
      // cascadeDelete:false — apagar uma foto tira ela da lista, não apaga a seleção
      rel("media", "media_items", {
        required: false,
        maxSelect: 2000,
        cascadeDelete: false,
      }),
      rel("contracted_plan", "pricing_plans", {
        required: false,
        cascadeDelete: false,
      }),
      { name: "submitted_at", type: "date" },
      ...autodate,
    ],
    indexes: [
      "CREATE INDEX `idx_selections_gallery` ON `selections` (`gallery`)",
    ],
  },

  {
    name: "drive_connections",
    fields: [
      // Informativo (qual conta foi conectada). NÃO pode ser obrigatório: se
      // o /userinfo do Google falhar, o campo vem vazio e a conexão inteira
      // seria rejeitada.
      { name: "google_account_email", type: "email", required: false },
      { name: "refresh_token_encrypted", type: "text", required: true, max: 2000 },
      ...autodate,
    ],
  },
];

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

  for (const col of collections) {
    if (idByName.has(col.name)) {
      console.log(`· ${col.name} — já existe, pulando`);
      continue;
    }

    // resolve as relações para o id real da coleção alvo
    const fields = col.fields.map((f) => {
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

    const created = await api("/api/collections", {
      method: "POST",
      token,
      body: {
        name: col.name,
        type: "base",
        fields,
        indexes: col.indexes ?? [],
        // fechadas: só o superuser (o servidor Next.js) acessa
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

  console.log("\nSchema pronto.");
}

main().catch((err) => {
  console.error("\n✗ Falhou:\n" + err.message);
  process.exit(1);
});
