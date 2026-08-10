import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/pb/session";
import { superuserPb } from "@/lib/pb/superuser";
import { r2Delete, BUCKET_PUBLIC, BUCKET_PRIVATE } from "@/lib/r2";

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

  // Confere que a mídia é mesmo deste ensaio — o id da galeria vem da URL.
  if (!item || item.gallery !== galleryId) {
    return NextResponse.json({ error: "Mídia não encontrada" }, { status: 404 });
  }

  await Promise.allSettled([
    item.preview_key ? r2Delete(BUCKET_PUBLIC, item.preview_key) : Promise.resolve(),
    item.thumb_key ? r2Delete(BUCKET_PUBLIC, item.thumb_key) : Promise.resolve(),
    item.original_key ? r2Delete(BUCKET_PRIVATE, item.original_key) : Promise.resolve(),
  ]);

  // `selections.media` não tem cascade: a foto só sai da lista da seleção.
  try {
    await pb.collection("media_items").delete(mediaId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao excluir" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
