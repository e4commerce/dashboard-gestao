import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/month-picker";
import { ExportCsvButton } from "./export-csv-button";
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

function coverageClass(pct: number, hasRevenue: boolean): string {
  if (!hasRevenue) return "text-fg-muted";
  if (pct >= 90) return "text-status-success";
  if (pct >= 70) return "text-fg-primary";
  return "text-status-warning";
}

// Tons leves para destacar pares de colunas (lucro + margem) sem competir
// com os cards de resumo. status-info = azul suave, action-personalize = laranja.
const PERF_COL_CLASS = "bg-status-info/[0.08]";
const OP_COL_CLASS = "bg-action-personalize/[0.08]";

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Análise de Margem"
          subtitle={`Lucro performance (vendas reais) e operacional (com custos de troca, voucher, reenvio e zerados)`}
        />
        <div className="flex items-center gap-3">
          <MonthPicker month={month} />
          <ExportCsvButton month={month} daily={daily} totals={totals} />
        </div>
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
        />
        <StatCard
          label="Lucro operacional"
          value={formatBRL(totals.operationalProfit)}
          sub={`Margem ${formatPercent(totals.operationalMargin, 1)}`}
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
          value={formatBRL(totals.cogsValid + totals.cogsValidEstimated)}
          sub={
            totals.cogsValidEstimated > 0
              ? `Real ${formatBRL(totals.cogsValid)} + estimado ${formatBRL(totals.cogsValidEstimated)}`
              : `Cobertura ${formatPercent(totals.cogsCoveragePct, 0)}`
          }
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
      <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-4 md:p-6">
        <div>
          <h3 className="text-sm font-semibold text-fg-primary">
            Lucro diário
          </h3>
          <p className="text-xs text-fg-muted">
            Lucro = Faturamento − Custo produto − Mídia − Taxas − Custo op. ·
            Pedidos sem COGS sincronizado e cobertura abaixo de 99% recebem
            estimativa via taxa média dos últimos 7 dias (marcado com{" "}
            <span className="text-status-warning">~</span>)
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
                <th
                  className="pb-2 pr-3 text-right font-medium text-fg-muted"
                  title={`Gateway (Mercado Pago) + Imposto ${TAX_LABEL} + Checkout ${CHECKOUT_LABEL}`}
                >
                  Taxas
                </th>
                <th
                  className="pb-2 pr-3 text-right font-medium text-fg-muted"
                  title="Custo de pedidos inválidos (troca, voucher, reenvio, zerados)"
                >
                  Custo op.
                </th>
                <th
                  className={`pb-2 pr-3 text-right font-medium text-fg-muted ${PERF_COL_CLASS}`}
                >
                  Lucro perf.
                </th>
                <th
                  className={`pb-2 pr-3 text-right font-medium text-fg-muted ${PERF_COL_CLASS}`}
                >
                  Margem perf.
                </th>
                <th
                  className={`pb-2 pr-3 text-right font-medium text-fg-muted ${OP_COL_CLASS}`}
                >
                  Lucro op.
                </th>
                <th
                  className={`pb-2 text-right font-medium text-fg-muted ${OP_COL_CLASS}`}
                >
                  Margem op.
                </th>
              </tr>
            </thead>
            <tbody>
              {daily.map((p) => {
                const hasRevenue = p.faturamento > 0;
                return (
                  <tr key={p.date} className="odd:bg-surface-input/60">
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
                    <td className="group relative py-2 pr-3 text-right tabular-nums text-fg-secondary">
                      {(() => {
                        const cogsTotal = p.cogsValid + p.cogsValidEstimated;
                        if (cogsTotal === 0) return "—";
                        if (p.cogsValidEstimated > 0) {
                          return (
                            <span className="cursor-help underline decoration-dotted decoration-status-warning/70 underline-offset-2">
                              {formatBRL(cogsTotal)}
                              <span className="ml-0.5 text-status-warning">
                                ~
                              </span>
                            </span>
                          );
                        }
                        return formatBRL(cogsTotal);
                      })()}
                      {p.cogsValidEstimated > 0 ? (
                        <div className="pointer-events-none invisible absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-border-default bg-surface-card p-3 text-left shadow-lg group-hover:visible">
                          <div className="mb-1 flex justify-between gap-3 text-[11px]">
                            <span className="text-fg-muted">Real (DSers)</span>
                            <span className="font-medium tabular-nums text-fg-primary">
                              {formatBRL(p.cogsValid)}
                            </span>
                          </div>
                          <div className="mb-1 flex justify-between gap-3 text-[11px]">
                            <span className="text-fg-muted">Estimado</span>
                            <span className="font-medium tabular-nums text-status-warning">
                              {formatBRL(p.cogsValidEstimated)}
                            </span>
                          </div>
                          <div className="mb-1 border-t border-border-subtle pt-1.5 text-[10px] text-fg-muted">
                            {p.cogsRateUsed !== null
                              ? `Taxa média 7 dias: ${formatPercent(p.cogsRateUsed * 100, 1)}`
                              : "Sem janela de referência"}
                          </div>
                          <div className="text-[10px] text-fg-muted">
                            Aplicado nos {(100 - p.cogsCoveragePct).toFixed(0)}%
                            de pedidos sem COGS sincronizado.
                          </div>
                        </div>
                      ) : null}
                    </td>
                    <td className="group relative py-2 pr-3 text-right tabular-nums text-fg-secondary">
                      {p.adSpend > 0 ? (
                        <span className="cursor-help underline decoration-dotted decoration-fg-muted underline-offset-2">
                          {formatBRL(p.adSpend)}
                        </span>
                      ) : (
                        "—"
                      )}
                      {p.adSpend > 0 ? (
                        <div className="pointer-events-none invisible absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-border-default bg-surface-card p-3 text-left shadow-lg group-hover:visible">
                          <div className="mb-1 flex justify-between gap-3 text-[11px]">
                            <span className="text-fg-muted">Meta ads</span>
                            <span className="font-medium tabular-nums text-fg-primary">
                              {formatBRL(p.adMetaRaw)}
                            </span>
                          </div>
                          <div className="mb-1 flex justify-between gap-3 text-[11px]">
                            <span className="text-fg-muted">Imposto Meta</span>
                            <span className="font-medium tabular-nums text-fg-primary">
                              {formatBRL(p.adMetaTax)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 text-[11px]">
                            <span className="text-fg-muted">Google ads</span>
                            <span className="font-medium tabular-nums text-fg-primary">
                              {formatBRL(p.adGoogle)}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </td>
                    <td className="group relative py-2 pr-3 text-right tabular-nums text-fg-secondary">
                      {(() => {
                        const totalFees =
                          p.gatewayFee + p.revenueTax + p.checkoutFee;
                        if (totalFees === 0) return "—";
                        return (
                          <span className="cursor-help underline decoration-dotted decoration-fg-muted underline-offset-2">
                            {formatBRL(totalFees)}
                          </span>
                        );
                      })()}
                      {p.gatewayFee + p.revenueTax + p.checkoutFee > 0 ? (
                        <div className="pointer-events-none invisible absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-border-default bg-surface-card p-3 text-left shadow-lg group-hover:visible">
                          <div className="mb-1 flex justify-between gap-3 text-[11px]">
                            <span className="text-fg-muted">Gateway</span>
                            <span className="font-medium tabular-nums text-fg-primary">
                              {formatBRL(p.gatewayFee)}
                            </span>
                          </div>
                          <div className="mb-1 flex justify-between gap-3 text-[11px]">
                            <span className="text-fg-muted">
                              Imposto ({TAX_LABEL})
                            </span>
                            <span className="font-medium tabular-nums text-fg-primary">
                              {formatBRL(p.revenueTax)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 text-[11px]">
                            <span className="text-fg-muted">
                              Checkout ({CHECKOUT_LABEL})
                            </span>
                            <span className="font-medium tabular-nums text-fg-primary">
                              {formatBRL(p.checkoutFee)}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </td>
                    <td className="group relative py-2 pr-3 text-right tabular-nums text-fg-secondary">
                      {p.cogsInvalid > 0 ? (
                        <span className="cursor-help underline decoration-dotted decoration-fg-muted underline-offset-2">
                          {formatBRL(p.cogsInvalid)}
                        </span>
                      ) : (
                        "—"
                      )}
                      {p.cogsInvalid > 0 ? (
                        <div className="pointer-events-none invisible absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-border-default bg-surface-card p-3 text-left shadow-lg group-hover:visible">
                          <div className="mb-1 flex justify-between gap-3 text-[11px]">
                            <span className="text-fg-muted">Reenvio</span>
                            <span className="font-medium tabular-nums text-fg-primary">
                              {formatBRL(p.cogsInvalidReenvio)}
                            </span>
                          </div>
                          <div className="mb-1 flex justify-between gap-3 text-[11px]">
                            <span className="text-fg-muted">Troca</span>
                            <span className="font-medium tabular-nums text-fg-primary">
                              {formatBRL(p.cogsInvalidTroca)}
                            </span>
                          </div>
                          <div className="mb-1 flex justify-between gap-3 text-[11px]">
                            <span className="text-fg-muted">Voucher</span>
                            <span className="font-medium tabular-nums text-fg-primary">
                              {formatBRL(p.cogsInvalidVoucher)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3 text-[11px]">
                            <span className="text-fg-muted">Zerado</span>
                            <span className="font-medium tabular-nums text-fg-primary">
                              {formatBRL(p.cogsInvalidZerado)}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums font-medium text-fg-primary ${PERF_COL_CLASS}`}
                    >
                      {hasRevenue ? formatBRL(p.performanceProfit) : "—"}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums text-fg-primary ${PERF_COL_CLASS}`}
                    >
                      {hasRevenue ? formatPercent(p.performanceMargin, 1) : "—"}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums font-medium text-fg-primary ${OP_COL_CLASS}`}
                    >
                      {hasRevenue ? formatBRL(p.operationalProfit) : "—"}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums text-fg-primary ${OP_COL_CLASS}`}
                    >
                      {hasRevenue ? formatPercent(p.operationalMargin, 1) : "—"}
                    </td>
                  </tr>
                );
              })}
              {daily.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-fg-muted">
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
                  <td className="group relative pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    {totals.cogsValidEstimated > 0 ? (
                      <>
                        <span className="cursor-help underline decoration-dotted decoration-status-warning/70 underline-offset-2">
                          {formatBRL(
                            totals.cogsValid + totals.cogsValidEstimated,
                          )}
                          <span className="ml-0.5 text-status-warning">~</span>
                        </span>
                        <div className="pointer-events-none invisible absolute right-0 bottom-full z-20 mb-1 w-56 rounded-md border border-border-default bg-surface-card p-3 text-left font-normal shadow-lg group-hover:visible">
                          <div className="mb-1 flex justify-between gap-3 text-[11px]">
                            <span className="text-fg-muted">Real (DSers)</span>
                            <span className="font-medium tabular-nums text-fg-primary">
                              {formatBRL(totals.cogsValid)}
                            </span>
                          </div>
                          <div className="mb-1 flex justify-between gap-3 text-[11px]">
                            <span className="text-fg-muted">Estimado</span>
                            <span className="font-medium tabular-nums text-status-warning">
                              {formatBRL(totals.cogsValidEstimated)}
                            </span>
                          </div>
                          {totals.cogsRateUsed !== null ? (
                            <div className="border-t border-border-subtle pt-1.5 text-[10px] text-fg-muted">
                              Taxa média:{" "}
                              {formatPercent(totals.cogsRateUsed * 100, 1)}
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      formatBRL(totals.cogsValid)
                    )}
                  </td>
                  <td className="group relative pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    <span className="cursor-help underline decoration-dotted decoration-fg-muted underline-offset-2">
                      {formatBRL(totals.adSpend)}
                    </span>
                    <div className="pointer-events-none invisible absolute right-0 bottom-full z-20 mb-1 w-48 rounded-md border border-border-default bg-surface-card p-3 text-left font-normal shadow-lg group-hover:visible">
                      <div className="mb-1 flex justify-between gap-3 text-[11px]">
                        <span className="text-fg-muted">Meta ads</span>
                        <span className="font-medium tabular-nums text-fg-primary">
                          {formatBRL(totals.adMetaRaw)}
                        </span>
                      </div>
                      <div className="mb-1 flex justify-between gap-3 text-[11px]">
                        <span className="text-fg-muted">Imposto Meta</span>
                        <span className="font-medium tabular-nums text-fg-primary">
                          {formatBRL(totals.adMetaTax)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 text-[11px]">
                        <span className="text-fg-muted">Google ads</span>
                        <span className="font-medium tabular-nums text-fg-primary">
                          {formatBRL(totals.adGoogle)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="group relative pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    <span className="cursor-help underline decoration-dotted decoration-fg-muted underline-offset-2">
                      {formatBRL(
                        totals.gatewayFee +
                          totals.revenueTax +
                          totals.checkoutFee,
                      )}
                    </span>
                    <div className="pointer-events-none invisible absolute right-0 bottom-full z-20 mb-1 w-48 rounded-md border border-border-default bg-surface-card p-3 text-left font-normal shadow-lg group-hover:visible">
                      <div className="mb-1 flex justify-between gap-3 text-[11px]">
                        <span className="text-fg-muted">Gateway</span>
                        <span className="font-medium tabular-nums text-fg-primary">
                          {formatBRL(totals.gatewayFee)}
                        </span>
                      </div>
                      <div className="mb-1 flex justify-between gap-3 text-[11px]">
                        <span className="text-fg-muted">
                          Imposto ({TAX_LABEL})
                        </span>
                        <span className="font-medium tabular-nums text-fg-primary">
                          {formatBRL(totals.revenueTax)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 text-[11px]">
                        <span className="text-fg-muted">
                          Checkout ({CHECKOUT_LABEL})
                        </span>
                        <span className="font-medium tabular-nums text-fg-primary">
                          {formatBRL(totals.checkoutFee)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="group relative pt-3 pr-3 text-right tabular-nums text-status-error">
                    {totals.cogsInvalid > 0 ? (
                      <span className="cursor-help underline decoration-dotted decoration-status-error/60 underline-offset-2">
                        {formatBRL(totals.cogsInvalid)}
                      </span>
                    ) : (
                      "—"
                    )}
                    {totals.cogsInvalid > 0 ? (
                      <div className="pointer-events-none invisible absolute right-0 bottom-full z-20 mb-1 w-48 rounded-md border border-border-default bg-surface-card p-3 text-left font-normal shadow-lg group-hover:visible">
                        <div className="mb-1 flex justify-between gap-3 text-[11px]">
                          <span className="text-fg-muted">Reenvio</span>
                          <span className="font-medium tabular-nums text-fg-primary">
                            {formatBRL(totals.cogsInvalidReenvio)}
                          </span>
                        </div>
                        <div className="mb-1 flex justify-between gap-3 text-[11px]">
                          <span className="text-fg-muted">Troca</span>
                          <span className="font-medium tabular-nums text-fg-primary">
                            {formatBRL(totals.cogsInvalidTroca)}
                          </span>
                        </div>
                        <div className="mb-1 flex justify-between gap-3 text-[11px]">
                          <span className="text-fg-muted">Voucher</span>
                          <span className="font-medium tabular-nums text-fg-primary">
                            {formatBRL(totals.cogsInvalidVoucher)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3 text-[11px]">
                          <span className="text-fg-muted">Zerado</span>
                          <span className="font-medium tabular-nums text-fg-primary">
                            {formatBRL(totals.cogsInvalidZerado)}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </td>
                  <td
                    className={`pt-3 pr-3 text-right tabular-nums text-fg-primary ${PERF_COL_CLASS}`}
                  >
                    {formatBRL(totals.performanceProfit)}
                  </td>
                  <td
                    className={`pt-3 pr-3 text-right tabular-nums text-fg-primary ${PERF_COL_CLASS}`}
                  >
                    {totals.faturamento > 0
                      ? formatPercent(totals.performanceMargin, 1)
                      : "—"}
                  </td>
                  <td
                    className={`pt-3 pr-3 text-right tabular-nums text-fg-primary ${OP_COL_CLASS}`}
                  >
                    {formatBRL(totals.operationalProfit)}
                  </td>
                  <td
                    className={`pt-3 text-right tabular-nums text-fg-primary ${OP_COL_CLASS}`}
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
