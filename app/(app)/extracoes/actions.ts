"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runExtraction } from "@/server/etl/extract";
import { auth } from "@/auth";

const inputSchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ExtractActionState = {
  status: "idle" | "running" | "ok" | "error";
  message?: string;
  stats?: {
    ordersExtracted: number;
    ordersNew: number;
    ordersSkipped: number;
    errorsCount: number;
    durationMs: number;
  };
};

export async function extractAction(
  _prev: ExtractActionState,
  formData: FormData,
): Promise<ExtractActionState> {
  const session = await auth();
  if (!session?.user) {
    return { status: "error", message: "Não autenticado." };
  }

  const parsed = inputSchema.safeParse({
    dateFrom: formData.get("dateFrom"),
    dateTo: formData.get("dateTo"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Datas inválidas." };
  }

  try {
    const dateFrom = new Date(`${parsed.data.dateFrom}T00:00:00.000Z`);
    const dateTo = new Date(`${parsed.data.dateTo}T23:59:59.999Z`);
    const result = await runExtraction(dateFrom, dateTo, "manual");
    revalidatePath("/extracoes");
    revalidatePath("/visao-geral");
    return {
      status: "ok",
      stats: { ...result.stats, durationMs: result.durationMs },
    };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}
