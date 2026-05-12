import Link from "next/link";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/month-picker";
import { RefreshDataButton } from "./refresh-button";
import { SyncMetaButton } from "./sync-meta-button";
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
  if (!d) return "nunca";
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

  const hasGoogle = summary.lastSyncByPlatform.google !== null;
  const hasMeta = summary.lastSyncByPlatform.meta !== null;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Marketing"
          subtitle={`Google: ${fmtLastSync(summary.lastSyncByPlatform.google)} · Meta: ${fmtLastSync(summary.lastSyncByPlatform.meta)}`}
        />
        <div className="flex items-center gap-3">
          <MonthPicker month={month} />
          <Link
            href="/marketing/contas"
            title="Configurar quais contas Meta sincronizar"
            className="flex items-center gap-2 rounded-md border border-border-default bg-surface-card px-3 py-2 text-xs font-medium text-fg-secondary transition-colors hover:bg-surface-card-hover hover:text-fg-primary"
          >
            <Settings className="size-3.5" strokeWidth={2.25} />
            Contas Meta
          </Link>
          <SyncMetaButton month={month} />
          <RefreshDataButton />
        </div>
      </div>

      {!hasGoogle && !hasMeta ? <ScriptSetupCard /> : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Investimento total"
          value={formatBRL(summary.totalSpend)}
          sub={`Meta ${formatBRL(summary.byPlatform.meta)} · Google ${formatBRL(summary.byPlatform.google)}`}
        />
        <StatCard
          label="Média diária"
          value={formatBRL(summary.avgDailySpend)}
          sub={`${summary.daysWithSpend} dia(s) com gasto`}
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
              Meta via Graph API · Google via Google Ads Script
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <th className="pb-2 pr-3 font-medium text-fg-muted">Data</th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Meta
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Google
                </th>
                <th className="pb-2 pr-3 text-right font-medium text-fg-muted">
                  Total
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
                    {p.meta.spend > 0 ? formatBRL(p.meta.spend) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                    {p.google.spend > 0 ? formatBRL(p.google.spend) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums font-medium text-fg-primary">
                    {p.total.spend > 0 ? formatBRL(p.total.spend) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-fg-secondary">
                    {p.total.clicks > 0
                      ? p.total.clicks.toLocaleString("pt-BR")
                      : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums text-fg-secondary">
                    {p.total.impressions > 0
                      ? p.total.impressions.toLocaleString("pt-BR")
                      : "—"}
                  </td>
                </tr>
              ))}
              {daily.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-fg-muted">
                    Nenhum dado recebido ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {daily.length > 0 ? (
              <tfoot>
                <tr className="border-t border-border-default font-semibold">
                  <td className="pt-3 pr-3 text-fg-primary">Total</td>
                  <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    {formatBRL(summary.byPlatform.meta)}
                  </td>
                  <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    {formatBRL(summary.byPlatform.google)}
                  </td>
                  <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    {formatBRL(summary.totalSpend)}
                  </td>
                  <td className="pt-3 pr-3 text-right tabular-nums text-fg-primary">
                    {daily
                      .reduce((s, p) => s + p.total.clicks, 0)
                      .toLocaleString("pt-BR")}
                  </td>
                  <td className="pt-3 text-right tabular-nums text-fg-primary">
                    {daily
                      .reduce((s, p) => s + p.total.impressions, 0)
                      .toLocaleString("pt-BR")}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      {!hasGoogle ? <ScriptSetupCard /> : <ScriptSetupCard collapsed />}
    </div>
  );
}
