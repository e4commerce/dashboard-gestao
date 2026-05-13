"use client";

import { useActionState } from "react";
import { extractAction, type ExtractActionState } from "./actions";

const initialState: ExtractActionState = { status: "idle" };
const SP_TZ = "America/Sao_Paulo";

function isoDateSP(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function todaySP(): string {
  return isoDateSP(new Date());
}

function daysAgoSP(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return isoDateSP(d);
}

export function ExtractForm() {
  const [state, formAction, pending] = useActionState(
    extractAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-secondary">De</span>
          <input
            type="date"
            name="dateFrom"
            defaultValue={daysAgoSP(7)}
            required
            className="rounded-md border border-border-default bg-surface-input px-3 py-2 text-sm text-fg-primary outline-none focus:border-action-primary"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-secondary">Até</span>
          <input
            type="date"
            name="dateTo"
            defaultValue={todaySP()}
            required
            className="rounded-md border border-border-default bg-surface-input px-3 py-2 text-sm text-fg-primary outline-none focus:border-action-primary"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-action-primary px-4 py-2 text-sm font-medium text-fg-on-dark transition-colors hover:bg-action-primary-hover disabled:opacity-60"
        >
          {pending ? "Iniciando…" : "Extrair pedidos"}
        </button>
      </div>

      {state.status === "started" ? (
        <div className="rounded-md bg-status-info/10 px-3 py-2 text-xs text-status-info">
          ✓ Extração #{state.logId} iniciada em background. A tabela atualiza
          sozinha quando concluir.
        </div>
      ) : null}

      {state.status === "error" && state.message ? (
        <div className="rounded-md bg-status-error/10 px-3 py-2 text-xs text-status-error">
          {state.message}
        </div>
      ) : null}
    </form>
  );
}
