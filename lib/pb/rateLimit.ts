import "server-only";

import { headers } from "next/headers";
import { ClientResponseError } from "pocketbase";
import { superuserPb } from "@/lib/pb/superuser";

const COLLECTION = "login_attempts";
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;
const BLOCK_MS = 15 * 60_000;

interface AttemptRecord {
  id: string;
  count: number;
  window_start: string;
  blocked_until: string;
}

let warnedMissing = false;

function parseDate(value: string | undefined): number {
  if (!value) return 0;
  const ms = new Date(value.replace(" ", "T")).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function isMissingCollection(err: unknown): boolean {
  return err instanceof ClientResponseError && err.status === 404;
}

function warnMissingOnce() {
  if (warnedMissing) return;
  warnedMissing = true;
  console.warn(
    `[rateLimit] coleção "${COLLECTION}" não existe — limite de tentativas desativado. Rode scripts/pb-setup.mjs.`,
  );
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}

export async function attemptKey(token: string): Promise<string> {
  return `${token}:${await clientIp()}`.slice(0, 200);
}

async function findAttempt(key: string): Promise<AttemptRecord | null> {
  const pb = await superuserPb();
  const list = await pb
    .collection(COLLECTION)
    .getList<AttemptRecord>(1, 1, { filter: pb.filter("key = {:k}", { k: key }) });
  return list.items[0] ?? null;
}

export async function isBlocked(key: string): Promise<boolean> {
  try {
    const rec = await findAttempt(key);
    return !!rec && parseDate(rec.blocked_until) > Date.now();
  } catch (err) {
    if (isMissingCollection(err)) {
      warnMissingOnce();
      return false;
    }
    throw err;
  }
}

export async function registerFailure(key: string): Promise<void> {
  try {
    const pb = await superuserPb();
    const rec = await findAttempt(key);
    const now = Date.now();

    if (!rec || parseDate(rec.window_start) + WINDOW_MS <= now) {
      const data = {
        key,
        count: 1,
        window_start: new Date(now).toISOString(),
        blocked_until: "",
      };
      if (rec) await pb.collection(COLLECTION).update(rec.id, data);
      else await pb.collection(COLLECTION).create(data);
      return;
    }

    const count = (rec.count ?? 0) + 1;
    await pb.collection(COLLECTION).update(rec.id, {
      count,
      blocked_until:
        count >= MAX_FAILURES ? new Date(now + BLOCK_MS).toISOString() : "",
    });
  } catch (err) {
    if (isMissingCollection(err)) {
      warnMissingOnce();
      return;
    }
    throw err;
  }
}

export async function resetAttempts(key: string): Promise<void> {
  try {
    const rec = await findAttempt(key);
    if (!rec) return;
    const pb = await superuserPb();
    await pb.collection(COLLECTION).delete(rec.id);
  } catch (err) {
    if (isMissingCollection(err)) {
      warnMissingOnce();
      return;
    }
    throw err;
  }
}
