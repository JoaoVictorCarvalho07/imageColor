import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storePhotoFromR2Key } from "@/lib/mediaPipeline";
import { processVideo } from "@/lib/video";
import { r2Download, r2Upload, BUCKET_PUBLIC, BUCKET_PRIVATE } from "@/lib/r2";

export const runtime = "nodejs"; // sharp/ffmpeg precisam do runtime Node
export const maxDuration = 300;

/**
 * POST /api/admin/ensaios/[id]/upload
 *
 * Recebe { originalKey, mediaId, filename, contentType } em JSON.
 * O original já está no R2 privado (enviado pelo browser via presigned PUT).
 * Este endpoint só faz: download do original → watermark/thumb → upload → DB.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: galleryId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: gallery } = await supabase
    .from("galleries").select("id").eq("id", galleryId).single();
  if (!gallery) return NextResponse.json({ error: "Galeria não encontrada" }, { status: 404 });

  const { data: photographer } = await supabase
    .from("photographers").select("watermark_text").eq("id", user.id).single();
  const wmText = photographer?.watermark_text || "ISABEL PONTES";

  const body = await req.json() as {
    originalKey: string;
    mediaId: string;
    filename: string;
    contentType: string;
  };
  const { originalKey, mediaId, filename, contentType } = body;

  const { count } = await supabase
    .from("media_items")
    .select("id", { count: "exact", head: true })
    .eq("gallery_id", galleryId);
  const position = count ?? 0;

  const isVideo = contentType.startsWith("video/");

  if (isVideo) {
    try {
      const buf = await r2Download(BUCKET_PRIVATE, originalKey);
      const { preview, thumb } = await processVideo(buf, wmText);
      const previewKey = `${galleryId}/${mediaId}.mp4`;
      const thumbKey = `${galleryId}/${mediaId}_t.webp`;

      await Promise.all([
        r2Upload(BUCKET_PUBLIC, previewKey, preview, "video/mp4"),
        r2Upload(BUCKET_PUBLIC, thumbKey, thumb, "image/webp"),
      ]);

      const { error } = await supabase.from("media_items").insert({
        id: mediaId,
        gallery_id: galleryId,
        type: "video",
        preview_key: previewKey,
        thumb_key: thumbKey,
        original_key: originalKey,
        filename,
        status: "ready",
        position,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Falha ao processar o vídeo." },
        { status: 500 },
      );
    }
  } else {
    try {
      await storePhotoFromR2Key(supabase, {
        galleryId,
        mediaId,
        originalKey,
        contentType,
        position,
        watermarkText: wmText,
        filename,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Falha ao processar a foto." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, count: 1 });
}
