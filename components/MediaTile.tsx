"use client";

import { Check, Heart, Play } from "lucide-react";
import { Watermark } from "./Watermark";
import type { MediaItem } from "@/lib/types";

export function MediaTile({
  item,
  selected,
  onToggle,
  onOpen,
  index,
}: {
  item: MediaItem;
  selected: boolean;
  onToggle: () => void;
  onOpen?: () => void;
  index?: number;
}) {
  const isVideo = item.type === "video";
  const noun = isVideo ? "vídeo" : "foto";
  const position = index === undefined ? "" : ` ${index + 1}`;

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
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${isVideo ? "Reproduzir" : "Ampliar"} ${noun}${position}`}
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
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card/90">
            <Play className="h-5 w-5 text-accent" aria-hidden />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label={`Selecionar ${noun}${position}`}
        aria-pressed={selected}
        className="group absolute right-0 top-0 flex h-11 w-11 items-center justify-center"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-card/90 transition-transform group-active:scale-90">
          <Heart
            aria-hidden
            className={`h-4 w-4 ${
              selected
                ? "fill-accent text-accent"
                : "fill-transparent text-muted-foreground"
            }`}
          />
        </span>
      </button>

      {selected && (
        <div className="pointer-events-none absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
          <Check className="h-3 w-3 text-accent-foreground" aria-hidden />
        </div>
      )}
    </div>
  );
}
