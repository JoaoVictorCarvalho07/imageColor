"use client";

import { useLayoutEffect, useMemo } from "react";
import { create } from "zustand";
import { saveSelectionAction } from "@/lib/clientActions";
import type { SelectionResult } from "@/lib/pb/gallery";
import type { MediaType, SelectionDraft } from "@/lib/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface SelectionEntry {
  ids: Record<string, true>;
  photoPlanId: string | null;
  videoPlanId: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  notice: string | null;
}

export type SelectionGuard = (id: string, adding: boolean) => string | null;

interface SelectionState {
  byToken: Record<string, SelectionEntry>;
  seed: (token: string, draft: SelectionDraft) => void;
  toggle: (token: string, id: string) => void;
  setPlan: (token: string, mediaType: MediaType, planId: string | null) => void;
  setSaveState: (token: string, status: SaveStatus, error?: string | null) => void;
  dismissNotice: (token: string) => void;
}

const SAVE_DELAY_MS = 700;

const EMPTY_ENTRY: SelectionEntry = {
  ids: {},
  photoPlanId: null,
  videoPlanId: null,
  saveStatus: "idle",
  saveError: null,
  notice: null,
};

function entryFromDraft(draft: SelectionDraft): SelectionEntry {
  return {
    ids: Object.fromEntries(draft.mediaIds.map((id) => [id, true as const])),
    photoPlanId: draft.photoPlanId,
    videoPlanId: draft.videoPlanId,
    saveStatus: "idle",
    saveError: null,
    notice: null,
  };
}

export function draftOf(entry: SelectionEntry): SelectionDraft {
  return {
    mediaIds: Object.keys(entry.ids),
    photoPlanId: entry.photoPlanId,
    videoPlanId: entry.videoPlanId,
  };
}

export const useSelectionStore = create<SelectionState>()((set, get) => {
  const update = (token: string, patch: (e: SelectionEntry) => Partial<SelectionEntry>) =>
    set((s) => {
      const current = s.byToken[token] ?? EMPTY_ENTRY;
      return { byToken: { ...s.byToken, [token]: { ...current, ...patch(current) } } };
    });

  return {
    byToken: {},
    seed: (token, draft) => {
      if (get().byToken[token]) return;
      set((s) => ({ byToken: { ...s.byToken, [token]: entryFromDraft(draft) } }));
    },
    toggle: (token, id) => {
      const current = get().byToken[token] ?? EMPTY_ENTRY;
      const adding = !current.ids[id];
      const blocked = guards.get(token)?.(id, adding) ?? null;
      if (blocked) {
        update(token, () => ({ notice: blocked }));
        return;
      }
      update(token, (e) => {
        const ids = { ...e.ids };
        if (adding) ids[id] = true;
        else delete ids[id];
        return { ids, notice: null };
      });
      scheduleSave(token);
    },
    setPlan: (token, mediaType, planId) => {
      update(token, () =>
        mediaType === "photo" ? { photoPlanId: planId } : { videoPlanId: planId },
      );
      scheduleSave(token);
    },
    setSaveState: (token, saveStatus, saveError = null) =>
      update(token, () => ({ saveStatus, saveError })),
    dismissNotice: (token) => update(token, () => ({ notice: null })),
  };
});

const guards = new Map<string, SelectionGuard>();

export function useSelectionGuard(token: string, guard: SelectionGuard) {
  useLayoutEffect(() => {
    guards.set(token, guard);
    return () => {
      if (guards.get(token) === guard) guards.delete(token);
    };
  }, [token, guard]);
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const queues = new Map<string, Promise<SelectionResult | null>>();

function runSave(token: string): Promise<SelectionResult | null> {
  const previous = queues.get(token) ?? Promise.resolve(null);
  const next = previous.then(async () => {
    const entry = useSelectionStore.getState().byToken[token];
    if (!entry) return null;
    const { setSaveState } = useSelectionStore.getState();
    setSaveState(token, "saving");
    try {
      const res = await saveSelectionAction(token, draftOf(entry));
      setSaveState(token, res.error ? "error" : "saved", res.error ?? null);
      return res;
    } catch {
      const error = "Sem conexão. Sua seleção será salva quando a internet voltar.";
      setSaveState(token, "error", error);
      return { error };
    }
  });
  queues.set(token, next);
  return next;
}

function scheduleSave(token: string) {
  clearTimeout(timers.get(token));
  timers.set(
    token,
    setTimeout(() => {
      timers.delete(token);
      void runSave(token);
    }, SAVE_DELAY_MS),
  );
}

export async function flushSelection(token: string): Promise<SelectionResult | null> {
  const pending = timers.get(token);
  if (pending) {
    clearTimeout(pending);
    timers.delete(token);
    return runSave(token);
  }
  return queues.get(token) ?? null;
}

export function useSeedSelection(token: string, draft: SelectionDraft) {
  const seed = useSelectionStore((s) => s.seed);
  useLayoutEffect(() => {
    seed(token, draft);
  }, [seed, token, draft]);

  useLayoutEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushSelection(token);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [token]);
}

export function useSelectionEntry(token: string, serverDraft?: SelectionDraft): SelectionEntry {
  const stored = useSelectionStore((s) => s.byToken[token]);
  const fallback = useMemo(
    () => (serverDraft ? entryFromDraft(serverDraft) : EMPTY_ENTRY),
    [serverDraft],
  );
  return stored ?? fallback;
}

export function useSelectedIds(token: string): Record<string, true> {
  return useSelectionStore((s) => s.byToken[token]?.ids ?? EMPTY_ENTRY.ids);
}
