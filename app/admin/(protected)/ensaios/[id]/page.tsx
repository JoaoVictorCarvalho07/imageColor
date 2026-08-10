import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Image as ImageIcon, Film, Users } from "lucide-react";
import { superuserPb } from "@/lib/pb/superuser";
import { formatDateBR } from "@/lib/format";
import { CopyLink } from "@/components/admin/CopyLink";
import { SetPasswordForm } from "@/components/admin/SetPasswordForm";
import { GallerySettingsForm } from "@/components/admin/GallerySettingsForm";
import { PricingEditor, type PlanRow } from "@/components/admin/PricingEditor";
import { MediaUploader } from "@/components/admin/MediaUploader";
import { DriveImport } from "@/components/admin/DriveImport";
import { SelectionFilenames } from "@/components/admin/SelectionFilenames";
import { DeliveryManager } from "@/components/admin/DeliveryManager";
import { MediaGrid } from "@/components/admin/MediaGrid";
import { DeleteGalleryButton } from "@/components/admin/DeleteGalleryButton";
import { previewUrl } from "@/lib/storageUrl";

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  ready: {
    label: "Pronto",
    bg: "hsl(var(--accent))",
    fg: "hsl(var(--accent-foreground))",
  },
  processing: {
    label: "Processando",
    bg: "hsl(var(--gold))",
    fg: "hsl(var(--primary))",
  },
  draft: {
    label: "Rascunho",
    bg: "hsl(var(--muted))",
    fg: "hsl(var(--muted-foreground))",
  },
  closed: {
    label: "Encerrado",
    bg: "hsl(var(--muted))",
    fg: "hsl(var(--muted-foreground))",
  },
};

export default async function EnsaioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pb = await superuserPb();

  type GalleryRecord = {
    id: string;
    title: string;
    status: string;
    access_token: string;
    access_expires_at: string;
    download_expires_days: number;
    selection_mode: "free" | "quota";
    selection_limit: number | null;
    extra_photo_cents: number | null;
    delivery_mode: "edit" | "direct";
    delivered_at: string;
    drive_folder_id: string;
  };
  type MediaRow = {
    id: string;
    type: "photo" | "video";
    thumb_key: string;
    status: string;
    position: number;
  };
  type PlanRecord = {
    media_type: "photo" | "video";
    kind: "single" | "package" | "full";
    name: string;
    included_qty: number | null;
    price_cents: number;
    extra_item_cents: number | null;
  };
  type SelectionRow = {
    id: string;
    status: string;
    created: string;
    submitted_at: string;
    expand?: { media?: { filename: string; type: string }[] };
  };

  const gallery = await pb
    .collection("galleries")
    .getOne<GalleryRecord>(id)
    .catch(() => null);
  if (!gallery) notFound();

  const byGallery = pb.filter("gallery = {:g}", { g: id });

  const [plans, media, selections, driveConns, finals] = await Promise.all([
    pb.collection("pricing_plans").getFullList<PlanRecord>({
      filter: byGallery,
      sort: "created",
    }),
    pb.collection("media_items").getFullList<MediaRow>({
      filter: byGallery,
      sort: "position",
      fields: "id,type,thumb_key,status,position",
    }),
    // `expand: media` traz os itens escolhidos — o que antes era o join com
    // selection_items.
    pb.collection("selections").getFullList<SelectionRow>({
      filter: byGallery,
      sort: "-created",
      expand: "media",
    }),
    pb
      .collection("drive_connections")
      .getFullList<{ google_account_email: string }>(),
    pb.collection("final_assets").getFullList<{ filename: string }>({
      filter: byGallery,
      sort: "created",
    }),
  ]);

  const driveConn = driveConns[0] ?? null;
  const finalRows = finals as { filename: string | null }[];

  const mediaRows = media.map((m) => ({
    ...m,
    thumbUrl: previewUrl(m.thumb_key),
  }));
  const photos = mediaRows.filter((m) => m.type === "photo").length;
  const videos = mediaRows.filter((m) => m.type === "video").length;

  const selectionRows = selections;

  const planRows: PlanRow[] = (plans ?? []).map((p) => ({
    mediaType: p.media_type,
    kind: p.kind,
    name: p.name,
    includedQty: p.included_qty != null ? String(p.included_qty) : "",
    price: (p.price_cents / 100).toFixed(2),
    extraItem:
      p.extra_item_cents != null ? (p.extra_item_cents / 100).toFixed(2) : "",
  }));

  const s = STATUS[gallery.status] ?? STATUS.draft;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Ensaios
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl text-primary sm:text-3xl">
            {gallery.title}
          </h1>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ background: s.bg, color: s.fg }}
          >
            {s.label}
          </span>
          <DeleteGalleryButton galleryId={gallery.id} redirectTo="/admin" />
        </div>
      </div>

      {/* Compartilhar */}
      <Section title="Compartilhar com a cliente">
        <p className="mb-2 text-sm text-muted-foreground">Link do ensaio</p>
        <CopyLink path={`/g/${gallery.access_token}`} />
        <p className="mb-2 mt-4 text-sm text-muted-foreground">
          Senha de acesso (a atual fica oculta — defina uma nova para
          compartilhar)
        </p>
        <SetPasswordForm galleryId={gallery.id} />
      </Section>

      {/* Resumo */}
      <Section title="Resumo">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            icon={<ImageIcon className="h-5 w-5" />}
            label="Fotos"
            value={photos}
          />
          <Stat
            icon={<Film className="h-5 w-5" />}
            label="Vídeos"
            value={videos}
          />
          <Stat
            icon={<Users className="h-5 w-5" />}
            label="Acesso até"
            text={
              gallery.access_expires_at
                ? formatDateBR(gallery.access_expires_at.slice(0, 10))
                : "—"
            }
          />
        </div>
      </Section>

      {/* Mídias */}
      <Section title="Mídias">
        <DriveImport
          galleryId={gallery.id}
          connected={!!driveConn}
          accountEmail={driveConn?.google_account_email}
          defaultFolder={gallery.drive_folder_id}
        />
        <p className="my-3 text-xs uppercase tracking-wide text-muted-foreground">
          ou envie do computador
        </p>
        <MediaUploader galleryId={gallery.id} />
        <MediaGrid galleryId={gallery.id} initialItems={mediaRows} />
        <p className="mt-3 text-xs text-muted-foreground">
          As fotos recebem marca d&apos;água automaticamente, e o nome de cada
          arquivo é guardado — assim você cruza a seleção com os RAWs.
        </p>
      </Section>

      {/* Configurações */}
      <Section title="Configurações">
        <GallerySettingsForm
          gallery={{
            id: gallery.id,
            title: gallery.title,
            status: gallery.status,
            accessExpiresAt: gallery.access_expires_at
              ? gallery.access_expires_at.slice(0, 10)
              : null,
            downloadDays: gallery.download_expires_days,
            selectionMode: gallery.selection_mode ?? "free",
            selectionLimit: gallery.selection_limit ?? null,
            extraPhotoCents: gallery.extra_photo_cents ?? null,
            deliveryMode: gallery.delivery_mode ?? "edit",
          }}
        />
      </Section>

      {/* Preços */}
      <Section title="Preços e pacotes">
        <PricingEditor galleryId={gallery.id} initial={planRows} />
      </Section>

      {/* Seleções */}
      <Section title="Seleções da cliente">
        {selectionRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma seleção ainda. Quando a cliente acessar o link e escolher
            itens, eles aparecem aqui.
          </p>
        ) : (
          <ul className="space-y-4">
            {selectionRows.map((sel) => {
              const items = sel.expand?.media ?? [];
              const names = items.map((m) => m.filename || "(sem nome)");
              const statusLabel =
                sel.status === "submitted"
                  ? "Enviada"
                  : sel.status === "paid"
                    ? "Paga"
                    : "Em andamento";
              const when = sel.submitted_at || sel.created;
              return (
                <li
                  key={sel.id}
                  className="rounded-md border border-border bg-background p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-primary">
                      {items.length} foto(s) selecionada(s)
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="rounded-full px-2 py-0.5"
                        style={{
                          background:
                            sel.status === "submitted"
                              ? "hsl(var(--accent))"
                              : "hsl(var(--muted))",
                          color:
                            sel.status === "submitted"
                              ? "hsl(var(--accent-foreground))"
                              : "hsl(var(--muted-foreground))",
                        }}
                      >
                        {statusLabel}
                      </span>
                      {new Date(when).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <SelectionFilenames names={names} />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Entrega */}
      <Section title="Entrega (fotos finais)">
        {(gallery.delivery_mode ?? "edit") === "direct" ? (
          <p className="text-sm text-muted-foreground">
            Este ensaio está em <strong>download direto</strong>: assim que a
            cliente confirma a seleção, ela baixa na hora os originais das fotos
            escolhidas (em alta, sem marca d&apos;água). Não é preciso publicar
            uma entrega aqui. Para editar e entregar você mesma, troque o{" "}
            <em>Destino da seleção</em> em Configurações para “Edição”.
          </p>
        ) : (
          <DeliveryManager
            galleryId={gallery.id}
            finals={finalRows}
            deliveredAt={gallery.delivered_at ?? null}
          />
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-3 font-display text-xl text-primary">{title}</h2>
      {children}
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  text,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  text?: string;
}) {
  return (
    <div className="rounded-md bg-background p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="label-caps">{label}</span>
      </div>
      <p className="mt-1.5 font-display text-2xl text-primary">
        {text ?? value}
      </p>
    </div>
  );
}
