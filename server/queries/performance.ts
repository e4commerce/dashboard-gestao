import "server-only";
import { getMarginAnalysis } from "./margin";
import { getDailyMetrics } from "./dashboard";
import { getDailyAdSpend } from "./ads";
import {
  buildWeightMap,
  getDailyWeights,
  getMonthlyGoal,
} from "./planning";
import { validOrder } from "./order-filters";
import { toMonthKeySP } from "@/lib/datetime";
import { db } from "@/server/db/client";
import {
  dailySessions,
  orders,
  orderAttribution,
} from "@/server/db/schema";
import { and, eq, gte, lt, lte, sql } from "drizzle-orm";

export type DailyPerformancePoint = {
  date: string;
  // Sessões / Conversão / CPS dependem de dados de sessão que ainda não temos.
  sessoesReal: number | null;
  sessoesPrev: number | null;
  pedidosReal: number;
  pedidosPrev: number | null;
  faturamentoReal: number;
  faturamentoPrev: number | null;
  conversaoReal: number | null;
  conversaoPrev: number | null;
  roasReal: number | null;
  roasPrev: number | null;
  ticketReal: number | null;
  ticketPrev: number | null;
  marketingReal: number;
  marketingPrev: number | null;
  cpsReal: number | null;
  cpsPrev: number | null;
  lucroBrutoReal: number;
  lucroBrutoPrev: number | null;
  margemBrutaReal: number;
  margemBrutaPrev: number | null;
  cpaReal: number | null;
  cpaPrev: number | null;
};

export type PerformanceTotals = Omit<DailyPerformancePoint, "date">;

export type PerformanceAnalysis = {
  daily: DailyPerformancePoint[];
  totals: PerformanceTotals;
};

// Distribui a meta mensal por dia usando os pesos configurados.
async function dailyGoalSharesForRange(
  dateFrom: Date,
  dateTo: Date,
): Promise<Map<string, { revenue: number; grossProfit: number }>> {
  const monthsTouched = new Set<string>();
  const cursor = new Date(dateFrom.getTime());
  while (cursor < dateTo) {
    monthsTouched.add(toMonthKeySP(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const out = new Map<string, { revenue: number; grossProfit: number }>();
  for (const month of monthsTouched) {
    const [goal, weights] = await Promise.all([
      getMonthlyGoal(month),
      getDailyWeights(month),
    ]);
    const revenueGoal = goal?.revenueGoal ?? 0;
    const grossProfitGoal = goal?.grossProfitGoal ?? 0;
    if (revenueGoal === 0 && grossProfitGoal === 0) continue;
    const wmap = buildWeightMap(month, weights);
    let sumWeights = 0;
    for (const w of wmap.values()) sumWeights += w;
    if (sumWeights === 0) continue;
    for (const [day, w] of wmap.entries()) {
      const key = `${month}-${String(day).padStart(2, "0")}`;
      out.set(key, {
        revenue: (w / sumWeights) * revenueGoal,
        grossProfit: (w / sumWeights) * grossProfitGoal,
      });
    }
  }
  return out;
}

function safeDiv(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

async function getSessionsByDate(
  dateFrom: Date,
  dateTo: Date,
): Promise<Map<string, number>> {
  const fromIso = dateFrom.toISOString().slice(0, 10);
  const toIso = dateTo.toISOString().slice(0, 10);
  const rows = await db
    .select({ date: dailySessions.date, sessions: dailySessions.sessions })
    .from(dailySessions)
    .where(
      and(
        gte(dailySessions.date, fromIso),
        lte(dailySessions.date, toIso),
      ),
    );
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.date, r.sessions);
  return map;
}

export async function getPerformanceAnalysis(
  dateFrom: Date,
  dateTo: Date,
): Promise<PerformanceAnalysis> {
  const [margin, dailyMetrics, goalSharesByDate, sessionsByDate] = await Promise.all([
    getMarginAnalysis(dateFrom, dateTo),
    getDailyMetrics(dateFrom, dateTo),
    dailyGoalSharesForRange(dateFrom, dateTo),
    getSessionsByDate(dateFrom, dateTo),
  ]);

  const metricsByDate = new Map<string, number>();
  for (const m of dailyMetrics) metricsByDate.set(m.date, m.pedidos);

  // Margem bruta prevista do mês = soma(grossProfit) / soma(revenue) das metas.
  const monthSums = new Map<string, { revenue: number; grossProfit: number }>();
  for (const [key, share] of goalSharesByDate) {
    const monthKey = key.slice(0, 7);
    const acc = monthSums.get(monthKey) ?? { revenue: 0, grossProfit: 0 };
    acc.revenue += share.revenue;
    acc.grossProfit += share.grossProfit;
    monthSums.set(monthKey, acc);
  }
  const monthlyMargemMap = new Map<string, number | null>();
  for (const [m, sums] of monthSums) {
    monthlyMargemMap.set(
      m,
      sums.revenue > 0 ? (sums.grossProfit / sums.revenue) * 100 : null,
    );
  }

  const daily: DailyPerformancePoint[] = margin.daily.map((p) => {
    const pedidosReal = metricsByDate.get(p.date) ?? 0;
    const sessoesReal = sessionsByDate.get(p.date) ?? null;
    const faturamentoReal = p.faturamento;
    const marketingReal = p.adSpend;
    const lucroBrutoReal = p.performanceProfit;
    const margemBrutaReal = p.performanceMargin;
    const roasReal = safeDiv(faturamentoReal, marketingReal);
    const ticketReal = safeDiv(faturamentoReal, pedidosReal);
    const cpaReal = safeDiv(marketingReal, pedidosReal);
    const conversaoReal =
      sessoesReal !== null && sessoesReal > 0
        ? (pedidosReal / sessoesReal) * 100
        : null;
    const cpsReal =
      sessoesReal !== null && sessoesReal > 0
        ? safeDiv(marketingReal, sessoesReal)
        : null;

    const share = goalSharesByDate.get(p.date) ?? null;
    const faturamentoPrev = share ? share.revenue : null;
    const lucroBrutoPrev = share ? share.grossProfit : null;
    const monthKey = p.date.slice(0, 7);
    const margemBrutaPrev = monthlyMargemMap.get(monthKey) ?? null;

    return {
      date: p.date,
      sessoesReal,
      sessoesPrev: null,
      pedidosReal,
      pedidosPrev: null,
      faturamentoReal,
      faturamentoPrev,
      conversaoReal,
      conversaoPrev: null,
      roasReal,
      roasPrev: null,
      ticketReal,
      ticketPrev: null,
      marketingReal,
      marketingPrev: null,
      cpsReal,
      cpsPrev: null,
      lucroBrutoReal,
      lucroBrutoPrev,
      margemBrutaReal,
      margemBrutaPrev,
      cpaReal,
      cpaPrev: null,
    };
  });

  // Totais somáveis: pedidos, faturamento, marketing, lucro, prev.
  let sumPedidosReal = 0;
  let sumSessoesReal = 0;
  let hasSessoes = false;
  let sumFaturamentoReal = 0;
  let sumMarketingReal = 0;
  let sumLucroReal = 0;
  let sumFaturamentoPrev = 0;
  let hasFatPrev = false;
  let sumLucroPrev = 0;
  let hasLucroPrev = false;

  for (const p of daily) {
    sumPedidosReal += p.pedidosReal;
    sumFaturamentoReal += p.faturamentoReal;
    sumMarketingReal += p.marketingReal;
    sumLucroReal += p.lucroBrutoReal;
    if (p.sessoesReal !== null) {
      sumSessoesReal += p.sessoesReal;
      hasSessoes = true;
    }
    if (p.faturamentoPrev !== null) {
      sumFaturamentoPrev += p.faturamentoPrev;
      hasFatPrev = true;
    }
    if (p.lucroBrutoPrev !== null) {
      sumLucroPrev += p.lucroBrutoPrev;
      hasLucroPrev = true;
    }
  }

  const totalSessoes = hasSessoes ? sumSessoesReal : null;
  const totalConversao =
    totalSessoes !== null && totalSessoes > 0
      ? (sumPedidosReal / totalSessoes) * 100
      : null;
  const totalCps =
    totalSessoes !== null && totalSessoes > 0
      ? safeDiv(sumMarketingReal, totalSessoes)
      : null;

  const totals: PerformanceTotals = {
    sessoesReal: totalSessoes,
    sessoesPrev: null,
    pedidosReal: sumPedidosReal,
    pedidosPrev: null,
    faturamentoReal: sumFaturamentoReal,
    faturamentoPrev: hasFatPrev ? sumFaturamentoPrev : null,
    conversaoReal: totalConversao,
    conversaoPrev: null,
    roasReal: safeDiv(sumFaturamentoReal, sumMarketingReal),
    roasPrev: null,
    ticketReal: safeDiv(sumFaturamentoReal, sumPedidosReal),
    ticketPrev: null,
    marketingReal: sumMarketingReal,
    marketingPrev: null,
    cpsReal: totalCps,
    cpsPrev: null,
    lucroBrutoReal: sumLucroReal,
    lucroBrutoPrev: hasLucroPrev ? sumLucroPrev : null,
    margemBrutaReal:
      sumFaturamentoReal > 0 ? (sumLucroReal / sumFaturamentoReal) * 100 : 0,
    margemBrutaPrev:
      hasFatPrev && sumFaturamentoPrev > 0
        ? (sumLucroPrev / sumFaturamentoPrev) * 100
        : null,
    cpaReal: safeDiv(sumMarketingReal, sumPedidosReal),
    cpaPrev: null,
  };

  return { daily, totals };
}

// ─── Vendas por canal (UTM) ──────────────────────────────────────────────────

export type SalesByChannelRow = {
  channel: string;          // channelName consolidado pelo classificador UTM
  orderCount: number;       // pedidos válidos atribuídos ao canal
  revenue: number;          // faturamento total no canal
  revenuePct: number;       // participação no faturamento total do período
  avgTicket: number;        // faturamento / pedidos
  // Margem bruta = (revenueWithCogs - cogs) / revenueWithCogs. Só considera
  // pedidos com COGS sincronizado, pra evitar margem "infiada" por pedidos
  // ainda não custeados.
  revenueWithCogs: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number | null;
  coveragePct: number;      // % de pedidos do canal com COGS sincronizado
  // Marketing pago atribuído ao canal: Meta → "Meta", Google → "Google".
  // null para canais sem mídia paga rastreada.
  adSpend: number | null;
  roas: number | null;      // revenue / adSpend
  cpa: number | null;       // adSpend / orderCount
};

export type SalesByChannelTotals = {
  orderCount: number;
  revenue: number;
  revenueWithCogs: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number | null;
  coveragePct: number;
  adSpend: number;
  roas: number | null;
  cpa: number | null;
  avgTicket: number;
};

export type SalesByChannelAnalysis = {
  rows: SalesByChannelRow[];
  totals: SalesByChannelTotals;
};

// Canais com gasto pago rastreado pela plataforma de ads — usado pra atribuir
// adSpend/ROAS/CPA. Demais canais aparecem com null nessas colunas.
const PAID_CHANNEL_KEYS = new Set(["Meta", "Google"]);

export async function getSalesByChannel(
  dateFrom: Date,
  dateTo: Date,
): Promise<SalesByChannelAnalysis> {
  // channelName pode ser nulo (pedidos antigos sem attribution ainda) — caímos
  // em "Sem atribuição" pra não esconder receita.
  const channelExpr = sql<string>`COALESCE(${orderAttribution.channelName}, 'Sem atribuição')`;

  const [channelRows, ads] = await Promise.all([
    db
      .select({
        channel: channelExpr,
        orderCount: sql<number>`COUNT(*)::int`,
        revenue: sql<number>`COALESCE(SUM(${orders.totalPrice}), 0)::float`,
        ordersWithCogs: sql<number>`COUNT(*) FILTER (WHERE ${orders.cogsAmount} > 0)::int`,
        revenueWithCogs: sql<number>`COALESCE(SUM(${orders.totalPrice}) FILTER (WHERE ${orders.cogsAmount} > 0), 0)::float`,
        cogs: sql<number>`COALESCE(SUM(${orders.cogsAmount}) FILTER (WHERE ${orders.cogsAmount} > 0), 0)::float`,
      })
      .from(orders)
      .leftJoin(orderAttribution, eq(orderAttribution.orderId, orders.id))
      .where(
        and(validOrder, gte(orders.createdAt, dateFrom), lt(orders.createdAt, dateTo)),
      )
      .groupBy(channelExpr),
    getDailyAdSpend(dateFrom, dateTo),
  ]);

  let metaSpend = 0;
  let googleSpend = 0;
  for (const a of ads) {
    metaSpend += a.meta.spend;
    googleSpend += a.google.spend;
  }
  const spendByChannel = new Map<string, number>([
    ["Meta", metaSpend],
    ["Google", googleSpend],
  ]);

  const totalRevenue = channelRows.reduce((s, r) => s + r.revenue, 0);

  const rows: SalesByChannelRow[] = channelRows.map((r) => {
    const grossProfit = r.revenueWithCogs - r.cogs;
    const grossMargin =
      r.revenueWithCogs > 0 ? (grossProfit / r.revenueWithCogs) * 100 : null;
    const isPaid = PAID_CHANNEL_KEYS.has(r.channel);
    const adSpend = isPaid ? spendByChannel.get(r.channel) ?? 0 : null;
    return {
      channel: r.channel,
      orderCount: r.orderCount,
      revenue: r.revenue,
      revenuePct: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
      avgTicket: r.orderCount > 0 ? r.revenue / r.orderCount : 0,
      revenueWithCogs: r.revenueWithCogs,
      cogs: r.cogs,
      grossProfit,
      grossMargin,
      coveragePct:
        r.orderCount > 0 ? (r.ordersWithCogs / r.orderCount) * 100 : 0,
      adSpend,
      roas: adSpend && adSpend > 0 ? r.revenue / adSpend : null,
      cpa: adSpend && adSpend > 0 && r.orderCount > 0 ? adSpend / r.orderCount : null,
    };
  });

  rows.sort((a, b) => b.revenue - a.revenue);

  const sumOrders = rows.reduce((s, r) => s + r.orderCount, 0);
  const sumRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const sumRevenueWithCogs = rows.reduce((s, r) => s + r.revenueWithCogs, 0);
  const sumCogs = rows.reduce((s, r) => s + r.cogs, 0);
  const sumGrossProfit = sumRevenueWithCogs - sumCogs;
  const sumOrdersWithCogs = channelRows.reduce(
    (s, r) => s + r.ordersWithCogs,
    0,
  );
  const sumAdSpend = metaSpend + googleSpend;

  const totals: SalesByChannelTotals = {
    orderCount: sumOrders,
    revenue: sumRevenue,
    revenueWithCogs: sumRevenueWithCogs,
    cogs: sumCogs,
    grossProfit: sumGrossProfit,
    grossMargin:
      sumRevenueWithCogs > 0 ? (sumGrossProfit / sumRevenueWithCogs) * 100 : null,
    coveragePct: sumOrders > 0 ? (sumOrdersWithCogs / sumOrders) * 100 : 0,
    adSpend: sumAdSpend,
    roas: sumAdSpend > 0 ? sumRevenue / sumAdSpend : null,
    cpa: sumAdSpend > 0 && sumOrders > 0 ? sumAdSpend / sumOrders : null,
    avgTicket: sumOrders > 0 ? sumRevenue / sumOrders : 0,
  };

  return { rows, totals };
}
