"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin + path);
      setFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground">
        {path}
      </code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground hover:opacity-90"
      >
        {copied ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
        {copied ? "Copiado!" : "Copiar"}
      </button>
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="h-4 w-4" aria-hidden /> Abrir
      </a>
      <span role="status" className="sr-only">
        {copied ? "Link copiado" : ""}
      </span>
      {failed && (
        <span role="alert" className="basis-full text-sm text-destructive">
          Não foi possível copiar. Selecione o link e copie manualmente.
        </span>
      )}
    </div>
  );
}
