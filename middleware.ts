import { NextResponse, type NextRequest } from "next/server";
import { looksLoggedIn, ADMIN_COOKIE } from "@/lib/pb/edgeSession";

/**
 * Barreira de UX, não de segurança: só evita renderizar o painel para quem
 * claramente não está logado. A checagem aqui não valida a assinatura do
 * token (o Edge não tem a chave), então quem autoriza acesso a dados é o
 * `requireAdmin()` do layout e das server actions.
 */
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
