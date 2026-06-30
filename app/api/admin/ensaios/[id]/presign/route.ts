import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { r2PresignedPutUrl, BUCKET_PRIVATE } from "@/lib/r2";

export const runtime = "nodejs";

/**
 * GET /api/admin/ensaios/[id]/presign?filename=foo.jpg&type=image/jpeg
 *
 * Devolve uma URL assinada para PUT direto ao R2 privado, contornando o
 * limite de 4.5 MB do Vercel. O cliente faz o PUT e depois chama /upload
 * com o originalKey para acionar o processamento (watermark + thumb).
 */
export async function GET(
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

  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get("type") ?? "application/octet-stream";

  const mediaId = crypto.randomUUID();
  const originalKey = `${galleryId}/${mediaId}_orig`;
  const uploadUrl = await r2PresignedPutUrl(BUCKET_PRIVATE, originalKey, contentType);

  return NextResponse.json({ uploadUrl, originalKey, mediaId });
}
