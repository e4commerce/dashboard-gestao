import "server-only";
import { db } from "@/server/db/client";
import { adsInsights } from "@/server/db/schema";
import { and, gte, inArray, lte, sql } from "drizzle-orm";
import { toIsoDateSP, daysBetweenSP } from "@/lib/datetime";

export type Platform = "google" | "meta";
const ALL_PLATFORMS: Platform[] = ["google", "meta"];

export type DailyAdSpend = {
  date: string;
  google: { spend: number; clicks: number; impressions: number };
  meta: { spend: number; clicks: number; impressions: number; conversions: number; conversionValue: number };
  total: { spend: number; clicks: number; impressions: number };
};

export type AdsSummary = {
  totalSpend: number;
  byPlatform: Record<Platform, number>;
  daysWithSpend: number;
  avgDailySpend: number;
  peakDate: string | null;
  peakSpend: number;
  lastSyncAt: Date | null;
  lastSyncByPlatform: Record<Platform, Date | null>;
};

function endDateInclusive(dateTo: Date): string {
  const oneDayMs = 24 * 60 * 60 * 1000;
  return toIsoDateSP(new Date(dateTo.getTime() - oneDayMs));
}

// Retorna 1 linha por dia com breakdown Meta / Google / Total.
export async function getDailyAdSpend(
  dateFrom: Date,
  dateTo: Date,
  platforms: Platform[] = ALL_PLATFORMS,
): Promise<DailyAdSpend[]> {
  const startDate = toIsoDateSP(dateFrom);
  const endDate = endDateInclusive(dateTo);

  const rows = await db
    .select({
      date: adsInsights.date,
      platform: adsInsights.platform,
      spend: sql<number>`${adsInsights.spend}::float`,
      clicks: adsInsights.clicks,
      impressions: adsInsights.impressions,
      conversions: sql<number | null>`${adsInsights.conversions}::float`,
      conversionValue: sql<number | null>`${adsInsights.conversionValue}::float`,
    })
    .from(adsInsights)
    .where(
      and(
        inArray(adsInsights.platform, platforms),
        gte(adsInsights.date, startDate),
        lte(adsInsights.date, endDate),
      ),
    );

  const emptyGoogle = { spend: 0, clicks: 0, impressions: 0 };
  const emptyMeta = {
    spend: 0,
    clicks: 0,
    impressions: 0,
    conversions: 0,
    conversionValue: 0,
  };
  const map = new Map<string, DailyAdSpend>();
  for (const r of rows) {
    const entry = map.get(r.date) ?? {
      date: r.date,
      google: { ...emptyGoogle },
      meta: { ...emptyMeta },
      total: { ...emptyGoogle },
    };
    if (r.platform === "google") {
      entry.google.spend += r.spend ?? 0;
      entry.google.clicks += r.clicks ?? 0;
      entry.google.impressions += r.impressions ?? 0;
    } else if (r.platform === "meta") {
      entry.meta.spend += r.spend ?? 0;
      entry.meta.clicks += r.clicks ?? 0;
      entry.meta.impressions += r.impressions ?? 0;
      entry.meta.conversions += r.conversions ?? 0;
      entry.meta.conversionValue += r.conversionValue ?? 0;
    }
    entry.total.spend = entry.google.spend + entry.meta.spend;
    entry.total.clicks = entry.google.clicks + entry.meta.clicks;
    entry.total.impressions = entry.google.impressions + entry.meta.impressions;
    map.set(r.date, entry);
  }

  const today = toIsoDateSP(new Date());
  const points: DailyAdSpend[] = [];
  for (const d of daysBetweenSP(dateFrom, dateTo)) {
    const key = toIsoDateSP(d);
    if (key > today) break;
    points.push(
      map.get(key) ?? {
        date: key,
        google: { ...emptyGoogle },
        meta: { ...emptyMeta },
        total: { ...emptyGoogle },
      },
    );
  }
  return points;
}

export async function getAdsSummary(
  dateFrom: Date,
  dateTo: Date,
  platforms: Platform[] = ALL_PLATFORMS,
): Promise<AdsSummary> {
  const startDate = toIsoDateSP(dateFrom);
  const endDate = endDateInclusive(dateTo);

  const rows = await db
    .select({
      platform: adsInsights.platform,
      totalSpend: sql<number>`COALESCE(SUM(${adsInsights.spend})::float, 0)`,
      lastSync: sql<string | Date | null>`MAX(${adsInsights.updatedAt})`,
    })
    .from(adsInsights)
    .where(
      and(
        inArray(adsInsights.platform, platforms),
        gte(adsInsights.date, startDate),
        lte(adsInsights.date, endDate),
      ),
    )
    .groupBy(adsInsights.platform);

  const byPlatform: Record<Platform, number> = { google: 0, meta: 0 };
  const lastSyncByPlatform: Record<Platform, Date | null> = {
    google: null,
    meta: null,
  };
  for (const r of rows) {
    const p = r.platform as Platform;
    byPlatform[p] = r.totalSpend ?? 0;
    if (r.lastSync) {
      lastSyncByPlatform[p] =
        r.lastSync instanceof Date ? r.lastSync : new Date(r.lastSync);
    }
  }

  // Para "dias com gasto" e "pico" usamos a soma por dia
  const dailyRows = await db
    .select({
      date: adsInsights.date,
      daySpend: sql<number>`SUM(${adsInsights.spend})::float`,
    })
    .from(adsInsights)
    .where(
      and(
        inArray(adsInsights.platform, platforms),
        gte(adsInsights.date, startDate),
        lte(adsInsights.date, endDate),
      ),
    )
    .groupBy(adsInsights.date);

  const daysWithSpend = dailyRows.filter((r) => (r.daySpend ?? 0) > 0).length;
  const totalSpend = dailyRows.reduce((s, r) => s + (r.daySpend ?? 0), 0);
  let peakDate: string | null = null;
  let peakSpend = 0;
  for (const r of dailyRows) {
    if ((r.daySpend ?? 0) > peakSpend) {
      peakSpend = r.daySpend ?? 0;
      peakDate = r.date;
    }
  }

  const lastSyncCandidates = Object.values(lastSyncByPlatform).filter(
    (d): d is Date => d !== null,
  );
  const lastSyncAt =
    lastSyncCandidates.length > 0
      ? new Date(Math.max(...lastSyncCandidates.map((d) => d.getTime())))
      : null;

  return {
    totalSpend,
    byPlatform,
    daysWithSpend,
    avgDailySpend: daysWithSpend > 0 ? totalSpend / daysWithSpend : 0,
    peakDate,
    peakSpend,
    lastSyncAt,
    lastSyncByPlatform,
  };
}
