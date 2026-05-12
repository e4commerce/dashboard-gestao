"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  discoverMetaAccounts,
  setMetaAccountEnabled,
  type DiscoverResult,
} from "@/server/meta/sync";

export type DiscoverState = {
  status: "idle" | "ok" | "error";
  message?: string;
  result?: DiscoverResult;
};

export async function discoverAccountsAction(
  _prev: DiscoverState,
  _formData: FormData,
): Promise<DiscoverState> {
  const session = await auth();
  if (!session?.user) return { status: "error", message: "Não autenticado." };

  try {
    const result = await discoverMetaAccounts();
    revalidatePath("/marketing/contas");
    return { status: "ok", result };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Erro desconhecido.",
    };
  }
}

export async function toggleAccountAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  const id = formData.get("id") as string;
  const enabled = formData.get("enabled") === "1";
  if (!id) return;
  await setMetaAccountEnabled(id, enabled);
  revalidatePath("/marketing/contas");
  revalidatePath("/marketing");
}
