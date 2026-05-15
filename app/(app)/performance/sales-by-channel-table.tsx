import type {
  SalesByChannelAnalysis,
  SalesByChannelRow,
} from "@/server/queries/performance";
import { formatBRL, formatPercent } from "@/lib/format";

type Props = {
  data: SalesByChannelAnalysis;
};

const fmtInt = (v: number) => v.toLocaleString("pt-BR");
const fmtMoney = (v: number) => formatBRL(v);
const fmtMoney2 = (v: number) => formatBRL(v, 2);
const fmtPct2 = (v: number) => formatPercent(v, 2);
const fmtRatio = (v: number) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const COST_COL_CLASS = "bg-status-error/[0.05]";
const PROFIT_COL_CLASS = "bg-status-info/[0.08]";
const ADS_COL_CLASS = "bg-status-warning/[0.06]";

function ShareBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-input">
        <div
          className="h-full rounded-full bg-[#4CAF50]/70"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="min-w-[40px] text-right tabular-nums text-fg-muted">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function MaybeCell({
  value,
  format,
  className = "",
}: {
  value: number | null;
  format: (v: number) => string;
  className?: string;
}) {
  return (
    <td className={`py-2.5 pr-3 text-right tabular-nums ${className}`}>
      {value !== null ? (
        <span className="font-medium text-fg-primary">{format(value)}</span>
      ) : (
        <span className="text-fg-muted">—</span>
      )}
    </td>
  );
}

function Row({ row }: { row: SalesByChannelRow }) {
  const marginPositive = row.performanceMargin >= 0;
  return (
    <tr className="odd:bg-surface-input/60">
      <td className="py-2.5 pr-3 font-medium text-fg-primary">{row.channel}</td>
      <td className="py-2.5 pr-3 text-right tabular-nums text-fg-secondary">
        {fmtInt(row.orderCount)}
      </td>
      <td className="py-2.5 pr-3">
        <ShareBar pct={row.revenuePct} />
      </td>
      <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-fg-primary">
        {fmtMoney(row.revenue)}
      </td>
      <td className="py-2.5 pr-3 text-right tabular-nums text-fg-secondary">
        {row.avgTicket > 0 ? fmtMoney2(row.avgTicket) : "—"}
      </td>
      {/* COGS */}
      <td className={`py-2.5 pr-3 text-right tabular-nums ${COST_COL_CLASS}`}>
        <div className="font-medium text-fg-primary">
          {fmtMoney(row.cogsTotal)}
        </div>
        <div className="text-[10px] text-fg-muted">
          {row.cogsEstimated > 0
            ? `real ${fmtMoney(row.cogsReal)} · est. ${fmtMoney(row.cogsEstimated)}`
            : `cob. ${row.coveragePct.toFixed(0)}%`}
        </div>
      </td>
      {/* Marketing */}
      <MaybeCell
        value={row.adSpend}
        format={fmtMoney}
        className={ADS_COL_CLASS}
      />
      {/* Taxas / fees */}
      <td className={`py-2.5 pr-3 text-right tabular-nums ${COST_COL_CLASS}`}>
        <div className="font-medium text-fg-primary">
          {fmtMoney(row.feesTotal)}
        </div>
        <div className="text-[10px] text-fg-muted">
          MP {fmtMoney(row.gatewayFee)} · imp. {fmtMoney(row.revenueTax)} · chk.{" "}
          {fmtMoney(row.checkoutFee)}
        </div>
      </td>
      {/* Lucro performance */}
      <td className={`py-2.5 pr-3 text-right tabular-nums ${PROFIT_COL_CLASS}`}>
        <span
          className={`font-semibold ${
            marginPositive ? "text-fg-primary" : "text-status-error"
          }`}
        >
          {fmtMoney(row.performanceProfit)}
        </span>
      </td>
      {/* Margem performance */}
      <td className={`py-2.5 pr-3 text-right tabular-nums ${PROFIT_COL_CLASS}`}>
        <span
          className={`font-semibold ${
            marginPositive ? "text-fg-primary" : "text-status-error"
          }`}
        >
          {fmtPct2(row.performanceMargin)}
        </span>
      </td>
      {/* ROAS / CPA */}
      <MaybeCell value={row.roas} format={fmtRatio} className={ADS_COL_CLASS} />
      <MaybeCell value={row.cpa} format={fmtMoney2} className={ADS_COL_CLASS} />
    </tr>
  );
}

export function SalesByChannelTable({ data }: Props) {
  const { rows, totals } = data;
  const totalMarginPositive = totals.performanceMargin >= 0;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-4 md:p-6">
      <div>
        <h3 className="text-sm font-semibold text-fg-primary">
          Vendas por canal (UTM)
        </h3>
        <p className="text-xs text-fg-muted">
          Atribuição consolidada pelo classificador de UTM. Lucro de performance
          = faturamento − COGS (real + estimado) − marketing − taxas (MP +
          imposto 1,72% + checkout 1%).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-subtle text-left">
              <th className="pb-2 pr-3 font-medium text-fg-muted">Canal</th>
              <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                Pedidos
              </th>
              <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                Participação
              </th>
              <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                Faturamento
              </th>
              <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                Ticket médio
              </th>
              <th
                className={`pb-2 pr-3 text-right font-medium text-fg-muted ${COST_COL_CLASS}`}
              >
                COGS
              </th>
              <th
                className={`pb-2 pr-3 text-right font-medium text-fg-muted ${ADS_COL_CLASS}`}
              >
                Marketing
              </th>
              <th
                className={`pb-2 pr-3 text-right font-medium text-fg-muted ${COST_COL_CLASS}`}
              >
                Taxas
              </th>
              <th
                className={`pb-2 pr-3 text-right font-medium text-fg-muted ${PROFIT_COL_CLASS}`}
              >
                Lucro
              </th>
              <th
                className={`pb-2 pr-3 text-right font-medium text-fg-muted ${PROFIT_COL_CLASS}`}
              >
                Margem
              </th>
              <th
                className={`pb-2 pr-3 text-right font-medium text-fg-muted ${ADS_COL_CLASS}`}
              >
                ROAS
              </th>
              <th
                className={`pb-2 pr-3 text-right font-medium text-fg-muted ${ADS_COL_CLASS}`}
              >
                CPA
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Row key={row.channel} row={row} />
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-6 text-center text-fg-muted">
                  Nenhum pedido válido com atribuição no período.
                </td>
              </tr>
            ) : null}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="border-t border-border-default">
                <td className="pt-3 pr-3 font-semibold text-fg-primary">
                  Total
                </td>
                <td className="pt-3 pr-3 text-right tabular-nums font-semibold text-fg-primary">
                  {fmtInt(totals.orderCount)}
                </td>
                <td className="pt-3 pr-3 text-right tabular-nums text-fg-muted">
                  100.0%
                </td>
                <td className="pt-3 pr-3 text-right tabular-nums font-semibold text-fg-primary">
                  {fmtMoney(totals.revenue)}
                </td>
                <td className="pt-3 pr-3 text-right tabular-nums font-semibold text-fg-primary">
                  {totals.avgTicket > 0 ? fmtMoney2(totals.avgTicket) : "—"}
                </td>
                <td
                  className={`pt-3 pr-3 text-right tabular-nums ${COST_COL_CLASS}`}
                >
                  <div className="font-semibold text-fg-primary">
                    {fmtMoney(totals.cogsTotal)}
                  </div>
                  <div className="text-[10px] font-normal text-fg-muted">
                    {totals.cogsEstimated > 0
                      ? `real ${fmtMoney(totals.cogsReal)} · est. ${fmtMoney(totals.cogsEstimated)}`
                      : `cob. ${totals.coveragePct.toFixed(0)}%`}
                  </div>
                </td>
                <td
                  className={`pt-3 pr-3 text-right tabular-nums font-semibold text-fg-primary ${ADS_COL_CLASS}`}
                >
                  {totals.adSpend > 0 ? fmtMoney(totals.adSpend) : "—"}
                </td>
                <td
                  className={`pt-3 pr-3 text-right tabular-nums ${COST_COL_CLASS}`}
                >
                  <div className="font-semibold text-fg-primary">
                    {fmtMoney(totals.feesTotal)}
                  </div>
                  <div className="text-[10px] font-normal text-fg-muted">
                    MP {fmtMoney(totals.gatewayFee)} · imp.{" "}
                    {fmtMoney(totals.revenueTax)} · chk.{" "}
                    {fmtMoney(totals.checkoutFee)}
                  </div>
                </td>
                <td
                  className={`pt-3 pr-3 text-right tabular-nums font-semibold ${
                    totalMarginPositive ? "text-fg-primary" : "text-status-error"
                  } ${PROFIT_COL_CLASS}`}
                >
                  {fmtMoney(totals.performanceProfit)}
                </td>
                <td
                  className={`pt-3 pr-3 text-right tabular-nums font-semibold ${
                    totalMarginPositive ? "text-fg-primary" : "text-status-error"
                  } ${PROFIT_COL_CLASS}`}
                >
                  {fmtPct2(totals.performanceMargin)}
                </td>
                <td
                  className={`pt-3 pr-3 text-right tabular-nums font-semibold text-fg-primary ${ADS_COL_CLASS}`}
                >
                  {totals.roas !== null ? fmtRatio(totals.roas) : "—"}
                </td>
                <td
                  className={`pt-3 pr-3 text-right tabular-nums font-semibold text-fg-primary ${ADS_COL_CLASS}`}
                >
                  {totals.cpa !== null ? fmtMoney2(totals.cpa) : "—"}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}
