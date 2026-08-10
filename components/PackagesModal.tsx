"use client";

import { X, Gift, Check } from "lucide-react";
import { formatBRL } from "@/lib/format";
import type { PricingPlan } from "@/lib/types";

const KIND_LABEL: Record<PricingPlan["kind"], string> = {
  single: "Avulso",
  package: "Pacote",
  full: "Completo",
};

export function PackagesModal({
  plans,
  contractedPlanId,
  onContract,
  onClose,
}: {
  plans: PricingPlan[];
  contractedPlanId: string | null;
  onContract: (plan: PricingPlan | null) => void;
  onClose: () => void;
}) {
  const photoPlans = plans.filter((p) => p.mediaType === "photo");
  const videoPlans = plans.filter((p) => p.mediaType === "video");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-card p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-primary">Pacotes disponíveis</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {photoPlans.length > 0 && (
          <PlanGroup
            label="Fotos"
            plans={photoPlans}
            contractedPlanId={contractedPlanId}
            onContract={onContract}
          />
        )}

        {videoPlans.length > 0 && (
          <div className={photoPlans.length > 0 ? "mt-5" : ""}>
            <PlanGroup
              label="Vídeos"
              plans={videoPlans}
              contractedPlanId={contractedPlanId}
              onContract={onContract}
            />
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          O valor do pacote será combinado diretamente com o estúdio.
        </p>
      </div>
    </div>
  );
}

function PlanGroup({
  label,
  plans,
  contractedPlanId,
  onContract,
}: {
  label: string;
  plans: PricingPlan[];
  contractedPlanId: string | null;
  onContract: (plan: PricingPlan | null) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ul className="space-y-2">
        {plans.map((p) => {
          const isGift = p.priceCents === 0;
          const isContracted = contractedPlanId === p.id;

          return (
            <li
              key={p.id}
              className={`rounded-md border bg-background px-4 py-3 transition-colors ${
                isContracted ? "border-accent" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-primary">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {KIND_LABEL[p.kind]}
                    {p.kind === "package" && p.includedQty != null
                      ? ` · ${p.includedQty} ${label.toLowerCase()} inclusas`
                      : ""}
                    {p.kind === "package" &&
                    p.extraItemCents != null &&
                    p.extraItemCents > 0
                      ? ` · extra ${formatBRL(p.extraItemCents)} cada`
                      : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {isGift ? (
                    <span className="inline-flex items-center gap-1 text-sm text-accent">
                      <Gift className="h-3.5 w-3.5" /> Brinde
                    </span>
                  ) : (
                    <span className="font-display text-lg text-accent">
                      {formatBRL(p.priceCents)}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3">
                {isContracted ? (
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                      <Check className="h-4 w-4" /> Pacote adicionado
                    </span>
                    <button
                      type="button"
                      onClick={() => onContract(null)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onContract(p)}
                    className="w-full rounded-md bg-accent py-1.5 text-sm font-medium uppercase tracking-wide text-accent-foreground hover:opacity-90"
                  >
                    Adicionar pacote
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
