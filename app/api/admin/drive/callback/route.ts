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

    let email: string | null = null;
    try {
      const info = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (info.ok) {
        email = ((await info.json()) as { email?: string }).email ?? null;
      } else {
        console.warn("[drive/callback] userinfo falhou:", info.status);
      }
    } catch (err) {
      console.warn("[drive/callback] userinfo indisponível:", err);
    }

    const pb = await superuserPb();

    const created = await pb.collection("drive_connections").create({
      google_account_email: email ?? "",
      refresh_token_encrypted: encrypt(tokens.refresh_token),
    });

    const stale = await pb
      .collection("drive_connections")
      .getFullList<{ id: string }>({
        filter: pb.filter("id != {:id}", { id: created.id }),
      });
    await Promise.all(
      stale.map((c) => pb.collection("drive_connections").delete(c.id)),
    );

    jar.delete("drive_oauth_state");
    return back(req, "connected");
  } catch (err) {
    console.error("[drive/callback] falhou:", err);
    return back(req, "error");
  }
}
