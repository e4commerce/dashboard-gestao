"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Dispara router.refresh() em intervalo fixo. Re-renderiza os server
// components da rota atual com dados frescos, sem reload completo da página
// (mantém estado de scroll/cliente). Pausa quando a aba fica oculta para
// não consumir recursos à toa.
export function AutoRefreshInterval({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (id !== null) return;
      id = setInterval(() => router.refresh(), intervalMs);
    }

    function stop() {
      if (id === null) return;
      clearInterval(id);
      id = null;
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stop();
      } else {
        router.refresh();
        start();
      }
    }

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, router]);

  return null;
}
