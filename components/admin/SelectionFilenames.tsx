"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function SelectionFilenames({ names }: { names: string[] }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  if (names.length === 0) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(names.join("\n"));
      setFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden />
        )}
        {copied ? "Copiado!" : "Copiar nomes (para achar os RAWs)"}
      </button>
      <span role="status" className="sr-only">
        {copied ? "Nomes copiados" : ""}
      </span>
      {failed && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          Não foi possível copiar. Selecione os nomes e copie manualmente.
        </p>
      )}
      <div
        role="region"
        aria-label="Nomes dos arquivos selecionados"
        tabIndex={0}
        className="scrollbar-none mt-2 max-h-44 overflow-auto rounded-md border border-border bg-background p-2 font-mono text-xs text-muted-foreground"
      >
        {names.map((n, i) => (
          <div key={i}>{n}</div>
        ))}
      </div>
    </div>
  );
}
