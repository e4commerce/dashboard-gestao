import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SectorCard } from "@/components/dashboard/sector-card";
import { MonthPicker } from "@/components/month-picker";
import { PageHeader } from "@/components/layout/page-header";
import { getOverviewChart, getOverviewProfitChart, getKpis, getSectors } from "@/lib/mock-data";
import { parseMonthKey, toMonthKeySP } from "@/lib/datetime";
import { formatLongDate } from "@/lib/format";

export default async function VisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthKey(params.month) ?? toMonthKeySP(new Date());

  const [chart, profitChart, kpis, sectors] = await Promise.all([
    getOverviewChart(month),
    getOverviewProfitChart(month),
    getKpis(month),
    getSectors(month),
  ]);
  const today = formatLongDate(new Date());

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Visão Geral" subtitle={today} />
        <MonthPicker month={month} />
      </div>

      <RevenueChart revenueData={chart} profitData={profitChart} />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-fg-primary">
          Desempenho por Setor
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {sectors.map((sector) => (
            <SectorCard key={sector.id} sector={sector} />
          ))}
        </div>
      </section>
    </div>
  );
}
