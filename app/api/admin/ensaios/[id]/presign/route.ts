import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/pb/session";
import { superuserPb } from "@/lib/pb/superuser";
import { newObjectId, keysFor } from "@/lib/mediaPipeline";
import { r2PresignedPutUrl, BUCKET_PRIVATE } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * GET /api/admin/ensaios/[id]/presign?filename=foo.jpg&type=image/jpeg
 *
 * Devolve uma URL assinada para PUT direto ao R2 privado, contornando o
 * limite de 4.5 MB do Vercel. O cliente faz o PUT e depois chama /upload
 * com o `originalKey` para acionar o processamento (watermark + thumb).
 *
 * `objectId` identifica o OBJETO no R2, não o registro no banco — o id do
 * registro só existe depois que /upload insere em media_items.
 */
export async function GET(
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

  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get("type") ?? "application/octet-stream";

  const objectId = newObjectId();
  const { originalKey } = keysFor(galleryId, objectId);
  const uploadUrl = await r2PresignedPutUrl(
    BUCKET_PRIVATE,
    originalKey,
    contentType,
  );

  return NextResponse.json({ uploadUrl, originalKey, objectId });
}
