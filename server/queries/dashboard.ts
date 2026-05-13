import "server-only";
import { db } from "@/server/db/client";
import { orders } from "@/server/db/schema";
import { and, gte, lt, sql } from "drizzle-orm";
import { validOrder } from "./order-filters";
import {
  daysBetweenSP,
  endOfDaySP,
  toIsoDateSP,
  toMonthKeySP,
} from "@/lib/datetime";

import {
  buildWeightMap,
  daysInMonth as daysInMonthYM,
  getDailyWeights,
  getMonthlyGoal,
} from "./planning";
import { getMarginAnalysis } from "./margin";

export type DailyPoint = {
  date: string;
  realizado: number | null;
  meta: number;
  realizadoDia: number | null;
  metaDia: number;
};

// Aliases para chaves de dia/mês alinhadas ao fuso de São Paulo
const toIsoDateUTC = toIsoDateSP;
const monthKey = toMonthKeySP;
const daysBetween = daysBetweenSP;

async function loadMonthDistribution(
  month: string,
): Promise<{
  revenueGoal: number;
  grossProfitGoal: number;
  dailyMetaShare: Map<number, number>;
}> {
  const [goal, weights] = await Promise.all([
    getMonthlyGoal(month),
    getDailyWeights(month),
  ]);
  const revenueGoal = goal?.revenueGoal ?? 0;
  const grossProfitGoal = goal?.grossProfitGoal ?? 0;
  const wmap = buildWeightMap(month, weights);
  let sum = 0;
  for (const w of wmap.values()) sum += w;

  const dailyMetaShare = new Map<number, number>();
  if (sum > 0) {
    for (const [day, w] of wmap.entries()) {
      dailyMetaShare.set(day, (w / sum) * revenueGoal);
    }
  }
  return { revenueGoal, grossProfitGoal, dailyMetaShare };
}

export async function getDailyAccumulatedRevenue(
  dateFrom: Date,
  dateTo: Date,
): Promise<DailyPoint[]> {
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD')`,
      total: sql<string>`COALESCE(SUM(${orders.totalPrice}), 0)`,
    })
    .from(orders)
    .where(
      and(
        validOrder,
        gte(orders.createdAt, dateFrom),
        lt(orders.createdAt, dateTo),
      ),
    )
    .groupBy(
      sql`date_trunc('day', ${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo')`,
    );

  const dailyMap = new Map<string, number>();
  for (const r of rows) dailyMap.set(r.day, Number(r.total));

  const monthDistributions = new Map<
    string,
    { dailyMetaShare: Map<number, number> }
  >();
  for (const d of daysBetween(dateFrom, dateTo)) {
    const mk = monthKey(d);
    if (!monthDistributions.has(mk)) {
      monthDistributions.set(mk, await loadMonthDistribution(mk));
    }
  }

  const todayKey = toIsoDateUTC(new Date());

  let realizadoAcum = 0;
  let metaAcum = 0;
  const points: DailyPoint[] = [];
  for (const d of daysBetween(dateFrom, dateTo)) {
    const dayKey = toIsoDateUTC(d);
    const mk = monthKey(d);
    const dayOfMonth = d.getUTCDate();
    const dist = monthDistributions.get(mk);
    const dayRealizado = dailyMap.get(dayKey) ?? 0;
    realizadoAcum += dayRealizado;
    const dayMeta = dist?.dailyMetaShare.get(dayOfMonth) ?? 0;
    metaAcum += dayMeta;
    const isFuture = dayKey > todayKey;
    points.push({
      date: dayKey,
      realizado: isFuture ? null : realizadoAcum,
      meta: metaAcum,
      realizadoDia: isFuture ? null : dayRealizado,
      metaDia: dayMeta,
    });
  }
  return points;
}

export type KpiResult = {
  faturamento: number;
  pedidos: number;
  ticketMedio: number;
  faturamentoMeta: number | null;
  grossProfitGoal: number | null;
  grossProfitMeta: number | null; // proporcional aos dias transcorridos (igual a faturamentoMeta)
};

export async function getKpiTotals(
  dateFrom: Date,
  dateTo: Date,
): Promise<KpiResult> {
  const [row] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${orders.totalPrice}), 0)`,
      count: sql<number>`COALESCE(COUNT(*), 0)::int`,
    })
    .from(orders)
    .where(
      and(
        validOrder,
        gte(orders.createdAt, dateFrom),
        lt(orders.createdAt, dateTo),
      ),
    );

  const faturamento = Number(row?.total ?? 0);
  const pedidos = Number(row?.count ?? 0);
  const ticketMedio = pedidos > 0 ? faturamento / pedidos : 0;

  let faturamentoMeta: number | null = null;
  let grossProfitGoal: number | null = null;
  let grossProfitMeta: number | null = null;
  let totalMetaSoFar = 0;
  let totalProfitMetaSoFar = 0;
  let hasGpMeta = false;
  let foundAnyGoal = false;

  const monthDists = new Map<
    string,
    {
      revenueGoal: number;
      grossProfitGoal: number;
      dailyMetaShare: Map<number, number>;
    }
  >();
  for (const d of daysBetween(dateFrom, dateTo)) {
    const mk = monthKey(d);
    if (!monthDists.has(mk)) {
      monthDists.set(mk, await loadMonthDistribution(mk));
    }
  }

  // Para "X% da meta" usamos meta proporcional aos dias transcorridos
  // (do início do período até o final do dia atual em SP). Dias futuros não contam.
  const todayEodSP = endOfDaySP(new Date());
  const cap = todayEodSP < dateTo ? todayEodSP : dateTo;

  for (const d of daysBetween(dateFrom, cap)) {
    const dist = monthDists.get(monthKey(d));
    if (!dist) continue;
    const share = dist.dailyMetaShare.get(d.getUTCDate()) ?? 0;
    totalMetaSoFar += share;
    if (dist.revenueGoal > 0 && dist.grossProfitGoal > 0) {
      totalProfitMetaSoFar += (share / dist.revenueGoal) * dist.grossProfitGoal;
      hasGpMeta = true;
    }
    if (dist.revenueGoal > 0 || dist.grossProfitGoal > 0) foundAnyGoal = true;
  }

  if (foundAnyGoal) {
    faturamentoMeta = totalMetaSoFar;
    let gpSum = 0;
    for (const dist of monthDists.values()) gpSum += dist.grossProfitGoal;
    if (gpSum > 0) grossProfitGoal = gpSum;
    if (hasGpMeta) grossProfitMeta = totalProfitMetaSoFar;
  }

  return {
    faturamento,
    pedidos,
    ticketMedio,
    faturamentoMeta,
    grossProfitGoal,
    grossProfitMeta,
  };
}

export async function getDailyAccumulatedProfit(
  dateFrom: Date,
  dateTo: Date,
): Promise<DailyPoint[]> {
  const { daily: marginDaily } = await getMarginAnalysis(dateFrom, dateTo);

  const monthDistributions = new Map<
    string,
    { revenueGoal: number; grossProfitGoal: number; dailyMetaShare: Map<number, number> }
  >();
  for (const d of daysBetween(dateFrom, dateTo)) {
    const mk = monthKey(d);
    if (!monthDistributions.has(mk)) {
      monthDistributions.set(mk, await loadMonthDistribution(mk));
    }
  }

  const profitByDate = new Map(marginDaily.map((p) => [p.date, p.operationalProfit]));
  const todayKey = toIsoDateUTC(new Date());

  let realizadoAcum = 0;
  let metaAcum = 0;
  const points: DailyPoint[] = [];

  for (const d of daysBetween(dateFrom, dateTo)) {
    const dayKey = toIsoDateUTC(d);
    const mk = monthKey(d);
    const dayOfMonth = d.getUTCDate();
    const dist = monthDistributions.get(mk);

    const dayRealizado = profitByDate.get(dayKey) ?? 0;
    realizadoAcum += dayRealizado;

    // Same weight distribution as revenue, scaled to grossProfitGoal
    const revenueShare = dist?.dailyMetaShare.get(dayOfMonth) ?? 0;
    const revenueGoal = dist?.revenueGoal ?? 0;
    const grossProfitGoal = dist?.grossProfitGoal ?? 0;
    const dayMeta = revenueGoal > 0 ? (revenueShare / revenueGoal) * grossProfitGoal : 0;
    metaAcum += dayMeta;

    const isFuture = dayKey > todayKey;
    points.push({
      date: dayKey,
      realizado: isFuture ? null : realizadoAcum,
      meta: metaAcum,
      realizadoDia: isFuture ? null : dayRealizado,
      metaDia: dayMeta,
    });
  }

  return points;
}

export function daysInMonth(year: number, month0: number): number {
  return daysInMonthYM(
    `${year}-${String(month0 + 1).padStart(2, "0")}`,
  );
}

export type DailyMetricPoint = {
  date: string;
  pedidos: number;
  ticketMedio: number | null;
};

export async function getDailyMetrics(
  dateFrom: Date,
  dateTo: Date,
): Promise<DailyMetricPoint[]> {
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD')`,
      pedidos: sql<number>`COUNT(*)::int`,
      total: sql<string>`COALESCE(SUM(${orders.totalPrice}), 0)`,
    })
    .from(orders)
    .where(
      and(
        validOrder,
        gte(orders.createdAt, dateFrom),
        lt(orders.createdAt, dateTo),
      ),
    )
    .groupBy(
      sql`date_trunc('day', ${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo')`,
    );

  const dailyMap = new Map<string, { pedidos: number; total: number }>();
  for (const r of rows) {
    dailyMap.set(r.day, { pedidos: r.pedidos, total: Number(r.total) });
  }

  const todayKey = toIsoDateUTC(new Date());
  const points: DailyMetricPoint[] = [];
  for (const d of daysBetween(dateFrom, dateTo)) {
    const dayKey = toIsoDateUTC(d);
    if (dayKey > todayKey) break;
    const entry = dailyMap.get(dayKey);
    const pedidos = entry?.pedidos ?? 0;
    points.push({
      date: dayKey,
      pedidos,
      ticketMedio: pedidos > 0 ? entry!.total / pedidos : null,
    });
  }
  return points;
}
