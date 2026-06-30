"use client";

import { Check, Heart, Play } from "lucide-react";
import { Watermark } from "./Watermark";
import type { MediaItem } from "@/lib/types";

const CREAM = "rgba(242,235,225,0.92)";

export function MediaTile({
  item,
  selected,
  onToggle,
  onOpen,
}: {
  item: MediaItem;
  selected: boolean;
  onToggle: () => void;
  onOpen?: () => void;
}) {
  const isVideo = item.type === "video";
  return (
    <div
      className="relative overflow-hidden rounded-md"
      style={{
        aspectRatio: isVideo ? "16 / 9" : "3 / 4",
        background: item.color,
        outline: selected
          ? "2px solid hsl(var(--accent))"
          : "1px solid hsl(var(--border))",
        outlineOffset: selected ? "-2px" : 0,
      }}
    >
      {/* Área clicável que amplia (carrossel). Usa a miniatura leve. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label="Ampliar imagem"
        className="absolute inset-0 h-full w-full"
      >
        {item.thumbUrl ?? item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbUrl ?? item.previewUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <Watermark />
        )}
      </button>

      {isVideo && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: CREAM }}
          >
            <Play className="h-5 w-5 text-accent" />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={selected ? "Remover da seleção" : "Adicionar à seleção"}
        aria-pressed={selected}
        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full active:scale-90"
        style={{ background: CREAM }}
      >
        <Heart
          className="h-4 w-4"
          style={{
            color: selected
              ? "hsl(var(--accent))"
              : "hsl(var(--muted-foreground))",
            fill: selected ? "hsl(var(--accent))" : "transparent",
          }}
        />
      </button>

      {selected && (
        <div className="pointer-events-none absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
          <Check className="h-3 w-3 text-accent-foreground" />
        </div>
      )}
    </div>
  );
}
