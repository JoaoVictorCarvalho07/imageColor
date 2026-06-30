import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import {
  refreshAccessToken,
  parseFolderId,
  listFolderImages,
  downloadFile,
} from "@/lib/google";
import { storePhoto } from "@/lib/mediaPipeline";
import { previewUrl } from "@/lib/storageUrl";

export const runtime = "nodejs";
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

  const body = (await req.json().catch(() => ({}))) as { folder?: string };
  const folderId = parseFolderId(String(body.folder ?? ""));
  if (!folderId) {
    return NextResponse.json(
      { error: "Link ou ID de pasta do Drive inválido." },
      { status: 400 },
    );
  }

  const { data: gallery } = await supabase
    .from("galleries")
    .select("id")
    .eq("id", galleryId)
    .single();
  if (!gallery) {
    return NextResponse.json({ error: "Galeria não encontrada" }, { status: 404 });
  }

  const { data: conn } = await supabase
    .from("drive_connections")
    .select("refresh_token_encrypted")
    .limit(1)
    .maybeSingle();
  if (!conn) {
    return NextResponse.json(
      { error: "Conecte o Google Drive primeiro." },
      { status: 400 },
    );
  }

  const { data: photographer } = await supabase
    .from("photographers")
    .select("watermark_text")
    .eq("id", user.id)
    .single();
  const wmText = photographer?.watermark_text || "ISABEL PONTES";

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(decrypt(conn.refresh_token_encrypted));
  } catch {
    return NextResponse.json(
      { error: "Conexão com o Drive expirou. Reconecte o Google Drive." },
      { status: 400 },
    );
  }

  let files;
  try {
    files = await listFolderImages(accessToken, folderId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao listar a pasta." },
      { status: 400 },
    );
  }

  // Evita reimportar o que já veio (por drive_file_id).
  const { data: existing } = await supabase
    .from("media_items")
    .select("drive_file_id")
    .eq("gallery_id", galleryId)
    .not("drive_file_id", "is", null);
  const seen = new Set((existing ?? []).map((r) => r.drive_file_id));
  const toImport = files.filter((f) => !seen.has(f.id));

  const { count } = await supabase
    .from("media_items")
    .select("id", { count: "exact", head: true })
    .eq("gallery_id", galleryId);
  let position = count ?? 0;

  const skipped = files.length - toImport.length;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      send({ type: "start", total: toImport.length, found: files.length, skipped });

      let imported = 0;
      try {
        for (const f of toImport) {
          const buf = await downloadFile(accessToken, f.id);
          const { thumbKey } = await storePhoto(supabase, {
            galleryId,
            buffer: buf,
            contentType: f.mimeType,
            position: position++,
            watermarkText: wmText,
            driveFileId: f.id,
            filename: f.name,
          });
          imported++;
          send({
            type: "item",
            index: imported,
            total: toImport.length,
            name: f.name,
            thumbUrl: previewUrl(thumbKey),
          });
        }

        await supabase
          .from("galleries")
          .update({ drive_folder_id: folderId })
          .eq("id", galleryId);

        send({ type: "done", imported, skipped, found: files.length });
      } catch (e) {
        send({
          type: "error",
          message: e instanceof Error ? e.message : "Falha na importação.",
          imported,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
