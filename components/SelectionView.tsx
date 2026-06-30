"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Check,
  Film,
  Loader2,
  Pencil,
  Download,
} from "lucide-react";
import { useSelectedIds } from "@/store/selection";
import { useHydrated } from "@/lib/useHydrated";
import { videoCost } from "@/lib/pricing";
import { formatBRL } from "@/lib/format";
import { saveSelectionAction, submitSelectionAction } from "@/lib/clientActions";
import { Lightbox } from "./Lightbox";
import type { PublicGallery } from "@/lib/types";

export function SelectionView({ gallery }: { gallery: PublicGallery }) {
  const token = gallery.token;
  const selectedIds = useSelectedIds(token);
  const hydrated = useHydrated();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(gallery.selectionStatus === "submitted");

  // Auto-salva a seleção enquanto a cliente ainda não enviou.
  useEffect(() => {
    if (!hydrated || sent) return;
    void saveSelectionAction(token, Object.keys(selectedIds));
  }, [hydrated, token, selectedIds, sent]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-muted-foreground">
        Carregando sua seleção…
      </div>
    );
  }

  const selectedPhotos = gallery.media.filter(
    (m) => m.type === "photo" && selectedIds[m.id],
  );
  const selectedVideos = gallery.media.filter(
    (m) => m.type === "video" && selectedIds[m.id],
  );
  const count = selectedPhotos.length;

  const isDirect = gallery.deliveryMode === "direct";
  const isQuota = gallery.selectionMode === "quota";
  const limit = gallery.selectionLimit ?? 0;
  const extras = isQuota ? Math.max(0, count - limit) : 0;
  const extraPrice = gallery.extraPhotoCents ?? 0;
  const extrasTotal = extras * extraPrice;

  const videoPlan = gallery.plans.find((p) => p.mediaType === "video");
  const videosTotal = videoCost(videoPlan, selectedVideos.length);
  const total = extrasTotal + videosTotal;

  const empty = count === 0 && selectedVideos.length === 0;

  async function confirm() {
    setSubmitting(true);
    const res = await submitSelectionAction(token, Object.keys(selectedIds));
    setSubmitting(false);
    if (!res.error) setSent(true);
  }

  // Estado: seleção enviada
  if (sent) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <Check className="h-8 w-8 text-accent-foreground" />
        </div>
        <h1 className="mt-5 font-display text-3xl text-primary">
          {isDirect ? "Tudo pronto!" : "Seleção enviada!"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {isDirect
            ? "Suas fotos selecionadas já estão liberadas para download em alta resolução, sem marca d'água."
            : `${gallery.studioName} vai editar e entregar suas fotos. Você será avisada quando estiverem prontas.`}
        </p>
        <p className="mt-4 text-sm text-primary">
          {count} foto(s)
          {selectedVideos.length > 0 && ` e ${selectedVideos.length} vídeo(s)`}{" "}
          escolhida(s).
          {extras > 0 && extraPrice > 0 && (
            <>
              {" "}
              {extras} extra(s) · {formatBRL(extrasTotal)} (a combinar).
            </>
          )}
        </p>
        {isDirect && count > 0 && (
          <Link
            href={`/g/${token}/entrega`}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 text-sm uppercase tracking-wide text-accent-foreground hover:opacity-90"
          >
            <Download className="h-4 w-4" /> Baixar minhas fotos
          </Link>
        )}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setSent(false)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm text-foreground hover:bg-secondary"
          >
            <Pencil className="h-4 w-4" /> Alterar seleção
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-6">
      <Link
        href={`/g/${token}/galeria`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar à galeria
      </Link>

      <h1 className="mt-3 font-display text-3xl text-primary">Minha seleção</h1>

      {empty ? (
        <p className="mt-6 text-muted-foreground">
          Você ainda não escolheu nenhuma foto.{" "}
          <Link href={`/g/${token}/galeria`} className="text-accent underline">
            Voltar e escolher
          </Link>
          .
        </p>
      ) : (
        <>
          {/* Resumo conforme o modo do ensaio */}
          <div className="mt-4 rounded-md border border-border bg-card p-4">
            {isQuota ? (
              <>
                <p className="text-sm text-primary">
                  <span className="font-medium">{count}</span> de{" "}
                  <span className="font-medium">{limit}</span> fotos inclusas
                </p>
                {extras > 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {extras} foto(s) além da cota
                    {extraPrice > 0
                      ? ` · ${formatBRL(extrasTotal)} em extras`
                      : ""}
                    .
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Dentro da cota inclusa. 🎉
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-primary">
                <span className="font-medium">{count}</span> foto(s) escolhida(s)
              </p>
            )}
          </div>

          {/* Miniaturas */}
          {count > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedPhotos.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  aria-label="Ampliar imagem"
                  className="h-16 w-12 overflow-hidden rounded-sm"
                  style={{ background: m.color }}
                >
                  {m.previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.previewUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Vídeos */}
          {selectedVideos.length > 0 && videoPlan && (
            <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-bege px-3 py-3">
              <span className="flex items-center gap-2 text-sm">
                <Film className="h-4 w-4 text-accent" />
                {selectedVideos.length} vídeo(s) ·{" "}
                {formatBRL(videoPlan.priceCents)} cada
              </span>
              <span className="text-sm font-medium">{formatBRL(videosTotal)}</span>
            </div>
          )}

          {/* Total (só quando há valor a pagar) */}
          {total > 0 && (
            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="label-caps">Extras a combinar</span>
              <span className="font-display text-2xl text-accent">
                {formatBRL(total)}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={confirm}
            disabled={submitting}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 text-sm uppercase tracking-wide text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Enviando…" : "Confirmar seleção"}
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {isDirect
              ? "Ao confirmar, suas fotos selecionadas ficam prontas para download em alta."
              : `Ao confirmar, sua escolha é enviada para a ${gallery.studioName} editar.`}
          </p>
        </>
      )}

      {lightboxIndex !== null && selectedPhotos.length > 0 && (
        <Lightbox
          items={selectedPhotos}
          startIndex={lightboxIndex}
          token={token}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
