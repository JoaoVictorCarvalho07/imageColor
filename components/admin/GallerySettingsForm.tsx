"use client";

import { useActionState, useState } from "react";
import {
  updateGalleryAction,
  type ActionState,
} from "@/lib/galleryAdminActions";

const initial: ActionState = {};

export interface GallerySettings {
  id: string;
  title: string;
  status: string;
  accessExpiresAt: string | null; // YYYY-MM-DD
  downloadDays: number;
  selectionMode: "free" | "quota";
  selectionLimit: number | null;
  extraPhotoCents: number | null;
  deliveryMode: "edit" | "direct";
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Rascunho" },
  { value: "processing", label: "Processando" },
  { value: "ready", label: "Pronto" },
  { value: "closed", label: "Encerrado" },
];

export function GallerySettingsForm({ gallery }: { gallery: GallerySettings }) {
  const action = updateGalleryAction.bind(null, gallery.id);
  const [state, formAction, pending] = useActionState(action, initial);
  const [mode, setMode] = useState<"free" | "quota">(gallery.selectionMode);
  const [delivery, setDelivery] = useState<"edit" | "direct">(
    gallery.deliveryMode,
  );

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-primary">Título</span>
        <input
          name="title"
          defaultValue={gallery.title}
          required
          className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-foreground outline-none focus:border-accent"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-primary">Status</span>
          <select
            name="status"
            defaultValue={gallery.status}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-foreground outline-none focus:border-accent"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-primary">
            Acesso até
          </span>
          <input
            name="accessExpiresAt"
            type="date"
            defaultValue={gallery.accessExpiresAt ?? ""}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-primary">
            Validade do download (dias)
          </span>
          <input
            name="downloadDays"
            type="number"
            min={1}
            defaultValue={gallery.downloadDays}
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-foreground outline-none focus:border-accent"
          />
        </label>
      </div>

      {/* Modo de seleção */}
      <div className="rounded-md border border-border bg-background p-3">
        <span className="label-caps">Seleção da cliente</span>
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-primary">Modo</span>
            <select
              name="selectionMode"
              value={mode}
              onChange={(e) => setMode(e.target.value as "free" | "quota")}
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-foreground outline-none focus:border-accent"
            >
              <option value="free">Livre (sem limite)</option>
              <option value="quota">Com cota inclusa</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-primary">
              Fotos inclusas
            </span>
            <input
              name="selectionLimit"
              type="number"
              min={1}
              defaultValue={gallery.selectionLimit ?? ""}
              disabled={mode !== "quota"}
              placeholder="ex.: 20"
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-foreground outline-none focus:border-accent disabled:opacity-40"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-primary">
              Preço foto extra (R$)
            </span>
            <input
              name="extraPhoto"
              inputMode="decimal"
              defaultValue={
                gallery.extraPhotoCents != null
                  ? (gallery.extraPhotoCents / 100).toFixed(2)
                  : ""
              }
              disabled={mode !== "quota"}
              placeholder="ex.: 25,00"
              className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-foreground outline-none focus:border-accent disabled:opacity-40"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {mode === "quota"
            ? "A cliente vê “X de N”; fotos além da cota entram como extras."
            : "A cliente escolhe quantas quiser, sem limite."}
        </p>
      </div>

      {/* Destino das fotos selecionadas */}
      <div className="rounded-md border border-border bg-background p-3">
        <span className="label-caps">Destino da seleção</span>
        <label className="mt-2 block sm:max-w-xs">
          <span className="mb-1.5 block text-sm font-medium text-primary">
            O que acontece ao confirmar
          </span>
          <select
            name="deliveryMode"
            value={delivery}
            onChange={(e) => setDelivery(e.target.value as "edit" | "direct")}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-foreground outline-none focus:border-accent"
          >
            <option value="edit">Edição — você edita e entrega</option>
            <option value="direct">Download direto — a cliente baixa</option>
          </select>
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          {delivery === "direct"
            ? "Ao confirmar a seleção, a cliente baixa na hora os originais das fotos escolhidas (em alta, sem marca d’água)."
            : "A cliente seleciona, você edita e publica a entrega final pela aba Entrega."}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-5 py-2.5 text-sm uppercase tracking-wide text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar configurações"}
        </button>
        {state.ok && <span className="text-sm text-accent">Salvo ✓</span>}
        {state.error && (
          <span className="text-sm text-destructive">{state.error}</span>
        )}
      </div>
    </form>
  );
}
