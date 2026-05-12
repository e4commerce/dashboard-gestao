// Roda uma vez quando o servidor Next.js sobe. Faz:
// 1. Cleanup de logs com status "running" (órfãos de crash/redeploy)
// 2. Registra os crons internos (extract Shopify + refresh DSers)
// Tudo no mesmo processo Node — sem serviço externo.
//
// Single-instance only: se um dia escalarmos pra múltiplos replicas, cada
// instância vai disparar — aí migrar pra Railway Cron ou leader-election.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.DISABLE_CRON === "1") {
    console.log("[cron] disabled via DISABLE_CRON=1");
    return;
  }

  const g = globalThis as { __cronStarted?: boolean };
  if (g.__cronStarted) return;
  g.__cronStarted = true;

  const cron = await import("node-cron");
  const {
    runExtraction,
    cleanupOrphanedExtractions,
  } = await import("./server/etl/extract");
  const {
    runCogsSync,
    cleanupOrphanedCogsSyncs,
  } = await import("./server/cogs/sync");

  // Cleanup órfãos: qualquer run com status "running" vindo de antes do boot
  // não vai mais avançar — marca como "failed" com mensagem explicativa.
  try {
    const [orphanExt, orphanCogs] = await Promise.all([
      cleanupOrphanedExtractions(),
      cleanupOrphanedCogsSyncs(),
    ]);
    if (orphanExt + orphanCogs > 0) {
      console.log(
        `[startup] cleaned orphaned runs — ${orphanExt} extrações, ${orphanCogs} cogs syncs`,
      );
    }
  } catch (err) {
    console.error("[startup] cleanup failed", err);
  }

  const TZ = "America/Sao_Paulo";

  // Extract Shopify — toda hora cheia (janela de 24h, upsert idempotente)
  cron.schedule(
    "0 * * * *",
    async () => {
      const to = new Date();
      const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
      try {
        const result = await runExtraction(from, to, "shopify");
        console.log("[cron:extract] ok", {
          logId: result.logId,
          stats: result.stats,
          durationMs: result.durationMs,
        });
      } catch (err) {
        console.error("[cron:extract] failed", err);
      }
    },
    { timezone: TZ },
  );

  // Refresh DSers costs — diário 03:30 BRT (janela de 30d)
  cron.schedule(
    "30 3 * * *",
    async () => {
      const to = new Date();
      const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      try {
        const { logId, result } = await runCogsSync(from, to, "cron");
        console.log("[cron:refresh-costs] ok", { logId, ...result });
      } catch (err) {
        console.error("[cron:refresh-costs] failed", err);
      }
    },
    { timezone: TZ },
  );

  console.log(
    "[cron] scheduled — extract @ hourly, refresh-costs @ 03:30 " + TZ,
  );
}
