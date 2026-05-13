"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { startExtractionBackground } from "@/server/etl/extract";
import { startCogsSyncBackground } from "@/server/cogs/sync";
import { startMpSyncBackground } from "@/server/mercadopago/sync";
import { syncMetaInsights, type MetaSyncResult } from "@/server/meta/sync";
import {
  parseMonthKey,
  startOfMonthFromKey,
  endOfMonthFromKey,
} from "@/lib/datetime";

const dateRangeSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function revalidateAfterSync() {
  revalidatePath("/integracoes");
  revalidatePath("/visao-geral");
  revalidatePath("/custos");
  revalidatePath("/marketing");
  revalidatePath("/analise-margem");
  revalidatePath("/performance");
}

// ── Shopify (extração de pedidos) ────────────────────────────────────────────

export type ExtractActionState = {
  status: "idle" | "started" | "error";
  message?: string;
  logId?: number;
};

export async function extractAction(
  _prev: ExtractActionState,
  formData: FormData,
): Promise<ExtractActionState> {
  const session = await auth();
  if (!session?.user) return { status: "error", message: "Não autenticado." };

  const parsed = dateRangeSchema.safeParse({
    dateFrom: formData.get("dateFrom"),
    dateTo: formData.get("dateTo"),
  });
  if (!parsed.success) return { status: "error", message: "Datas inválidas." };

  try {
    const dateFrom = new Date(`${parsed.data.dateFrom}T00:00:00.000Z`);
    const dateTo = new Date(`${parsed.data.dateTo}T23:59:59.999Z`);
    const { logId } = await startExtractionBackground(
      dateFrom,
      dateTo,
      "manual",
    );
    revalidateAfterSync();
    return { status: "started", logId };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}

// ── DSers (COGS) ─────────────────────────────────────────────────────────────

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
    revalidateAfterSync();
    return { status: "started", logId };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}

// ── Mercado Pago ─────────────────────────────────────────────────────────────

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
    revalidateAfterSync();
    return { status: "started", logId };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}

// ── Meta Ads ─────────────────────────────────────────────────────────────────

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
    revalidateAfterSync();
    return { status: "ok", result };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}
