"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type ByToken = Record<string, Record<string, true>>;

interface SelectionState {
  byToken: ByToken;
  toggle: (token: string, id: string) => void;
  clear: (token: string) => void;
}

export const useSelectionStore = create<SelectionState>()(
  persist(
    (set) => ({
      byToken: {},
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
    }),
    { name: "ic-selection" },
  ),
);

const EMPTY: Record<string, true> = {};

/** Conjunto de ids selecionados para um token. */
export function useSelectedIds(token: string): Record<string, true> {
  return useSelectionStore((s) => s.byToken[token] ?? EMPTY);
}
