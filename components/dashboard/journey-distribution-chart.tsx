"use client";

import {
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
} from "recharts";
import type { JourneyBucket } from "@/server/queries/journey";
import { formatBRL } from "@/lib/format";

const COLOR_GRID = "rgba(255, 255, 255, 0.06)";
const COLOR_AXIS = "#8B8B8B";
const COLOR_TICKET = "#FFB74D";

const BUCKET_COLORS: Record<string, string> = {
  same_day:  "#4CAF50",
  d1_3:      "#7E8CF7",
  d4_7:      "#64B5F6",
  d8_30:     "#FFB74D",
  d30_plus:  "#EF5350",
};

type Props = { data: JourneyBucket[] };

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; payload: JourneyBucket }>;
};

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-default bg-surface-elevated px-3 py-2.5 text-xs shadow-md">
      <p className="mb-2 font-semibold text-fg-primary">{b.label}</p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-fg-secondary">Pedidos</span>
          <span className="tabular-nums font-medium text-fg-primary">
            {b.count.toLocaleString("pt-BR")}
            <span className="ml-1.5 text-fg-muted">({b.pct.toFixed(1)}%)</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-fg-secondary">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: COLOR_TICKET }} />
            Ticket médio
          </span>
          <span className="tabular-nums font-medium text-fg-primary">
            {b.avgTicket > 0 ? formatBRL(b.avgTicket, 2) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function JourneyDistributionChart({ data }: Props) {
  const total = data.reduce((s, b) => s + b.count, 0);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-fg-primary">Distribuição por faixa de jornada</h3>
          <p className="text-xs text-fg-muted">
            {total > 0 ? `${total.toLocaleString("pt-BR")} pedidos com jornada registrada` : "Sem dados"}
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-fg-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-[#7E8CF7]" />
            Pedidos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: COLOR_TICKET }} />
            Ticket médio
          </span>
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 52, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={COLOR_GRID} />
            <XAxis
              dataKey="label"
              tick={{ fill: COLOR_AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            {/* Eixo esquerdo: pedidos */}
            <YAxis
              yAxisId="left"
              tick={{ fill: COLOR_AXIS, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={32}
              allowDecimals={false}
            />
            {/* Eixo direito: ticket médio em R$ */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: COLOR_AXIS, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => v >= 1000 ? `R$${Math.round(v / 1000)}k` : `R$${v}`}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar yAxisId="left" dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={52}>
              {data.map((b) => (
                <Cell key={b.key} fill={BUCKET_COLORS[b.key]} />
              ))}
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgTicket"
              stroke={COLOR_TICKET}
              strokeWidth={2}
              dot={{ r: 4, fill: COLOR_TICKET, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
