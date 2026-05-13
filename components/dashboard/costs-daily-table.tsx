"use client";

import type { DailyCostPoint } from "@/server/queries/costs";
import { formatBRL, formatDateLabel, formatPercent } from "@/lib/format";

type Props = { data: DailyCostPoint[] };

function pctAccent(pct: number, type: "coverage" | "cost"): string {
  // Para cobertura: maior = melhor. Para % custo: menor = melhor.
  if (type === "coverage") {
    if (pct >= 90) return "text-status-success";
    if (pct >= 70) return "text-fg-primary";
    return "text-status-warning";
  }
  // cost
  if (pct === 0) return "text-fg-muted";
  if (pct <= 40) return "text-status-success";
  if (pct <= 60) return "text-fg-primary";
  return "text-status-warning";
}

export function CostsDailyTable({ data }: Props) {
  // Totais agregados
  const totals = data.reduce(
    (acc, p) => {
      acc.validOrders += p.validOrders;
      acc.validOrdersWithCogs += p.validOrdersWithCogs;
      acc.validRevenueTotal += p.validRevenueTotal;
      acc.validRevenue += p.validRevenue;
      acc.validCogs += p.validCogs;
      acc.invalidCogs += p.invalidCogs;
      acc.mpFee += p.mpFee;
      return acc;
    },
    {
      validOrders: 0,
      validOrdersWithCogs: 0,
      validRevenueTotal: 0,
      validRevenue: 0,
      validCogs: 0,
      invalidCogs: 0,
      mpFee: 0,
    },
  );
  const totalCoverage =
    totals.validOrders > 0
      ? (totals.validOrdersWithCogs / totals.validOrders) * 100
      : 0;
  const totalCostPct =
    totals.validRevenue > 0 ? (totals.validCogs / totals.validRevenue) * 100 : 0;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-6">
      <div>
        <h3 className="text-sm font-semibold text-fg-primary">Análise diária</h3>
        <p className="text-xs text-fg-muted">
          Pedidos válidos com COGS sincronizado e custo operacional dos inválidos
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-subtle text-left">
              <th className="pb-2 pr-3 font-medium text-fg-muted">Data</th>
              <th className="pb-2 pr-3 text-right font-medium text-fg-muted">Pedidos</th>
              <th className="pb-2 pr-3 text-right font-medium text-fg-muted">% Atualizado</th>
              <th className="pb-2 pr-3 text-right font-medium text-fg-muted">Receita</th>
              <th className="pb-2 pr-3 text-right font-medium text-fg-muted">Custo de produto</th>
              <th
                className="pb-2 pr-3 text-right font-medium text-fg-muted"
                title="Custo / receita dos pedidos com COGS confirmado pelo DSers"
              >
                % Custo
              </th>
              <th
                className="pb-2 pr-3 text-right font-medium text-fg-muted"
                title="Taxa Mercado Pago paga no dia de aprovação"
              >
                Taxa MP
              </th>
              <th className="pb-2 text-right font-medium text-fg-muted">Custo op.</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => {
              const hasCogs = p.validOrdersWithCogs > 0;
              return (
                <tr key={p.date} className="odd:bg-surface-input/60">
                  <td className="py-2 pr-3 font-medium text-fg-primary">
                    {formatDateLabel(p.date)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                    {p.validOrders === 0
                      ? "—"
                      : `${p.validOrdersWithCogs}/${p.validOrders}`}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums font-medium ${pctAccent(p.validCoveragePct, "coverage")}`}
                  >
                    {p.validOrders === 0 ? "—" : formatPercent(p.validCoveragePct, 0)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                    {p.validOrders > 0 ? formatBRL(p.validRevenueTotal) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                    {hasCogs ? formatBRL(p.validCogs) : "—"}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right tabular-nums font-medium ${pctAccent(p.validCostPct, "cost")}`}
                  >
                    {hasCogs ? formatPercent(p.validCostPct, 1) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                    {p.mpFee > 0 ? formatBRL(p.mpFee) : "—"}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums text-fg-secondary">
                    {p.invalidCogs > 0 ? formatBRL(p.invalidCogs) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-default font-semibold">
              <td className="pt-3 pr-3 text-fg-primary">Total</td>
              <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                {totals.validOrdersWithCogs}/{totals.validOrders}
              </td>
              <td
                className={`pt-3 pr-3 text-right tabular-nums ${pctAccent(totalCoverage, "coverage")}`}
              >
                {formatPercent(totalCoverage, 0)}
              </td>
              <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                {formatBRL(totals.validRevenueTotal)}
              </td>
              <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                {formatBRL(totals.validCogs)}
              </td>
              <td
                className={`pt-3 pr-3 text-right tabular-nums ${pctAccent(totalCostPct, "cost")}`}
              >
                {totals.validRevenue > 0 ? formatPercent(totalCostPct, 1) : "—"}
              </td>
              <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                {totals.mpFee > 0 ? formatBRL(totals.mpFee) : "—"}
              </td>
              <td className="pt-3 pl-2 text-right tabular-nums text-status-error">
                {totals.invalidCogs > 0 ? formatBRL(totals.invalidCogs) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
