"use client";

import { useEffect } from "react";
import { useSelectionEntry, useSelectionStore } from "@/store/selection";

const NOTICE_MS = 4000;

export function SelectionNotice({ token }: { token: string }) {
  const { notice, saveStatus, saveError } = useSelectionEntry(token);
  const dismiss = useSelectionStore((s) => s.dismissNotice);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => dismiss(token), NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice, token, dismiss]);

  const message = notice ?? (saveStatus === "error" ? saveError : null);
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-5"
    >
      <p className="pointer-events-auto max-w-sm rounded-md bg-primary px-4 py-2.5 text-center text-sm text-primary-foreground shadow-lg">
        {message}
      </p>
    </div>
  );
}
