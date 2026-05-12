"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function ScriptCopyBlock({ script }: { script: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select all in pre
      const pre = document.getElementById("script-pre");
      if (pre) {
        const range = document.createRange();
        range.selectNodeContents(pre);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-md border border-border-default bg-surface-card px-2.5 py-1.5 text-[10px] font-medium text-fg-secondary transition-colors hover:bg-surface-card-hover hover:text-fg-primary"
      >
        {copied ? (
          <>
            <Check className="size-3 text-status-success" strokeWidth={2.5} />
            Copiado
          </>
        ) : (
          <>
            <Copy className="size-3" strokeWidth={2.25} />
            Copiar
          </>
        )}
      </button>
      <pre
        id="script-pre"
        className="max-h-[480px] overflow-auto rounded-md border border-border-subtle bg-surface-input p-3 pr-24 text-[11px] leading-relaxed text-fg-secondary"
      >
        {script}
      </pre>
    </div>
  );
}
