"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveWeightsAction, type SaveWeightsState } from "./actions";
import { WeightCell } from "./weight-cell";

const initial: SaveWeightsState = { status: "idle" };

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const PRESETS: Array<{
  id: string;
  label: string;
  weights: [number, number, number, number, number, number, number];
}> = [
  {
    id: "uniforme",
    label: "Uniforme",
    weights: [1, 1, 1, 1, 1, 1, 1],
  },
  {
    id: "fim-de-semana",
    label: "Foco fim de semana",
    weights: [0.9, 0.9, 0.9, 0.9, 1.1, 1.3, 1.2],
  },
  {
    id: "dias-uteis",
    label: "Foco dias úteis",
    weights: [1.2, 1.2, 1.2, 1.2, 1.2, 0.8, 0.5],
  },
];

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function firstWeekdayMonFirst(month: string): number {
  const [y, m] = month.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return (jsDay + 6) % 7;
}

function weekdayMonFirst(month: string, day: number): number {
  const [y, m] = month.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return (jsDay + 6) % 7;
}

function fmtBRLCompact(value: number): string {
  if (value >= 1000) return `R$ ${Math.round(value / 1000)}k`;
  return `R$ ${Math.round(value)}`;
}

function mapsEqual(
  a: Map<number, number>,
  b: Map<number, number>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    const bv = b.get(k);
    if (bv === undefined) return false;
    if (Math.abs(bv - v) > 1e-6) return false;
  }
  return true;
}

type Props = {
  month: string;
  initialWeights: Array<{ day: number; weight: number }>;
  revenueGoal: number;
};

export function DailyWeightsGrid({
  month,
  initialWeights,
  revenueGoal,
}: Props) {
  const dim = daysInMonth(month);
  const baseline = useMemo(() => {
    const map = new Map<number, number>();
    for (let d = 1; d <= dim; d++) map.set(d, 1);
    for (const w of initialWeights) map.set(w.day, w.weight);
    return map;
  }, [dim, initialWeights]);

  const [weights, setWeights] = useState<Map<number, number>>(baseline);
  const [state, formAction, pending] = useActionState(
    saveWeightsAction,
    initial,
  );

  // Sincroniza com novos defaults se mudar o mês ou após save
  useEffect(() => {
    setWeights(baseline);
  }, [baseline]);

  const sumWeights = useMemo(() => {
    let s = 0;
    for (const v of weights.values()) s += v;
    return s;
  }, [weights]);

  const avgShare = sumWeights > 0 ? 1 / dim : 0;
  const isDirty = !mapsEqual(weights, baseline);

  function setDay(day: number, value: number) {
    setWeights((prev) => {
      const next = new Map(prev);
      next.set(day, value);
      return next;
    });
  }

  function applyPreset(weeklyWeights: number[]) {
    const next = new Map<number, number>();
    for (let d = 1; d <= dim; d++) {
      const wd = weekdayMonFirst(month, d);
      next.set(d, weeklyWeights[wd]);
    }
    setWeights(next);
  }

  function buildCells() {
    const lead = firstWeekdayMonFirst(month);
    const cells: Array<{ day: number | null }> = [];
    for (let i = 0; i < lead; i++) cells.push({ day: null });
    for (let d = 1; d <= dim; d++) cells.push({ day: d });
    while (cells.length % 7 !== 0) cells.push({ day: null });
    return cells;
  }

  const cells = buildCells();

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-fg-primary">
            Distribuição diária
          </span>
          <span className="text-xs text-fg-muted">
            Pesos relativos: arraste para ajustar (0–2) ou clique no número
            para digitar valores maiores (ex: 5× para um dia de lançamento).
            Mexer um dia redistribui o R$ entre os demais.
          </span>
        </div>
        {isDirty ? (
          <span className="rounded-sm bg-status-warning/15 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-status-warning">
            Alterações não salvas
          </span>
        ) : null}
      </div>

      <input type="hidden" name="month" value={month} />
      {Array.from(weights.entries()).map(([day, weight]) => (
        <input
          key={day}
          type="hidden"
          name={`w_${day}`}
          value={weight.toFixed(3)}
        />
      ))}

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={pending}
            onClick={() => applyPreset(p.weights)}
            className="rounded-md border border-border-default bg-surface-input px-3 py-1.5 text-xs font-medium text-fg-secondary transition-colors hover:bg-surface-card-hover hover:text-fg-primary disabled:opacity-60"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-1 text-center text-[10px] font-medium uppercase tracking-wider text-fg-muted"
          >
            {label}
          </div>
        ))}

        {cells.map((cell, idx) => {
          if (cell.day === null) {
            return (
              <div
                key={`empty-${idx}`}
                className="h-[88px] rounded-md border border-dashed border-border-subtle/30"
              />
            );
          }
          const weight = weights.get(cell.day) ?? 1;
          const share = sumWeights > 0 ? weight / sumWeights : 0;
          const shareR$ = revenueGoal > 0 ? share * revenueGoal : 0;
          return (
            <WeightCell
              key={cell.day}
              day={cell.day}
              weight={weight}
              share={share}
              avgShare={avgShare}
              disabled={pending}
              onChange={(v) => setDay(cell.day!, v)}
              shareLabel={revenueGoal > 0 ? fmtBRLCompact(shareR$) : undefined}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-border-subtle pt-3 text-xs text-fg-muted">
        {sumWeights === 0 ? (
          <span className="text-status-warning">
            ⚠ Soma dos pesos = 0. Defina pelo menos um dia &gt; 0 para distribuir
            a meta.
          </span>
        ) : (
          <>
            <span>
              Soma:{" "}
              <span className="font-semibold text-fg-primary tabular-nums">
                {sumWeights.toFixed(2)}
              </span>
            </span>
            <span>
              Linha de referência (média):{" "}
              <span className="font-semibold text-fg-primary tabular-nums">
                {revenueGoal > 0
                  ? fmtBRLCompact(revenueGoal / dim)
                  : "—"}
              </span>{" "}
              por dia
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !isDirty}
          className="rounded-md bg-action-primary px-4 py-2 text-sm font-medium text-fg-on-dark transition-colors hover:bg-action-primary-hover disabled:opacity-60"
        >
          {pending ? "Salvando..." : "Salvar pesos"}
        </button>
        {state.status === "ok" && !isDirty ? (
          <span className="text-xs text-status-success">✓ Salvo</span>
        ) : null}
        {state.status === "error" ? (
          <span className="text-xs text-status-error">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
