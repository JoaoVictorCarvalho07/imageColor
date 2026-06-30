import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { sessionCookieName } from "@/lib/access";
import { getGalleryPublicInfo } from "@/lib/clientGallery";
import { AccessForm } from "@/components/AccessForm";
import { formatDateBR } from "@/lib/format";

export default async function AccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const info = await getGalleryPublicInfo(token);
  if (!info) notFound();

  const jar = await cookies();
  if (jar.get(sessionCookieName(token))) {
    redirect(`/g/${token}/galeria`);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm">
        <p className="label-caps">{info.studioName} · Fotografia</p>
        <h1 className="mt-5 font-display text-4xl leading-tight text-primary">
          {info.title}
        </h1>
        {info.clientName && (
          <p className="font-display text-xl italic text-accent">
            {info.clientName}
          </p>
        )}

        {info.expired ? (
          <p className="mt-6 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
            O acesso a este ensaio expirou. Entre em contato com a fotógrafa para
            reabrir.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              Digite a senha para ver suas fotos
            </p>
            <AccessForm token={token} />
            {info.accessExpiresAt && (
              <p className="mt-6 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Acesso válido até{" "}
                {formatDateBR(info.accessExpiresAt.slice(0, 10))}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
