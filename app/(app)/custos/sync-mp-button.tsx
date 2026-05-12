"use client";

import { useActionState } from "react";
import { CreditCard } from "lucide-react";
import { syncMpAction, type SyncMpState } from "./mp-actions";

const initial: SyncMpState = { status: "idle" };

type Props = { month: string };

export function SyncMpButton({ month }: Props) {
  const [state, formAction, pending] = useActionState(syncMpAction, initial);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="month" value={month} />
      <button
        type="submit"
        disabled={pending}
        title="Puxa taxas do Mercado Pago do mês"
        className="flex items-center gap-2 rounded-md border border-border-default bg-surface-card px-3.5 py-2 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-card-hover disabled:opacity-60"
      >
        <CreditCard
          className={`size-3.5 ${pending ? "animate-pulse" : ""}`}
          strokeWidth={2.25}
        />
        {pending ? "Iniciando…" : "Sincronizar MP"}
      </button>
      {state.status === "started" ? (
        <span className="text-[11px] text-status-info">
          ✓ Sync #{state.logId} rodando em background
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
