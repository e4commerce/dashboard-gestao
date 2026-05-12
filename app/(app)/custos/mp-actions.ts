"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { startMpSyncBackground } from "@/server/mercadopago/sync";
import {
  parseMonthKey,
  startOfMonthFromKey,
  endOfMonthFromKey,
} from "@/lib/datetime";

export type SyncMpState = {
  status: "idle" | "started" | "error";
  message?: string;
  logId?: number;
};

export async function syncMpAction(
  _prev: SyncMpState,
  formData: FormData,
): Promise<SyncMpState> {
  const session = await auth();
  if (!session?.user) return { status: "error", message: "Não autenticado." };

  const month = parseMonthKey(formData.get("month") as string | null);
  if (!month) return { status: "error", message: "Mês inválido." };

  try {
    const from = startOfMonthFromKey(month);
    const to = endOfMonthFromKey(month);
    const { logId } = await startMpSyncBackground(from, to, "manual");
    revalidatePath("/custos");
    return { status: "started", logId };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}
