"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, CheckCircle2, Send, EyeOff } from "lucide-react";
import { setDeliveryPublishedAction } from "@/lib/galleryAdminActions";
import { putFile, readError } from "@/lib/clientUpload";
import {
  isFinalType,
  resolveContentType,
  FINAL_MAX_BYTES,
  formatLimit,
} from "@/lib/mediaLimits";

export function DeliveryManager({
  galleryId,
  finals,
  deliveredAt,
}: {
  galleryId: string;
  finals: { filename: string | null }[];
  deliveredAt: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [failures, setFailures] = useState<{ name: string; reason: string }[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const published = !!deliveredAt;

  async function uploadOne(file: File, label: string): Promise<void> {
    const type = resolveContentType(file);
    if (!isFinalType(type)) throw new Error("Formato não suportado.");
    if (file.size > FINAL_MAX_BYTES) {
      throw new Error(`Acima do limite de ${formatLimit(FINAL_MAX_BYTES)}.`);
    }

    setStatus(`Enviando${label}…`);
    const presignRes = await fetch(`/api/admin/ensaios/${galleryId}/finals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "presign",
        filename: file.name,
        type,
        size: file.size,
      }),
    });
    if (!presignRes.ok) {
      throw new Error(await readError(presignRes, "Falha ao iniciar o envio."));
    }
    const { key, url } = await presignRes.json();

    await putFile(url, file, type, (f) =>
      setStatus(`Enviando${label} ${Math.round(f * 100)}%`),
    );

    setStatus(`Registrando${label}…`);
    const registerRes = await fetch(`/api/admin/ensaios/${galleryId}/finals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", key, filename: file.name }),
    });
    if (!registerRes.ok) {
      throw new Error(
        await readError(registerRes, `Erro ao registrar (${registerRes.status}).`),
      );
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
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
          ? { ok: true, text: `${done} arquivo(s) enviado(s) ✓` }
          : {
              ok: false,
              text: `${done} de ${arr.length} arquivo(s) enviado(s). ${failed.length} falhou(aram).`,
            },
      );
      if (done > 0) router.refresh();
    } finally {
      setBusy(false);
      setStatus("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function togglePublish() {
    startTransition(async () => {
      await setDeliveryPublishedAction(galleryId, !published);
      router.refresh();
    });
  }

  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">
        Envie as fotos finais editadas (sem marca d&apos;água). Ficam privadas
        até você publicar a entrega.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onUpload}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm text-foreground hover:bg-secondary disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4" />
          )}
          {busy ? status || "Enviando…" : "Enviar fotos finais"}
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

      {finals.length > 0 && (
        <div className="scrollbar-none mt-3 max-h-44 overflow-auto rounded-md border border-border bg-background p-2 font-mono text-xs text-muted-foreground">
          {finals.map((f, i) => (
            <div key={i}>{f.filename ?? "(sem nome)"}</div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <span className="text-sm">
          {published ? (
            <span className="inline-flex items-center gap-1.5 text-accent">
              <CheckCircle2 className="h-4 w-4" /> Entrega publicada (
              {finals.length} foto(s))
            </span>
          ) : (
            <span className="text-muted-foreground">Entrega não publicada</span>
          )}
        </span>
        <button
          type="button"
          onClick={togglePublish}
          disabled={pending || finals.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm uppercase tracking-wide text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : published ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {pending
            ? "Salvando…"
            : published
              ? "Despublicar"
              : "Publicar entrega"}
        </button>
      </div>
      {finals.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Envie ao menos uma foto final para publicar.
        </p>
      )}
    </div>
  );
}
