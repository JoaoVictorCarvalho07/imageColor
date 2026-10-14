import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/pb/session";
import { superuserPb } from "@/lib/pb/superuser";
import { r2DeleteBestEffort, BUCKET_PUBLIC, BUCKET_PRIVATE } from "@/lib/r2";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  const { id: galleryId, mediaId } = await params;

  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const pb = await superuserPb();

  const item = await pb
    .collection("media_items")
    .getOne<{
      gallery: string;
      preview_key: string;
      thumb_key: string;
      original_key: string;
    }>(mediaId)
    .catch(() => null);

  if (!item || item.gallery !== galleryId) {
    return NextResponse.json({ error: "Mídia não encontrada" }, { status: 404 });
  }

  const [publicOk, privateOk] = await Promise.all([
    r2DeleteBestEffort(
      BUCKET_PUBLIC,
      [item.preview_key, item.thumb_key],
      `media:${mediaId}`,
    ),
    r2DeleteBestEffort(BUCKET_PRIVATE, [item.original_key], `media:${mediaId}`),
  ]);

  try {
    await pb.collection("media_items").delete(mediaId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao excluir" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    publicOk && privateOk
      ? { ok: true }
      : { ok: true, warning: "Alguns arquivos não puderam ser removidos do armazenamento." },
  );
}
