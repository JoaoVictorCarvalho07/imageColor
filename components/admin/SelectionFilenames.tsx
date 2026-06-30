"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function SelectionFilenames({ names }: { names: string[] }) {
  const [copied, setCopied] = useState(false);
  if (names.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(names.join("\n"));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? "Copiado!" : "Copiar nomes (p/ achar os RAWs)"}
      </button>
      <div className="scrollbar-none mt-2 max-h-44 overflow-auto rounded-md border border-border bg-background p-2 font-mono text-xs text-muted-foreground">
        {names.map((n, i) => (
          <div key={i}>{n}</div>
        ))}
      </div>
    </div>
  );
}
