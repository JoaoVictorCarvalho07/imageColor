"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Heart, Check } from "lucide-react";
import { Watermark } from "./Watermark";
import { useSelectedIds, useSelectionStore } from "@/store/selection";
import type { MediaItem } from "@/lib/types";

const OVERLAY = "rgba(20,18,16,0.96)";

export function Lightbox({
  items,
  startIndex,
  token,
  onClose,
}: {
  items: MediaItem[];
  startIndex: number;
  token: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);
  const selectedIds = useSelectedIds(token);
  const toggle = useSelectionStore((s) => s.toggle);

  const prev = useCallback(
    () => setIndex((i) => (i - 1 + items.length) % items.length),
    [items.length],
  );
  const next = useCallback(
    () => setIndex((i) => (i + 1) % items.length),
    [items.length],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [prev, next, onClose]);

  const item = items[index];
  if (!item) return null;
  const selected = Boolean(selectedIds[item.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: OVERLAY }}
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-5 py-4 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm tabular-nums text-white/80">
          {index + 1} / {items.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded-full p-2 text-white/90 hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center px-2 sm:px-6"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(dx) > 40) {
            if (dx < 0) next();
            else prev();
          }
          touchStartX.current = null;
        }}
      >
        {items.length > 1 && (
          <button
            type="button"
            onClick={prev}
            aria-label="Anterior"
            className="absolute left-1 z-10 rounded-full p-2 text-white/80 hover:bg-white/10 sm:left-3"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}

        {item.type === "video" && item.previewUrl ? (
          <video
            src={item.previewUrl}
            poster={item.thumbUrl}
            controls
            playsInline
            className="max-h-[76vh] w-auto max-w-full rounded-md"
          />
        ) : item.previewUrl || item.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.previewUrl ?? item.thumbUrl}
            alt=""
            className="max-h-[76vh] w-auto max-w-full rounded-md object-contain"
          />
        ) : (
          <div
            className="relative aspect-[3/4] w-[70vw] max-w-sm overflow-hidden rounded-md"
            style={{ background: item.color }}
          >
            <Watermark opacity={0.3} />
          </div>
        )}

        {items.length > 1 && (
          <button
            type="button"
            onClick={next}
            aria-label="Próxima"
            className="absolute right-1 z-10 rounded-full p-2 text-white/80 hover:bg-white/10 sm:right-3"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}
      </div>

      <div
        className="flex items-center justify-center px-5 py-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => toggle(token, item.id)}
          aria-pressed={selected}
          className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm uppercase tracking-wide transition-colors"
          style={
            selected
              ? { background: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" }
              : { background: "rgba(255,255,255,0.12)", color: "#fff" }
          }
        >
          {selected ? (
            <>
              <Check className="h-4 w-4" /> Selecionada
            </>
          ) : (
            <>
              <Heart className="h-4 w-4" /> Selecionar
            </>
          )}
        </button>
      </div>
    </div>
  );
}
