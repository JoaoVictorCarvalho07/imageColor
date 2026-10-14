"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Check,
  Clock,
  CreditCard,
  Film,
  Loader2,
  Download,
  Package,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { draftOf, flushSelection, useSelectionStore } from "@/store/selection";
import { formatBRL } from "@/lib/format";
import {
  cancelCheckoutAction,
  checkoutAction,
  refreshPaymentAction,
  resumeCheckoutAction,
} from "@/lib/clientActions";
import type { CheckoutResult } from "@/lib/pb/orders";
import type { MediaQuote } from "@/lib/pricing";
import { Lightbox } from "./Lightbox";
import { SelectionNotice } from "./SelectionNotice";
import { useGallerySelection } from "./useGallerySelection";
import type { PublicGallery } from "@/lib/types";

interface Line {
  label: string;
  cents: number;
}

function linesFor(q: MediaQuote, noun: string): Line[] {
  const lines: Line[] = [];
  if (q.plan && q.planCents > 0) {
    lines.push({ label: `Pacote ${q.plan.name}`, cents: q.planCents });
  }
  if (q.extras > 0 && q.extrasCents > 0) {
    const unit = formatBRL(q.extraUnitCents ?? 0);
    const label =
      q.plan?.kind === "single"
        ? `${q.extras} ${noun} × ${unit}`
        : `${q.extras} ${noun} extra(s) × ${unit}`;
    lines.push({ label, cents: q.extrasCents });
  }
  return lines;
}

const OFFLINE: CheckoutResult = { error: "Sem conexão. Tente novamente." };

export function SelectionView({ gallery }: { gallery: PublicGallery }) {
  const token = gallery.token;
  const router = useRouter();
  const [justSent, setJustSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const sent =
    justSent || gallery.selectionStatus === "submitted" || gallery.selectionStatus === "paid";
  const { entry, selectedPhotos, selectedVideos, quote, photoPlan, videoPlan } =
    useGallerySelection(gallery, sent);
  const saveStatus = useSelectionStore((s) => s.byToken[token]?.saveStatus ?? "idle");

  const isDirect = gallery.deliveryMode === "direct";
  const photoCount = selectedPhotos.length;
  const videoCount = selectedVideos.length;
  const empty = photoCount === 0 && videoCount === 0;
  const lines = [...linesFor(quote.photos, "foto(s)"), ...linesFor(quote.videos, "vídeo(s)")];
  const needsPayment = quote.totalCents > 0;

  async function confirm() {
    setSubmitting(true);
    setSubmitError(null);
    await flushSelection(token);
    const res = await checkoutAction(token, draftOf(entry)).catch(() => OFFLINE);
    if (res.checkoutUrl) {
      window.location.assign(res.checkoutUrl);
      return;
    }
    setSubmitting(false);
    if (res.error) {
      setSubmitError(res.error);
      return;
    }
    setJustSent(true);
    router.refresh();
  }

  if (sent) {
    if (gallery.payment.status === "pending") {
      return <PendingPayment gallery={gallery} />;
    }
    const paid = gallery.payment.status === "paid";
    return (
      <div className="mx-auto max-w-2xl px-5 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <Check className="h-8 w-8 text-accent-foreground" />
        </div>
        <h1 className="mt-5 font-display text-3xl text-primary">
          {paid ? "Pagamento confirmado!" : isDirect ? "Tudo pronto!" : "Seleção enviada!"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {gallery.downloadReady
            ? "Suas fotos já estão liberadas para download em alta resolução, sem marca d'água."
            : `${gallery.studioName} vai editar e entregar suas fotos. Você será avisada quando estiverem prontas.`}
        </p>
        <p className="mt-4 text-sm text-primary">
          {photoCount} foto(s)
          {videoCount > 0 && ` e ${videoCount} vídeo(s)`} escolhida(s).
          {gallery.payment.amountCents > 0 && (
            <> {paid ? "Pago" : "Total"}: {formatBRL(gallery.payment.amountCents)}.</>
          )}
        </p>
        {gallery.downloadReady && (
          <Link
            href={`/g/${token}/entrega`}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 text-sm uppercase tracking-wide text-accent-foreground hover:opacity-90"
          >
            <Download className="h-4 w-4" /> Baixar minhas fotos
          </Link>
        )}
        {!paid && (
          <p className="mt-6 text-sm text-muted-foreground">
            Precisa mudar algo? Fale com {gallery.studioName} para reabrir sua seleção.
          </p>
        )}
        <div>
          <Link
            href={`/g/${token}/galeria`}
            className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar à galeria
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-6">
      <Link
        href={`/g/${token}/galeria`}
        onClick={() => void flushSelection(token)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar à galeria
      </Link>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">Minha seleção</h1>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saveStatus === "saving" ? "Salvando…" : saveStatus === "saved" ? "Salvo" : ""}
        </span>
      </div>

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
          <div className="mt-4 rounded-md border border-border bg-card p-4">
            <PhotoSummary q={quote.photos} />
          </div>

          {(photoPlan || videoPlan) && (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
              <Package className="h-4 w-4 shrink-0" />
              <span>
                {[photoPlan, videoPlan]
                  .filter(Boolean)
                  .map((p) => p!.name)
                  .join(" + ")}
              </span>
            </div>
          )}

          {photoCount > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedPhotos.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  aria-label={`Ampliar foto ${i + 1}`}
                  className="h-16 w-12 overflow-hidden rounded-sm"
                  style={{ background: m.color }}
                >
                  {m.thumbUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.thumbUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          {videoCount > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-bege px-3 py-3 text-sm">
              <Film className="h-4 w-4 text-accent" />
              {videoCount} vídeo(s)
            </div>
          )}

          {lines.length > 0 && (
            <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
              {lines.map((l) => (
                <div key={l.label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{l.label}</dt>
                  <dd className="tabular-nums">{formatBRL(l.cents)}</dd>
                </div>
              ))}
            </dl>
          )}

          {quote.totalCents > 0 && (
            <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
              <span className="label-caps">Total</span>
              <span className="font-display text-2xl text-accent">
                {formatBRL(quote.totalCents)}
              </span>
            </div>
          )}

          {submitError && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {submitError}
            </p>
          )}

          <button
            type="button"
            onClick={confirm}
            disabled={submitting}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 text-sm uppercase tracking-wide text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              needsPayment && <CreditCard className="h-4 w-4" />
            )}
            {submitting
              ? needsPayment
                ? "Abrindo o pagamento…"
                : "Enviando…"
              : needsPayment
                ? `Ir para o pagamento · ${formatBRL(quote.totalCents)}`
                : "Confirmar seleção"}
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {needsPayment
              ? `Pagamento por Pix ou cartão no Mercado Pago. ${
                  isDirect
                    ? "Assim que for aprovado, suas fotos ficam liberadas em alta."
                    : `Assim que for aprovado, ${gallery.studioName} começa a editar.`
                }`
              : isDirect
                ? "Ao confirmar, suas fotos selecionadas ficam prontas para download em alta."
                : `Ao confirmar, sua escolha é enviada para ${gallery.studioName} editar.`}
          </p>
        </>
      )}

      <SelectionNotice token={token} />

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

function PhotoSummary({ q }: { q: MediaQuote }) {
  if (q.allIncluded) {
    return (
      <p className="text-sm text-primary">
        Todas as <span className="font-medium">{q.count}</span> fotos inclusas no pacote.
      </p>
    );
  }
  if (q.limit !== null) {
    return (
      <>
        <p className="text-sm text-primary">
          <span className="font-medium">{q.included}</span> de{" "}
          <span className="font-medium">{q.limit}</span> fotos inclusas
          {q.extras > 0 && (
            <>
              {" "}
              + <span className="font-medium">{q.extras}</span> extra(s)
            </>
          )}
        </p>
        {q.extras === 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {q.canExceedLimit
              ? "Dentro do incluso."
              : `Você pode escolher até ${q.limit} fotos.`}
          </p>
        )}
      </>
    );
  }
  return (
    <p className="text-sm text-primary">
      <span className="font-medium">{q.count}</span> foto(s) escolhida(s)
    </p>
  );
}

type ActionResult = CheckoutResult | { ok?: boolean; error?: string };
type PendingKind = "pay" | "check" | "edit";

function PendingPayment({ gallery }: { gallery: PublicGallery }) {
  const token = gallery.token;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<PendingKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(kind: PendingKind, action: () => Promise<ActionResult>) {
    setBusy(kind);
    setError(null);
    startTransition(async () => {
      const res: ActionResult = await action().catch(() => OFFLINE);
      if ("checkoutUrl" in res && res.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
        return;
      }
      if (res.error) setError(res.error);
      setBusy(null);
      router.refresh();
    });
  }

  const icon = (kind: PendingKind, fallback: React.ReactNode) =>
    pending && busy === kind ? <Loader2 className="h-4 w-4 animate-spin" /> : fallback;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
        <Clock className="h-8 w-8 text-accent" />
      </div>
      <h1 className="mt-5 font-display text-3xl text-primary">Falta o pagamento</h1>
      <p className="mt-2 text-muted-foreground">
        Sua seleção está reservada. Conclua o pagamento de{" "}
        <strong className="text-primary">{formatBRL(gallery.payment.amountCents)}</strong> para
        liberar {gallery.deliveryMode === "direct" ? "o download das fotos" : "a edição e a entrega"}.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Pagou com Pix agora há pouco? A confirmação pode levar alguns instantes.
      </p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mx-auto mt-6 flex max-w-sm flex-col gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("pay", () => resumeCheckoutAction(token))}
          className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 text-sm uppercase tracking-wide text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {icon("pay", <CreditCard className="h-4 w-4" />)} Pagar agora
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("check", () => refreshPaymentAction(token))}
          className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-6 py-2.5 text-sm text-foreground hover:bg-secondary disabled:opacity-60"
        >
          {icon("check", <RefreshCw className="h-4 w-4" />)} Já paguei, verificar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("edit", () => cancelCheckoutAction(token))}
          className="flex min-h-11 items-center justify-center gap-2 rounded-md px-6 py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          {icon("edit", <Pencil className="h-4 w-4" />)} Alterar seleção
        </button>
      </div>

      <Link
        href={`/g/${token}/galeria`}
        className="mt-6 inline-flex items-center gap-1 text-sm text-accent hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar à galeria
      </Link>
    </div>
  );
}
