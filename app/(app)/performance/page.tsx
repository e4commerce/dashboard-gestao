import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/month-picker";
import { ExportCsvButton } from "./export-csv-button";
import { SalesByChannelTable } from "./sales-by-channel-table";
import {
  getPerformanceAnalysis,
  getSalesByChannel,
} from "@/server/queries/performance";
import {
  parseMonthKey,
  toMonthKeySP,
  startOfMonthFromKey,
  endOfMonthFromKey,
} from "@/lib/datetime";
import { formatBRL, formatDateLabel, formatPercent } from "@/lib/format";

type Formatter = (v: number) => string;

const fmtInt: Formatter = (v) => v.toLocaleString("pt-BR");
const fmtMoney: Formatter = (v) => formatBRL(v);
const fmtMoney2: Formatter = (v) => formatBRL(v, 2);
const fmtPct2: Formatter = (v) => formatPercent(v, 2);
const fmtRatio: Formatter = (v) =>
  v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

type ValueCellProps = {
  real: number | null;
  prev: number | null;
  format: Formatter;
  className?: string;
};

// Cada célula mostra o realizado em destaque e o previsto em cinza embaixo,
// pra deixar a comparação prev/real legível sem dobrar o número de colunas.
function ValueCell({ real, prev, format, className = "" }: ValueCellProps) {
  return (
    <td className={`py-2 pr-3 text-right tabular-nums ${className}`}>
      <div className="font-medium text-fg-primary">
        {real !== null ? format(real) : <span className="text-fg-muted">—</span>}
      </div>
      <div className="text-[10px] text-fg-muted">
        {prev !== null ? format(prev) : "—"}
      </div>
    </td>
  );
}

function FootCell({ real, prev, format, className = "" }: ValueCellProps) {
  return (
    <td className={`pt-3 pr-3 text-right tabular-nums ${className}`}>
      <div className="font-semibold text-fg-primary">
        {real !== null ? format(real) : <span className="text-fg-muted">—</span>}
      </div>
      <div className="text-[10px] text-fg-muted">
        {prev !== null ? format(prev) : "—"}
      </div>
    </td>
  );
}

const PROFIT_COL_CLASS = "bg-status-info/[0.08]";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border-default bg-surface-card p-5">
      <span className="text-xs font-medium uppercase tracking-wider text-fg-muted">
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums tracking-tight text-fg-primary">
        {value}
      </span>
      {sub ? <span className="text-xs text-fg-muted">{sub}</span> : null}
    </div>
  );
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthKey(params.month) ?? toMonthKeySP(new Date());
  const from = startOfMonthFromKey(month);
  const to = endOfMonthFromKey(month);

  const [{ daily, totals }, salesByChannel] = await Promise.all([
    getPerformanceAnalysis(from, to),
    getSalesByChannel(from, to),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Análise de Performance"
          subtitle="Acompanhamento diário · Realizado em destaque · Previsto em cinza"
        />
        <div className="flex items-center gap-3">
          <MonthPicker month={month} />
          <ExportCsvButton month={month} daily={daily} totals={totals} />
        </div>
      </div>

      {/* ── Resumo do mês ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Faturamento"
          value={formatBRL(totals.faturamentoReal)}
          sub={
            totals.faturamentoPrev !== null
              ? `Meta ${formatBRL(totals.faturamentoPrev)} · ${formatPercent(
                  totals.faturamentoPrev > 0
                    ? (totals.faturamentoReal / totals.faturamentoPrev) * 100
                    : 0,
                  1,
                )}`
              : "Sem meta cadastrada"
          }
        />
        <StatCard
          label="Pedidos"
          value={fmtInt(totals.pedidosReal)}
          sub={
            totals.ticketReal !== null
              ? `Ticket ${formatBRL(totals.ticketReal, 2)}`
              : "—"
          }
        />
        <StatCard
          label="Marketing"
          value={formatBRL(totals.marketingReal)}
          sub={
            totals.roasReal !== null
              ? `ROAS ${fmtRatio(totals.roasReal)} · CPA ${formatBRL(totals.cpaReal ?? 0, 2)}`
              : "—"
          }
        />
        <StatCard
          label="Lucro bruto"
          value={formatBRL(totals.lucroBrutoReal)}
          sub={`Margem ${fmtPct2(totals.margemBrutaReal)}${
            totals.lucroBrutoPrev !== null
              ? ` · Meta ${formatBRL(totals.lucroBrutoPrev)}`
              : ""
          }`}
        />
      </div>

      {/* ── Tabela diária ── */}
      <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-4 md:p-6">
        <div>
          <h3 className="text-sm font-semibold text-fg-primary">
            Performance diária
          </h3>
          <p className="text-xs text-fg-muted">
            Linha de cima = realizado · linha de baixo = previsto (meta). Sessões
            via ShopifyQL — sincronizadas diariamente às 04h.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <th className="pb-2 pr-3 font-medium text-fg-muted">Data</th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Sessões
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Pedidos
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Faturamento
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Conversão
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  ROAS pago
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Ticket médio
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Marketing
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  CPS
                </th>
                <th className={`pb-2 pr-3 text-right font-medium text-fg-muted ${PROFIT_COL_CLASS}`}>
                  Lucro bruto
                </th>
                <th className={`pb-2 pr-3 text-right font-medium text-fg-muted ${PROFIT_COL_CLASS}`}>
                  Margem bruta
                </th>
                <th className="pb-2 text-right font-medium text-fg-muted">
                  CPA pago
                </th>
              </tr>
            </thead>
            <tbody>
              {daily.map((p) => (
                <tr key={p.date} className="odd:bg-surface-input/60">
                  <td className="py-2 pr-3 font-medium text-fg-primary align-top">
                    {formatDateLabel(p.date)}
                  </td>
                  <ValueCell real={p.sessoesReal} prev={p.sessoesPrev} format={fmtInt} />
                  <ValueCell real={p.pedidosReal} prev={p.pedidosPrev} format={fmtInt} />
                  <ValueCell
                    real={p.faturamentoReal}
                    prev={p.faturamentoPrev}
                    format={fmtMoney}
                  />
                  <ValueCell real={p.conversaoReal} prev={p.conversaoPrev} format={fmtPct2} />
                  <ValueCell real={p.roasReal} prev={p.roasPrev} format={fmtRatio} />
                  <ValueCell real={p.ticketReal} prev={p.ticketPrev} format={fmtMoney2} />
                  <ValueCell
                    real={p.marketingReal}
                    prev={p.marketingPrev}
                    format={fmtMoney}
                  />
                  <ValueCell real={p.cpsReal} prev={p.cpsPrev} format={fmtMoney2} />
                  <ValueCell
                    real={p.lucroBrutoReal}
                    prev={p.lucroBrutoPrev}
                    format={fmtMoney}
                    className={PROFIT_COL_CLASS}
                  />
                  <ValueCell
                    real={p.margemBrutaReal}
                    prev={p.margemBrutaPrev}
                    format={fmtPct2}
                    className={PROFIT_COL_CLASS}
                  />
                  <ValueCell real={p.cpaReal} prev={p.cpaPrev} format={fmtMoney2} />
                </tr>
              ))}
              {daily.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-6 text-center text-fg-muted">
                    Nenhum dado disponível para o período.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {daily.length > 0 ? (
              <tfoot>
                <tr className="border-t border-border-default">
                  <td className="pt-3 pr-3 font-semibold text-fg-primary align-top">
                    Total
                  </td>
                  <FootCell real={totals.sessoesReal} prev={totals.sessoesPrev} format={fmtInt} />
                  <FootCell real={totals.pedidosReal} prev={totals.pedidosPrev} format={fmtInt} />
                  <FootCell
                    real={totals.faturamentoReal}
                    prev={totals.faturamentoPrev}
                    format={fmtMoney}
                  />
                  <FootCell
                    real={totals.conversaoReal}
                    prev={totals.conversaoPrev}
                    format={fmtPct2}
                  />
                  <FootCell real={totals.roasReal} prev={totals.roasPrev} format={fmtRatio} />
                  <FootCell
                    real={totals.ticketReal}
                    prev={totals.ticketPrev}
                    format={fmtMoney2}
                  />
                  <FootCell
                    real={totals.marketingReal}
                    prev={totals.marketingPrev}
                    format={fmtMoney}
                  />
                  <FootCell real={totals.cpsReal} prev={totals.cpsPrev} format={fmtMoney2} />
                  <FootCell
                    real={totals.lucroBrutoReal}
                    prev={totals.lucroBrutoPrev}
                    format={fmtMoney}
                    className={PROFIT_COL_CLASS}
                  />
                  <FootCell
                    real={totals.margemBrutaReal}
                    prev={totals.margemBrutaPrev}
                    format={fmtPct2}
                    className={PROFIT_COL_CLASS}
                  />
                  <td className="pt-3 text-right tabular-nums">
                    <div className="font-semibold text-fg-primary">
                      {totals.cpaReal !== null
                        ? fmtMoney2(totals.cpaReal)
                        : "—"}
                    </div>
                    <div className="text-[10px] text-fg-muted">
                      {totals.cpaPrev !== null ? fmtMoney2(totals.cpaPrev) : "—"}
                    </div>
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      {/* ── Análise por canal (UTM) ── */}
      <SalesByChannelTable data={salesByChannel} />
    </div>
  );
}
