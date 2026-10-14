"use client";

import { useCallback, useMemo } from "react";
import { findPlan, quoteSelection, type MediaQuote } from "@/lib/pricing";
import {
  useSeedSelection,
  useSelectionEntry,
  useSelectionGuard,
} from "@/store/selection";
import type { MediaItem, MediaType, PublicGallery } from "@/lib/types";

export const LOCKED_NOTICE =
  "Sua seleção já foi enviada. Para alterar, fale com a fotógrafa.";

const NOUN: Record<MediaType, string> = { photo: "foto(s)", video: "vídeo(s)" };

function blockReason(q: MediaQuote, type: MediaType, adding: boolean): string | null {
  if (q.allIncluded) {
    return type === "photo"
      ? "Seu pacote já inclui todas as fotos."
      : "Seu pacote já inclui todos os vídeos.";
  }
  if (adding && !q.canExceedLimit && q.limit !== null && q.count + 1 > q.limit) {
    return `Você pode escolher até ${q.limit} ${NOUN[type]}.`;
  }
  return null;
}

export function useGallerySelection(gallery: PublicGallery, locked: boolean) {
  const token = gallery.token;
  useSeedSelection(token, gallery.selection);
  const entry = useSelectionEntry(token, gallery.selection);

  const state = useMemo(() => {
    const photoPlan = findPlan(gallery.plans, entry.photoPlanId, "photo");
    const videoPlan = findPlan(gallery.plans, entry.videoPlanId, "video");
    const photos = gallery.media.filter((m) => m.type === "photo");
    const videos = gallery.media.filter((m) => m.type === "video");
    const pick = (items: MediaItem[], all: boolean) =>
      all ? items : items.filter((m) => entry.ids[m.id]);
    const selectedPhotos = pick(photos, photoPlan?.kind === "full");
    const selectedVideos = pick(videos, videoPlan?.kind === "full");

    const quote = quoteSelection(
      {
        selectionMode: gallery.selectionMode,
        selectionLimit: gallery.selectionLimit,
        extraPhotoCents: gallery.extraPhotoCents,
        plans: gallery.plans,
      },
      {
        photoCount: selectedPhotos.length,
        videoCount: selectedVideos.length,
        photoPlanId: photoPlan?.id ?? null,
        videoPlanId: videoPlan?.id ?? null,
      },
    );

    const selectedSet = new Set([...selectedPhotos, ...selectedVideos].map((m) => m.id));
    return { photos, videos, photoPlan, videoPlan, selectedPhotos, selectedVideos, selectedSet, quote };
  }, [gallery, entry.ids, entry.photoPlanId, entry.videoPlanId]);

  const typeById = useMemo(
    () => new Map(gallery.media.map((m) => [m.id, m.type])),
    [gallery.media],
  );

  const guard = useCallback(
    (id: string, adding: boolean) => {
      if (locked) return LOCKED_NOTICE;
      const type = typeById.get(id);
      if (!type) return null;
      return blockReason(type === "photo" ? state.quote.photos : state.quote.videos, type, adding);
    },
    [locked, typeById, state.quote],
  );
  useSelectionGuard(token, guard);

  return { ...state, entry };
}
