import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/pb/session";
import { superuserPb } from "@/lib/pb/superuser";
import { newObjectId, isValidObjectId } from "@/lib/mediaPipeline";
import {
  r2PresignedPutUrl,
  r2Head,
  r2DeleteBestEffort,
  safeFilename,
  BUCKET_PRIVATE,
} from "@/lib/r2";
import { isFinalType, FINAL_MAX_BYTES, formatLimit } from "@/lib/mediaLimits";

export const runtime = "nodejs";

interface FinalsBody {
  action?: unknown;
  filename?: unknown;
  type?: unknown;
  size?: unknown;
  key?: unknown;
}

const finalKey = (galleryId: string, objectId: string) =>
  `${galleryId}/finals/${objectId}`;

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

  const body = (await req.json().catch(() => null)) as FinalsBody | null;
  if (!body) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (body.action === "presign") {
    const { type, size } = body;
    if (typeof type !== "string" || !isFinalType(type)) {
      return NextResponse.json(
        { error: "Formato não suportado. Envie JPEG, PNG, WebP, HEIC ou TIFF." },
        { status: 400 },
      );
    }
    if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0) {
      return NextResponse.json(
        { error: "Informe o tamanho do arquivo." },
        { status: 400 },
      );
    }
    if (size > FINAL_MAX_BYTES) {
      return NextResponse.json(
        { error: `Arquivo acima do limite de ${formatLimit(FINAL_MAX_BYTES)}.` },
        { status: 400 },
      );
    }

    const key = finalKey(galleryId, newObjectId());
    const url = await r2PresignedPutUrl(BUCKET_PRIVATE, key, type, {
      contentLength: size,
      expiresIn: 3600,
    });
    return NextResponse.json({ key, url });
  }

  if (body.action === "register") {
    const { key, filename } = body;
    const prefix = `${galleryId}/finals/`;
    if (
      typeof key !== "string" ||
      !key.startsWith(prefix) ||
      !isValidObjectId(key.slice(prefix.length))
    ) {
      return NextResponse.json({ error: "Chave inválida." }, { status: 400 });
    }

    const head = await r2Head(BUCKET_PRIVATE, key).catch(() => undefined);
    if (head === undefined) {
      return NextResponse.json(
        { error: "Não foi possível verificar o arquivo enviado." },
        { status: 502 },
      );
    }
    if (head === null) {
      return NextResponse.json(
        { error: "Arquivo não encontrado no armazenamento. Envie novamente." },
        { status: 400 },
      );
    }

    const duplicate = await pb.collection("final_assets").getList(1, 1, {
      filter: pb.filter("gallery = {:g} && storage_key = {:k}", {
        g: galleryId,
        k: key,
      }),
    });
    if (duplicate.totalItems > 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    try {
      await pb.collection("final_assets").create({
        gallery: galleryId,
        storage_key: key,
        filename: safeFilename(typeof filename === "string" ? filename : "", "foto"),
      });
    } catch (err) {
      console.error("[finals] falha ao registrar arquivo final", {
        galleryId,
        key,
        error: err instanceof Error ? err.message : err,
      });
      await r2DeleteBestEffort(BUCKET_PRIVATE, [key], "finals:registro");
      return NextResponse.json(
        { error: "Não foi possível registrar o arquivo. Envie novamente." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, count: 1 });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
