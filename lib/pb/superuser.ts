import "server-only";

import PocketBase from "pocketbase";

let cached: PocketBase | null = null;
let inFlight: Promise<PocketBase> | null = null;

async function authenticate(): Promise<PocketBase> {
  const url = process.env.POCKETBASE_URL;
  const email = process.env.POCKETBASE_ADMIN_EMAIL;
  const password = process.env.POCKETBASE_ADMIN_PASSWORD;

  if (!url || !email || !password) {
    throw new Error(
      "PocketBase não configurado: faltam POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL ou POCKETBASE_ADMIN_PASSWORD.",
    );
  }

  const pb = new PocketBase(url);
  pb.autoCancellation(false);

  await pb.collection("_superusers").authWithPassword(email, password);
  cached = pb;
  return pb;
}

export async function superuserPb(): Promise<PocketBase> {
  if (cached?.authStore.isValid) return cached;
  inFlight ??= authenticate().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
