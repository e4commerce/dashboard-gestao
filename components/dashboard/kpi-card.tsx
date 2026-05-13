import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { Kpi } from "@/lib/mock-data";
import { formatBRL, formatPercent } from "@/lib/format";

function vsTargetStyle(ratio: number): {
  bg: string;
  text: string;
  Arrow: typeof ArrowUpRight;
} {
  if (ratio >= 0.9)
    return { bg: "bg-status-success-muted", text: "text-status-success", Arrow: ArrowUpRight };
  if (ratio >= 0.7)
    return { bg: "bg-status-warning-muted", text: "text-status-warning", Arrow: ArrowDownRight };
  return { bg: "bg-status-error-muted", text: "text-status-error", Arrow: ArrowDownRight };
}

type Props = {
  kpi: Kpi;
};

export function KpiCard({ kpi }: Props) {
  if (kpi.value === null) {
    return (
      <article className="flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-fg-muted">
          {kpi.label}
        </span>
        <span className="text-3xl font-bold tracking-tight text-fg-muted">
          —
        </span>
        {kpi.placeholder ? (
          <span className="text-xs text-fg-muted">{kpi.placeholder}</span>
        ) : null}
      </article>
    );
  }

  const value =
    kpi.format === "BRL" ? formatBRL(kpi.value) : formatPercent(kpi.value, 1);

  return (
    <article className="flex flex-col gap-3">
      <span className="text-xs font-medium uppercase tracking-wider text-fg-muted">
        {kpi.label}
      </span>
      <span className="text-3xl font-bold tracking-tight text-fg-primary">
        {value}
      </span>
      {typeof kpi.vsTarget === "number" ? (() => {
        const { bg, text, Arrow } = vsTargetStyle(kpi.vsTarget);
        return (
          <span className={`inline-flex w-fit items-center gap-1 rounded-sm ${bg} px-2 py-1 text-xs font-medium ${text}`}>
            <Arrow className="size-3.5" strokeWidth={2.25} />
            {formatPercent(kpi.vsTarget * 100, 1)} da meta
          </span>
        );
      })() : typeof kpi.targetReference === "number" ? (
        <span className="text-xs text-fg-muted">
          Frente a meta de{" "}
          <span className="font-semibold text-fg-primary">
            {formatPercent(kpi.targetReference, 1)}
          </span>
        </span>
      ) : null}
      {kpi.sub ? (() => {
        const positive = kpi.sub.includes("+");
        const negative = kpi.sub.includes("-");
        const bg = positive ? "bg-status-success-muted" : negative ? "bg-status-error-muted" : "bg-surface-card";
        const text = positive ? "text-status-success" : negative ? "text-status-error" : "text-fg-muted";
        return (
          <span className={`inline-flex w-fit rounded-sm ${bg} px-2 py-1 text-xs font-medium ${text}`}>
            {kpi.sub}
          </span>
        );
      })() : null}
    </article>
  );
}
