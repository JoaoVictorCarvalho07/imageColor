import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/pb/session";
import { superuserPb } from "@/lib/pb/superuser";
import { r2DeleteMany, BUCKET_PUBLIC, BUCKET_PRIVATE } from "@/lib/r2";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: galleryId } = await params;

  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const pb = await superuserPb();

  const gallery = await pb
    .collection("galleries")
    .getOne(galleryId)
    .catch(() => null);
  if (!gallery) {
    return NextResponse.json({ error: "Galeria não encontrada" }, { status: 404 });
  }

  const byGallery = pb.filter("gallery = {:g}", { g: galleryId });
  const [mediaItems, finals] = await Promise.all([
    pb.collection("media_items").getFullList<{
      preview_key: string;
      thumb_key: string;
      original_key: string;
    }>({ filter: byGallery, fields: "preview_key,thumb_key,original_key" }),
    pb
      .collection("final_assets")
      .getFullList<{ storage_key: string }>({ filter: byGallery, fields: "storage_key" }),
  ]);

  const publicKeys: string[] = [];
  const privateKeys: string[] = [];
  for (const m of mediaItems) {
    if (m.preview_key) publicKeys.push(m.preview_key);
    if (m.thumb_key) publicKeys.push(m.thumb_key);
    if (m.original_key) privateKeys.push(m.original_key);
  }
  for (const f of finals) {
    if (f.storage_key) privateKeys.push(f.storage_key);
  }

  await Promise.allSettled([
    r2DeleteMany(BUCKET_PUBLIC, publicKeys),
    r2DeleteMany(BUCKET_PRIVATE, privateKeys),
  ]);

  // As relações filhas têm cascadeDelete: apagar a galeria leva junto
  // media_items, pricing_plans, final_assets, gallery_sessions e selections.
  try {
    await pb.collection("galleries").delete(galleryId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao excluir" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
