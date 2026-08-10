"use client";

import PocketBase from "pocketbase";

export const ADMIN_COOKIE = "pb_admin";

let pb: PocketBase | null = null;

/** Cliente PocketBase do navegador — usado só para o login da fotógrafa. */
export function browserPb(): PocketBase {
  if (pb) return pb;

  pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL!);

  // O SDK guarda o token em localStorage, que o servidor não enxerga.
  // Espelhamos em cookie para o middleware e os server components lerem.
  pb.authStore.onChange(() => {
    document.cookie = pb!.authStore.exportToCookie(
      { httpOnly: false, secure: location.protocol === "https:", sameSite: "Lax", path: "/" },
      ADMIN_COOKIE,
    );
  });

  return pb;
}
