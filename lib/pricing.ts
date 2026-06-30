import type { PricingPlan } from "./types";

/** Custo das fotos para um plano e uma quantidade selecionada. */
export function photoCost(plan: PricingPlan, count: number): number {
  if (count === 0) return 0;
  if (plan.kind === "full") return plan.priceCents;
  if (plan.kind === "single") return count * plan.priceCents;
  // package
  const extra = Math.max(0, count - (plan.includedQty ?? 0));
  return plan.priceCents + extra * (plan.extraItemCents ?? 0);
}

/** Custo dos vídeos (avulso por item). */
export function videoCost(plan: PricingPlan | undefined, count: number): number {
  if (!plan || count === 0) return 0;
  return count * plan.priceCents;
}
