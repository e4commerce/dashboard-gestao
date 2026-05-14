import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/month-picker";
import { YearlyChart } from "@/components/dashboard/yearly-chart";
import { getMonthlyGoal, getDailyWeights, getYearlyChartData } from "@/server/queries/planning";
import { parseMonthKey, toMonthKeySP } from "@/lib/datetime";
import { MonthlyGoalForm } from "./monthly-goal-form";
import { DailyWeightsGrid } from "./daily-weights-grid";

const MONTHS_PT: Record<string, string> = {
  "01": "Janeiro", "02": "Fevereiro", "03": "Março",
  "04": "Abril",   "05": "Maio",      "06": "Junho",
  "07": "Julho",   "08": "Agosto",    "09": "Setembro",
  "10": "Outubro", "11": "Novembro",  "12": "Dezembro",
};

function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${MONTHS_PT[m] ?? m} de ${y}`;
}

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthKey(params.month) ?? toMonthKeySP(new Date());
  const year = month.slice(0, 4);

  const [goal, weights, yearlyData] = await Promise.all([
    getMonthlyGoal(month),
    getDailyWeights(month),
    getYearlyChartData(year),
  ]);

  const revenueGoal = goal?.revenueGoal ?? 0;
  const grossProfitGoal = goal?.grossProfitGoal ?? 0;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Metas"
          subtitle={`Planejamento de ${monthLabel(month)}`}
        />
        <MonthPicker month={month} />
      </div>

      <YearlyChart data={yearlyData} />

      <MonthlyGoalForm
        key={`goal-${month}`}
        month={month}
        revenueGoal={revenueGoal}
        grossProfitGoal={grossProfitGoal}
      />

      <DailyWeightsGrid
        key={`weights-${month}`}
        month={month}
        initialWeights={weights}
        revenueGoal={revenueGoal}
      />
    </div>
  );
}
