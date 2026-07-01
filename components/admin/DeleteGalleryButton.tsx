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

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ensaios/${galleryId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Erro ao excluir ensaio.");
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
      }
      router.refresh();
    } catch {
      alert("Erro ao excluir ensaio.");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Excluir ensaio?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded bg-destructive px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60 hover:opacity-90"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          Excluir
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors"
      title="Excluir ensaio"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
