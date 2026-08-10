"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PricingPlan } from "@/lib/types";

type ByToken = Record<string, Record<string, true>>;
type ContractedByToken = Record<string, PricingPlan | null>;

interface SelectionState {
  byToken: ByToken;
  contractedByToken: ContractedByToken;
  toggle: (token: string, id: string) => void;
  clear: (token: string) => void;
  contractPlan: (token: string, plan: PricingPlan | null) => void;
}

export const useSelectionStore = create<SelectionState>()(
  persist(
    (set) => ({
      byToken: {},
      contractedByToken: {},
      toggle: (token, id) =>
        set((s) => {
          const current = { ...(s.byToken[token] ?? {}) };
          if (current[id]) {
            delete current[id];
          } else {
            current[id] = true;
          }
          return { byToken: { ...s.byToken, [token]: current } };
        }),
      clear: (token) =>
        set((s) => ({ byToken: { ...s.byToken, [token]: {} } })),
      contractPlan: (token, plan) =>
        set((s) => ({
          contractedByToken: { ...s.contractedByToken, [token]: plan },
        })),
    }),
    { name: "ic-selection" },
  ),
);

const EMPTY: Record<string, true> = {};

/** Conjunto de ids selecionados para um token. */
export function useSelectedIds(token: string): Record<string, true> {
  return useSelectionStore((s) => s.byToken[token] ?? EMPTY);
}

/** Plano contratado pela cliente para este token. */
export function useContractedPlan(token: string): PricingPlan | null {
  return useSelectionStore((s) => s.contractedByToken[token] ?? null);
}
