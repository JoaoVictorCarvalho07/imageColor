"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";

type MediaItem = {
  id: string;
  type: "photo" | "video";
  thumbUrl: string | null;
  status: string;
  position: number;
};

export function MediaGrid({
  galleryId,
  initialItems,
}: {
  galleryId: string;
  initialItems: MediaItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function handleDelete(mediaId: string) {
    setDeleting(mediaId);
    try {
      const res = await fetch(`/api/admin/ensaios/${galleryId}/media/${mediaId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Erro ao excluir.");
        return;
      }
      setItems((prev) => prev.filter((m) => m.id !== mediaId));
      router.refresh();
    } catch {
      alert("Erro ao excluir.");
    } finally {
      setDeleting(null);
      setConfirming(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {items.map((m) => {
        const isDeleting = deleting === m.id;
        const isConfirming = confirming === m.id;

        return (
          <div
            key={m.id}
            className="group relative aspect-square overflow-hidden rounded-md border border-border bg-secondary"
          >
            {m.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.thumbUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                {m.type === "video" ? "vídeo" : "…"}
              </div>
            )}

            {isConfirming ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/70">
                {isDeleting ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <>
                    <p className="text-center text-[10px] font-medium text-white leading-tight">
                      Excluir?
                    </p>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="rounded bg-destructive px-2 py-0.5 text-[10px] text-white hover:opacity-90"
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setConfirming(null)}
                        className="rounded bg-white/20 px-2 py-0.5 text-[10px] text-white hover:bg-white/30"
                      >
                        Não
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => setConfirming(m.id)}
                className="absolute right-1 top-1 rounded bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                title="Excluir mídia"
              >
                <Trash2 className="h-3.5 w-3.5 text-white" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
