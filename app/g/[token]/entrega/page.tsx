import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Download, CheckCircle2 } from "lucide-react";
import { getSessionGallery } from "@/lib/clientGallery";
import { r2SignedUrl, BUCKET_PRIVATE } from "@/lib/r2";

export default async function EntregaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const gallery = await getSessionGallery(token);
  if (!gallery) redirect(`/g/${token}`);

  const finals = gallery.finals ?? [];
  if (!gallery.downloadReady || finals.length === 0) {
    redirect(`/g/${token}/galeria`);
  }
  const direct = gallery.deliveryMode === "direct";

  // URLs assinadas do R2 (bucket privado) — geradas no servidor.
  const items = await Promise.all(
    finals.map(async (f) => {
      const [inlineUrl, downloadUrl] = await Promise.all([
        r2SignedUrl(BUCKET_PRIVATE, f.storageKey),
        r2SignedUrl(BUCKET_PRIVATE, f.storageKey, 21600, f.filename),
      ]);
      return { inlineUrl, downloadUrl, filename: f.filename };
    }),
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <Link
        href={`/g/${token}/galeria`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar à galeria
      </Link>

      <div className="mt-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent">
          <CheckCircle2 className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="mt-4 font-display text-3xl text-primary sm:text-4xl">
          Suas fotos estão prontas!
        </h1>
        <p className="mt-2 text-muted-foreground">
          {direct
            ? `${items.length} foto(s) selecionada(s) por você. Toque em baixar para salvar em alta resolução, sem marca d'água.`
            : `${items.length} foto(s) editada(s) por ${gallery.studioName}. Toque em baixar para salvar em alta resolução, sem marca d'água.`}
        </p>
        <a
          href={`/g/${token}/finals-zip`}
          download
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 text-sm uppercase tracking-wide text-accent-foreground hover:opacity-90"
        >
          <Download className="h-4 w-4" /> Baixar todas (.zip)
        </a>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((it, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-md border border-border bg-card"
          >
            {it.inlineUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.inlineUrl}
                alt={it.filename ?? ""}
                loading="lazy"
                className="aspect-[3/4] w-full object-cover"
              />
            )}
            <a
              href={it.downloadUrl ?? "#"}
              className="flex items-center justify-center gap-1.5 border-t border-border py-2.5 text-sm text-accent hover:bg-secondary"
            >
              <Download className="h-4 w-4" /> Baixar
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
