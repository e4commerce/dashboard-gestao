"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Channel = "shopify" | "cogs" | "mp";

const POLL_MS = 4000;

type SyncResponse = {
  shopify: { running: boolean };
  cogs: { running: boolean };
  mp: { running: boolean };
};

// Faz router.refresh() periodicamente enquanto o canal informado estiver com
// status "running". Quando vê transição running → idle, faz um refresh final.
export function AutoRefreshOnSync({ channel }: { channel: Channel }) {
  const router = useRouter();
  const wasRunning = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const res = await fetch("/api/sync-status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as SyncResponse;
        const running = data[channel].running;
        if (running) {
          wasRunning.current = true;
          router.refresh();
        } else if (wasRunning.current) {
          wasRunning.current = false;
          router.refresh();
        }
      } catch {
        // ignora; próximo tick tenta de novo
      } finally {
        if (!cancelled) timeoutId = setTimeout(tick, POLL_MS);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [channel, router]);

  return null;
}
