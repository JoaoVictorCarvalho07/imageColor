"use client";

import { useActionState, useId } from "react";
import { KeyRound } from "lucide-react";
import { setPasswordAction, type ActionState } from "@/lib/galleryAdminActions";

const initial: ActionState = {};

export function SetPasswordForm({ galleryId }: { galleryId: string }) {
  const action = setPasswordAction.bind(null, galleryId);
  const [state, formAction, pending] = useActionState(action, initial);
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <label htmlFor={inputId} className="sr-only">
        Nova senha de acesso
      </label>
      <div className="relative flex-1">
        <KeyRound
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={inputId}
          name="password"
          placeholder="Nova senha de acesso"
          required
          minLength={6}
          autoComplete="off"
          aria-describedby={hintId}
          className="w-full rounded-md border border-border bg-background py-2.5 pl-10 pr-3 text-foreground outline-none focus:border-accent"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Definir senha"}
      </button>
      <p id={hintId} className="basis-full text-xs text-muted-foreground">
        Mínimo de 6 caracteres.
      </p>
      {state.ok && (
        <span role="status" className="text-sm text-accent">
          Senha atualizada ✓
        </span>
      )}
      {state.error && (
        <span role="alert" className="text-sm text-destructive">
          {state.error}
        </span>
      )}
    </form>
  );
}
