"use client";

import PocketBase, { BaseAuthStore } from "pocketbase";

let pb: PocketBase | null = null;

export function browserPb(): PocketBase {
  if (pb) return pb;
  pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL!, new BaseAuthStore());
  return pb;
}

export function discardBrowserAuth(): void {
  pb?.authStore.clear();
}
