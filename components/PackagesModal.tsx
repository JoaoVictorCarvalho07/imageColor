"use client";

import { useEffect, useRef } from "react";
import { X, Gift, Check } from "lucide-react";
import { formatBRL } from "@/lib/format";
import type { MediaType, PricingPlan } from "@/lib/types";

const KIND_LABEL: Record<PricingPlan["kind"], string> = {
  single: "Avulso",
  package: "Pacote",
  full: "Completo",
};

export function PackagesModal({
  plans,
  contracted,
  locked,
  onContract,
  onClose,
}: {
  plans: PricingPlan[];
  contracted: Record<MediaType, string | null>;
  locked: boolean;
  onContract: (mediaType: MediaType, plan: PricingPlan | null) => void;
  onClose: () => void;
}) {
  const photoPlans = plans.filter((p) => p.mediaType === "photo");
  const videoPlans = plans.filter((p) => p.mediaType === "video");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="packages-title"
        className="safe-bottom max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card px-5 pt-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="packages-title" className="font-display text-xl text-primary">
            Pacotes disponíveis
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {photoPlans.length > 0 && (
          <PlanGroup
            label="Fotos"
            plans={photoPlans}
            contractedPlanId={contracted.photo}
            locked={locked}
            onContract={(plan) => onContract("photo", plan)}
          />
        )}

        {videoPlans.length > 0 && (
          <div className={photoPlans.length > 0 ? "mt-5" : ""}>
            <PlanGroup
              label="Vídeos"
              plans={videoPlans}
              contractedPlanId={contracted.video}
              locked={locked}
              onContract={(plan) => onContract("video", plan)}
            />
          </div>
        )}

        <p className="mt-4 pb-1 text-xs text-muted-foreground">
          O total é calculado na sua seleção e pago por Pix ou cartão ao confirmar.
        </p>
      </div>
    </div>
  );
}

function PlanGroup({
  label,
  plans,
  contractedPlanId,
  locked,
  onContract,
}: {
  label: string;
  plans: PricingPlan[];
  contractedPlanId: string | null;
  locked: boolean;
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
                      ? ` · ${p.includedQty} ${label.toLowerCase()} ${label === "Fotos" ? "inclusas" : "inclusos"}`
                      : ""}
                    {p.kind === "single" ? " · por item" : ""}
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
                    {!locked && (
                      <button
                        type="button"
                        onClick={() => onContract(null)}
                        className="px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                ) : locked ? null : (
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
