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
import type { YearlyChartPoint } from "@/server/queries/planning";
import { formatBRL, formatCompactBRL, formatPercent } from "@/lib/format";

type Mode = "profit" | "revenue";

const COLOR_PROFIT  = "#818cf8";
const COLOR_REVENUE = "#4CAF50";
const COLOR_META    = "#FFB74D";
const COLOR_GRID    = "rgba(255,255,255,0.06)";
const COLOR_AXIS    = "#8B8B8B";

const MODE_CFG = {
  profit:  { color: COLOR_PROFIT,  realKey: "grossProfitReal",  goalKey: "grossProfitGoal", realLabel: "Lucro op.", goalLabel: "Meta lucro" },
  revenue: { color: COLOR_REVENUE, realKey: "revenueReal",      goalKey: "revenueGoal",     realLabel: "Faturamento", goalLabel: "Meta fat." },
} as const;

type Props = { data: YearlyChartPoint[] };

export function YearlyChart({ data }: Props) {
  const [mode, setMode] = useState<Mode>("profit");
  const cfg = MODE_CFG[mode];

  const totalGoal = data.reduce((s, p) => s + (p[cfg.goalKey] as number), 0);
  const totalReal = data.reduce((s, p) => {
    const v = p[cfg.realKey as keyof YearlyChartPoint];
    return typeof v === "number" ? s + v : s;
  }, 0);
  const pct = totalGoal > 0 ? (totalReal / totalGoal) * 100 : null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-fg-primary">
            Desempenho anual · {data[0]?.month.slice(0, 4)}
          </h3>
          {pct !== null && (
            <p className="text-xs text-fg-muted">
              {cfg.realLabel}{" "}
              <span className="font-medium text-fg-secondary">{formatBRL(totalReal)}</span>
              {" · "}
              <span
                className={
                  pct >= 90
                    ? "font-medium text-status-success"
                    : pct >= 70
                      ? "font-medium text-status-warning"
                      : "font-medium text-status-error"
                }
              >
                {formatPercent(pct, 1)} da meta
              </span>
            </p>
          )}
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      <div className="flex items-center gap-5 text-xs text-fg-muted">
        <LegendDot color={COLOR_META}  label={cfg.goalLabel}  dashed />
        <LegendDot color={cfg.color}   label={cfg.realLabel} />
      </div>

      <div className="h-56 w-full sm:h-72 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="yearlyProfitFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={COLOR_PROFIT}  stopOpacity={0.32} />
                <stop offset="60%"  stopColor={COLOR_PROFIT}  stopOpacity={0.08} />
                <stop offset="100%" stopColor={COLOR_PROFIT}  stopOpacity={0} />
              </linearGradient>
              <linearGradient id="yearlyRevenueFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={COLOR_REVENUE} stopOpacity={0.32} />
                <stop offset="60%"  stopColor={COLOR_REVENUE} stopOpacity={0.08} />
                <stop offset="100%" stopColor={COLOR_REVENUE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={COLOR_GRID} />
            <XAxis
              dataKey="label"
              tick={{ fill: COLOR_AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={0}
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
              dataKey={cfg.goalKey}
              stroke={COLOR_META}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Area
              key={mode}
              type="monotone"
              dataKey={cfg.realKey}
              stroke={cfg.color}
              strokeWidth={2.5}
              fill={`url(#${mode === "profit" ? "yearlyProfitFade" : "yearlyRevenueFade"})`}
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
    <div className="flex shrink-0 rounded-md border border-border-default bg-surface-input p-0.5 text-xs">
      <Btn active={mode === "profit"}   onClick={() => onChange("profit")}>Lucro</Btn>
      <Btn active={mode === "revenue"}  onClick={() => onChange("revenue")}>Faturamento</Btn>
    </div>
  );
}

function Btn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
  label?: string;
  payload?: Array<{ payload: YearlyChartPoint; value: number | null; dataKey: string }>;
  mode: Mode;
};

function CustomTooltip({ active, label, payload, mode }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const cfg = MODE_CFG[mode];
  const real = point[cfg.realKey as keyof YearlyChartPoint] as number | null;
  const goal = point[cfg.goalKey as keyof YearlyChartPoint] as number;
  const pct  = goal > 0 && real !== null ? (real / goal) * 100 : null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-elevated px-3 py-2.5 text-xs shadow-md">
      <div className="mb-2 font-medium text-fg-muted">{label} · {point.month.slice(0, 4)}</div>
      <div className="flex flex-col gap-1">
        <Row color={COLOR_META}  label={cfg.goalLabel}  value={formatBRL(goal)} />
        <Row color={cfg.color}   label={cfg.realLabel}  value={real !== null ? formatBRL(real) : "—"} />
        {pct !== null && (
          <div className="mt-1 border-t border-border-subtle pt-1 text-fg-muted">
            {formatPercent(pct, 1)} da meta
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-2 text-fg-secondary">
        <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="font-semibold tabular-nums text-fg-primary">{value}</span>
    </div>
  );
}

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      {dashed ? (
        <span
          className="inline-block h-px w-4"
          style={{ backgroundImage: `repeating-linear-gradient(to right,${color} 0,${color} 4px,transparent 4px,transparent 8px)` }}
        />
      ) : (
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
    </span>
  );
}
