import "server-only";
import { db } from "@/server/db/client";
import { monthlyGoals, dailyWeights } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

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
