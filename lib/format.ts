export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatDateBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${iso}T00:00:00`));
}
