"use client";

import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyJourneyPoint } from "@/server/queries/journey";
import { formatDateLabel } from "@/lib/format";

const COLOR = "#7E8CF7";
const COLOR_GRID = "rgba(255, 255, 255, 0.06)";
const COLOR_AXIS = "#8B8B8B";
const GRADIENT_ID = "journeyGrad";

type Props = { data: DailyJourneyPoint[] };

type TooltipProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload: DailyJourneyPoint }>;
};

function CustomTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  if (p.orderCount === 0) return null;
  return (
    <div className="rounded-lg border border-border-default bg-surface-elevated px-3 py-2.5 text-xs shadow-md">
      <p className="mb-1.5 text-[11px] font-medium text-fg-muted">
        {typeof label === "string" ? label : ""}
      </p>
      <div className="flex items-center gap-2">
        <span className="size-1.5 rounded-full" style={{ backgroundColor: COLOR }} />
        <span className="text-fg-secondary">Média</span>
        <span className="font-semibold tabular-nums text-fg-primary">
          {p.avgDays === 1 ? "1 dia" : `${p.avgDays} dias`}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-fg-muted">{p.orderCount} pedido{p.orderCount !== 1 ? "s" : ""} com jornada</p>
    </div>
  );
}

export function JourneyTrendChart({ data }: Props) {
  const chartData = data.map((p) => ({
    date: formatDateLabel(p.date),
    avgDays: p.orderCount > 0 ? p.avgDays : null,
    orderCount: p.orderCount,
  }));

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-6">
      <div>
        <h3 className="text-sm font-semibold text-fg-primary">Tempo médio de jornada por dia</h3>
        <p className="text-xs text-fg-muted">Dias entre a primeira visita e a compra</p>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR} stopOpacity={0.28} />
                <stop offset="100%" stopColor={COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={COLOR_GRID} />
            <XAxis
              dataKey="date"
              tick={{ fill: COLOR_AXIS, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={1}
              minTickGap={20}
            />
            <YAxis
              tick={{ fill: COLOR_AXIS, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}d`}
              width={28}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: COLOR_GRID, strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="avgDays"
              stroke={COLOR}
              strokeWidth={2}
              fill={`url(#${GRADIENT_ID})`}
              dot={false}
              activeDot={{ r: 4, fill: COLOR }}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
