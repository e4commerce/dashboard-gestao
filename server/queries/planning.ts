import "server-only";
import { db } from "@/server/db/client";
import { monthlyGoals, dailyWeights } from "@/server/db/schema";
import { and, between, eq } from "drizzle-orm";
import { startOfMonthFromKey, endOfMonthFromKey, toMonthKeySP } from "@/lib/datetime";
import { getMarginAnalysis } from "./margin";

export type MonthlyGoalRow = {
  month: string;
  revenueGoal: number;
  grossProfitGoal: number;
};

export async function getMonthlyGoal(
  month: string,
): Promise<MonthlyGoalRow | null> {
  const [row] = await db
    .select()
    .from(monthlyGoals)
    .where(eq(monthlyGoals.month, month))
    .limit(1);
  if (!row) return null;
  return {
    month: row.month,
    revenueGoal: Number(row.revenueGoal),
    grossProfitGoal: Number(row.grossProfitGoal),
  };
}

export async function upsertMonthlyGoal(input: {
  month: string;
  revenueGoal: number;
  grossProfitGoal: number;
}): Promise<void> {
  await db
    .insert(monthlyGoals)
    .values({
      month: input.month,
      revenueGoal: input.revenueGoal.toString(),
      grossProfitGoal: input.grossProfitGoal.toString(),
    })
    .onConflictDoUpdate({
      target: monthlyGoals.month,
      set: {
        revenueGoal: input.revenueGoal.toString(),
        grossProfitGoal: input.grossProfitGoal.toString(),
        updatedAt: new Date(),
      },
    });
}

export type DayWeight = { day: number; weight: number };

export async function getDailyWeights(month: string): Promise<DayWeight[]> {
  const rows = await db
    .select()
    .from(dailyWeights)
    .where(eq(dailyWeights.month, month));
  return rows.map((r) => ({ day: r.day, weight: Number(r.weight) }));
}

export async function upsertDailyWeights(
  month: string,
  weights: DayWeight[],
): Promise<void> {
  if (weights.length === 0) return;
  for (const w of weights) {
    await db
      .insert(dailyWeights)
      .values({
        month,
        day: w.day,
        weight: w.weight.toString(),
      })
      .onConflictDoUpdate({
        target: [dailyWeights.month, dailyWeights.day],
        set: { weight: w.weight.toString(), updatedAt: new Date() },
      });
  }
}

const MONTHS_PT_SHORT = [
  "Jan","Fev","Mar","Abr","Mai","Jun",
  "Jul","Ago","Set","Out","Nov","Dez",
];

export type YearlyChartPoint = {
  month: string;       // "YYYY-MM"
  label: string;       // "Jan", "Fev", …
  revenueGoal: number;
  grossProfitGoal: number;
  revenueReal: number | null;      // null = mês ainda não ocorreu
  grossProfitReal: number | null;
};

export async function getYearlyChartData(year: string): Promise<YearlyChartPoint[]> {
  const from = startOfMonthFromKey(`${year}-01`);
  const to   = endOfMonthFromKey(`${year}-12`);
  const currentMonth = toMonthKeySP(new Date());

  const [goalRows, margin] = await Promise.all([
    db.select()
      .from(monthlyGoals)
      .where(between(monthlyGoals.month, `${year}-01`, `${year}-12`)),
    getMarginAnalysis(from, to),
  ]);

  const goalMap = new Map<string, { revenueGoal: number; grossProfitGoal: number }>();
  for (const r of goalRows) {
    goalMap.set(r.month, {
      revenueGoal: Number(r.revenueGoal),
      grossProfitGoal: Number(r.grossProfitGoal),
    });
  }

  const revenueByMonth = new Map<string, number>();
  const profitByMonth  = new Map<string, number>();
  for (const p of margin.daily) {
    const m = p.date.slice(0, 7);
    revenueByMonth.set(m, (revenueByMonth.get(m) ?? 0) + p.faturamento);
    profitByMonth.set(m,  (profitByMonth.get(m)  ?? 0) + p.operationalProfit);
  }

  return Array.from({ length: 12 }, (_, i) => {
    const mm    = String(i + 1).padStart(2, "0");
    const month = `${year}-${mm}`;
    const isFuture = month > currentMonth;
    const g = goalMap.get(month);
    return {
      month,
      label: MONTHS_PT_SHORT[i],
      revenueGoal:      g?.revenueGoal      ?? 0,
      grossProfitGoal:  g?.grossProfitGoal  ?? 0,
      revenueReal:      isFuture ? null : (revenueByMonth.get(month) ?? 0),
      grossProfitReal:  isFuture ? null : (profitByMonth.get(month)  ?? 0),
    };
  });
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function buildWeightMap(
  month: string,
  saved: DayWeight[],
): Map<number, number> {
  const dim = daysInMonth(month);
  const map = new Map<number, number>();
  for (let d = 1; d <= dim; d++) map.set(d, 1);
  for (const w of saved) {
    if (w.day >= 1 && w.day <= dim) map.set(w.day, w.weight);
  }
  return map;
}
