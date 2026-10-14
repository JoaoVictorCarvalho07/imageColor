"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

export function DeleteGalleryButton({
  galleryId,
  redirectTo,
}: {
  galleryId: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ensaios/${galleryId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Erro ao excluir ensaio.");
        return;
      }
      setConfirming(false);
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch {
      setError("Erro ao excluir ensaio.");
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar exclusão do ensaio">
        <span className="text-sm text-muted-foreground">Excluir ensaio?</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-1 rounded bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          Excluir
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={loading}
          className="min-h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
        {error && (
          <span role="alert" className="basis-full text-xs text-destructive">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Excluir ensaio"
      title="Excluir ensaio"
      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" aria-hidden />
    </button>
  );
}
