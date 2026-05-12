import "server-only";
import { db } from "@/server/db/client";
import { orders, orderAttribution } from "@/server/db/schema";
import { and, eq, gte, isNotNull, isNull, lt, not, sql } from "drizzle-orm";
import { validOrder } from "./order-filters";
import { toIsoDateSP, daysBetweenSP } from "@/lib/datetime";

const todayKey = () => toIsoDateSP(new Date());

const journeyWhere = (dateFrom: Date, dateTo: Date) =>
  and(
    validOrder,
    gte(orders.createdAt, dateFrom),
    lt(orders.createdAt, dateTo),
    isNotNull(orderAttribution.daysToConversion),
  );

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DailyJourneyPoint = {
  date: string;
  avgDays: number;
  orderCount: number;
};

export type JourneyBucket = {
  key: "same_day" | "d1_3" | "d4_7" | "d8_30" | "d30_plus";
  label: string;
  count: number;
  pct: number;
  avgTicket: number;
};

export type JourneySummary = {
  avgDays: number;
  sameDayPct: number;
  ordersWithJourney: number;
  totalOrders: number;
  fastAvgTicket: number;  // jornada ≤ 3 dias
  slowAvgTicket: number;  // jornada ≥ 8 dias
};

export type JourneyByChannel = {
  channel: string;
  orderCount: number;
  avgDays: number;
  avgTicket: number;
  pct: number;
};

export type JourneyByOrderIndex = {
  label: string;
  orderCount: number;
  avgDays: number;
  avgTicket: number;
  pct: number;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

// Tendência diária: média de dias e ticket por dia do mês
export async function getJourneyDailyTrend(
  dateFrom: Date,
  dateTo: Date,
): Promise<DailyJourneyPoint[]> {
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD')`,
      avgDays: sql<number>`ROUND(AVG(${orderAttribution.daysToConversion}), 1)::float`,
      orderCount: sql<number>`COUNT(*)::int`,
    })
    .from(orders)
    .innerJoin(orderAttribution, eq(orderAttribution.orderId, orders.id))
    .where(journeyWhere(dateFrom, dateTo))
    .groupBy(
      sql`date_trunc('day', ${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo')`,
    );

  const dailyMap = new Map<string, { avgDays: number; orderCount: number }>();
  for (const r of rows) dailyMap.set(r.day, r);

  const today = todayKey();
  const points: DailyJourneyPoint[] = [];
  for (const d of daysBetweenSP(dateFrom, dateTo)) {
    const key = toIsoDateSP(d);
    if (key > today) break;
    const entry = dailyMap.get(key);
    if (entry) points.push({ date: key, ...entry });
    else points.push({ date: key, avgDays: 0, orderCount: 0 });
  }
  return points;
}

const BUCKETS: Array<{ key: JourneyBucket["key"]; label: string }> = [
  { key: "same_day", label: "Mesmo dia" },
  { key: "d1_3",     label: "1–3 dias"  },
  { key: "d4_7",     label: "4–7 dias"  },
  { key: "d8_30",    label: "8–30 dias" },
  { key: "d30_plus", label: "30+ dias"  },
];

// Distribuição por faixa + ticket médio por faixa
export async function getJourneyDistribution(
  dateFrom: Date,
  dateTo: Date,
): Promise<JourneyBucket[]> {
  const bucketExpr = sql<string>`
    CASE
      WHEN ${orderAttribution.daysToConversion} = 0 THEN 'same_day'
      WHEN ${orderAttribution.daysToConversion} <= 3 THEN 'd1_3'
      WHEN ${orderAttribution.daysToConversion} <= 7 THEN 'd4_7'
      WHEN ${orderAttribution.daysToConversion} <= 30 THEN 'd8_30'
      ELSE 'd30_plus'
    END`;

  const rows = await db
    .select({
      bucket: bucketExpr,
      count: sql<number>`COUNT(*)::int`,
      avgTicket: sql<number>`ROUND(AVG(${orders.totalPrice})::numeric, 2)::float`,
    })
    .from(orders)
    .innerJoin(orderAttribution, eq(orderAttribution.orderId, orders.id))
    .where(journeyWhere(dateFrom, dateTo))
    .groupBy(bucketExpr);

  const dataMap = new Map<string, { count: number; avgTicket: number }>();
  for (const r of rows) dataMap.set(r.bucket, r);
  const total = [...dataMap.values()].reduce((s, r) => s + r.count, 0);

  return BUCKETS.map(({ key, label }) => {
    const row = dataMap.get(key);
    return {
      key,
      label,
      count: row?.count ?? 0,
      pct: total > 0 ? ((row?.count ?? 0) / total) * 100 : 0,
      avgTicket: row?.avgTicket ?? 0,
    };
  });
}

// Estatísticas resumidas: inclui comparativo de ticket rápido vs lento
export async function getJourneySummary(
  dateFrom: Date,
  dateTo: Date,
): Promise<JourneySummary> {
  const [journeyRow] = await db
    .select({
      avgDays: sql<number>`COALESCE(ROUND(AVG(${orderAttribution.daysToConversion}), 1)::float, 0)`,
      sameDayCount: sql<number>`COUNT(*) FILTER (WHERE ${orderAttribution.daysToConversion} = 0)::int`,
      ordersWithJourney: sql<number>`COUNT(*)::int`,
      fastAvgTicket: sql<number>`
        COALESCE(ROUND(
          AVG(${orders.totalPrice}) FILTER (WHERE ${orderAttribution.daysToConversion} <= 3)::numeric
        , 2)::float, 0)`,
      slowAvgTicket: sql<number>`
        COALESCE(ROUND(
          AVG(${orders.totalPrice}) FILTER (WHERE ${orderAttribution.daysToConversion} >= 8)::numeric
        , 2)::float, 0)`,
    })
    .from(orders)
    .innerJoin(orderAttribution, eq(orderAttribution.orderId, orders.id))
    .where(journeyWhere(dateFrom, dateTo));

  const [totalRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(orders)
    .where(and(validOrder, gte(orders.createdAt, dateFrom), lt(orders.createdAt, dateTo)));

  const ordersWithJourney = journeyRow?.ordersWithJourney ?? 0;
  const sameDayCount = journeyRow?.sameDayCount ?? 0;

  return {
    avgDays: journeyRow?.avgDays ?? 0,
    sameDayPct: ordersWithJourney > 0 ? (sameDayCount / ordersWithJourney) * 100 : 0,
    ordersWithJourney,
    totalOrders: totalRow?.count ?? 0,
    fastAvgTicket: journeyRow?.fastAvgTicket ?? 0,
    slowAvgTicket: journeyRow?.slowAvgTicket ?? 0,
  };
}

// Análise por canal de origem (firstVisit)
export async function getJourneyByChannel(
  dateFrom: Date,
  dateTo: Date,
): Promise<JourneyByChannel[]> {
  const rows = await db
    .select({
      channel: orderAttribution.channelName,
      orderCount: sql<number>`COUNT(*)::int`,
      avgDays: sql<number>`ROUND(AVG(${orderAttribution.daysToConversion}), 1)::float`,
      avgTicket: sql<number>`ROUND(AVG(${orders.totalPrice})::numeric, 2)::float`,
    })
    .from(orders)
    .innerJoin(orderAttribution, eq(orderAttribution.orderId, orders.id))
    .where(
      and(
        journeyWhere(dateFrom, dateTo),
        isNotNull(orderAttribution.channelName),
        not(sql`${orderAttribution.channelName} = ''`),
      ),
    )
    .groupBy(orderAttribution.channelName)
    .orderBy(sql`COUNT(*) DESC`);

  const total = rows.reduce((s, r) => s + r.orderCount, 0);

  return rows.map((r) => ({
    channel: r.channel ?? "Desconhecido",
    orderCount: r.orderCount,
    avgDays: r.avgDays,
    avgTicket: r.avgTicket,
    pct: total > 0 ? (r.orderCount / total) * 100 : 0,
  }));
}

// Análise por índice de compra (1ª, 2ª, 3ª+ compra)
export async function getJourneyByOrderIndex(
  dateFrom: Date,
  dateTo: Date,
): Promise<JourneyByOrderIndex[]> {
  const indexBucket = sql<string>`
    CASE
      WHEN ${orderAttribution.customerOrderIndex} = 1 THEN 'first'
      WHEN ${orderAttribution.customerOrderIndex} = 2 THEN 'second'
      WHEN ${orderAttribution.customerOrderIndex} >= 3 THEN 'third_plus'
    END`;

  const rows = await db
    .select({
      bucket: indexBucket,
      orderCount: sql<number>`COUNT(*)::int`,
      avgDays: sql<number>`ROUND(AVG(${orderAttribution.daysToConversion}), 1)::float`,
      avgTicket: sql<number>`ROUND(AVG(${orders.totalPrice})::numeric, 2)::float`,
    })
    .from(orders)
    .innerJoin(orderAttribution, eq(orderAttribution.orderId, orders.id))
    .where(
      and(
        journeyWhere(dateFrom, dateTo),
        isNotNull(orderAttribution.customerOrderIndex),
      ),
    )
    .groupBy(indexBucket)
    .orderBy(indexBucket);

  const LABELS: Record<string, string> = {
    first:      "1ª compra",
    second:     "2ª compra",
    third_plus: "3ª+ compra",
  };

  const total = rows.reduce((s, r) => s + r.orderCount, 0);

  return (["first", "second", "third_plus"] as const)
    .map((key) => {
      const row = rows.find((r) => r.bucket === key);
      return {
        label: LABELS[key],
        orderCount: row?.orderCount ?? 0,
        avgDays: row?.avgDays ?? 0,
        avgTicket: row?.avgTicket ?? 0,
        pct: total > 0 && row ? (row.orderCount / total) * 100 : 0,
      };
    })
    .filter((r) => r.orderCount > 0);
}
