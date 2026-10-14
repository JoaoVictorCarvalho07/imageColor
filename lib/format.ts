export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatDateBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${iso}T00:00:00`));
}

export function parseBRLToCents(input: string): number {
  const raw = input.replace(/[^\d.,-]/g, "");
  if (!raw) return 0;

  let normalized: string;
  if (raw.includes(",")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if ((raw.match(/\./g) ?? []).length > 1 || /^\d+\.\d{3}$/.test(raw)) {
    normalized = raw.replace(/\./g, "");
  } else {
    normalized = raw;
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
}
