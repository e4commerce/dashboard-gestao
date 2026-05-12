import "server-only";
import {
  getDailyAccumulatedRevenue,
  getDailyMetrics,
  getKpiTotals,
} from "@/server/queries/dashboard";
import { formatBRL } from "./format";
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
    return [
      {
        date: `${month}-01`,
        realizado: 0,
        meta: 0,
        realizadoDia: 0,
        metaDia: 0,
      },
    ];
  }
  return points;
}

export async function getKpis(
  month = toMonthKeySP(new Date()),
): Promise<Kpi[]> {
  const from = startOfMonthFromKey(month);
  const to = endOfMonthFromKey(month);
  const totals = await getKpiTotals(from, to);

  const vsTarget =
    totals.faturamentoMeta && totals.faturamentoMeta > 0
      ? totals.faturamento / totals.faturamentoMeta
      : undefined;

  return [
    {
      label: "Lucro Operacional",
      value: null,
      format: "BRL",
      placeholder: "Disponível na Fase 3",
    },
    {
      label: "Faturamento Atual",
      value: totals.faturamento,
      format: "BRL",
      vsTarget,
    },
    {
      label: "Margem Operacional",
      value: null,
      format: "PERCENT",
      placeholder: "Disponível na Fase 3",
    },
  ];
}

export async function getSectors(
  month = toMonthKeySP(new Date()),
): Promise<Sector[]> {
  const from = startOfMonthFromKey(month);
  const to = endOfMonthFromKey(month);
  const [totals, history] = await Promise.all([
    getKpiTotals(from, to),
    getDailyMetrics(from, to),
  ]);

  return [
    {
      id: "marketing",
      title: "Marketing",
      metrics: [
        { label: "CPA", value: null },
        { label: "ROAS", value: null },
        { label: "Investimento", value: null },
        { label: "Conversões", value: null },
      ],
    },
    {
      id: "operacoes",
      title: "Operações",
      metrics: [
        { label: "Custo Operacional", value: null },
        {
          label: "Pedidos",
          value: totals.pedidos.toLocaleString("pt-BR"),
          chartData: history.map((p) => ({ date: p.date, value: p.pedidos })),
          chartType: "bar",
          chartFormat: "number",
        },
        {
          label: "Ticket Médio",
          value: totals.ticketMedio > 0 ? formatBRL(totals.ticketMedio) : "—",
          chartData: history.map((p) => ({
            date: p.date,
            value: p.ticketMedio,
          })),
          chartType: "area",
          chartFormat: "BRL",
        },
        { label: "Margem", value: null },
      ],
    },
    {
      id: "cro",
      title: "CRO",
      metrics: [
        { label: "Taxa de Conversão", value: null },
        { label: "Sessões", value: null },
        { label: "Bounce Rate", value: null },
        { label: "Tempo Médio", value: null },
      ],
    },
  ];
}
