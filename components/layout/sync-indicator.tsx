"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type SyncStatus = {
  shopify: { running: boolean; runningSince: string | null };
  cogs: { running: boolean; runningSince: string | null };
  mp: { running: boolean; runningSince: string | null };
};

const POLL_MS = 4000;

export function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/sync-status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as SyncStatus;
        if (!cancelled) setStatus(data);
      } catch {
        // network blips don't matter — próximo tick resolve
      }
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!status) return null;
  const items: Array<{ key: string; label: string }> = [];
  if (status.shopify.running) items.push({ key: "shopify", label: "Shopify" });
  if (status.cogs.running) items.push({ key: "cogs", label: "Custos" });
  if (status.mp.running) items.push({ key: "mp", label: "MP" });
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 px-2 py-3">
      {items.map((it) => (
        <div
          key={it.key}
          className="flex items-center gap-1.5 rounded-md bg-status-info/10 px-2 py-1.5 text-[10px] font-medium text-status-info"
          title={`Sincronizando ${it.label} em background`}
        >
          <Loader2 className="size-3 animate-spin" strokeWidth={2.5} />
          <span className="truncate">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
