import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/pb/session";
import { superuserPb } from "@/lib/pb/superuser";
import {
  storePhotoFromR2Key,
  storeVideoFromR2Key,
  keysFor,
  isValidObjectId,
} from "@/lib/mediaPipeline";
import { WATERMARK_TEXT } from "@/lib/studio";
import {
  r2Head,
  r2DeleteBestEffort,
  safeFilename,
  BUCKET_PRIVATE,
} from "@/lib/r2";
import { isMediaType, isVideoType, maxBytesFor } from "@/lib/mediaLimits";

export const runtime = "nodejs";
export const maxDuration = 300;

interface UploadBody {
  originalKey?: unknown;
  objectId?: unknown;
  filename?: unknown;
  contentType?: unknown;
}

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

  const body = (await req.json().catch(() => null)) as UploadBody | null;
  const { originalKey, objectId, filename, contentType } = body ?? {};

  if (
    typeof originalKey !== "string" ||
    typeof contentType !== "string" ||
    !isValidObjectId(objectId) ||
    originalKey !== keysFor(galleryId, objectId).originalKey
  ) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (!isMediaType(contentType)) {
    return NextResponse.json(
      { error: "Formato de arquivo não suportado." },
      { status: 400 },
    );
  }

  const head = await r2Head(BUCKET_PRIVATE, originalKey).catch(() => undefined);
  if (head === undefined) {
    return NextResponse.json(
      { error: "Não foi possível verificar o arquivo enviado. Tente novamente." },
      { status: 502 },
    );
  }
  if (head === null) {
    return NextResponse.json(
      { error: "Arquivo não encontrado no armazenamento. Envie novamente." },
      { status: 400 },
    );
  }
  if (head.size > maxBytesFor(contentType)) {
    await r2DeleteBestEffort(BUCKET_PRIVATE, [originalKey], "upload:limite");
    return NextResponse.json(
      { error: "Arquivo acima do limite permitido." },
      { status: 400 },
    );
  }

  const duplicate = await pb.collection("media_items").getList(1, 1, {
    filter: pb.filter("gallery = {:g} && original_key = {:k}", {
      g: galleryId,
      k: originalKey,
    }),
  });
  if (duplicate.totalItems > 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const existing = await pb.collection("media_items").getList(1, 1, {
    filter: pb.filter("gallery = {:g}", { g: galleryId }),
  });

  const common = {
    galleryId,
    objectId,
    originalKey,
    position: existing.totalItems,
    watermarkText: WATERMARK_TEXT,
    filename: safeFilename(typeof filename === "string" ? filename : "", "arquivo"),
  };

  const video = isVideoType(contentType);
  try {
    await (video ? storeVideoFromR2Key(common) : storePhotoFromR2Key(common));
  } catch (err) {
    console.error("[upload] falha ao processar mídia", {
      galleryId,
      originalKey,
      error: err instanceof Error ? err.message : err,
    });
    await r2DeleteBestEffort(BUCKET_PRIVATE, [originalKey], "upload:falha");
    return NextResponse.json(
      {
        error: video
          ? "Não foi possível processar o vídeo. Envie o arquivo novamente."
          : "Não foi possível processar a foto. Envie o arquivo novamente.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, count: 1 });
}
