import { ArrowUpRight } from "lucide-react";
import type { Kpi } from "@/lib/mock-data";
import { formatBRL, formatPercent } from "@/lib/format";

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
      {typeof kpi.vsTarget === "number" ? (
        <span className="inline-flex w-fit items-center gap-1 rounded-sm bg-status-success-muted px-2 py-1 text-xs font-medium text-status-success">
          <ArrowUpRight className="size-3.5" strokeWidth={2.25} />
          {formatPercent(kpi.vsTarget * 100, 1)} da meta
        </span>
      ) : typeof kpi.targetReference === "number" ? (
        <span className="text-xs text-fg-muted">
          Frente a meta de{" "}
          <span className="font-semibold text-fg-primary">
            {formatPercent(kpi.targetReference, 1)}
          </span>
        </span>
      ) : null}
    </article>
  );
}
