"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-md border border-border-default bg-surface-card px-3 py-1.5 text-xs font-medium text-fg-secondary transition-colors hover:bg-surface-card-hover hover:text-fg-primary"
    >
      {copied ? (
        <Check className="size-3.5 text-status-success" strokeWidth={2.25} />
      ) : (
        <Copy className="size-3.5" strokeWidth={2.25} />
      )}
      {copied ? "Copiado!" : "Copiar código"}
    </button>
  );
}
