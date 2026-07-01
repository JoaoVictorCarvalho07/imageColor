import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { r2Delete, BUCKET_PUBLIC, BUCKET_PRIVATE } from "@/lib/r2";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  const { id: galleryId, mediaId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: item } = await supabase
    .from("media_items")
    .select("preview_key, thumb_key, original_key")
    .eq("id", mediaId)
    .eq("gallery_id", galleryId)
    .single();

  if (!item) return NextResponse.json({ error: "Mídia não encontrada" }, { status: 404 });

  await Promise.allSettled([
    item.preview_key  ? r2Delete(BUCKET_PUBLIC,  item.preview_key)  : Promise.resolve(),
    item.thumb_key    ? r2Delete(BUCKET_PUBLIC,  item.thumb_key)    : Promise.resolve(),
    item.original_key ? r2Delete(BUCKET_PRIVATE, item.original_key) : Promise.resolve(),
  ]);

  const { error } = await supabase.from("media_items").delete().eq("id", mediaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
