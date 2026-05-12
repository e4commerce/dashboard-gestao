"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MetricDataPoint } from "@/lib/mock-data";
import { formatBRL, formatDateLabel } from "@/lib/format";

const COLOR_LINE = "#4CAF50";
const COLOR_GRID = "rgba(255, 255, 255, 0.06)";
const COLOR_AXIS = "#8B8B8B";
const GRADIENT_ID = "metricModalGrad";

type Props = {
  title: string;
  data: MetricDataPoint[];
  chartType: "bar" | "area";
  format: "number" | "BRL";
  onClose: () => void;
};

function fmtValue(v: number | null | undefined, format: "number" | "BRL"): string {
  if (v == null) return "—";
  if (format === "BRL") return formatBRL(v, 2);
  return v.toLocaleString("pt-BR");
}

function fmtAxis(v: number, format: "number" | "BRL"): string {
  if (format === "BRL") {
    if (v >= 1000) return `R$${Math.round(v / 1000)}k`;
    return `R$${v}`;
  }
  return String(v);
}

function monthLabel(data: MetricDataPoint[]): string {
  if (!data.length) return "";
  const [y, m] = data[0].date.split("-").map(Number);
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[m - 1]} ${y}`;
}

type TooltipInnerProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{ value: number | null }>;
  format: "number" | "BRL";
};

function ChartTooltip({ active, label, payload, format }: TooltipInnerProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border-default bg-surface-elevated px-3 py-2 text-xs shadow-md">
      <p className="mb-1 text-[11px] text-fg-muted">{label}</p>
      <p className="font-semibold tabular-nums text-fg-primary">
        {fmtValue(payload[0].value, format)}
      </p>
    </div>
  );
}

export function MetricChartModal({ title, data, chartType, format, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const chartData = data.map((p) => ({
    date: formatDateLabel(p.date),
    value: p.value,
  }));

  const tickInterval = Math.max(0, Math.ceil(chartData.length / 7) - 1);
  const yWidth = format === "BRL" ? 56 : 32;

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="relative mx-4 w-full max-w-xl rounded-xl border border-border-default bg-surface-card p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-fg-primary">{title}</h3>
            <p className="text-xs text-fg-muted">{monthLabel(data)}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-input hover:text-fg-primary"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke={COLOR_GRID} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: COLOR_AXIS, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={tickInterval}
                />
                <YAxis
                  tick={{ fill: COLOR_AXIS, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => fmtAxis(v, format)}
                  width={yWidth}
                  allowDecimals={false}
                />
                <Tooltip
                  content={<ChartTooltip format={format} />}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                />
                <Bar
                  dataKey="value"
                  fill={COLOR_LINE}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            ) : (
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLOR_LINE} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={COLOR_LINE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={COLOR_GRID} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: COLOR_AXIS, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={tickInterval}
                />
                <YAxis
                  tick={{ fill: COLOR_AXIS, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => fmtAxis(v, format)}
                  width={yWidth}
                />
                <Tooltip
                  content={<ChartTooltip format={format} />}
                  cursor={{ stroke: COLOR_GRID, strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={COLOR_LINE}
                  strokeWidth={2}
                  fill={`url(#${GRADIENT_ID})`}
                  dot={false}
                  activeDot={{ r: 4, fill: COLOR_LINE }}
                  connectNulls={false}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
