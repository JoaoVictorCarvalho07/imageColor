"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground">
        {path}
      </code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(window.location.origin + path);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground hover:opacity-90"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copiado!" : "Copiar"}
      </button>
      <a
        href={path}
        target="_blank"
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="h-4 w-4" /> Abrir
      </a>
    </div>
  );
}
