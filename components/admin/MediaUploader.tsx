"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2 } from "lucide-react";

export function MediaUploader({ galleryId }: { galleryId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    const localUrls = arr
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => URL.createObjectURL(f));

    setPreviews(localUrls);
    setBusy(true);
    setMsg(null);

    let done = 0;
    try {
      for (let i = 0; i < arr.length; i++) {
        const file = arr[i];
        const label = arr.length > 1 ? ` ${i + 1}/${arr.length}` : "";

        // 1. Obtém URL assinada para PUT direto ao R2 (sem passar pelo Vercel)
        setStatus(`Enviando${label}…`);
        const presignRes = await fetch(
          `/api/admin/ensaios/${galleryId}/presign?` +
            new URLSearchParams({ filename: file.name, type: file.type }),
        );
        if (!presignRes.ok) throw new Error("Falha ao iniciar upload");
        const { uploadUrl, originalKey, mediaId } = await presignRes.json();

        // 2. PUT direto ao R2 — contorna o limite de 4.5 MB do Vercel
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!putRes.ok) throw new Error(`Erro no upload para R2 (${putRes.status})`);

        // 3. Servidor baixa do R2, aplica watermark e gera thumb
        setStatus(`Processando${label}…`);
        const processRes = await fetch(`/api/admin/ensaios/${galleryId}/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ originalKey, mediaId, filename: file.name, contentType: file.type }),
        });
        if (!processRes.ok) {
          const json = await processRes.json().catch(() => ({}));
          throw new Error(json.error ?? `Erro ao processar (${processRes.status})`);
        }
        done++;
      }
      setMsg({ ok: true, text: `${done} arquivo(s) processado(s) ✓` });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Falha no envio." });
    } finally {
      setBusy(false);
      setStatus("");
      localUrls.forEach((u) => URL.revokeObjectURL(u));
      setPreviews([]);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={onChange}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm uppercase tracking-wide text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4" />
          )}
          {busy ? status || "Enviando…" : "Adicionar fotos/vídeos"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-accent" : "text-destructive"}`}>
            {msg.text}
          </span>
        )}
      </div>

      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {previews.map((src, i) => (
            <div
              key={i}
              className="relative aspect-square overflow-hidden rounded-sm border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover opacity-50"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
