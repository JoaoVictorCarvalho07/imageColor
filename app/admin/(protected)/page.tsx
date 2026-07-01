import Link from "next/link";
import { Plus, Images, Clock, FolderOpen, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateBR } from "@/lib/format";
import { DeleteGalleryButton } from "@/components/admin/DeleteGalleryButton";

type GalleryRow = {
  id: string;
  title: string;
  status: "draft" | "processing" | "ready" | "closed";
  access_token: string;
  access_expires_at: string | null;
  created_at: string;
  media_items: { count: number }[] | null;
};

const STATUS: Record<
  GalleryRow["status"],
  { label: string; bg: string; fg: string }
> = {
  ready: { label: "Pronto", bg: "hsl(var(--accent))", fg: "hsl(var(--accent-foreground))" },
  processing: { label: "Processando", bg: "hsl(var(--gold))", fg: "hsl(var(--primary))" },
  draft: { label: "Rascunho", bg: "hsl(var(--muted))", fg: "hsl(var(--muted-foreground))" },
  closed: { label: "Encerrado", bg: "hsl(var(--muted))", fg: "hsl(var(--muted-foreground))" },
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("galleries")
    .select(
      "id,title,status,access_token,access_expires_at,created_at, media_items(count)",
    )
    .order("created_at", { ascending: false });

  const galleries = (data ?? []) as GalleryRow[];
  const mediaCount = (g: GalleryRow) => g.media_items?.[0]?.count ?? 0;
  const totalMedia = galleries.reduce((sum, g) => sum + mediaCount(g), 0);
  const processing = galleries.filter((g) => g.status === "processing").length;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-primary">Ensaios</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas galerias e acompanhe as seleções.
          </p>
        </div>
        <Link
          href="/admin/ensaios/novo"
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-2.5 text-sm uppercase tracking-wide text-accent-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Novo ensaio
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard icon={<FolderOpen className="h-5 w-5" />} label="Ensaios" value={galleries.length} />
        <StatCard icon={<Images className="h-5 w-5" />} label="Mídias" value={totalMedia} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Processando" value={processing} />
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
        {galleries.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">
            Nenhum ensaio ainda.{" "}
            <Link href="/admin/ensaios/novo" className="text-accent underline">
              Criar o primeiro
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {galleries.map((g) => {
              const s = STATUS[g.status];
              return (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div>
                    <Link
                      href={`/admin/ensaios/${g.id}`}
                      className="font-medium text-primary hover:text-accent hover:underline"
                    >
                      {g.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {mediaCount(g)} mídia(s)
                      {g.access_expires_at &&
                        ` · expira ${formatDateBR(g.access_expires_at.slice(0, 10))}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ background: s.bg, color: s.fg }}
                    >
                      {s.label}
                    </span>
                    <Link
                      href={`/g/${g.access_token}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-accent"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> ver galeria
                    </Link>
                    <DeleteGalleryButton galleryId={g.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-card p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="hidden sm:inline-flex">{icon}</span>
        <span className="label-caps text-[10px] sm:text-xs">{label}</span>
      </div>
      <p className="mt-1.5 font-display text-2xl text-primary sm:mt-2 sm:text-3xl">
        {value}
      </p>
    </div>
  );
}
