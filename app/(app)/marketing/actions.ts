"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { syncMetaInsights, type MetaSyncResult } from "@/server/meta/sync";
import {
  parseMonthKey,
  startOfMonthFromKey,
  endOfMonthFromKey,
} from "@/lib/datetime";

export type SyncMetaState = {
  status: "idle" | "ok" | "error";
  message?: string;
  result?: MetaSyncResult;
};

export async function syncMetaAction(
  _prev: SyncMetaState,
  formData: FormData,
): Promise<SyncMetaState> {
  const session = await auth();
  if (!session?.user) return { status: "error", message: "Não autenticado." };

  const month = parseMonthKey(formData.get("month") as string | null);
  if (!month) return { status: "error", message: "Mês inválido." };

  try {
    const from = startOfMonthFromKey(month);
    const to = endOfMonthFromKey(month);
    const result = await syncMetaInsights(from, to);
    revalidatePath("/marketing");
    revalidatePath("/visao-geral");
    return { status: "ok", result };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}
