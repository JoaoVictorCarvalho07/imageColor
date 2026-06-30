"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, CheckCircle2, Send, EyeOff } from "lucide-react";
import { setDeliveryPublishedAction } from "@/lib/galleryAdminActions";

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
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const published = !!deliveredAt;

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    try {
      const res = await fetch(`/api/admin/ensaios/${galleryId}/finals`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: `Erro: ${json.error ?? res.status}` });
      } else {
        setMsg({ ok: true, text: `${json.count} arquivo(s) enviado(s) ✓` });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Falha no envio." });
    } finally {
      setBusy(false);
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
          {busy ? "Enviando…" : "Enviar fotos finais"}
        </button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-accent" : "text-destructive"}`}>
            {msg.text}
          </span>
        )}
      </div>

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
