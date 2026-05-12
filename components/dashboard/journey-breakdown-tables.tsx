"use client";

import type { JourneyByChannel, JourneyByOrderIndex } from "@/server/queries/journey";
import { formatBRL } from "@/lib/format";

// ─── Tabela por canal ──────────────────────────────────────────────────────────

function DaysBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-input">
        <div className="h-full rounded-full bg-[#7E8CF7]" style={{ width: `${pct}%` }} />
      </div>
      <span className="min-w-[36px] tabular-nums text-right text-fg-primary">
        {value === 0 ? "—" : value < 1 ? "< 1d" : `${value}d`}
      </span>
    </div>
  );
}

type ChannelProps = { data: JourneyByChannel[] };

export function JourneyChannelTable({ data }: ChannelProps) {
  if (data.length === 0) {
    return (
      <section className="rounded-lg border border-border-default bg-surface-card p-6">
        <h3 className="text-sm font-semibold text-fg-primary">Jornada por canal de origem</h3>
        <p className="mt-2 text-xs text-fg-muted">Sem dados de canal para o período.</p>
      </section>
    );
  }

  const maxDays = Math.max(...data.map((r) => r.avgDays));

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-6">
      <div>
        <h3 className="text-sm font-semibold text-fg-primary">Jornada por canal de origem</h3>
        <p className="text-xs text-fg-muted">Canal da primeira visita antes da compra</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-subtle text-left">
              <th className="pb-2 pr-4 font-medium text-fg-muted">Canal</th>
              <th className="pb-2 pr-4 text-right font-medium text-fg-muted">Pedidos</th>
              <th className="pb-2 pr-4 text-right font-medium text-fg-muted">Participação</th>
              <th className="pb-2 pr-4 font-medium text-fg-muted">Jornada média</th>
              <th className="pb-2 text-right font-medium text-fg-muted">Ticket médio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {data.map((row) => (
              <tr key={row.channel} className="group">
                <td className="py-2.5 pr-4 font-medium text-fg-primary">{row.channel}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-fg-secondary">
                  {row.orderCount.toLocaleString("pt-BR")}
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-input">
                      <div
                        className="h-full rounded-full bg-[#4CAF50]/70"
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span className="min-w-[36px] text-right tabular-nums text-fg-muted">
                      {row.pct.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="py-2.5 pr-4">
                  <DaysBar value={row.avgDays} max={maxDays} />
                </td>
                <td className="py-2.5 text-right tabular-nums font-medium text-fg-primary">
                  {row.avgTicket > 0 ? formatBRL(row.avgTicket, 2) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Tabela por índice de compra ───────────────────────────────────────────────

type IndexProps = { data: JourneyByOrderIndex[] };

export function JourneyOrderIndexTable({ data }: IndexProps) {
  if (data.length === 0) {
    return (
      <section className="rounded-lg border border-border-default bg-surface-card p-6">
        <h3 className="text-sm font-semibold text-fg-primary">Jornada por momento de compra</h3>
        <p className="mt-2 text-xs text-fg-muted">Sem dados para o período.</p>
      </section>
    );
  }

  const maxDays = Math.max(...data.map((r) => r.avgDays));

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-6">
      <div>
        <h3 className="text-sm font-semibold text-fg-primary">Jornada por momento de compra</h3>
        <p className="text-xs text-fg-muted">
          Clientes novos vs. recorrentes — jornada e ticket comparados
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-subtle text-left">
              <th className="pb-2 pr-4 font-medium text-fg-muted">Momento</th>
              <th className="pb-2 pr-4 text-right font-medium text-fg-muted">Pedidos</th>
              <th className="pb-2 pr-4 text-right font-medium text-fg-muted">%</th>
              <th className="pb-2 pr-4 font-medium text-fg-muted">Jornada média</th>
              <th className="pb-2 text-right font-medium text-fg-muted">Ticket médio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {data.map((row) => (
              <tr key={row.label}>
                <td className="py-2.5 pr-4 font-medium text-fg-primary">{row.label}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-fg-secondary">
                  {row.orderCount.toLocaleString("pt-BR")}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-fg-muted">
                  {row.pct.toFixed(1)}%
                </td>
                <td className="py-2.5 pr-4">
                  <DaysBar value={row.avgDays} max={maxDays} />
                </td>
                <td className="py-2.5 text-right tabular-nums font-medium text-fg-primary">
                  {row.avgTicket > 0 ? formatBRL(row.avgTicket, 2) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
