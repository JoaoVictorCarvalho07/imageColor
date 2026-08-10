import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { getAdminUser } from "@/lib/pb/session";
import { buildAuthUrl } from "@/lib/google";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await getAdminUser())) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("drive_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildAuthUrl(state));
}
