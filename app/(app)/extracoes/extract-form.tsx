"use client";

import { useActionState } from "react";
import { extractAction, type ExtractActionState } from "./actions";

const initialState: ExtractActionState = { status: "idle" };

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoUTC(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function ExtractForm() {
  const [state, formAction, pending] = useActionState(extractAction, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-6"
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-fg-primary">Extrair Agora</span>
        <span className="text-xs text-fg-muted">
          Importa pedidos do Shopify no intervalo selecionado.
          {" "}A extração roda em background — pode sair da página sem interromper.
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-secondary">De</span>
          <input
            type="date"
            name="dateFrom"
            defaultValue={daysAgoUTC(7)}
            required
            className="rounded-md border border-border-default bg-surface-input px-3 py-2 text-sm text-fg-primary outline-none focus:border-action-primary"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-secondary">Até</span>
          <input
            type="date"
            name="dateTo"
            defaultValue={todayUTC()}
            required
            className="rounded-md border border-border-default bg-surface-input px-3 py-2 text-sm text-fg-primary outline-none focus:border-action-primary"
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-action-primary px-4 py-2 text-sm font-medium text-fg-on-dark transition-colors hover:bg-action-primary-hover disabled:opacity-60"
        >
          {pending ? "Iniciando…" : "Extrair"}
        </button>
      </div>

      {state.status === "started" ? (
        <div className="rounded-md bg-status-info/10 px-3 py-2 text-xs text-status-info">
          ✓ Extração #{state.logId} iniciada. Acompanhe o status na tabela abaixo —
          ela atualiza automaticamente.
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
