import "server-only";
import { db } from "@/server/db/client";
import { mpPayments, orders } from "@/server/db/schema";
import { and, gte, isNotNull, lt, sql, type SQL } from "drizzle-orm";
import { validOrder, invalidOrder, hasCogs } from "./order-filters";
import { toIsoDateSP, daysBetweenSP } from "@/lib/datetime";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CostGroupSummary = {
  totalOrders: number;
  ordersWithCogs: number;
  coveragePct: number;
  totalRevenue: number;     // SUM(total_price)
  revenueWithCogs: number;  // SUM(total_price) só dos pedidos com COGS
  totalCogs: number;        // SUM(cogs_amount) onde cogs_amount IS NOT NULL
  grossProfit: number;      // revenueWithCogs - totalCogs
  grossMargin: number;      // grossProfit / revenueWithCogs, %
  costPct: number;          // totalCogs / revenueWithCogs, % (= 100 - grossMargin)
  avgCogsPerOrder: number;
};

export type CostsOverview = {
  valid: CostGroupSummary;
  invalid: CostGroupSummary;
  lastSyncAt: Date | null;
};

export type DailyCostPoint = {
  date: string;
  // Pedidos válidos
  validOrders: number;             // total de pedidos válidos no dia
  validOrdersWithCogs: number;     // dos válidos, quantos têm cogs > 0
  validCoveragePct: number;        // % pedidos com custo atualizado
  validRevenueTotal: number;       // receita de TODOS os pedidos válidos
  validRevenue: number;            // receita só dos pedidos com cogs > 0
  validCogs: number;               // custo total dos pedidos válidos com cogs
  validCostPct: number;            // cogs / receita_sync (% real dos atualizados)
  validCostPctOverall: number;     // cogs / receita_total (% geral)
  validProfit: number;             // receita_sync - cogs
  // Inválidos (operacional)
  invalidCogs: number;
  // Taxa de gateway (Mercado Pago) — agregado por dia de aprovação
  mpFee: number;
};

export type InvalidReasonBreakdown = {
  key: "reenvio" | "troca" | "voucher" | "zerado";
  label: string;
  orderCount: number;
  cogs: number;
};

export type InfluencerCouponRow = {
  code: string;
  orderCount: number;
  ordersWithCogs: number;
  coveragePct: number;
  totalRevenue: number;
  revenueWithCogs: number;
  totalCogs: number;
  grossProfit: number;
  grossMargin: number;
  costPct: number;
  avgTicket: number;
};

export type DailyInvalidReasonRow = {
  date: string;
  reenvio: number;
  troca: number;
  voucher: number;
  zerado: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function groupSummary(
  dateFrom: Date,
  dateTo: Date,
  filter: SQL | undefined,
): Promise<CostGroupSummary> {
  // Tratamos cogs_amount = 0 como "não realmente sincronizado" (Profitfy ainda
  // não puxou do DSers). Esses pedidos saem dos cálculos de margem/lucro.
  const [row] = await db
    .select({
      totalOrders: sql<number>`COUNT(*)::int`,
      ordersWithCogs: sql<number>`COUNT(*) FILTER (WHERE ${orders.cogsAmount} > 0)::int`,
      totalRevenue: sql<number>`COALESCE(SUM(${orders.totalPrice}), 0)::float`,
      revenueWithCogs: sql<number>`COALESCE(SUM(${orders.totalPrice}) FILTER (WHERE ${orders.cogsAmount} > 0), 0)::float`,
      totalCogs: sql<number>`COALESCE(SUM(${orders.cogsAmount}) FILTER (WHERE ${orders.cogsAmount} > 0), 0)::float`,
    })
    .from(orders)
    .where(and(filter, gte(orders.createdAt, dateFrom), lt(orders.createdAt, dateTo)));

  const totalOrders = row?.totalOrders ?? 0;
  const ordersWithCogs = row?.ordersWithCogs ?? 0;
  const totalCogs = row?.totalCogs ?? 0;
  const revenueWithCogs = row?.revenueWithCogs ?? 0;
  const grossProfit = revenueWithCogs - totalCogs;

  return {
    totalOrders,
    ordersWithCogs,
    coveragePct: totalOrders > 0 ? (ordersWithCogs / totalOrders) * 100 : 0,
    totalRevenue: row?.totalRevenue ?? 0,
    revenueWithCogs,
    totalCogs,
    grossProfit,
    grossMargin: revenueWithCogs > 0 ? (grossProfit / revenueWithCogs) * 100 : 0,
    costPct: revenueWithCogs > 0 ? (totalCogs / revenueWithCogs) * 100 : 0,
    avgCogsPerOrder: ordersWithCogs > 0 ? totalCogs / ordersWithCogs : 0,
  };
}

// ─── Overview: válidos + inválidos + última sync ──────────────────────────────

export async function getCostsOverview(
  dateFrom: Date,
  dateTo: Date,
): Promise<CostsOverview> {
  const [valid, invalid, lastSyncRaw] = await Promise.all([
    groupSummary(dateFrom, dateTo, validOrder),
    groupSummary(dateFrom, dateTo, invalidOrder),
    db
      .select({ latest: sql<string | Date | null>`MAX(${orders.cogsUpdatedAt})` })
      .from(orders)
      .then((r) => r[0]?.latest ?? null),
  ]);
  const lastSyncAt =
    lastSyncRaw == null
      ? null
      : lastSyncRaw instanceof Date
        ? lastSyncRaw
        : new Date(lastSyncRaw);
  return { valid, invalid, lastSyncAt };
}

// ─── Série diária: receita, COGS, lucro bruto válido + COGS inválido ──────────

export async function getDailyCosts(
  dateFrom: Date,
  dateTo: Date,
): Promise<DailyCostPoint[]> {
  const dayExpr = sql<string>`to_char(date_trunc('day', ${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD')`;

  // Para pedidos válidos: contamos TODOS no dia + sumarizamos só os com cogs > 0.
  // Isso permite calcular cobertura (% atualizado) e custos consistentes.
  const validRows = await db
    .select({
      day: dayExpr,
      orders: sql<number>`COUNT(*)::int`,
      ordersWithCogs: sql<number>`COUNT(*) FILTER (WHERE ${orders.cogsAmount} > 0)::int`,
      revenueTotal: sql<number>`COALESCE(SUM(${orders.totalPrice}), 0)::float`,
      revenue: sql<number>`COALESCE(SUM(${orders.totalPrice}) FILTER (WHERE ${orders.cogsAmount} > 0), 0)::float`,
      cogs: sql<number>`COALESCE(SUM(${orders.cogsAmount}) FILTER (WHERE ${orders.cogsAmount} > 0), 0)::float`,
    })
    .from(orders)
    .where(and(validOrder, gte(orders.createdAt, dateFrom), lt(orders.createdAt, dateTo)))
    .groupBy(sql`date_trunc('day', ${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo')`);

  const invalidRows = await db
    .select({
      day: dayExpr,
      cogs: sql<number>`COALESCE(SUM(${orders.cogsAmount}), 0)::float`,
    })
    .from(orders)
    .where(and(invalidOrder, gte(orders.createdAt, dateFrom), lt(orders.createdAt, dateTo), hasCogs))
    .groupBy(sql`date_trunc('day', ${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo')`);

  // Taxas Mercado Pago — só pagamentos aprovados; agrupamos por date_approved
  const mpRows = await db
    .select({
      day: sql<string>`to_char((${mpPayments.dateApproved} AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD')`,
      fee: sql<number>`COALESCE(SUM(${mpPayments.feeAmount})::float, 0)`,
    })
    .from(mpPayments)
    .where(
      and(
        isNotNull(mpPayments.dateApproved),
        gte(mpPayments.dateApproved, dateFrom),
        lt(mpPayments.dateApproved, dateTo),
        sql`${mpPayments.status} = 'approved'`,
      ),
    )
    .groupBy(
      sql`to_char((${mpPayments.dateApproved} AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD')`,
    );

  type ValidAgg = {
    orders: number;
    ordersWithCogs: number;
    revenueTotal: number;
    revenue: number;
    cogs: number;
  };
  const validMap = new Map<string, ValidAgg>();
  for (const r of validRows) {
    validMap.set(r.day, {
      orders: r.orders,
      ordersWithCogs: r.ordersWithCogs,
      revenueTotal: r.revenueTotal,
      revenue: r.revenue,
      cogs: r.cogs,
    });
  }
  const invalidMap = new Map<string, number>();
  for (const r of invalidRows) invalidMap.set(r.day, r.cogs);

  const mpMap = new Map<string, number>();
  for (const r of mpRows) mpMap.set(r.day, r.fee);

  const today = toIsoDateSP(new Date());
  const points: DailyCostPoint[] = [];
  for (const d of daysBetweenSP(dateFrom, dateTo)) {
    const key = toIsoDateSP(d);
    if (key > today) break;
    const v = validMap.get(key) ?? {
      orders: 0,
      ordersWithCogs: 0,
      revenueTotal: 0,
      revenue: 0,
      cogs: 0,
    };
    points.push({
      date: key,
      validOrders: v.orders,
      validOrdersWithCogs: v.ordersWithCogs,
      validCoveragePct: v.orders > 0 ? (v.ordersWithCogs / v.orders) * 100 : 0,
      validRevenueTotal: v.revenueTotal,
      validRevenue: v.revenue,
      validCogs: v.cogs,
      validCostPct: v.revenue > 0 ? (v.cogs / v.revenue) * 100 : 0,
      validCostPctOverall: v.revenueTotal > 0 ? (v.cogs / v.revenueTotal) * 100 : 0,
      validProfit: v.revenue - v.cogs,
      invalidCogs: invalidMap.get(key) ?? 0,
      mpFee: mpMap.get(key) ?? 0,
    });
  }
  return points;
}

// ─── Breakdown diário dos custos "inválidos" por motivo ──────────────────────

export async function getDailyInvalidReasonBreakdown(
  dateFrom: Date,
  dateTo: Date,
): Promise<DailyInvalidReasonRow[]> {
  const reasonExpr = sql<string>`
    CASE
      WHEN ${orders.tags} ILIKE '%Reenvio%' THEN 'reenvio'
      WHEN ${orders.discountCodes} ILIKE '%TROCA%' THEN 'troca'
      WHEN ${orders.discountCodes} ILIKE '%VOUCHER%' THEN 'voucher'
      WHEN ${orders.totalPrice} = 0 THEN 'zerado'
    END`;
  const dayBucket = sql`date_trunc('day', ${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo')`;

  const rows = await db
    .select({
      day: sql<string>`to_char(${dayBucket}, 'YYYY-MM-DD')`,
      reason: reasonExpr,
      cogs: sql<number>`COALESCE(SUM(${orders.cogsAmount}), 0)::float`,
    })
    .from(orders)
    .where(
      and(
        invalidOrder,
        gte(orders.createdAt, dateFrom),
        lt(orders.createdAt, dateTo),
        hasCogs,
      ),
    )
    .groupBy(dayBucket, reasonExpr);

  const map = new Map<string, DailyInvalidReasonRow>();
  for (const r of rows) {
    let entry = map.get(r.day);
    if (!entry) {
      entry = { date: r.day, reenvio: 0, troca: 0, voucher: 0, zerado: 0 };
      map.set(r.day, entry);
    }
    if (r.reason === "reenvio") entry.reenvio += r.cogs;
    else if (r.reason === "troca") entry.troca += r.cogs;
    else if (r.reason === "voucher") entry.voucher += r.cogs;
    else if (r.reason === "zerado") entry.zerado += r.cogs;
  }
  return Array.from(map.values());
}

// ─── Breakdown dos custos "inválidos" por motivo ──────────────────────────────

export async function getInvalidReasonBreakdown(
  dateFrom: Date,
  dateTo: Date,
): Promise<InvalidReasonBreakdown[]> {
  // Prioridade: reenvio > troca > voucher > zerado (mutuamente exclusivo)
  const reasonExpr = sql<string>`
    CASE
      WHEN ${orders.tags} ILIKE '%Reenvio%' THEN 'reenvio'
      WHEN ${orders.discountCodes} ILIKE '%TROCA%' THEN 'troca'
      WHEN ${orders.discountCodes} ILIKE '%VOUCHER%' THEN 'voucher'
      WHEN ${orders.totalPrice} = 0 THEN 'zerado'
    END`;

  const rows = await db
    .select({
      reason: reasonExpr,
      orderCount: sql<number>`COUNT(*)::int`,
      cogs: sql<number>`COALESCE(SUM(${orders.cogsAmount}), 0)::float`,
    })
    .from(orders)
    .where(and(invalidOrder, gte(orders.createdAt, dateFrom), lt(orders.createdAt, dateTo)))
    .groupBy(reasonExpr);

  const LABELS: Record<string, string> = {
    reenvio: "Reenvio",
    troca:   "Troca",
    voucher: "Voucher",
    zerado:  "Zerado",
  };

  const map = new Map<string, { orderCount: number; cogs: number }>();
  for (const r of rows) {
    if (r.reason) map.set(r.reason, { orderCount: r.orderCount, cogs: r.cogs });
  }

  return (["reenvio", "troca", "voucher", "zerado"] as const).map((key) => {
    const row = map.get(key);
    return {
      key,
      label: LABELS[key],
      orderCount: row?.orderCount ?? 0,
      cogs: row?.cogs ?? 0,
    };
  });
}

// ─── Pedidos com cupom de influencer (códigos terminados em "20" = 20% OFF) ──

// Match any code inside the comma-separated `discount_codes` that ends with "20".
// Examples: "ANA20", "MARIA20" → match. "200OFF", "FRETE2025", "PROMO20OFF" → no.
const influencerCouponPredicate = sql`${orders.discountCodes} ~* '(^|,)[^,]*20($|,)'`;

export async function getInfluencerCouponSummary(
  dateFrom: Date,
  dateTo: Date,
): Promise<CostGroupSummary> {
  return groupSummary(dateFrom, dateTo, and(validOrder, influencerCouponPredicate));
}

export async function getInfluencerCouponBreakdown(
  dateFrom: Date,
  dateTo: Date,
): Promise<InfluencerCouponRow[]> {
  // Unnest discount_codes and keep only entries ending with "20".
  // Group by normalized (uppercase, trimmed) code so "ana20" and "ANA20" merge.
  const rows = await db.execute<{
    code: string;
    order_count: number;
    orders_with_cogs: number;
    total_revenue: number;
    revenue_with_cogs: number;
    total_cogs: number;
  }>(sql`
    SELECT
      UPPER(TRIM(c.code)) AS code,
      COUNT(*)::int AS order_count,
      COUNT(*) FILTER (WHERE o.cogs_amount > 0)::int AS orders_with_cogs,
      COALESCE(SUM(o.total_price::numeric), 0)::float AS total_revenue,
      COALESCE(SUM(o.total_price::numeric) FILTER (WHERE o.cogs_amount > 0), 0)::float AS revenue_with_cogs,
      COALESCE(SUM(o.cogs_amount::numeric) FILTER (WHERE o.cogs_amount > 0), 0)::float AS total_cogs
    FROM orders o
    CROSS JOIN LATERAL unnest(string_to_array(o.discount_codes, ',')) AS c(code)
    WHERE o.financial_status = 'PAID'
      AND o.total_price::numeric > 0
      AND (o.discount_codes IS NULL OR o.discount_codes NOT ILIKE '%TROCA%')
      AND (o.discount_codes IS NULL OR o.discount_codes NOT ILIKE '%VOUCHER%')
      AND (o.tags IS NULL OR o.tags NOT ILIKE '%Reenvio%')
      AND o.created_at >= ${dateFrom}
      AND o.created_at < ${dateTo}
      AND TRIM(c.code) ~* '20$'
    GROUP BY UPPER(TRIM(c.code))
    ORDER BY total_revenue DESC
  `);

  return rows.map((r) => {
    const orderCount = Number(r.order_count) || 0;
    const ordersWithCogs = Number(r.orders_with_cogs) || 0;
    const totalRevenue = Number(r.total_revenue) || 0;
    const revenueWithCogs = Number(r.revenue_with_cogs) || 0;
    const totalCogs = Number(r.total_cogs) || 0;
    const grossProfit = revenueWithCogs - totalCogs;
    return {
      code: r.code,
      orderCount,
      ordersWithCogs,
      coveragePct: orderCount > 0 ? (ordersWithCogs / orderCount) * 100 : 0,
      totalRevenue,
      revenueWithCogs,
      totalCogs,
      grossProfit,
      grossMargin: revenueWithCogs > 0 ? (grossProfit / revenueWithCogs) * 100 : 0,
      costPct: revenueWithCogs > 0 ? (totalCogs / revenueWithCogs) * 100 : 0,
      avgTicket: orderCount > 0 ? totalRevenue / orderCount : 0,
    };
  });
}
