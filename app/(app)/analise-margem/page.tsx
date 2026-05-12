import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/month-picker";
import {
  getMarginAnalysis,
  REVENUE_TAX_RATE,
  CHECKOUT_FEE_RATE,
} from "@/server/queries/margin";
import {
  parseMonthKey,
  toMonthKeySP,
  startOfMonthFromKey,
  endOfMonthFromKey,
} from "@/lib/datetime";
import { formatBRL, formatDateLabel, formatPercent } from "@/lib/format";

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  accent?: "neutral" | "positive" | "negative";
};

function StatCard({ label, value, sub, accent = "neutral" }: StatCardProps) {
  const color =
    accent === "positive"
      ? "text-status-success"
      : accent === "negative"
        ? "text-status-error"
        : "text-fg-primary";
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border-default bg-surface-card p-5">
      <span className="text-xs font-medium uppercase tracking-wider text-fg-muted">
        {label}
      </span>
      <span
        className={`text-2xl font-bold tabular-nums tracking-tight ${color}`}
      >
        {value}
      </span>
      {sub ? <span className="text-xs text-fg-muted">{sub}</span> : null}
    </div>
  );
}

function marginAccent(pct: number): "positive" | "neutral" | "negative" {
  if (pct >= 15) return "positive";
  if (pct >= 0) return "neutral";
  return "negative";
}

function coverageClass(pct: number, hasRevenue: boolean): string {
  if (!hasRevenue) return "text-fg-muted";
  if (pct >= 90) return "text-status-success";
  if (pct >= 70) return "text-fg-primary";
  return "text-status-warning";
}

function profitClass(value: number): string {
  if (value > 0) return "text-status-success";
  if (value < 0) return "text-status-error";
  return "text-fg-muted";
}

const TAX_LABEL = `${(REVENUE_TAX_RATE * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const CHECKOUT_LABEL = `${(CHECKOUT_FEE_RATE * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;

export default async function AnaliseMargemPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthKey(params.month) ?? toMonthKeySP(new Date());
  const from = startOfMonthFromKey(month);
  const to = endOfMonthFromKey(month);

  const { daily, totals } = await getMarginAnalysis(from, to);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Análise de Margem"
          subtitle={`Lucro performance (vendas reais) e operacional (com custos de troca, voucher, reenvio e zerados)`}
        />
        <MonthPicker month={month} />
      </div>

      {/* ── Cards resumo ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Faturamento"
          value={formatBRL(totals.faturamento)}
          sub="Pedidos válidos"
        />
        <StatCard
          label="Lucro performance"
          value={formatBRL(totals.performanceProfit)}
          sub={`Margem ${formatPercent(totals.performanceMargin, 1)}`}
          accent={
            totals.faturamento > 0
              ? marginAccent(totals.performanceMargin)
              : "neutral"
          }
        />
        <StatCard
          label="Lucro operacional"
          value={formatBRL(totals.operationalProfit)}
          sub={`Margem ${formatPercent(totals.operationalMargin, 1)}`}
          accent={
            totals.faturamento > 0
              ? marginAccent(totals.operationalMargin)
              : "neutral"
          }
        />
        <StatCard
          label="Custo op. (inválidos)"
          value={
            totals.cogsInvalid > 0 ? formatBRL(totals.cogsInvalid) : "—"
          }
          sub="Troca · Voucher · Reenvio · Zerado"
          accent={totals.cogsInvalid > 0 ? "negative" : "neutral"}
        />
      </div>

      {/* ── Detalhamento de custos ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard
          label="Custo de produto"
          value={formatBRL(totals.cogsValid)}
          sub={`Cobertura ${formatPercent(totals.cogsCoveragePct, 0)}`}
        />
        <StatCard
          label="Mídia paga"
          value={formatBRL(totals.adSpend)}
          sub="Meta (c/ imposto) + Google"
        />
        <StatCard
          label="Gateway"
          value={totals.gatewayFee > 0 ? formatBRL(totals.gatewayFee) : "—"}
          sub="Taxa Mercado Pago"
        />
        <StatCard
          label={`Imposto (${TAX_LABEL})`}
          value={formatBRL(totals.revenueTax)}
          sub="Sob faturamento"
        />
        <StatCard
          label={`Checkout (${CHECKOUT_LABEL})`}
          value={formatBRL(totals.checkoutFee)}
          sub="Sob faturamento"
        />
      </div>

      {/* ── Tabela diária ── */}
      <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-6">
        <div>
          <h3 className="text-sm font-semibold text-fg-primary">
            Lucro diário
          </h3>
          <p className="text-xs text-fg-muted">
            Performance = sem custos de pedidos inválidos · Operacional = com
            custos de troca, voucher, reenvio e zerados
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <th className="pb-2 pr-3 font-medium text-fg-muted">Data</th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Faturamento
                </th>
                <th
                  className="pb-2 pr-3 text-right font-medium text-fg-muted"
                  title="Cobertura DSers (pedidos com COGS sincronizado)"
                >
                  Cobertura
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Custo produto
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Mídia
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Gateway
                </th>
                <th
                  className="pb-2 pr-3 text-right font-medium text-fg-muted"
                  title={`Imposto ${TAX_LABEL} sob faturamento`}
                >
                  Imposto
                </th>
                <th
                  className="pb-2 pr-3 text-right font-medium text-fg-muted"
                  title={`Taxa de checkout ${CHECKOUT_LABEL} sob faturamento`}
                >
                  Checkout
                </th>
                <th
                  className="pb-2 pr-3 text-right font-medium text-fg-muted"
                  title="Custo de pedidos inválidos (troca, voucher, reenvio, zerados)"
                >
                  Custo op.
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Lucro perf.
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Margem perf.
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Lucro op.
                </th>
                <th className="pb-2 text-right font-medium text-fg-muted">
                  Margem op.
                </th>
              </tr>
            </thead>
            <tbody>
              {daily.map((p) => {
                const hasRevenue = p.faturamento > 0;
                return (
                  <tr key={p.date} className="odd:bg-surface-input/30">
                    <td className="py-2 pr-3 font-medium text-fg-primary">
                      {formatDateLabel(p.date)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                      {hasRevenue ? formatBRL(p.faturamento) : "—"}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums font-medium ${coverageClass(p.cogsCoveragePct, hasRevenue)}`}
                    >
                      {hasRevenue ? formatPercent(p.cogsCoveragePct, 0) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                      {p.cogsValid > 0 ? formatBRL(p.cogsValid) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                      {p.adSpend > 0 ? formatBRL(p.adSpend) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                      {p.gatewayFee > 0 ? formatBRL(p.gatewayFee) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                      {p.revenueTax > 0 ? formatBRL(p.revenueTax) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                      {p.checkoutFee > 0 ? formatBRL(p.checkoutFee) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                      {p.cogsInvalid > 0 ? formatBRL(p.cogsInvalid) : "—"}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums font-medium ${profitClass(p.performanceProfit)}`}
                    >
                      {hasRevenue ? formatBRL(p.performanceProfit) : "—"}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums ${profitClass(p.performanceProfit)}`}
                    >
                      {hasRevenue ? formatPercent(p.performanceMargin, 1) : "—"}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums font-medium ${profitClass(p.operationalProfit)}`}
                    >
                      {hasRevenue ? formatBRL(p.operationalProfit) : "—"}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${profitClass(p.operationalProfit)}`}
                    >
                      {hasRevenue ? formatPercent(p.operationalMargin, 1) : "—"}
                    </td>
                  </tr>
                );
              })}
              {daily.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-6 text-center text-fg-muted">
                    Nenhum dado disponível para o período.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {daily.length > 0 ? (
              <tfoot>
                <tr className="border-t border-border-default font-semibold">
                  <td className="pt-3 pr-3 text-fg-primary">Total</td>
                  <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    {formatBRL(totals.faturamento)}
                  </td>
                  <td
                    className={`pt-3 pr-3 text-right tabular-nums ${coverageClass(totals.cogsCoveragePct, totals.faturamento > 0)}`}
                  >
                    {totals.faturamento > 0
                      ? formatPercent(totals.cogsCoveragePct, 0)
                      : "—"}
                  </td>
                  <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    {formatBRL(totals.cogsValid)}
                  </td>
                  <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    {formatBRL(totals.adSpend)}
                  </td>
                  <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    {totals.gatewayFee > 0 ? formatBRL(totals.gatewayFee) : "—"}
                  </td>
                  <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    {formatBRL(totals.revenueTax)}
                  </td>
                  <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    {formatBRL(totals.checkoutFee)}
                  </td>
                  <td className="pt-3 pr-3 text-right tabular-nums text-status-error">
                    {totals.cogsInvalid > 0 ? formatBRL(totals.cogsInvalid) : "—"}
                  </td>
                  <td
                    className={`pt-3 pr-3 text-right tabular-nums ${profitClass(totals.performanceProfit)}`}
                  >
                    {formatBRL(totals.performanceProfit)}
                  </td>
                  <td
                    className={`pt-3 pr-3 text-right tabular-nums ${profitClass(totals.performanceProfit)}`}
                  >
                    {totals.faturamento > 0
                      ? formatPercent(totals.performanceMargin, 1)
                      : "—"}
                  </td>
                  <td
                    className={`pt-3 pr-3 text-right tabular-nums ${profitClass(totals.operationalProfit)}`}
                  >
                    {formatBRL(totals.operationalProfit)}
                  </td>
                  <td
                    className={`pt-3 text-right tabular-nums ${profitClass(totals.operationalProfit)}`}
                  >
                    {totals.faturamento > 0
                      ? formatPercent(totals.operationalMargin, 1)
                      : "—"}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </div>
  );
}
