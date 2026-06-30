"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2 } from "lucide-react";

export function MediaUploader({ galleryId }: { galleryId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
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

    const fd = new FormData();
    arr.forEach((f) => fd.append("files", f));

    try {
      const res = await fetch(`/api/admin/ensaios/${galleryId}/upload`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: `Erro: ${json.error ?? res.status}` });
      } else {
        setMsg({ ok: true, text: `${json.count} arquivo(s) processado(s) ✓` });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Falha no envio." });
    } finally {
      setBusy(false);
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
          {busy ? "Processando…" : "Adicionar fotos/vídeos"}
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
