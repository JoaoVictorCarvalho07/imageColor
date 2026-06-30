"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { login, type LoginState } from "@/lib/actions";

const initialState: LoginState = {};

export function AccessForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="mt-6 w-full">
      <input type="hidden" name="token" value={token} />

      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="password"
          type="password"
          autoComplete="off"
          required
          placeholder="Senha do ensaio"
          className="w-full rounded-md border border-border bg-card py-3 pl-10 pr-3 text-center tracking-widest text-foreground outline-none focus:border-accent"
        />
      </div>

      {state.error && (
        <p className="mt-2 text-sm text-destructive">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-3 w-full rounded-md bg-accent py-3 text-sm uppercase tracking-wide text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
