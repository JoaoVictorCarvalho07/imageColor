"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Gift } from "lucide-react";
import { savePlansAction, type PlanInput } from "@/lib/galleryAdminActions";

export interface PlanRow {
  mediaType: "photo" | "video";
  kind: "single" | "package" | "full";
  name: string;
  includedQty: string;
  price: string; // em reais
  extraItem: string; // em reais
}

const KIND_LABEL: Record<PlanRow["kind"], string> = {
  single: "Avulso",
  package: "Pacote",
  full: "Completo",
};

function emptyRow(): PlanRow {
  return {
    mediaType: "photo",
    kind: "package",
    name: "",
    includedQty: "",
    price: "",
    extraItem: "",
  };
}

function toCents(v: string): number {
  return Math.round((parseFloat(v.replace(",", ".")) || 0) * 100);
}

export function PricingEditor({
  galleryId,
  initial,
}: {
  galleryId: string;
  initial: PlanRow[];
}) {
  const [rows, setRows] = useState<PlanRow[]>(
    initial.length ? initial : [emptyRow()],
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function patch(i: number, p: Partial<PlanRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  }

  function save() {
    setMsg(null);
    const plans: PlanInput[] = rows
      .filter((r) => r.name.trim() || r.price)
      .map((r) => ({
        mediaType: r.mediaType,
        kind: r.kind,
        name: r.name.trim() || "Plano",
        includedQty: r.kind === "package" ? parseInt(r.includedQty) || 0 : null,
        priceCents: toCents(r.price),
        extraItemCents: r.kind === "package" ? toCents(r.extraItem) : null,
      }));
    startTransition(async () => {
      const res = await savePlansAction(galleryId, plans);
      setMsg(
        res.error
          ? { ok: false, text: `Erro: ${res.error}` }
          : { ok: true, text: "Preços salvos ✓" },
      );
    });
  }

  return (
    <div>
      <div className="space-y-3">
        {rows.map((r, i) => {
          const isPackage = r.kind === "package";
          const isGift = toCents(r.price) === 0 && (r.name || r.price);
          return (
            <div
              key={i}
              className="rounded-md border border-border bg-background p-3"
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
                <select
                  value={r.mediaType}
                  onChange={(e) =>
                    patch(i, { mediaType: e.target.value as PlanRow["mediaType"] })
                  }
                  className="rounded-md border border-border bg-card px-2 py-2 text-sm sm:col-span-2"
                >
                  <option value="photo">Fotos</option>
                  <option value="video">Vídeos</option>
                </select>

                <select
                  value={r.kind}
                  onChange={(e) =>
                    patch(i, { kind: e.target.value as PlanRow["kind"] })
                  }
                  className="rounded-md border border-border bg-card px-2 py-2 text-sm sm:col-span-2"
                >
                  {(["single", "package", "full"] as const).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>

                <input
                  value={r.name}
                  onChange={(e) => patch(i, { name: e.target.value })}
                  placeholder="Nome do plano"
                  className="rounded-md border border-border bg-card px-2 py-2 text-sm sm:col-span-3"
                />

                <input
                  value={r.includedQty}
                  onChange={(e) => patch(i, { includedQty: e.target.value })}
                  placeholder="Qtd"
                  type="number"
                  min={0}
                  disabled={!isPackage}
                  title="Quantidade inclusa (pacotes)"
                  className="rounded-md border border-border bg-card px-2 py-2 text-sm disabled:opacity-40 sm:col-span-1"
                />

                <div className="relative sm:col-span-2">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    R$
                  </span>
                  <input
                    value={r.price}
                    onChange={(e) => patch(i, { price: e.target.value })}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="w-full rounded-md border border-border bg-card py-2 pl-7 pr-2 text-sm"
                  />
                </div>

                <div className="relative sm:col-span-1">
                  <input
                    value={r.extraItem}
                    onChange={(e) => patch(i, { extraItem: e.target.value })}
                    placeholder="extra"
                    inputMode="decimal"
                    disabled={!isPackage}
                    title="Preço por item extra (pacotes)"
                    className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm disabled:opacity-40"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                  aria-label="Remover plano"
                  className="flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive sm:col-span-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {isGift && (
                <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-accent">
                  <Gift className="h-3 w-3" /> Preço R$ 0 — este item é um brinde/cortesia
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, emptyRow()])}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary"
        >
          <Plus className="h-4 w-4" /> Adicionar plano
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-accent px-5 py-2 text-sm uppercase tracking-wide text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar preços"}
        </button>
        {msg && (
          <span
            className={`text-sm ${msg.ok ? "text-accent" : "text-destructive"}`}
          >
            {msg.text}
          </span>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Dica: deixe o preço em <strong>R$ 0,00</strong> para oferecer um item de
        brinde. Fotos e vídeos têm planos independentes.
      </p>
    </div>
  );
}
