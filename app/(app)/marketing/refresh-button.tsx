"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";

export function RefreshDataButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      title="Re-lê os dados do banco. Para forçar nova coleta no Google Ads, abra o Script e clique em Preview."
      className="flex items-center gap-2 rounded-md border border-border-default bg-surface-card px-3.5 py-2 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-card-hover disabled:opacity-60"
    >
      <RefreshCw
        className={`size-3.5 ${pending ? "animate-spin" : ""}`}
        strokeWidth={2.25}
      />
      {pending ? "Atualizando…" : "Atualizar dados"}
    </button>
  );
}
