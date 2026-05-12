"use client";

import { useState } from "react";
import { ArrowUpRight, ArrowDownRight, ChevronRight } from "lucide-react";
import type { Metric } from "@/lib/mock-data";
import { formatDelta } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MetricChartModal } from "./metric-chart-modal";

type Props = {
  metric: Metric;
};

export function MetricRow({ metric }: Props) {
  const [open, setOpen] = useState(false);
  const hasChart = Boolean(metric.chartData?.length);

  if (metric.value === null) {
    return (
      <div className="flex items-center justify-between py-3 text-sm">
        <span className="text-fg-secondary">{metric.label}</span>
        <span className="text-fg-muted">—</span>
      </div>
    );
  }

  const isPositive = (metric.delta ?? 0) >= 0;
  const Arrow = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between py-3 text-sm -mx-1 px-1 rounded-sm",
          hasChart &&
            "cursor-pointer transition-colors hover:bg-surface-card-hover",
        )}
        onClick={hasChart ? () => setOpen(true) : undefined}
        role={hasChart ? "button" : undefined}
        tabIndex={hasChart ? 0 : undefined}
        onKeyDown={
          hasChart
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setOpen(true);
                  e.preventDefault();
                }
              }
            : undefined
        }
        aria-label={
          hasChart ? `Ver histórico de ${metric.label}` : undefined
        }
      >
        <span className="text-fg-secondary">{metric.label}</span>
        <div className="flex items-center gap-3">
          <span className="font-medium text-fg-primary">{metric.value}</span>
          {typeof metric.delta === "number" ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                isPositive ? "text-status-success" : "text-status-warning",
              )}
            >
              <Arrow className="size-3" strokeWidth={2.5} />
              {formatDelta(metric.delta)}
            </span>
          ) : null}
          {hasChart ? (
            <ChevronRight className="size-3.5 text-fg-muted" />
          ) : null}
        </div>
      </div>

      {open && metric.chartData && metric.chartType && metric.chartFormat ? (
        <MetricChartModal
          title={metric.label}
          data={metric.chartData}
          chartType={metric.chartType}
          format={metric.chartFormat}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
