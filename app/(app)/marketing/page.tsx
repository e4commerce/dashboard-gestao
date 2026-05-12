import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/month-picker";
import { RefreshDataButton } from "./refresh-button";
import { getDailyAdSpend, getAdsSummary } from "@/server/queries/ads";
import {
  parseMonthKey,
  toMonthKeySP,
  startOfMonthFromKey,
  endOfMonthFromKey,
} from "@/lib/datetime";
import { formatBRL, formatDateLabel } from "@/lib/format";
import { ScriptSetupCard } from "./script-setup";

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

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthKey(params.month) ?? toMonthKeySP(new Date());
  const from = startOfMonthFromKey(month);
  const to = endOfMonthFromKey(month);

  const [daily, summary] = await Promise.all([
    getDailyAdSpend(from, to),
    getAdsSummary(from, to),
  ]);

  const hasAnyData = summary.lastSyncAt !== null;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Marketing"
          subtitle={`Google Ads · Última coleta: ${fmtLastSync(summary.lastSyncAt)}`}
        />
        <div className="flex items-center gap-3">
          <MonthPicker month={month} />
          <RefreshDataButton />
        </div>
      </div>

      {!hasAnyData ? <ScriptSetupCard /> : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Investimento total"
          value={formatBRL(summary.totalSpend)}
          sub={`${summary.daysWithSpend} dia(s) com gasto`}
        />
        <StatCard
          label="Média diária"
          value={formatBRL(summary.avgDailySpend)}
          sub="apenas dias com gasto"
        />
        <StatCard
          label="Pico do mês"
          value={formatBRL(summary.peakSpend)}
          sub={summary.peakDate ? formatDateLabel(summary.peakDate) : "—"}
        />
        <StatCard
          label="Dias no período"
          value={daily.length.toString()}
          sub="dias com janela já passada"
        />
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-fg-primary">
              Investimento diário
            </h3>
            <p className="text-xs text-fg-muted">
              Dados recebidos via Google Ads Script
            </p>
          </div>
          {hasAnyData ? (
            <button
              type="button"
              className="text-[11px] text-fg-muted hover:text-fg-primary"
              title="Mostrar instruções de setup do script"
            >
              {/* Placeholder pra futura expansão (toggle ScriptSetupCard) */}
            </button>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <th className="pb-2 pr-3 font-medium text-fg-muted">Data</th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Investimento
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Cliques
                </th>
                <th className="pb-2 text-right font-medium text-fg-muted">
                  Impressões
                </th>
              </tr>
            </thead>
            <tbody>
              {daily.map((p) => (
                <tr key={p.date} className="odd:bg-surface-input/30">
                  <td className="py-2 pr-3 font-medium text-fg-primary">
                    {formatDateLabel(p.date)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                    {p.spend > 0 ? formatBRL(p.spend) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                    {p.clicks > 0 ? p.clicks.toLocaleString("pt-BR") : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums text-fg-secondary">
                    {p.impressions > 0
                      ? p.impressions.toLocaleString("pt-BR")
                      : "—"}
                  </td>
                </tr>
              ))}
              {daily.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-fg-muted">
                    Nenhum dado recebido. Configure o Google Ads Script para
                    começar a enviar.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {daily.length > 0 ? (
              <tfoot>
                <tr className="border-t border-border-default font-semibold">
                  <td className="pt-3 pr-3 text-fg-primary">Total</td>
                  <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    {formatBRL(summary.totalSpend)}
                  </td>
                  <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    {daily
                      .reduce((s, p) => s + p.clicks, 0)
                      .toLocaleString("pt-BR")}
                  </td>
                  <td className="pt-3 text-right tabular-nums text-fg-primary">
                    {daily
                      .reduce((s, p) => s + p.impressions, 0)
                      .toLocaleString("pt-BR")}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      {hasAnyData ? <ScriptSetupCard collapsed /> : null}
    </div>
  );
}
