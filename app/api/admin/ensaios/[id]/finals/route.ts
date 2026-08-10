import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/pb/session";
import { superuserPb } from "@/lib/pb/superuser";
import { r2Upload, BUCKET_PRIVATE } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 120;

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

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  let done = 0;
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const key = `${galleryId}/${crypto.randomUUID()}`;

    await r2Upload(
      BUCKET_PRIVATE,
      key,
      buf,
      file.type || "application/octet-stream",
    );

    try {
      await pb.collection("final_assets").create({
        gallery: galleryId,
        storage_key: key,
        filename: file.name,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erro ao registrar" },
        { status: 500 },
      );
    }
    done++;
  }

  return NextResponse.json({ ok: true, count: done });
}
