import { type NextRequest } from "next/server";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { r2Download, BUCKET_PRIVATE } from "@/lib/r2";
import { sessionCookieName } from "@/lib/access";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const jar = await cookies();
  const session = jar.get(sessionCookieName(token))?.value;
  if (!session) return new Response("Sessão inválida", { status: 401 });

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_gallery_session", {
    p_session: session,
  });
  if (!data || !data.download_ready) {
    return new Response("Entrega indisponível", { status: 403 });
  }
  const finals = (data.finals ?? []) as {
    storage_key: string;
    filename: string | null;
    bucket: "finals" | "originals";
  }[];
  if (finals.length === 0) return new Response("Sem arquivos", { status: 404 });

  const archive = new ZipArchive();

  (async () => {
    try {
      const seen = new Set<string>();
      let i = 0;
      for (const f of finals) {
        i++;
        let buf: Buffer;
        try {
          buf = await r2Download(BUCKET_PRIVATE, f.storage_key);
        } catch {
          continue;
        }
        let name = f.filename || `foto-${String(i).padStart(3, "0")}.jpg`;
        if (seen.has(name)) name = `${i}-${name}`;
        seen.add(name);
        archive.append(buf, { name });
      }
      await archive.finalize();
    } catch {
      archive.destroy();
    }
  })();

  const webStream = Readable.toWeb(
    archive,
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="fotos-${token}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
