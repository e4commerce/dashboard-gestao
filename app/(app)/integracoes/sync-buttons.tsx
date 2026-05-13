"use client";

import { useActionState } from "react";
import { CreditCard, Download, RefreshCw } from "lucide-react";
import {
  syncCogsAction,
  syncMetaAction,
  syncMpAction,
  type SyncCogsState,
  type SyncMetaState,
  type SyncMpState,
} from "./actions";

type Props = { month: string };

const initialCogs: SyncCogsState = { status: "idle" };
const initialMp: SyncMpState = { status: "idle" };
const initialMeta: SyncMetaState = { status: "idle" };

export function SyncCogsButton({ month }: Props) {
  const [state, formAction, pending] = useActionState(
    syncCogsAction,
    initialCogs,
  );
  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="month" value={month} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-md bg-action-primary px-3.5 py-2 text-sm font-medium text-fg-on-dark transition-colors hover:bg-action-primary-hover disabled:opacity-60"
      >
        <RefreshCw
          className={`size-3.5 ${pending ? "animate-spin" : ""}`}
          strokeWidth={2.25}
        />
        {pending ? "Iniciando…" : "Sincronizar DSers"}
      </button>
      {state.status === "started" ? (
        <span className="text-[11px] text-status-info">
          ✓ Sync #{state.logId} rodando em background
        </span>
      ) : null}
      {state.status === "error" ? (
        <span className="max-w-[280px] text-[11px] text-status-error">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function SyncMpButton({ month }: Props) {
  const [state, formAction, pending] = useActionState(
    syncMpAction,
    initialMp,
  );
  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="month" value={month} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-md border border-border-default bg-surface-card px-3.5 py-2 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-card-hover disabled:opacity-60"
      >
        <CreditCard
          className={`size-3.5 ${pending ? "animate-pulse" : ""}`}
          strokeWidth={2.25}
        />
        {pending ? "Iniciando…" : "Sincronizar Mercado Pago"}
      </button>
      {state.status === "started" ? (
        <span className="text-[11px] text-status-info">
          ✓ Sync #{state.logId} rodando em background
        </span>
      ) : null}
      {state.status === "error" ? (
        <span className="max-w-[280px] text-[11px] text-status-error">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

export function SyncMetaButton({ month }: Props) {
  const [state, formAction, pending] = useActionState(
    syncMetaAction,
    initialMeta,
  );
  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="month" value={month} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-md border border-border-default bg-surface-card px-3.5 py-2 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-card-hover disabled:opacity-60"
      >
        <Download
          className={`size-3.5 ${pending ? "animate-bounce" : ""}`}
          strokeWidth={2.25}
        />
        {pending ? "Sincronizando Meta…" : "Sincronizar Meta"}
      </button>
      {state.status === "ok" && state.result ? (
        <div className="flex flex-col gap-0.5 text-[11px]">
          <span className="text-status-success">
            ✓ {state.result.accountsProcessed} conta(s) ·{" "}
            {state.result.daysImported} dia(s) importado(s)
          </span>
          {state.result.errors.length > 0 ? (
            <span className="max-w-[280px] text-status-warning">
              ⚠ {state.result.errors[0].accountId}:{" "}
              {state.result.errors[0].message}
            </span>
          ) : null}
        </div>
      ) : null}
      {state.status === "error" ? (
        <span className="max-w-[280px] text-[11px] text-status-error">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
