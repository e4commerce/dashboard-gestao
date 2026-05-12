"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  upsertMonthlyGoal,
  upsertDailyWeights,
  daysInMonth,
} from "@/server/queries/planning";
import { auth } from "@/auth";

const monthRegex = /^\d{4}-\d{2}$/;

const goalSchema = z.object({
  month: z.string().regex(monthRegex),
  revenueGoal: z.coerce.number().min(0),
  grossProfitGoal: z.coerce.number().min(0),
});

export type SaveMonthlyGoalState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

export async function saveMonthlyGoalAction(
  _prev: SaveMonthlyGoalState,
  formData: FormData,
): Promise<SaveMonthlyGoalState> {
  const session = await auth();
  if (!session?.user) return { status: "error", message: "Não autenticado." };

  const parsed = goalSchema.safeParse({
    month: formData.get("month"),
    revenueGoal: formData.get("revenueGoal"),
    grossProfitGoal: formData.get("grossProfitGoal"),
  });
  if (!parsed.success) return { status: "error", message: "Dados inválidos." };

  try {
    await upsertMonthlyGoal(parsed.data);
    revalidatePath("/metas");
    revalidatePath("/visao-geral");
    return { status: "ok" };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}

const weightsSchema = z.object({
  month: z.string().regex(monthRegex),
  weights: z.array(
    z.object({
      day: z.number().int().min(1).max(31),
      weight: z.number().min(0).max(99),
    }),
  ),
});

export type SaveWeightsState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

export async function saveWeightsAction(
  _prev: SaveWeightsState,
  formData: FormData,
): Promise<SaveWeightsState> {
  const session = await auth();
  if (!session?.user) return { status: "error", message: "Não autenticado." };

  const month = formData.get("month") as string | null;
  if (!month || !monthRegex.test(month)) {
    return { status: "error", message: "Mês inválido." };
  }

  const dim = daysInMonth(month);
  const weights = [];
  for (let d = 1; d <= dim; d++) {
    const raw = formData.get(`w_${d}`);
    if (raw === null) continue;
    const parsed = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { status: "error", message: `Peso inválido no dia ${d}.` };
    }
    weights.push({ day: d, weight: parsed });
  }

  const validated = weightsSchema.safeParse({ month, weights });
  if (!validated.success) return { status: "error", message: "Dados inválidos." };

  try {
    await upsertDailyWeights(validated.data.month, validated.data.weights);
    revalidatePath("/metas");
    revalidatePath("/visao-geral");
    return { status: "ok" };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}
