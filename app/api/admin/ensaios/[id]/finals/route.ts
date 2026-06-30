import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { r2Upload, BUCKET_PRIVATE } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: galleryId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: gallery } = await supabase
    .from("galleries")
    .select("id")
    .eq("id", galleryId)
    .single();
  if (!gallery) {
    return NextResponse.json({ error: "Galeria não encontrada" }, { status: 404 });
  }

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  let done = 0;
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const key = `${galleryId}/${crypto.randomUUID()}`;

    await r2Upload(BUCKET_PRIVATE, key, buf, file.type || "application/octet-stream");

    const { error } = await supabase.from("final_assets").insert({
      gallery_id: galleryId,
      storage_key: key,
      filename: file.name,
      size_bytes: buf.length,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    done++;
  }

  return NextResponse.json({ ok: true, count: done });
}
