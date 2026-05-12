"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { startCogsSyncBackground } from "@/server/cogs/sync";
import {
  parseMonthKey,
  startOfMonthFromKey,
  endOfMonthFromKey,
} from "@/lib/datetime";

export type SyncCogsState = {
  status: "idle" | "started" | "error";
  message?: string;
  logId?: number;
};

export async function syncCogsAction(
  _prev: SyncCogsState,
  formData: FormData,
): Promise<SyncCogsState> {
  const session = await auth();
  if (!session?.user) return { status: "error", message: "Não autenticado." };

  const month = parseMonthKey(formData.get("month") as string | null);
  if (!month) return { status: "error", message: "Mês inválido." };

  try {
    const from = startOfMonthFromKey(month);
    const to = endOfMonthFromKey(month);
    const { logId } = await startCogsSyncBackground(from, to, "manual");
    revalidatePath("/custos");
    return { status: "started", logId };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}
