export function sessionCookieName(token: string): string {
  return `ic_sess_${token}`;
}
