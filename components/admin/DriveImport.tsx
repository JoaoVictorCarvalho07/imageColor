"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, FolderInput, CheckCircle2, Loader2 } from "lucide-react";

interface ImportEvent {
  type: "start" | "item" | "done" | "error";
  total?: number;
  index?: number;
  thumbUrl?: string | null;
  imported?: number;
  skipped?: number;
  found?: number;
  message?: string;
}

export function DriveImport({
  galleryId,
  connected,
  accountEmail,
  defaultFolder,
}: {
  galleryId: string;
  connected: boolean;
  accountEmail?: string | null;
  defaultFolder?: string | null;
}) {
  const router = useRouter();
  const [folder, setFolder] = useState(defaultFolder ?? "");
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!connected) {
    return (
      <div className="rounded-md border border-dashed border-border p-4">
        <p className="mb-2 text-sm text-muted-foreground">
          Conecte o Google Drive para importar as fotos direto de uma pasta.
        </p>
        <a
          href="/api/admin/drive/connect"
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm text-foreground hover:bg-secondary"
        >
          <Link2 className="h-4 w-4" /> Conectar Google Drive
        </a>
      </div>
    );
  }

  async function importNow() {
    setBusy(true);
    setMsg(null);
    setThumbs([]);
    setTotal(0);
    setDone(0);

    try {
      const res = await fetch(`/api/admin/ensaios/${galleryId}/drive-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });

      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok && ct.includes("application/json")) {
        const j = await res.json();
        setMsg({ ok: false, text: `Erro: ${j.error ?? res.status}` });
        return;
      }
      if (!res.body) {
        setMsg({ ok: false, text: "Sem resposta do servidor." });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let imported = 0;
      let skipped = 0;
      let found = 0;
      let hadError = false;

      while (true) {
        const { done: rdone, value } = await reader.read();
        if (rdone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const s = line.trim();
          if (!s) continue;
          let evt: ImportEvent;
          try {
            evt = JSON.parse(s);
          } catch {
            continue;
          }
          if (evt.type === "start") {
            setTotal(evt.total ?? 0);
          } else if (evt.type === "item") {
            setDone(evt.index ?? 0);
            if (evt.thumbUrl) setThumbs((t) => [...t, evt.thumbUrl as string]);
          } else if (evt.type === "done") {
            imported = evt.imported ?? 0;
            skipped = evt.skipped ?? 0;
            found = evt.found ?? 0;
          } else if (evt.type === "error") {
            hadError = true;
            setMsg({ ok: false, text: `Erro: ${evt.message}` });
          }
        }
      }

      if (!hadError) {
        setMsg({
          ok: true,
          text: `${imported} importada(s) · ${skipped} já existiam · ${found} na pasta.`,
        });
      }
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Falha na importação." });
    } finally {
      setBusy(false);
    }
  }

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-md border border-border p-4">
      <p className="mb-2 inline-flex items-center gap-1.5 text-sm text-accent">
        <CheckCircle2 className="h-4 w-4" /> Drive conectado
        {accountEmail && (
          <span className="text-muted-foreground">({accountEmail})</span>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          placeholder="Cole o link da pasta do Google Drive"
          disabled={busy}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent disabled:opacity-60"
        />
        <button
          type="button"
          onClick={importNow}
          disabled={busy || !folder}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm uppercase tracking-wide text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderInput className="h-4 w-4" />
          )}
          {busy
            ? total > 0
              ? `Importando ${done}/${total}`
              : "Listando…"
            : "Importar"}
        </button>
      </div>

      {busy && total > 0 && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {thumbs.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {thumbs.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt=""
              className="aspect-square w-full rounded-sm border border-border object-cover"
            />
          ))}
        </div>
      )}

      {msg && (
        <p className={`mt-2 text-sm ${msg.ok ? "text-accent" : "text-destructive"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
