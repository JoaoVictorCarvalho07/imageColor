export const ADMIN_COOKIE = "pb_admin";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    return JSON.parse(atob(b64 + pad));
  } catch {
    return null;
  }
}

export function looksLoggedIn(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  try {
    const parsed = JSON.parse(decodeURIComponent(cookieValue));
    const token = parsed?.token;
    if (typeof token !== "string") return false;

    const payload = decodeJwtPayload(token);
    const exp = payload?.exp;
    if (typeof exp !== "number") return false;

    return exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
