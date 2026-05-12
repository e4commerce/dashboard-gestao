import "server-only";
import { db } from "@/server/db/client";
import { adsInsights } from "@/server/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { toIsoDateSP, daysBetweenSP } from "@/lib/datetime";

export type DailyAdSpend = {
  date: string;
  spend: number;
  clicks: number;
  impressions: number;
};

export type AdsSummary = {
  totalSpend: number;
  daysWithSpend: number;
  avgDailySpend: number;
  peakDate: string | null;
  peakSpend: number;
  lastSyncAt: Date | null;
};

// Helper: endDate (Date exclusivo) → string ISO inclusiva
function endDateInclusive(dateTo: Date): string {
  const oneDayMs = 24 * 60 * 60 * 1000;
  return toIsoDateSP(new Date(dateTo.getTime() - oneDayMs));
}

export async function getDailyAdSpend(
  dateFrom: Date,
  dateTo: Date,
  platform = "google",
): Promise<DailyAdSpend[]> {
  const startDate = toIsoDateSP(dateFrom);
  const endDate = endDateInclusive(dateTo);

  const rows = await db
    .select({
      date: adsInsights.date,
      spend: sql<number>`${adsInsights.spend}::float`,
      clicks: adsInsights.clicks,
      impressions: adsInsights.impressions,
    })
    .from(adsInsights)
    .where(
      and(
        eq(adsInsights.platform, platform),
        gte(adsInsights.date, startDate),
        lte(adsInsights.date, endDate),
      ),
    );

  const map = new Map<string, DailyAdSpend>();
  for (const r of rows) {
    map.set(r.date, {
      date: r.date,
      spend: r.spend ?? 0,
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
    });
  }

  // Preenche dias faltantes com zero
  const today = toIsoDateSP(new Date());
  const points: DailyAdSpend[] = [];
  for (const d of daysBetweenSP(dateFrom, dateTo)) {
    const key = toIsoDateSP(d);
    if (key > today) break;
    points.push(
      map.get(key) ?? { date: key, spend: 0, clicks: 0, impressions: 0 },
    );
  }
  return points;
}

export async function getAdsSummary(
  dateFrom: Date,
  dateTo: Date,
  platform = "google",
): Promise<AdsSummary> {
  const startDate = toIsoDateSP(dateFrom);
  const endDate = endDateInclusive(dateTo);

  const [agg] = await db
    .select({
      totalSpend: sql<number>`COALESCE(SUM(${adsInsights.spend})::float, 0)`,
      daysWithSpend: sql<number>`COUNT(*) FILTER (WHERE ${adsInsights.spend} > 0)::int`,
      lastSync: sql<string | Date | null>`MAX(${adsInsights.updatedAt})`,
    })
    .from(adsInsights)
    .where(
      and(
        eq(adsInsights.platform, platform),
        gte(adsInsights.date, startDate),
        lte(adsInsights.date, endDate),
      ),
    );

  const [peak] = await db
    .select({
      date: adsInsights.date,
      spend: sql<number>`${adsInsights.spend}::float`,
    })
    .from(adsInsights)
    .where(
      and(
        eq(adsInsights.platform, platform),
        gte(adsInsights.date, startDate),
        lte(adsInsights.date, endDate),
      ),
    )
    .orderBy(sql`${adsInsights.spend} DESC`)
    .limit(1);

  const totalSpend = agg?.totalSpend ?? 0;
  const daysWithSpend = agg?.daysWithSpend ?? 0;
  const lastSyncRaw = agg?.lastSync ?? null;
  const lastSyncAt =
    lastSyncRaw == null
      ? null
      : lastSyncRaw instanceof Date
        ? lastSyncRaw
        : new Date(lastSyncRaw);

  return {
    totalSpend,
    daysWithSpend,
    avgDailySpend: daysWithSpend > 0 ? totalSpend / daysWithSpend : 0,
    peakDate: peak?.date ?? null,
    peakSpend: peak?.spend ?? 0,
    lastSyncAt,
  };
}
