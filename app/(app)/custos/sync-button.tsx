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
        {pending ? "Sincronizando…" : "Sincronizar custos"}
      </button>
      {state.status === "ok" && state.result ? (
        <div className="flex flex-col items-end gap-0.5 text-[11px]">
          <span className="text-status-success">
            ✓ {state.result.matched} confirmados no DSers
            {state.result.cleared > 0 ? ` · ${state.result.cleared} limpos` : ""}
          </span>
          {state.result.failedChunks.length > 0 ? (
            <span className="text-status-warning">
              ⚠ {state.result.failedChunks.length} dia(s) falharam — rode novamente
            </span>
          ) : null}
        </div>
      ) : null}
      {state.status === "error" ? (
        <span className="max-w-[280px] text-right text-[11px] text-status-error">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
