import "server-only";
import { getMarginAnalysis } from "./margin";
import { getDailyMetrics } from "./dashboard";
import {
  buildWeightMap,
  getDailyWeights,
  getMonthlyGoal,
} from "./planning";
import { toMonthKeySP } from "@/lib/datetime";

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

export async function getPerformanceAnalysis(
  dateFrom: Date,
  dateTo: Date,
): Promise<PerformanceAnalysis> {
  const [margin, dailyMetrics, goalSharesByDate] = await Promise.all([
    getMarginAnalysis(dateFrom, dateTo),
    getDailyMetrics(dateFrom, dateTo),
    dailyGoalSharesForRange(dateFrom, dateTo),
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
    const faturamentoReal = p.faturamento;
    const marketingReal = p.adSpend;
    const lucroBrutoReal = p.performanceProfit;
    const margemBrutaReal = p.performanceMargin;
    const roasReal = safeDiv(faturamentoReal, marketingReal);
    const ticketReal = safeDiv(faturamentoReal, pedidosReal);
    const cpaReal = safeDiv(marketingReal, pedidosReal);

    const share = goalSharesByDate.get(p.date) ?? null;
    const faturamentoPrev = share ? share.revenue : null;
    const lucroBrutoPrev = share ? share.grossProfit : null;
    const monthKey = p.date.slice(0, 7);
    const margemBrutaPrev = monthlyMargemMap.get(monthKey) ?? null;

    return {
      date: p.date,
      sessoesReal: null,
      sessoesPrev: null,
      pedidosReal,
      pedidosPrev: null,
      faturamentoReal,
      faturamentoPrev,
      conversaoReal: null,
      conversaoPrev: null,
      roasReal,
      roasPrev: null,
      ticketReal,
      ticketPrev: null,
      marketingReal,
      marketingPrev: null,
      cpsReal: null,
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
    if (p.faturamentoPrev !== null) {
      sumFaturamentoPrev += p.faturamentoPrev;
      hasFatPrev = true;
    }
    if (p.lucroBrutoPrev !== null) {
      sumLucroPrev += p.lucroBrutoPrev;
      hasLucroPrev = true;
    }
  }

  const totals: PerformanceTotals = {
    sessoesReal: null,
    sessoesPrev: null,
    pedidosReal: sumPedidosReal,
    pedidosPrev: null,
    faturamentoReal: sumFaturamentoReal,
    faturamentoPrev: hasFatPrev ? sumFaturamentoPrev : null,
    conversaoReal: null,
    conversaoPrev: null,
    roasReal: safeDiv(sumFaturamentoReal, sumMarketingReal),
    roasPrev: null,
    ticketReal: safeDiv(sumFaturamentoReal, sumPedidosReal),
    ticketPrev: null,
    marketingReal: sumMarketingReal,
    marketingPrev: null,
    cpsReal: null,
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
