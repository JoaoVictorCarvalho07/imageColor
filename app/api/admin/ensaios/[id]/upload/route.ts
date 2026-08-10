import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/pb/session";
import { superuserPb } from "@/lib/pb/superuser";
import { storePhotoFromR2Key, keysFor } from "@/lib/mediaPipeline";
import { WATERMARK_TEXT } from "@/lib/studio";
import { processVideo } from "@/lib/video";
import { r2Download, r2Upload, BUCKET_PUBLIC, BUCKET_PRIVATE } from "@/lib/r2";

export const runtime = "nodejs"; // sharp/ffmpeg precisam do runtime Node
export const maxDuration = 300;

/**
 * POST /api/admin/ensaios/[id]/upload
 *
 * Recebe { originalKey, objectId, filename, contentType } em JSON.
 * O original já está no R2 privado (enviado pelo browser via presigned PUT).
 * Este endpoint só faz: download do original → watermark/thumb → upload → DB.
 */
export async function POST(
  req: NextRequest,
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

  const { originalKey, objectId, filename, contentType } = (await req.json()) as {
    originalKey: string;
    objectId: string;
    filename: string;
    contentType: string;
  };

  const existing = await pb.collection("media_items").getList(1, 1, {
    filter: pb.filter("gallery = {:g}", { g: galleryId }),
  });
  const position = existing.totalItems;

  if (contentType.startsWith("video/")) {
    try {
      const buf = await r2Download(BUCKET_PRIVATE, originalKey);
      const { preview, thumb } = await processVideo(buf, WATERMARK_TEXT);
      const { thumbKey } = keysFor(galleryId, objectId);
      const previewKey = `${galleryId}/${objectId}.mp4`;

      await Promise.all([
        r2Upload(BUCKET_PUBLIC, previewKey, preview, "video/mp4"),
        r2Upload(BUCKET_PUBLIC, thumbKey, thumb, "image/webp"),
      ]);

      await pb.collection("media_items").create({
        gallery: galleryId,
        type: "video",
        preview_key: previewKey,
        thumb_key: thumbKey,
        original_key: originalKey,
        filename,
        status: "ready",
        position,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Falha ao processar o vídeo." },
        { status: 500 },
      );
    }
  } else {
    try {
      await storePhotoFromR2Key({
        galleryId,
        objectId,
        originalKey,
        position,
        watermarkText: WATERMARK_TEXT,
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
