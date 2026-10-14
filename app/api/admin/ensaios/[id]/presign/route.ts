import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/pb/session";
import { superuserPb } from "@/lib/pb/superuser";
import { newObjectId, keysFor } from "@/lib/mediaPipeline";
import { r2PresignedPutUrl, BUCKET_PRIVATE } from "@/lib/r2";
import {
  isMediaType,
  maxBytesFor,
  formatLimit,
  isVideoType,
} from "@/lib/mediaLimits";

export const runtime = "nodejs";

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
  const contentType = searchParams.get("type") ?? "";
  const size = Number(searchParams.get("size"));

  if (!isMediaType(contentType)) {
    return NextResponse.json(
      {
        error:
          "Formato não suportado. Envie JPEG, PNG, WebP, HEIC, MP4, MOV ou WebM.",
      },
      { status: 400 },
    );
  }

  if (!Number.isSafeInteger(size) || size <= 0) {
    return NextResponse.json(
      { error: "Informe o tamanho do arquivo." },
      { status: 400 },
    );
  }

  const limit = maxBytesFor(contentType);
  if (size > limit) {
    return NextResponse.json(
      {
        error: `${isVideoType(contentType) ? "Vídeo" : "Foto"} acima do limite de ${formatLimit(limit)}.`,
      },
      { status: 400 },
    );
  }

  const objectId = newObjectId();
  const { originalKey } = keysFor(galleryId, objectId);
  const uploadUrl = await r2PresignedPutUrl(BUCKET_PRIVATE, originalKey, contentType, {
    contentLength: size,
    expiresIn: 7200,
  });

  return NextResponse.json({ uploadUrl, originalKey, objectId });
}
