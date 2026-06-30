import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storePhoto } from "@/lib/mediaPipeline";
import { processVideo } from "@/lib/video";
import { r2Upload, BUCKET_PUBLIC, BUCKET_PRIVATE } from "@/lib/r2";

export const runtime = "nodejs"; // sharp/ffmpeg precisam do runtime Node
export const maxDuration = 300;

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

  // Confirma a propriedade da galeria (RLS já restringe, mas validamos cedo).
  const { data: gallery } = await supabase
    .from("galleries")
    .select("id")
    .eq("id", galleryId)
    .single();
  if (!gallery) {
    return NextResponse.json({ error: "Galeria não encontrada" }, { status: 404 });
  }

  const { data: photographer } = await supabase
    .from("photographers")
    .select("watermark_text")
    .eq("id", user.id)
    .single();
  const wmText = photographer?.watermark_text || "ISABEL PONTES";

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  const { count } = await supabase
    .from("media_items")
    .select("id", { count: "exact", head: true })
    .eq("gallery_id", galleryId);
  let position = count ?? 0;

  let done = 0;
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const mediaId = crypto.randomUUID();
    const isVideo = file.type.startsWith("video/");

    if (isVideo) {
      // Vídeo: transcodifica p/ preview 720p com marca d'água + poster.
      try {
        const { preview, thumb } = await processVideo(buf, wmText);
        const previewKey = `${galleryId}/${mediaId}.mp4`;
        const thumbKey = `${galleryId}/${mediaId}_t.webp`;
        const origKey = `${galleryId}/${mediaId}_orig`;

        await Promise.all([
          r2Upload(BUCKET_PUBLIC, previewKey, preview, "video/mp4"),
          r2Upload(BUCKET_PUBLIC, thumbKey, thumb, "image/webp"),
          r2Upload(BUCKET_PRIVATE, origKey, buf, file.type || "application/octet-stream"),
        ]);

        const { error } = await supabase.from("media_items").insert({
          id: mediaId,
          gallery_id: galleryId,
          type: "video",
          preview_key: previewKey,
          thumb_key: thumbKey,
          original_key: origKey,
          filename: file.name,
          status: "ready",
          position: position++,
        });
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        done++;
      } catch (e) {
        return NextResponse.json(
          {
            error:
              e instanceof Error ? e.message : "Falha ao processar o vídeo.",
          },
          { status: 500 },
        );
      }
      continue;
    }

    try {
      await storePhoto(supabase, {
        galleryId,
        buffer: buf,
        contentType: file.type,
        position: position++,
        watermarkText: wmText,
        filename: file.name,
      });
      done++;
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Falha ao processar a foto." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, count: done });
}
