import "server-only";
import {
  getDailyAccumulatedRevenue,
  getDailyAccumulatedProfit,
  getDailyMetrics,
  getKpiTotals,
} from "@/server/queries/dashboard";
import { getMarginAnalysis } from "@/server/queries/margin";
import { getPerformanceAnalysis } from "@/server/queries/performance";
import { getDailyAdSpend } from "@/server/queries/ads";
import { formatBRL, formatPercent } from "./format";
import {
  toMonthKeySP,
  startOfMonthFromKey,
  endOfMonthFromKey,
} from "./datetime";

export type ChartPoint = {
  date: string;
  realizado: number | null;
  meta: number;
  realizadoDia: number | null;
  metaDia: number;
};

export type Kpi = {
  label: string;
  value: number | null;
  format: "BRL" | "PERCENT";
  vsTarget?: number;
  targetReference?: number;
  placeholder?: string;
};

export type MetricDataPoint = { date: string; value: number | null };

export type Metric = {
  label: string;
  value: string | null;
  delta?: number;
  chartData?: MetricDataPoint[];
  chartType?: "bar" | "area";
  chartFormat?: "number" | "BRL";
};

export type Sector = {
  id: "marketing" | "operacoes" | "cro";
  title: string;
  metrics: Metric[];
};

export async function getOverviewChart(
  month = toMonthKeySP(new Date()),
): Promise<ChartPoint[]> {
  const from = startOfMonthFromKey(month);
  const to = endOfMonthFromKey(month);
  const points = await getDailyAccumulatedRevenue(from, to);
  if (points.length === 0) {
    return [{ date: `${month}-01`, realizado: 0, meta: 0, realizadoDia: 0, metaDia: 0 }];
  }
  return points;
}

export async function getOverviewProfitChart(
  month = toMonthKeySP(new Date()),
): Promise<ChartPoint[]> {
  const from = startOfMonthFromKey(month);
  const to = endOfMonthFromKey(month);
  const points = await getDailyAccumulatedProfit(from, to);
  if (points.length === 0) {
    return [{ date: `${month}-01`, realizado: 0, meta: 0, realizadoDia: 0, metaDia: 0 }];
  }
  return points;
}

export async function getKpis(
  month = toMonthKeySP(new Date()),
): Promise<Kpi[]> {
  const from = startOfMonthFromKey(month);
  const to = endOfMonthFromKey(month);

  const [totals, margin] = await Promise.all([
    getKpiTotals(from, to),
    getMarginAnalysis(from, to),
  ]);

  const vsRevenue =
    totals.faturamentoMeta && totals.faturamentoMeta > 0
      ? totals.faturamento / totals.faturamentoMeta
      : undefined;

  return [
    {
      label: "Lucro Operacional",
      value: margin.totals.operationalProfit,
      format: "BRL",
    },
    {
      label: "Faturamento",
      value: totals.faturamento,
      format: "BRL",
      vsTarget: vsRevenue,
    },
    {
      label: "Margem Operacional",
      value: margin.totals.operationalMargin,
      format: "PERCENT",
    },
  ];
}

export async function getSectors(
  month = toMonthKeySP(new Date()),
): Promise<Sector[]> {
  const from = startOfMonthFromKey(month);
  const to = endOfMonthFromKey(month);

  const [history, perf, adDaily, margin] = await Promise.all([
    getDailyMetrics(from, to),
    getPerformanceAnalysis(from, to),
    getDailyAdSpend(from, to),
    getMarginAnalysis(from, to),
  ]);

  const pt = perf.totals;
  const mt = margin.totals;

  const totalMetaConversions = adDaily.reduce((s, d) => s + (d.meta.conversions ?? 0), 0);

  const fmtRatio = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return [
    {
      id: "marketing",
      title: "Marketing",
      metrics: [
        {
          label: "Investimento",
          value: pt.marketingReal > 0 ? formatBRL(pt.marketingReal) : null,
          chartData: adDaily.map((d) => ({ date: d.date, value: d.total.spend })),
          chartType: "area",
          chartFormat: "BRL",
        },
        {
          label: "ROAS",
          value: pt.roasReal !== null ? fmtRatio(pt.roasReal) : null,
        },
        {
          label: "CPA",
          value: pt.cpaReal !== null ? formatBRL(pt.cpaReal, 2) : null,
        },
        {
          label: "Conv. Meta",
          value: totalMetaConversions > 0
            ? totalMetaConversions.toLocaleString("pt-BR")
            : null,
        },
      ],
    },
    {
      id: "operacoes",
      title: "Operações",
      metrics: [
        {
          label: "Pedidos",
          value: pt.pedidosReal.toLocaleString("pt-BR"),
          chartData: history.map((p) => ({ date: p.date, value: p.pedidos })),
          chartType: "bar",
          chartFormat: "number",
        },
        {
          label: "Ticket Médio",
          value: pt.ticketReal !== null ? formatBRL(pt.ticketReal, 2) : null,
          chartData: history.map((p) => ({ date: p.date, value: p.ticketMedio })),
          chartType: "area",
          chartFormat: "BRL",
        },
        {
          label: "Custo de Produto",
          value:
            mt.cogsValid + mt.cogsValidEstimated > 0
              ? formatBRL(mt.cogsValid + mt.cogsValidEstimated)
              : null,
        },
        {
          label: "Margem Bruta",
          value:
            pt.margemBrutaReal !== 0
              ? formatPercent(pt.margemBrutaReal, 1)
              : null,
        },
      ],
    },
    {
      id: "cro",
      title: "CRO",
      metrics: [
        {
          label: "Sessões",
          value:
            pt.sessoesReal !== null
              ? pt.sessoesReal.toLocaleString("pt-BR")
              : null,
        },
        {
          label: "Taxa de Conversão",
          value:
            pt.conversaoReal !== null
              ? formatPercent(pt.conversaoReal, 2)
              : null,
        },
        {
          label: "CPS",
          value: pt.cpsReal !== null ? formatBRL(pt.cpsReal, 2) : null,
        },
        {
          label: "Bounce Rate",
          value: null,
        },
      ],
    },
  ];
}
