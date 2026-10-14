import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/pb/session";
import { superuserPb } from "@/lib/pb/superuser";
import { decrypt } from "@/lib/crypto";
import {
  refreshAccessToken,
  parseFolderId,
  listFolderImages,
  downloadFileResilient,
  type DriveSession,
} from "@/lib/google";
import { PHOTO_MAX_BYTES, formatLimit } from "@/lib/mediaLimits";
import { storePhoto } from "@/lib/mediaPipeline";
import { WATERMARK_TEXT } from "@/lib/studio";
import { previewUrl } from "@/lib/storageUrl";

export const runtime = "nodejs";
export const maxDuration = 300;

const STOP_STARTING_AFTER_MS = 270_000;
const HARD_DEADLINE_MS = 290_000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: galleryId } = await params;

  if (!(await getAdminUser())) {
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

  const pb = await superuserPb();

  const gallery = await pb
    .collection("galleries")
    .getOne(galleryId)
    .catch(() => null);
  if (!gallery) {
    return NextResponse.json({ error: "Galeria não encontrada" }, { status: 404 });
  }

  const conns = await pb
    .collection("drive_connections")
    .getFullList<{ refresh_token_encrypted: string }>();
  const conn = conns[0];
  if (!conn) {
    return NextResponse.json(
      { error: "Conecte o Google Drive primeiro." },
      { status: 400 },
    );
  }

  const refreshToken = decrypt(conn.refresh_token_encrypted);
  let driveSession: DriveSession;
  try {
    driveSession = {
      accessToken: await refreshAccessToken(refreshToken),
      refreshToken,
    };
  } catch {
    return NextResponse.json(
      { error: "Conexão com o Drive expirou. Reconecte o Google Drive." },
      { status: 400 },
    );
  }

  let files;
  try {
    files = await listFolderImages(driveSession.accessToken, folderId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao listar a pasta." },
      { status: 400 },
    );
  }

  const existing = await pb.collection("media_items").getFullList<{
    drive_file_id: string;
  }>({
    filter: pb.filter("gallery = {:g} && drive_file_id != ''", { g: galleryId }),
    fields: "drive_file_id",
  });
  const seen = new Set(existing.map((r) => r.drive_file_id));
  const toImport = files.filter((f) => !seen.has(f.id));

  const all = await pb.collection("media_items").getList(1, 1, {
    filter: pb.filter("gallery = {:g}", { g: galleryId }),
  });
  let position = all.totalItems;

  if (gallery.drive_folder_id !== folderId) {
    await pb
      .collection("galleries")
      .update(galleryId, { drive_folder_id: folderId })
      .catch((err) =>
        console.error("[drive-import] falha ao salvar a pasta", {
          galleryId,
          error: err instanceof Error ? err.message : err,
        }),
      );
  }

  const skipped = files.length - toImport.length;
  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {}
      };

      send({ type: "start", total: toImport.length, found: files.length, skipped });

      let imported = 0;
      let failed = 0;
      let processed = 0;
      try {
        for (const f of toImport) {
          if (
            req.signal.aborted ||
            Date.now() - startedAt >= STOP_STARTING_AFTER_MS
          ) {
            break;
          }
          processed++;

          try {
            if (f.size && Number(f.size) > PHOTO_MAX_BYTES) {
              throw new Error(`Acima do limite de ${formatLimit(PHOTO_MAX_BYTES)}.`);
            }
            const buf = await downloadFileResilient(driveSession, f.id, {
              deadlineAt: startedAt + HARD_DEADLINE_MS,
            });
            const { thumbKey } = await storePhoto({
              galleryId,
              buffer: buf,
              contentType: f.mimeType,
              position,
              watermarkText: WATERMARK_TEXT,
              driveFileId: f.id,
              filename: f.name,
            });
            position++;
            imported++;
            send({
              type: "item",
              index: imported,
              total: toImport.length,
              name: f.name,
              thumbUrl: previewUrl(thumbKey),
            });
          } catch (e) {
            failed++;
            console.error("[drive-import] falha ao importar arquivo", {
              galleryId,
              driveFileId: f.id,
              error: e instanceof Error ? e.message : e,
            });
            send({
              type: "failed",
              name: f.name,
              message: e instanceof Error ? e.message : "Falha ao importar.",
            });
          }
        }

        send({
          type: "done",
          imported,
          failed,
          skipped,
          found: files.length,
          remaining: toImport.length - processed,
        });
      } catch (e) {
        send({
          type: "error",
          message: e instanceof Error ? e.message : "Falha na importação.",
          imported,
        });
      } finally {
        try {
          controller.close();
        } catch {}
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
