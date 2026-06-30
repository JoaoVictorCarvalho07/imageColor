"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { setPasswordAction, type ActionState } from "@/lib/galleryAdminActions";

const initial: ActionState = {};

export function SetPasswordForm({ galleryId }: { galleryId: string }) {
  const action = setPasswordAction.bind(null, galleryId);
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1">
        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="password"
          placeholder="Nova senha de acesso"
          className="w-full rounded-md border border-border bg-background py-2 pl-10 pr-3 text-foreground outline-none focus:border-accent"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Definir senha"}
      </button>
      {state.ok && <span className="text-sm text-accent">Senha atualizada ✓</span>}
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}
