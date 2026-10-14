"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, RotateCcw } from "lucide-react";

const ICONS = { reopen: RotateCcw, paid: BadgeCheck };

export function ConfirmActionButton({
  label,
  prompt,
  icon,
  action,
}: {
  label: string;
  prompt: string;
  icon: keyof typeof ICONS;
  action: () => Promise<{ ok?: boolean; error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = ICONS[icon];

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-foreground hover:bg-secondary"
      >
        <Icon className="h-4 w-4" aria-hidden /> {label}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">{prompt}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await action();
            if (res.error) setError(res.error);
            else setConfirming(false);
          })
        }
        className="min-h-11 rounded-md bg-accent px-3 text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Aguarde…" : "Confirmar"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-11 rounded-md px-3 text-muted-foreground hover:text-foreground"
      >
        Cancelar
      </button>
      {error && (
        <p role="alert" className="w-full text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
