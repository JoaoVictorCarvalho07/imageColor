"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2 } from "lucide-react";
import { putFile, readError } from "@/lib/clientUpload";
import {
  isMediaType,
  maxBytesFor,
  formatLimit,
  resolveContentType,
} from "@/lib/mediaLimits";

export function MediaUploader({ galleryId }: { galleryId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [previews, setPreviews] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [failures, setFailures] = useState<{ name: string; reason: string }[]>([]);

  async function uploadOne(file: File, label: string): Promise<void> {
    const type = resolveContentType(file);
    if (!isMediaType(type)) {
      throw new Error("Formato não suportado.");
    }
    const limit = maxBytesFor(type);
    if (file.size > limit) {
      throw new Error(`Acima do limite de ${formatLimit(limit)}.`);
    }

    setStatus(`Enviando${label}…`);
    const presignRes = await fetch(
      `/api/admin/ensaios/${galleryId}/presign?` +
        new URLSearchParams({
          filename: file.name,
          type,
          size: String(file.size),
        }),
    );
    if (!presignRes.ok) {
      throw new Error(await readError(presignRes, "Falha ao iniciar o envio."));
    }
    const { uploadUrl, originalKey, objectId } = await presignRes.json();

    await putFile(uploadUrl, file, type, (f) =>
      setStatus(`Enviando${label} ${Math.round(f * 100)}%`),
    );

    setStatus(`Processando${label}…`);
    const processRes = await fetch(`/api/admin/ensaios/${galleryId}/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalKey,
        objectId,
        filename: file.name,
        contentType: type,
      }),
    });
    if (!processRes.ok) {
      throw new Error(
        await readError(processRes, `Erro ao processar (${processRes.status}).`),
      );
    }
  }

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
    setFailures([]);

    let done = 0;
    const failed: { name: string; reason: string }[] = [];
    try {
      for (let i = 0; i < arr.length; i++) {
        const file = arr[i];
        const label = arr.length > 1 ? ` ${i + 1}/${arr.length}` : "";
        try {
          await uploadOne(file, label);
          done++;
        } catch (err) {
          failed.push({
            name: file.name,
            reason: err instanceof Error ? err.message : "Falha no envio.",
          });
        }
      }
      setFailures(failed);
      setMsg(
        failed.length === 0
          ? { ok: true, text: `${done} arquivo(s) processado(s) ✓` }
          : {
              ok: false,
              text: `${done} de ${arr.length} arquivo(s) processado(s). ${failed.length} falhou(aram).`,
            },
      );
      if (done > 0) router.refresh();
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

      {failures.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-destructive">
          {failures.map((f, i) => (
            <li key={i}>
              {f.name}: {f.reason}
            </li>
          ))}
        </ul>
      )}

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
