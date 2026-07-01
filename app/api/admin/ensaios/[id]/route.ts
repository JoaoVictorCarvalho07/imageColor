import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { r2DeleteMany, BUCKET_PUBLIC, BUCKET_PRIVATE } from "@/lib/r2";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: galleryId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: gallery } = await supabase
    .from("galleries")
    .select("id")
    .eq("id", galleryId)
    .single();
  if (!gallery) return NextResponse.json({ error: "Galeria não encontrada" }, { status: 404 });

  // Coleta todas as chaves R2 das mídias
  const { data: mediaItems } = await supabase
    .from("media_items")
    .select("preview_key, thumb_key, original_key")
    .eq("gallery_id", galleryId);

  const publicKeys: string[] = [];
  const privateKeys: string[] = [];
  for (const m of mediaItems ?? []) {
    if (m.preview_key)  publicKeys.push(m.preview_key);
    if (m.thumb_key)    publicKeys.push(m.thumb_key);
    if (m.original_key) privateKeys.push(m.original_key);
  }

  // Coleta chaves dos finais entregues
  const { data: finals } = await supabase
    .from("final_assets")
    .select("storage_key")
    .eq("gallery_id", galleryId);
  for (const f of finals ?? []) {
    if (f.storage_key) privateKeys.push(f.storage_key);
  }

  // Exclui do R2 (ignora erros — objetos podem já não existir)
  await Promise.allSettled([
    r2DeleteMany(BUCKET_PUBLIC,  publicKeys),
    r2DeleteMany(BUCKET_PRIVATE, privateKeys),
  ]);

  // Exclui a galeria (cascade remove media_items, selections, final_assets, etc.)
  const { error } = await supabase.from("galleries").delete().eq("id", galleryId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
