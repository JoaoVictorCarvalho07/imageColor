import { type NextRequest } from "next/server";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { cookies } from "next/headers";
import { getSessionDownloads } from "@/lib/pb/gallery";
import { r2GetStream, safeFilename, BUCKET_PRIVATE } from "@/lib/r2";
import { sessionCookieName } from "@/lib/access";

export const runtime = "nodejs";
export const maxDuration = 300;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/tiff": "tif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

const extensionFor = (contentType: string | null): string =>
  EXTENSIONS[(contentType ?? "").split(";")[0].trim().toLowerCase()] ?? "jpg";

function uniqueName(name: string, used: Set<string>): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let candidate = name;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) {
    candidate = `${stem} (${n})${ext}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function appendAndWait(
  archive: ZipArchive,
  source: Readable,
  name: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      archive.off("entry", onEntry);
      archive.off("error", onError);
      source.off("error", onError);
    };
    const onEntry = () => {
      cleanup();
      resolve();
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    archive.on("entry", onEntry);
    archive.once("error", onError);
    source.once("error", onError);
    archive.append(source, { name });
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const jar = await cookies();
  const session = jar.get(sessionCookieName(token))?.value;
  if (!session) return new Response("Sessão inválida", { status: 401 });

  const files = await getSessionDownloads(session);
  if (!files) return new Response("Sessão inválida", { status: 401 });
  if (files.length === 0) {
    return new Response("Entrega indisponível", { status: 403 });
  }

  const archive = new ZipArchive({ store: true });
  const controller = new AbortController();
  let current: Readable | null = null;
  const abort = () => {
    controller.abort();
    current?.destroy();
    archive.destroy();
  };
  req.signal.addEventListener("abort", abort, { once: true });
  archive.once("close", () => req.signal.removeEventListener("abort", abort));

  (async () => {
    const used = new Set<string>();
    const failures: string[] = [];
    try {
      let index = 0;
      for (const f of files) {
        if (controller.signal.aborted) return;
        index++;
        const label = f.filename ? safeFilename(f.filename) : `arquivo ${index}`;
        let object;
        try {
          object = await r2GetStream(BUCKET_PRIVATE, f.storageKey, controller.signal);
        } catch (err) {
          if (controller.signal.aborted) return;
          console.error("[finals-zip] falha ao ler arquivo", {
            key: f.storageKey,
            error: err instanceof Error ? err.message : err,
          });
          failures.push(label);
          continue;
        }

        const fallback = `foto-${String(index).padStart(3, "0")}.${extensionFor(object.contentType)}`;
        const name = uniqueName(safeFilename(f.filename, fallback), used);
        current = object.stream;
        await appendAndWait(archive, object.stream, name);
        current = null;
      }

      if (failures.length > 0) {
        archive.append(
          [
            "Alguns arquivos não puderam ser incluídos neste ZIP:",
            "",
            ...failures.map((n) => `- ${n}`),
            "",
            "Tente baixar novamente ou entre em contato com a fotógrafa.",
          ].join("\r\n"),
          { name: "LEIA-ME-erros.txt" },
        );
      }
      await archive.finalize();
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error("[finals-zip] falha ao montar o ZIP", {
          error: err instanceof Error ? err.message : err,
        });
      }
      archive.destroy();
    }
  })();

  const webStream = Readable.toWeb(
    archive,
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="fotos.zip"',
      "Cache-Control": "no-store",
    },
  });
}
