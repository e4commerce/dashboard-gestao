import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/month-picker";
import { CostsDailyTable } from "@/components/dashboard/costs-daily-table";
import { AutoRefreshOnSync } from "@/components/auto-refresh-on-sync";
import {
  getCostsOverview,
  getDailyCosts,
  getInvalidReasonBreakdown,
  type CostGroupSummary,
} from "@/server/queries/costs";
import { getMpSummary } from "@/server/queries/gateway-fees";
import {
  parseMonthKey,
  toMonthKeySP,
  startOfMonthFromKey,
  endOfMonthFromKey,
} from "@/lib/datetime";
import { formatBRL, formatPercent } from "@/lib/format";

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
      <span className="text-xs font-medium uppercase tracking-wider text-fg-muted">{label}</span>
      <span className={`text-2xl font-bold tabular-nums tracking-tight ${color}`}>{value}</span>
      {sub ? <span className="text-xs text-fg-muted">{sub}</span> : null}
    </div>
  );
}

function GroupAnalysisCard({
  title,
  subtitle,
  data,
  variant,
}: {
  title: string;
  subtitle: string;
  data: CostGroupSummary;
  variant: "valid" | "invalid";
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-6">
      <div>
        <h3 className="text-sm font-semibold text-fg-primary">{title}</h3>
        <p className="text-xs text-fg-muted">{subtitle}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Field label="Pedidos" value={data.totalOrders.toLocaleString("pt-BR")} />
        <Field
          label="Com COGS"
          value={`${data.ordersWithCogs.toLocaleString("pt-BR")} (${data.coveragePct.toFixed(0)}%)`}
        />
        {variant === "valid" ? (
          <>
            <Field label="Receita" value={formatBRL(data.totalRevenue)} />
            <Field label="Custo total" value={formatBRL(data.totalCogs)} negative />
            <Field
              label="% Custo de produto"
              value={data.revenueWithCogs > 0 ? formatPercent(data.costPct, 1) : "—"}
            />
            <Field label="Custo médio / pedido" value={formatBRL(data.avgCogsPerOrder)} />
          </>
        ) : (
          <>
            <Field
              label="Custo operacional"
              value={formatBRL(data.totalCogs)}
              negative
            />
            <Field label="Custo médio / pedido" value={formatBRL(data.avgCogsPerOrder)} />
          </>
        )}
      </dl>
    </section>
  );
}

function Field({
  label,
  value,
  positive = false,
  negative = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  const color = positive
    ? "text-status-success"
    : negative
      ? "text-status-error"
      : "text-fg-primary";
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">{label}</dt>
      <dd className={`font-semibold tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}

function fmtLastSync(d: Date | null): string {
  if (!d) return "Nunca sincronizado";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  return `há ${days} dia${days !== 1 ? "s" : ""}`;
}

export default async function CustosPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthKey(params.month) ?? toMonthKeySP(new Date());
  const from = startOfMonthFromKey(month);
  const to = endOfMonthFromKey(month);

  const [overview, daily, invalidBreakdown, mp] = await Promise.all([
    getCostsOverview(from, to),
    getDailyCosts(from, to),
    getInvalidReasonBreakdown(from, to),
    getMpSummary(from, to),
  ]);

  const totalCogs = overview.valid.totalCogs + overview.invalid.totalCogs;
  const totalOrders = overview.valid.totalOrders + overview.invalid.totalOrders;
  const ordersWithCogs = overview.valid.ordersWithCogs + overview.invalid.ordersWithCogs;
  const overallCoverage = totalOrders > 0 ? (ordersWithCogs / totalOrders) * 100 : 0;
  const overallAvg = ordersWithCogs > 0 ? totalCogs / ordersWithCogs : 0;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <AutoRefreshOnSync channel="cogs" />
      <AutoRefreshOnSync channel="mp" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Custos de Produto"
          subtitle={`Última sincronização: ${fmtLastSync(overview.lastSyncAt)}`}
        />
        <MonthPicker month={month} />
      </div>

      {/* ── Resumo geral ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard
          label="Custo total"
          value={formatBRL(totalCogs)}
          sub="válidos + inválidos"
        />
        <StatCard
          label="Taxa MP"
          value={mp.totalFees > 0 ? formatBRL(mp.totalFees) : "—"}
          sub={
            mp.paymentCount > 0
              ? `${mp.paymentCount} pgto(s) · ${mp.feePct.toFixed(2)}%`
              : "Sincronize pra carregar"
          }
          accent={mp.totalFees > 0 ? "negative" : "neutral"}
        />
        <StatCard
          label="% Custo de produto"
          value={overview.valid.revenueWithCogs > 0 ? formatPercent(overview.valid.costPct, 1) : "—"}
          sub="sobre receita dos válidos"
          accent={
            overview.valid.costPct === 0
              ? "neutral"
              : overview.valid.costPct <= 40
                ? "positive"
                : overview.valid.costPct <= 60
                  ? "neutral"
                  : "negative"
          }
        />
        <StatCard
          label="Custo médio / pedido"
          value={formatBRL(overallAvg)}
          sub={`${ordersWithCogs} pedidos com COGS`}
        />
        <StatCard
          label="Cobertura"
          value={`${overallCoverage.toFixed(0)}%`}
          sub={`${ordersWithCogs} de ${totalOrders} pedidos`}
          accent={overallCoverage >= 80 ? "positive" : overallCoverage >= 50 ? "neutral" : "negative"}
        />
      </div>

      {/* ── Análise por grupo ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GroupAnalysisCard
          title="Pedidos válidos"
          subtitle="Somente vendas reais"
          data={overview.valid}
          variant="valid"
        />
        <GroupAnalysisCard
          title="Pedidos inválidos (custo operacional)"
          subtitle="Zerados, trocas, vouchers, reenvios — custos sem receita correspondente"
          data={overview.invalid}
          variant="invalid"
        />
      </div>

      {/* ── Tabela diária ── */}
      <CostsDailyTable data={daily} />

      {/* ── Breakdown dos inválidos por motivo ── */}
      <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-6">
        <div>
          <h3 className="text-sm font-semibold text-fg-primary">Custo operacional por motivo</h3>
          <p className="text-xs text-fg-muted">
            Decomposição dos pedidos não-receita por categoria
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <th className="pb-2 pr-4 font-medium text-fg-muted">Motivo</th>
                <th className="pb-2 pr-4 text-right font-medium text-fg-muted">Pedidos</th>
                <th className="pb-2 text-right font-medium text-fg-muted">Custo total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {invalidBreakdown.map((row) => (
                <tr key={row.key}>
                  <td className="py-2.5 pr-4 font-medium text-fg-primary">{row.label}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-fg-secondary">
                    {row.orderCount.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-medium text-fg-primary">
                    {row.cogs > 0 ? formatBRL(row.cogs) : "—"}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border-default">
                <td className="py-2.5 pr-4 font-semibold text-fg-primary">Total</td>
                <td className="py-2.5 pr-4 text-right tabular-nums font-semibold text-fg-primary">
                  {invalidBreakdown.reduce((s, r) => s + r.orderCount, 0).toLocaleString("pt-BR")}
                </td>
                <td className="py-2.5 text-right tabular-nums font-semibold text-status-error">
                  {formatBRL(invalidBreakdown.reduce((s, r) => s + r.cogs, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
