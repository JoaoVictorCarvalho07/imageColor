"use client";

import { useActionState } from "react";
import {
  createGalleryAction,
  type CreateGalleryState,
} from "@/lib/galleryActions";

const initialState: CreateGalleryState = {};

export function NewGalleryForm() {
  const [state, formAction, pending] = useActionState(
    createGalleryAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-6 max-w-lg space-y-4">
      <Field label="Título do ensaio" hint="Ex.: Ensaio Gestante — Marina">
        <input
          name="title"
          required
          placeholder="Ensaio Gestante — Marina"
          className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-foreground outline-none focus:border-accent"
        />
      </Field>

      <Field label="Nome da cliente" hint="Opcional">
        <input
          name="clientName"
          placeholder="Marina Silva"
          className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-foreground outline-none focus:border-accent"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Senha de acesso" hint="Em branco = gerada">
          <input
            name="password"
            placeholder="ex.: 123456"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-foreground outline-none focus:border-accent"
          />
        </Field>
        <Field label="Dias de acesso" hint="Padrão 15">
          <input
            name="accessDays"
            type="number"
            min={1}
            defaultValue={15}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-foreground outline-none focus:border-accent"
          />
        </Field>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-6 py-2.5 text-sm uppercase tracking-wide text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Criando…" : "Criar ensaio"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-sm font-medium text-primary">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
