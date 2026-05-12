"use client";

import { useActionState, useMemo, useState } from "react";
import { saveMonthlyGoalAction, type SaveMonthlyGoalState } from "./actions";

const initial: SaveMonthlyGoalState = { status: "idle" };

type Props = {
  month: string;
  revenueGoal: number;
  grossProfitGoal: number;
};

function fmtBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function MonthlyGoalForm({ month, revenueGoal, grossProfitGoal }: Props) {
  const [revenue, setRevenue] = useState(revenueGoal);
  const [gross, setGross] = useState(grossProfitGoal);
  const [state, formAction, pending] = useActionState(
    saveMonthlyGoalAction,
    initial,
  );

  const grossPct = useMemo(() => {
    if (revenue <= 0) return null;
    return (gross / revenue) * 100;
  }, [revenue, gross]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-6"
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-fg-primary">
          Meta mensal
        </span>
        <span className="text-xs text-fg-muted">
          Defina os totais do mês. O sistema distribui pela curva de pesos
          diários abaixo.
        </span>
      </div>

      <input type="hidden" name="month" value={month} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-secondary">
            Faturamento (R$)
          </span>
          <input
            name="revenueGoal"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={revenue}
            onChange={(e) => setRevenue(Number(e.target.value) || 0)}
            className="rounded-md border border-border-default bg-surface-input px-3 py-2 text-sm text-fg-primary tabular-nums outline-none focus:border-action-primary"
          />
          <span className="text-xs text-fg-muted">{fmtBRL(revenue)}</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-secondary">
            Lucro Bruto (R$)
          </span>
          <input
            name="grossProfitGoal"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={gross}
            onChange={(e) => setGross(Number(e.target.value) || 0)}
            className="rounded-md border border-border-default bg-surface-input px-3 py-2 text-sm text-fg-primary tabular-nums outline-none focus:border-action-primary"
          />
          <span className="text-xs text-fg-muted">
            {fmtBRL(gross)}{" "}
            {grossPct !== null ? (
              <span className="text-fg-secondary">
                ({grossPct.toFixed(1)}% do faturamento)
              </span>
            ) : null}
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-action-primary px-4 py-2 text-sm font-medium text-fg-on-dark transition-colors hover:bg-action-primary-hover disabled:opacity-60"
        >
          {pending ? "Salvando..." : "Salvar metas"}
        </button>
        {state.status === "ok" ? (
          <span className="text-xs text-status-success">✓ Salvo</span>
        ) : null}
        {state.status === "error" ? (
          <span className="text-xs text-status-error">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
