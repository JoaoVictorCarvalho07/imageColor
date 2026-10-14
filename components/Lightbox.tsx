"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Heart, Check } from "lucide-react";
import { Watermark } from "./Watermark";
import { useSelectedIds, useSelectionStore } from "@/store/selection";
import type { MediaItem } from "@/lib/types";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

const NATIVE_ARROW_TARGETS =
  'video, input, select, textarea, [contenteditable="true"]';

const FOCUS_RING = "focus-visible:outline-white";

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
  const count = items.length;
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const selectedIds = useSelectedIds(token);
  const toggle = useSelectionStore((s) => s.toggle);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (count === 0) {
      onCloseRef.current();
      return;
    }
    setIndex((i) => Math.min(Math.max(i, 0), count - 1));
  }, [count]);

  const prev = useCallback(() => {
    if (count === 0) return;
    setIndex((i) => (i - 1 + count) % count);
  }, [count]);
  const next = useCallback(() => {
    if (count === 0) return;
    setIndex((i) => (i + 1) % count);
  }, [count]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    function trapTab(e: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab") {
        trapTab(e);
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.target instanceof Element && e.target.closest(NATIVE_ARROW_TARGETS)) {
        return;
      }
      if (e.key === "ArrowLeft") prev();
      else next();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  if (count === 0) return null;

  const current = Math.min(Math.max(index, 0), count - 1);
  const item = items[current];
  const selected = Boolean(selectedIds[item.id]);
  const position = `${current + 1} de ${count}`;
  const kind = item.type === "video" ? "Vídeo" : "Foto";

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de fotos e vídeos"
      className="fixed inset-0 z-50 flex flex-col bg-overlay"
      onClick={onClose}
    >
      <div
        className="safe-top flex items-center justify-between px-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm tabular-nums text-white/80" aria-live="polite">
          {current + 1} / {count}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className={`flex h-11 w-11 items-center justify-center rounded-full text-white/90 hover:bg-white/10 ${FOCUS_RING}`}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-6"
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
        {count > 1 && (
          <button
            type="button"
            onClick={prev}
            aria-label="Anterior"
            className={`absolute left-1 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:bg-white/10 sm:left-3 ${FOCUS_RING}`}
          >
            <ChevronLeft className="h-7 w-7" aria-hidden />
          </button>
        )}

        {item.type === "video" && item.previewUrl ? (
          <video
            key={item.id}
            src={item.previewUrl}
            poster={item.thumbUrl}
            controls
            playsInline
            aria-label={`${kind} ${position}`}
            className="max-h-[76dvh] w-auto max-w-full rounded-md"
          />
        ) : item.previewUrl || item.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={item.previewUrl ?? item.thumbUrl}
            alt={`${kind} ${position}`}
            className="max-h-[76dvh] w-auto max-w-full rounded-md object-contain"
          />
        ) : (
          <div
            role="img"
            aria-label={`${kind} ${position}`}
            className="relative aspect-[3/4] w-[70vw] max-w-sm overflow-hidden rounded-md"
            style={{ background: item.color }}
          >
            <Watermark opacity={0.3} />
          </div>
        )}

        {count > 1 && (
          <button
            type="button"
            onClick={next}
            aria-label="Próxima"
            className={`absolute right-1 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:bg-white/10 sm:right-3 ${FOCUS_RING}`}
          >
            <ChevronRight className="h-7 w-7" aria-hidden />
          </button>
        )}
      </div>

      <div
        className="flex items-center justify-center px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => toggle(token, item.id)}
          aria-pressed={selected}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full px-6 py-3 text-sm uppercase tracking-wide transition-colors ${FOCUS_RING} ${
            selected
              ? "bg-accent text-accent-foreground"
              : "bg-white/15 text-white"
          }`}
        >
          {selected ? (
            <>
              <Check className="h-4 w-4" aria-hidden /> Selecionada
            </>
          ) : (
            <>
              <Heart className="h-4 w-4" aria-hidden /> Selecionar
            </>
          )}
        </button>
      </div>
    </div>
  );
}
