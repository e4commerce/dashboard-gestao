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
  const { syncMetaInsights } = await import("./server/meta/sync");
  const {
    runMpSync,
    cleanupOrphanedMpSyncs,
  } = await import("./server/mercadopago/sync");

  // Cleanup órfãos: qualquer run com status "running" vindo de antes do boot
  // não vai mais avançar — marca como "failed" com mensagem explicativa.
  try {
    const [orphanExt, orphanCogs, orphanMp] = await Promise.all([
      cleanupOrphanedExtractions(),
      cleanupOrphanedCogsSyncs(),
      cleanupOrphanedMpSyncs(),
    ]);
    if (orphanExt + orphanCogs + orphanMp > 0) {
      console.log(
        `[startup] cleaned orphaned runs — ${orphanExt} extrações, ${orphanCogs} cogs, ${orphanMp} mp`,
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

  // Meta Ads insights — a cada 15 min (últimos 30 dias, upsert idempotente).
  // Só roda se META_ACCESS_TOKEN estiver configurado.
  cron.schedule(
    "*/15 * * * *",
    async () => {
      if (!process.env.META_ACCESS_TOKEN) return;
      const to = new Date();
      const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      try {
        const result = await syncMetaInsights(from, to);
        console.log("[cron:meta] ok", result);
      } catch (err) {
        console.error("[cron:meta] failed", err);
      }
    },
    { timezone: TZ },
  );

  // Mercado Pago — a cada 30 min, últimos 30 dias. Skip se token não setado.
  cron.schedule(
    "*/30 * * * *",
    async () => {
      if (!process.env.MP_ACCESS_TOKEN) return;
      const to = new Date();
      const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      try {
        const { logId, result } = await runMpSync(from, to, "cron");
        console.log("[cron:mp] ok", { logId, ...result });
      } catch (err) {
        console.error("[cron:mp] failed", err);
      }
    },
    { timezone: TZ },
  );

  console.log(
    "[cron] scheduled — extract @ hourly, refresh-costs @ 03:30 " +
      TZ +
      ", meta every 15 min, mp every 30 min",
  );
}
