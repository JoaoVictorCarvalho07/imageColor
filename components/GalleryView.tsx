"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Loader2, Sparkles, ChevronRight, Package, CreditCard } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { MediaTile } from "./MediaTile";
import { Lightbox } from "./Lightbox";
import { PackagesModal } from "./PackagesModal";
import { flushSelection, useSelectionStore } from "@/store/selection";
import { useGallerySelection } from "./useGallerySelection";
import { SelectionNotice } from "./SelectionNotice";
import type { MediaType, PublicGallery } from "@/lib/types";

const PAGE_SIZE = 60;

export function GalleryView({ gallery }: { gallery: PublicGallery }) {
  const token = gallery.token;
  const router = useRouter();
  const [tab, setTab] = useState<MediaType>("photo");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showPackages, setShowPackages] = useState(false);
  const [pending, startTransition] = useTransition();
  const hasPlans = gallery.plans.length > 0;
  const locked =
    gallery.selectionStatus === "submitted" || gallery.selectionStatus === "paid";
  const { photos, videos, entry, selectedSet, quote } = useGallerySelection(gallery, locked);
  const toggle = useSelectionStore((s) => s.toggle);
  const setPlan = useSelectionStore((s) => s.setPlan);

  const visible = tab === "photo" ? photos : videos;
  const count = selectedSet.size;
  const limit = quote.photos.allIncluded ? null : quote.photos.limit;

  function openSelection() {
    startTransition(async () => {
      await flushSelection(token);
      router.push(`/g/${token}/selecao`);
    });
  }

  const [shown, setShown] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setShown(PAGE_SIZE), [tab]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setShown((s) => s + PAGE_SIZE);
      },
      { rootMargin: "800px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [tab, visible.length]);

  const shownItems = visible.slice(0, shown);
  const hasMore = shown < visible.length;

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 pt-5 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl text-primary">{gallery.title}</h1>
            <p className="label-caps truncate">{gallery.studioName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {hasPlans && (
              <button
                type="button"
                onClick={() => setShowPackages(true)}
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Ver pacotes</span>
                <span className="sm:hidden">Pacotes</span>
              </button>
            )}
            <div className="flex items-center gap-2 rounded-full border border-border bg-bege px-3 py-1.5">
              <Heart className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-primary">
                {count}
                {limit != null && (
                  <span className="text-muted-foreground"> / {limit}</span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-6">
          <TabButton active={tab === "photo"} onClick={() => setTab("photo")}>
            Fotos <span className="text-muted-foreground">{photos.length}</span>
          </TabButton>
          <TabButton active={tab === "video"} onClick={() => setTab("video")}>
            Vídeos <span className="text-muted-foreground">{videos.length}</span>
          </TabButton>
        </div>
      </header>

      {gallery.payment.status === "pending" && (
        <Link
          href={`/g/${token}/selecao`}
          className="mx-5 mt-4 flex items-center justify-between gap-2 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent hover:bg-accent/15"
        >
          <span className="inline-flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamento pendente · {formatBRL(gallery.payment.amountCents)}
          </span>
          <span className="inline-flex items-center gap-1 uppercase tracking-wide">
            Pagar <ChevronRight className="h-4 w-4" />
          </span>
        </Link>
      )}

      {gallery.downloadReady && (
        <Link
          href={`/g/${token}/entrega`}
          className="mx-5 mt-4 flex items-center justify-between gap-2 rounded-md bg-accent px-4 py-3 text-sm text-accent-foreground hover:opacity-90"
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {gallery.deliveryMode === "direct"
              ? "Suas fotos estão prontas para download!"
              : "Suas fotos finais estão prontas!"}
          </span>
          <span className="inline-flex items-center gap-1 uppercase tracking-wide">
            Baixar <ChevronRight className="h-4 w-4" />
          </span>
        </Link>
      )}

      <div className="flex-1 px-5 py-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shownItems.map((item, i) => (
            <MediaTile
              key={item.id}
              item={item}
              index={i}
              selected={selectedSet.has(item.id)}
              onToggle={() => toggle(token, item.id)}
              onOpen={() => setLightboxIndex(i)}
            />
          ))}
        </div>

        {hasMore && (
          <div ref={sentinelRef} className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => setShown((s) => s + PAGE_SIZE)}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary"
            >
              Carregar mais ({visible.length - shown} restantes)
            </button>
          </div>
        )}
      </div>

      <SelectionNotice token={token} />

      <footer className="safe-bottom sticky bottom-0 border-t border-border bg-card/95 px-5 pt-3 backdrop-blur">
        <button
          type="button"
          disabled={(count === 0 && !locked) || pending}
          onClick={openSelection}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 text-center text-sm uppercase tracking-wide text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? "Abrindo…" : locked ? "Ver seleção enviada" : `Ver minha seleção (${count})`}
        </button>
      </footer>

      {lightboxIndex !== null && (
        <Lightbox
          items={visible}
          startIndex={lightboxIndex}
          token={token}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {showPackages && (
        <PackagesModal
          plans={gallery.plans}
          contracted={{ photo: entry.photoPlanId, video: entry.videoPlanId }}
          locked={locked}
          onContract={(mediaType, plan) => {
            setPlan(token, mediaType, plan?.id ?? null);
            if (plan) {
              setShowPackages(false);
              if (plan.kind === "full" && mediaType === "photo") openSelection();
            }
          }}
          onClose={() => setShowPackages(false)}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 pb-2.5 text-sm uppercase tracking-wide transition-colors ${
        active
          ? "border-accent font-medium text-primary"
          : "border-transparent text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
