import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/admin/login", req.url));

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      return back(req, "norefresh");
    }

    // Busca o e-mail da conta conectada (informativo).
    let email: string | null = null;
    try {
      const info = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      );
      if (info.ok) email = ((await info.json()) as { email?: string }).email ?? null;
    } catch {
      // opcional — ignora
    }

    await supabase.from("drive_connections").delete().eq("user_id", user.id);
    const { error } = await supabase.from("drive_connections").insert({
      user_id: user.id,
      google_account_email: email,
      refresh_token_encrypted: encrypt(tokens.refresh_token),
    });
    if (error) return back(req, "error");

    jar.delete("drive_oauth_state");
    return back(req, "connected");
  } catch {
    return back(req, "error");
  }
}
