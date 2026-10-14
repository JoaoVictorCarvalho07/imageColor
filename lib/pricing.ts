import type { PricingPlan, SelectionMode } from "./types";

export interface PricingContext {
  selectionMode: SelectionMode;
  selectionLimit?: number | null;
  extraPhotoCents?: number | null;
  plans: PricingPlan[];
}

export interface SelectionInput {
  photoCount: number;
  videoCount: number;
  photoPlanId: string | null;
  videoPlanId: string | null;
}

export interface MediaQuote {
  count: number;
  plan: PricingPlan | null;
  allIncluded: boolean;
  limit: number | null;
  canExceedLimit: boolean;
  included: number;
  extras: number;
  extraUnitCents: number | null;
  planCents: number;
  extrasCents: number;
  totalCents: number;
}

export interface SelectionQuote {
  photos: MediaQuote;
  videos: MediaQuote;
  totalCents: number;
}

export function findPlan(
  plans: PricingPlan[],
  id: string | null,
  mediaType: PricingPlan["mediaType"],
): PricingPlan | null {
  if (!id) return null;
  return plans.find((p) => p.id === id && p.mediaType === mediaType) ?? null;
}

function quoteMedia(
  count: number,
  plan: PricingPlan | null,
  baseLimit: number | null,
  baseExtraCents: number | null,
): MediaQuote {
  const quote = (q: Omit<MediaQuote, "count" | "plan" | "totalCents">): MediaQuote => ({
    count,
    plan,
    ...q,
    totalCents: q.planCents + q.extrasCents,
  });

  if (plan?.kind === "full") {
    return quote({
      allIncluded: true,
      limit: null,
      canExceedLimit: true,
      included: count,
      extras: 0,
      extraUnitCents: null,
      planCents: plan.priceCents,
      extrasCents: 0,
    });
  }

  if (plan?.kind === "single") {
    const free = baseLimit ?? 0;
    const paid = Math.max(0, count - free);
    return quote({
      allIncluded: false,
      limit: null,
      canExceedLimit: true,
      included: Math.min(count, free),
      extras: paid,
      extraUnitCents: plan.priceCents,
      planCents: 0,
      extrasCents: paid * plan.priceCents,
    });
  }

  const limit =
    plan?.kind === "package" ? (baseLimit ?? 0) + (plan.includedQty ?? 0) : baseLimit;
  const extraUnitCents =
    plan?.kind === "package" ? (plan.extraItemCents ?? baseExtraCents) : baseExtraCents;
  const extras = limit === null ? 0 : Math.max(0, count - limit);

  return quote({
    allIncluded: false,
    limit,
    canExceedLimit: limit === null || extraUnitCents !== null,
    included: count - extras,
    extras,
    extraUnitCents,
    planCents: plan?.priceCents ?? 0,
    extrasCents: extras * (extraUnitCents ?? 0),
  });
}

export function defaultVideoPlan(plans: PricingPlan[]): PricingPlan | null {
  return plans.find((p) => p.mediaType === "video" && p.kind === "single") ?? null;
}

export function quoteSelection(ctx: PricingContext, sel: SelectionInput): SelectionQuote {
  const photoPlan = findPlan(ctx.plans, sel.photoPlanId, "photo");
  const videoPlan =
    findPlan(ctx.plans, sel.videoPlanId, "video") ?? defaultVideoPlan(ctx.plans);

  const isQuota = ctx.selectionMode === "quota";
  const photos = quoteMedia(
    sel.photoCount,
    photoPlan,
    isQuota ? (ctx.selectionLimit ?? 0) : null,
    isQuota ? (ctx.extraPhotoCents ?? null) : null,
  );
  const videos = quoteMedia(sel.videoCount, videoPlan, null, null);

  return { photos, videos, totalCents: photos.totalCents + videos.totalCents };
}

export function exceedsLimit(q: MediaQuote): boolean {
  return !q.canExceedLimit && q.limit !== null && q.count > q.limit;
}
