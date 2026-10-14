import { NextResponse, type NextRequest } from "next/server";
import { looksLoggedIn, ADMIN_COOKIE } from "@/lib/pb/edgeSession";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith("/admin") && !path.startsWith("/admin/login");

  if (!isProtected) return NextResponse.next();

  if (!looksLoggedIn(request.cookies.get(ADMIN_COOKIE)?.value)) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
