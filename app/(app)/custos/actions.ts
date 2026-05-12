"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { syncCogs, type CogsSyncResult } from "@/server/cogs/sync";
import {
  parseMonthKey,
  startOfMonthFromKey,
  endOfMonthFromKey,
} from "@/lib/datetime";

export type SyncCogsState = {
  status: "idle" | "ok" | "error";
  message?: string;
  result?: CogsSyncResult;
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
    const result = await syncCogs(from, to);
    revalidatePath("/custos");
    revalidatePath("/visao-geral");
    return { status: "ok", result };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}
