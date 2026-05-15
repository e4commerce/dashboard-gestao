import "server-only";
import {
  getMarginAnalysis,
  REVENUE_TAX_RATE,
  CHECKOUT_FEE_RATE,
} from "./margin";
import { getDailyCosts } from "./costs";
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
  utmParameters,
} from "@/server/db/schema";
import { and, eq, gte, lt, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  getConsolidatedChannel,
  type ConsolidatedChannel,
  type TouchModel,
} from "@/server/etl/channels";

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
  channel: ConsolidatedChannel; // canal consolidado pelo classificador UTM
  orderCount: number;       // pedidos válidos atribuídos ao canal
  revenue: number;          // faturamento total no canal
  revenuePct: number;       // participação no faturamento total do período
  avgTicket: number;        // faturamento / pedidos
  // ── COGS ──────────────────────────────────────────────────────────────────
  // cogsReal = soma de cogs_amount dos pedidos sincronizados (cogs > 0).
  // cogsEstimated = receita_não_sincronizada × taxa_média_de_cogs do período.
  // A taxa é a mesma usada na análise de margem (sum.cogs / sum.revenueWithCogs).
  cogsReal: number;
  cogsEstimated: number;
  cogsTotal: number;        // cogsReal + cogsEstimated
  coveragePct: number;      // % de pedidos do canal com COGS sincronizado
  // ── Marketing pago ─────────────────────────────────────────────────────────
  // Atribuído ao canal: Meta→"Meta", Google→"Google". null nos demais canais.
  adSpend: number | null;
  roas: number | null;
  cpa: number | null;
  // ── Demais taxas/fees ─────────────────────────────────────────────────────
  // gatewayFee é a taxa MP do período rateada pela participação no faturamento.
  // revenueTax e checkoutFee são percentuais fixos sobre o faturamento do canal.
  gatewayFee: number;
  revenueTax: number;
  checkoutFee: number;
  feesTotal: number;        // gatewayFee + revenueTax + checkoutFee
  // ── Lucro de performance ──────────────────────────────────────────────────
  // = faturamento − cogsTotal − adSpend − feesTotal. Mesma fórmula da página
  // de margem, mas atribuída por canal. cogsInvalid (reenvio/troca/voucher/zerado)
  // é operacional e não entra aqui.
  performanceProfit: number;
  performanceMargin: number;
};

export type SalesByChannelTotals = {
  orderCount: number;
  revenue: number;
  avgTicket: number;
  cogsReal: number;
  cogsEstimated: number;
  cogsTotal: number;
  coveragePct: number;
  adSpend: number;
  roas: number | null;
  cpa: number | null;
  gatewayFee: number;
  revenueTax: number;
  checkoutFee: number;
  feesTotal: number;
  performanceProfit: number;
  performanceMargin: number;
};

export type SalesByChannelAnalysis = {
  rows: SalesByChannelRow[];
  totals: SalesByChannelTotals;
};

// Canais com gasto pago rastreado pela plataforma de ads — usado pra atribuir
// adSpend/ROAS/CPA. Demais canais aparecem com null nessas colunas.
const PAID_CHANNEL_KEYS = new Set<ConsolidatedChannel>(["Meta", "Google"]);

// Ordem fixa de exibição. Canais sem pedidos no período somem da tabela.
const CHANNEL_DISPLAY_ORDER: ConsolidatedChannel[] = [
  "Meta",
  "Google",
  "Klaviyo-Inlead",
  "WhatsApp",
  "Grupo VIP",
  "TikTok",
  "FoxAppy",
  "Direct",
];

export async function getSalesByChannel(
  dateFrom: Date,
  dateTo: Date,
  touchModel: TouchModel = "last_touch",
): Promise<SalesByChannelAnalysis> {
  // Re-classificamos cada pedido aqui em vez de confiar em order_attribution.
  // channel_name foi populado pela versão antiga do classificador e está
  // defasado (não olhava utm_source). Buscamos os dados crus + UTMs e
  // rodamos o classificador novo por pedido.
  const firstUtm = alias(utmParameters, "first_utm");
  const lastUtm = alias(utmParameters, "last_utm");

  const [orderRows, ads, dailyCosts] = await Promise.all([
    db
      .select({
        revenue: sql<number>`${orders.totalPrice}::float`,
        cogsAmount: sql<number>`COALESCE(${orders.cogsAmount}, 0)::float`,
        firstVisitSource: orderAttribution.firstVisitSource,
        lastVisitSource: orderAttribution.lastVisitSource,
        firstVisitReferrerUrl: orderAttribution.firstVisitReferrerUrl,
        lastVisitReferrerUrl: orderAttribution.lastVisitReferrerUrl,
        firstUtmSource: firstUtm.utmSource,
        firstUtmMedium: firstUtm.utmMedium,
        firstUtmCampaign: firstUtm.utmCampaign,
        lastUtmSource: lastUtm.utmSource,
        lastUtmMedium: lastUtm.utmMedium,
        lastUtmCampaign: lastUtm.utmCampaign,
      })
      .from(orders)
      .leftJoin(orderAttribution, eq(orderAttribution.orderId, orders.id))
      .leftJoin(
        firstUtm,
        and(eq(firstUtm.orderId, orders.id), eq(firstUtm.visitType, "first_visit")),
      )
      .leftJoin(
        lastUtm,
        and(eq(lastUtm.orderId, orders.id), eq(lastUtm.visitType, "last_visit")),
      )
      .where(
        and(validOrder, gte(orders.createdAt, dateFrom), lt(orders.createdAt, dateTo)),
      ),
    getDailyAdSpend(dateFrom, dateTo),
    getDailyCosts(dateFrom, dateTo),
  ]);

  // Marketing pago: Meta/Google total no período.
  let metaSpend = 0;
  let googleSpend = 0;
  for (const a of ads) {
    metaSpend += a.meta.spend;
    googleSpend += a.google.spend;
  }
  const spendByChannel = new Map<ConsolidatedChannel, number>([
    ["Meta", metaSpend],
    ["Google", googleSpend],
  ]);

  // Taxa de COGS do período (sum cogs / sum receita-com-cogs) — usada pra
  // estimar o COGS dos pedidos não-sincronizados de cada canal.
  let periodCogs = 0;
  let periodRevenueWithCogs = 0;
  let periodGatewayFee = 0;
  for (const c of dailyCosts) {
    periodCogs += c.validCogs;
    periodRevenueWithCogs += c.validRevenue;
    periodGatewayFee += c.mpFee;
  }
  const cogsRate =
    periodRevenueWithCogs > 0 ? periodCogs / periodRevenueWithCogs : 0;

  // Agrega pedidos por canal classificado.
  type ChannelAgg = {
    orderCount: number;
    revenue: number;
    ordersWithCogs: number;
    revenueWithCogs: number;
    cogs: number;
  };
  const byChannel = new Map<ConsolidatedChannel, ChannelAgg>();

  for (const r of orderRows) {
    const channel = getConsolidatedChannel(
      {
        firstVisitSource: r.firstVisitSource,
        lastVisitSource: r.lastVisitSource,
        firstVisitUtmSource: r.firstUtmSource,
        firstVisitUtmMedium: r.firstUtmMedium,
        firstVisitUtmCampaign: r.firstUtmCampaign,
        lastVisitUtmSource: r.lastUtmSource,
        lastVisitUtmMedium: r.lastUtmMedium,
        lastVisitUtmCampaign: r.lastUtmCampaign,
        firstVisitReferrerUrl: r.firstVisitReferrerUrl,
        lastVisitReferrerUrl: r.lastVisitReferrerUrl,
      },
      touchModel,
    );

    const agg = byChannel.get(channel) ?? {
      orderCount: 0,
      revenue: 0,
      ordersWithCogs: 0,
      revenueWithCogs: 0,
      cogs: 0,
    };
    agg.orderCount += 1;
    agg.revenue += r.revenue;
    if (r.cogsAmount > 0) {
      agg.ordersWithCogs += 1;
      agg.revenueWithCogs += r.revenue;
      agg.cogs += r.cogsAmount;
    }
    byChannel.set(channel, agg);
  }

  const totalRevenue = [...byChannel.values()].reduce(
    (s, r) => s + r.revenue,
    0,
  );

  const channelEntries: Array<{ channel: ConsolidatedChannel; agg: ChannelAgg }> =
    CHANNEL_DISPLAY_ORDER.filter((c) => byChannel.has(c)).map((c) => ({
      channel: c,
      agg: byChannel.get(c)!,
    }));

  const rows: SalesByChannelRow[] = channelEntries.map(({ channel, agg }) => {
    const unsyncedRevenue = Math.max(0, agg.revenue - agg.revenueWithCogs);
    const cogsEstimated = unsyncedRevenue * cogsRate;
    const cogsTotal = agg.cogs + cogsEstimated;

    const isPaid = PAID_CHANNEL_KEYS.has(channel);
    const adSpend = isPaid ? spendByChannel.get(channel) ?? 0 : null;

    const revenueTax = agg.revenue * REVENUE_TAX_RATE;
    const checkoutFee = agg.revenue * CHECKOUT_FEE_RATE;
    // Rateia o gateway fee do período pela participação do canal no faturamento
    // total dos canais — boa aproximação porque a quase totalidade dos pedidos
    // passa pelo MP e a taxa/receita varia pouco entre canais.
    const revenueShare = totalRevenue > 0 ? agg.revenue / totalRevenue : 0;
    const gatewayFee = periodGatewayFee * revenueShare;
    const feesTotal = gatewayFee + revenueTax + checkoutFee;

    const adSpendValue = adSpend ?? 0;
    const performanceProfit =
      agg.revenue - cogsTotal - adSpendValue - feesTotal;
    const performanceMargin =
      agg.revenue > 0 ? (performanceProfit / agg.revenue) * 100 : 0;

    return {
      channel,
      orderCount: agg.orderCount,
      revenue: agg.revenue,
      revenuePct: totalRevenue > 0 ? (agg.revenue / totalRevenue) * 100 : 0,
      avgTicket: agg.orderCount > 0 ? agg.revenue / agg.orderCount : 0,
      cogsReal: agg.cogs,
      cogsEstimated,
      cogsTotal,
      coveragePct:
        agg.orderCount > 0 ? (agg.ordersWithCogs / agg.orderCount) * 100 : 0,
      adSpend,
      roas: adSpend && adSpend > 0 ? agg.revenue / adSpend : null,
      cpa:
        adSpend && adSpend > 0 && agg.orderCount > 0
          ? adSpend / agg.orderCount
          : null,
      gatewayFee,
      revenueTax,
      checkoutFee,
      feesTotal,
      performanceProfit,
      performanceMargin,
    };
  });

  rows.sort((a, b) => b.revenue - a.revenue);

  const sum = rows.reduce(
    (acc, r) => {
      acc.orderCount += r.orderCount;
      acc.revenue += r.revenue;
      acc.cogsReal += r.cogsReal;
      acc.cogsEstimated += r.cogsEstimated;
      acc.cogsTotal += r.cogsTotal;
      acc.adSpend += r.adSpend ?? 0;
      acc.gatewayFee += r.gatewayFee;
      acc.revenueTax += r.revenueTax;
      acc.checkoutFee += r.checkoutFee;
      acc.feesTotal += r.feesTotal;
      acc.performanceProfit += r.performanceProfit;
      return acc;
    },
    {
      orderCount: 0,
      revenue: 0,
      cogsReal: 0,
      cogsEstimated: 0,
      cogsTotal: 0,
      adSpend: 0,
      gatewayFee: 0,
      revenueTax: 0,
      checkoutFee: 0,
      feesTotal: 0,
      performanceProfit: 0,
    },
  );
  const sumOrdersWithCogs = channelEntries.reduce(
    (s, e) => s + e.agg.ordersWithCogs,
    0,
  );

  const totals: SalesByChannelTotals = {
    ...sum,
    avgTicket: sum.orderCount > 0 ? sum.revenue / sum.orderCount : 0,
    coveragePct:
      sum.orderCount > 0 ? (sumOrdersWithCogs / sum.orderCount) * 100 : 0,
    roas: sum.adSpend > 0 ? sum.revenue / sum.adSpend : null,
    cpa:
      sum.adSpend > 0 && sum.orderCount > 0
        ? sum.adSpend / sum.orderCount
        : null,
    performanceMargin:
      sum.revenue > 0 ? (sum.performanceProfit / sum.revenue) * 100 : 0,
  };

  return { rows, totals };
}
