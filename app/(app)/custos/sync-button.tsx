"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { syncCogsAction, type SyncCogsState } from "./actions";

const initial: SyncCogsState = { status: "idle" };

type Props = { month: string };

export function SyncCogsButton({ month }: Props) {
  const [state, formAction, pending] = useActionState(syncCogsAction, initial);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="month" value={month} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-md bg-action-primary px-3.5 py-2 text-sm font-medium text-fg-on-dark transition-colors hover:bg-action-primary-hover disabled:opacity-60"
      >
        <RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} strokeWidth={2.25} />
        {pending ? "Iniciando…" : "Sincronizar custos"}
      </button>
      {state.status === "started" ? (
        <span className="text-[11px] text-status-info">
          ✓ Sincronização #{state.logId} rodando em background
        </span>
      ) : null}
      {state.status === "error" ? (
        <span className="max-w-[280px] text-right text-[11px] text-status-error">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
