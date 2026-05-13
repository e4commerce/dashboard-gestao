"use client";

import { useState } from "react";
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

type Mode = "profit" | "revenue";

type Props = {
  revenueData: ChartPoint[];
  profitData: ChartPoint[];
};

const COLOR_PROFIT = "#818cf8";   // indigo-400
const COLOR_REVENUE = "#4CAF50";  // green
const COLOR_META = "#FFB74D";     // orange
const COLOR_GRID = "rgba(255, 255, 255, 0.06)";
const COLOR_AXIS = "#8B8B8B";

const MODE_CONFIG = {
  profit: {
    color: COLOR_PROFIT,
    gradientId: "profitFade",
    realizadoLabel: "Lucro op.",
    metaLabel: "Meta lucro",
    title: "Lucro Operacional vs. Meta",
  },
  revenue: {
    color: COLOR_REVENUE,
    gradientId: "revenueFade",
    realizadoLabel: "Faturamento",
    metaLabel: "Meta faturamento",
    title: "Faturamento vs. Meta",
  },
} as const;

export function RevenueChart({ revenueData, profitData }: Props) {
  const [mode, setMode] = useState<Mode>("profit");
  const cfg = MODE_CONFIG[mode];
  const data = mode === "profit" ? profitData : revenueData;

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-5 text-xs text-fg-muted">
          <LegendDot color={COLOR_META} label={cfg.metaLabel} dashed />
          <LegendDot color={cfg.color} label={cfg.realizadoLabel} />
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>
      <div className="h-60 w-full sm:h-80 md:h-[486px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="profitFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR_PROFIT} stopOpacity={0.32} />
                <stop offset="60%" stopColor={COLOR_PROFIT} stopOpacity={0.08} />
                <stop offset="100%" stopColor={COLOR_PROFIT} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="revenueFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR_REVENUE} stopOpacity={0.32} />
                <stop offset="60%" stopColor={COLOR_REVENUE} stopOpacity={0.08} />
                <stop offset="100%" stopColor={COLOR_REVENUE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={COLOR_GRID} strokeDasharray="0" />
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
              content={<CustomTooltip mode={mode} />}
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
              key={mode}
              type="monotone"
              dataKey="realizado"
              stroke={cfg.color}
              strokeWidth={2.5}
              fill={`url(#${cfg.gradientId})`}
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

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex rounded-md border border-border-default bg-surface-input p-0.5 text-xs">
      <ToggleBtn active={mode === "profit"} onClick={() => onChange("profit")}>
        Lucro
      </ToggleBtn>
      <ToggleBtn active={mode === "revenue"} onClick={() => onChange("revenue")}>
        Faturamento
      </ToggleBtn>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "rounded px-3 py-1 font-medium text-fg-primary bg-surface-card shadow-sm"
          : "rounded px-3 py-1 text-fg-muted hover:text-fg-primary transition-colors"
      }
    >
      {children}
    </button>
  );
}

type TooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ payload: ChartPoint }>;
  mode: Mode;
};

function CustomTooltip({ active, label, payload, mode }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  if (!point) return null;
  const cfg = MODE_CONFIG[mode];

  return (
    <div className="rounded-lg border border-border-default bg-surface-elevated px-3 py-2.5 text-xs shadow-md">
      <div className="mb-2 text-[11px] font-medium text-fg-muted">
        {formatDateLabel(typeof label === "string" ? label : point.date)}
      </div>

      <div className="mb-1.5 flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-fg-muted">Acumulado</span>
        <Row color={COLOR_META} label={cfg.metaLabel} value={formatBRL(point.meta)} />
        <Row
          color={cfg.color}
          label={cfg.realizadoLabel}
          value={point.realizado === null ? "—" : formatBRL(point.realizado)}
        />
      </div>

      <div className="mt-2 border-t border-border-subtle pt-2 flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-fg-muted">No dia</span>
        <Row color={COLOR_META} label={cfg.metaLabel} value={formatBRL(point.metaDia)} dimmed />
        <Row
          color={cfg.color}
          label={cfg.realizadoLabel}
          value={point.realizadoDia === null ? "—" : formatBRL(point.realizadoDia)}
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
        <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className={`font-semibold tabular-nums ${dimmed ? "text-fg-secondary" : "text-fg-primary"}`}>
        {value}
      </span>
    </div>
  );
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      {dashed ? (
        <span
          aria-hidden
          className="inline-block h-px w-4"
          style={{
            backgroundImage: `repeating-linear-gradient(to right, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)`,
          }}
        />
      ) : (
        <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
    </span>
  );
}
