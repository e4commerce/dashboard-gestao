"use client";

import { useActionState } from "react";
import { Download } from "lucide-react";
import { syncMetaAction, type SyncMetaState } from "./actions";

const initial: SyncMetaState = { status: "idle" };

type Props = { month: string };

export function SyncMetaButton({ month }: Props) {
  const [state, formAction, pending] = useActionState(syncMetaAction, initial);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="month" value={month} />
      <button
        type="submit"
        disabled={pending}
        title="Puxa insights do Meta Ads do mês selecionado"
        className="flex items-center gap-2 rounded-md border border-border-default bg-surface-card px-3.5 py-2 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-card-hover disabled:opacity-60"
      >
        <Download className={`size-3.5 ${pending ? "animate-bounce" : ""}`} strokeWidth={2.25} />
        {pending ? "Sincronizando Meta…" : "Sincronizar Meta"}
      </button>
      {state.status === "ok" && state.result ? (
        <div className="flex flex-col items-end gap-0.5 text-[11px]">
          <span className="text-status-success">
            ✓ {state.result.accountsProcessed} conta(s) · {state.result.daysImported} dia(s) importado(s)
          </span>
          {state.result.errors.length > 0 ? (
            <span className="max-w-[280px] text-right text-status-warning">
              ⚠ {state.result.errors[0].accountId}: {state.result.errors[0].message}
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
