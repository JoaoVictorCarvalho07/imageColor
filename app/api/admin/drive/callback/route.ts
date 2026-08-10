import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAdminUser } from "@/lib/pb/session";
import { superuserPb } from "@/lib/pb/superuser";
import { exchangeCode } from "@/lib/google";
import { encrypt } from "@/lib/crypto";

export const runtime = "nodejs";

function back(req: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/admin?drive=${status}`, req.url));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const jar = await cookies();
  const savedState = jar.get("drive_oauth_state")?.value;

  if (oauthError || !code || !state || state !== savedState) {
    return back(req, "error");
  }

  if (!(await getAdminUser())) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return back(req, "norefresh");

    // Busca o e-mail da conta conectada (informativo).
    let email: string | null = null;
    try {
      const info = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (info.ok) email = ((await info.json()) as { email?: string }).email ?? null;
    } catch {
      // opcional — ignora
    }

    const pb = await superuserPb();

    // Uma fotógrafa só: a conexão nova substitui a anterior.
    const current = await pb
      .collection("drive_connections")
      .getFullList<{ id: string }>();
    await Promise.all(
      current.map((c) => pb.collection("drive_connections").delete(c.id)),
    );

    await pb.collection("drive_connections").create({
      google_account_email: email ?? "",
      refresh_token_encrypted: encrypt(tokens.refresh_token),
    });

    jar.delete("drive_oauth_state");
    return back(req, "connected");
  } catch {
    return back(req, "error");
  }
}
