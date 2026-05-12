"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartPoint } from "@/lib/mock-data";
import { formatBRL, formatCompactBRL, formatDateLabel } from "@/lib/format";

type Props = {
  data: ChartPoint[];
};

const COLOR_REALIZADO = "#4CAF50";
const COLOR_META = "#FFB74D";
const COLOR_GRID = "rgba(255, 255, 255, 0.06)";
const COLOR_AXIS = "#8B8B8B";
const GRADIENT_ID = "realizadoFade";

export function RevenueChart({ data }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between">
        <h2 className="text-base font-semibold text-fg-primary">
          Realizado vs. Previsto
        </h2>
        <div className="flex items-center gap-5 text-xs text-fg-muted">
          <LegendDot color={COLOR_META} label="Meta Planejada" />
          <LegendDot color={COLOR_REALIZADO} label="Realizado Acumulado" />
        </div>
      </div>
      <div className="h-[486px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id={GRADIENT_ID}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={COLOR_REALIZADO}
                  stopOpacity={0.32}
                />
                <stop
                  offset="60%"
                  stopColor={COLOR_REALIZADO}
                  stopOpacity={0.08}
                />
                <stop
                  offset="100%"
                  stopColor={COLOR_REALIZADO}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke={COLOR_GRID}
              strokeDasharray="0"
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fill: COLOR_AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={1}
              minTickGap={16}
            />
            <YAxis
              tickFormatter={formatCompactBRL}
              tick={{ fill: COLOR_AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip
              cursor={{ stroke: COLOR_GRID, strokeWidth: 1 }}
              content={<CustomTooltip />}
            />
            <Line
              type="monotone"
              dataKey="meta"
              stroke={COLOR_META}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive
              animationDuration={900}
            />
            <Area
              type="monotone"
              dataKey="realizado"
              stroke={COLOR_REALIZADO}
              strokeWidth={2.5}
              fill={`url(#${GRADIENT_ID})`}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive
              animationDuration={1100}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

type TooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ payload: ChartPoint }>;
};

function CustomTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-elevated px-3 py-2.5 text-xs shadow-md">
      <div className="mb-2 text-[11px] font-medium text-fg-muted">
        {formatDateLabel(typeof label === "string" ? label : point.date)}
      </div>

      <div className="mb-1.5 flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-fg-muted">
          Acumulado
        </span>
        <Row
          color={COLOR_META}
          label="Meta"
          value={formatBRL(point.meta)}
        />
        <Row
          color={COLOR_REALIZADO}
          label="Realizado"
          value={point.realizado === null ? "—" : formatBRL(point.realizado)}
        />
      </div>

      <div className="mt-2 border-t border-border-subtle pt-2 flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-fg-muted">
          No dia
        </span>
        <Row
          color={COLOR_META}
          label="Meta"
          value={formatBRL(point.metaDia)}
          dimmed
        />
        <Row
          color={COLOR_REALIZADO}
          label="Realizado"
          value={
            point.realizadoDia === null ? "—" : formatBRL(point.realizadoDia)
          }
          dimmed
        />
      </div>
    </div>
  );
}

function Row({
  color,
  label,
  value,
  dimmed = false,
}: {
  color: string;
  label: string;
  value: string;
  dimmed?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-2 text-fg-secondary">
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        {label}
      </span>
      <span
        className={`font-semibold tabular-nums ${
          dimmed ? "text-fg-secondary" : "text-fg-primary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
