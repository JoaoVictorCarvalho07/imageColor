/** Nome do cookie de sessão da cliente para uma galeria (link + senha). */
export function sessionCookieName(token: string): string {
  return `ic_sess_${token}`;
}
