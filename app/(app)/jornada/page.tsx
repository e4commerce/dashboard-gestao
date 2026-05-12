import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/month-picker";
import { JourneyTrendChart } from "@/components/dashboard/journey-trend-chart";
import { JourneyDistributionChart } from "@/components/dashboard/journey-distribution-chart";
import { JourneyChannelTable, JourneyOrderIndexTable } from "@/components/dashboard/journey-breakdown-tables";
import {
  getJourneyDailyTrend,
  getJourneyDistribution,
  getJourneySummary,
  getJourneyByChannel,
  getJourneyByOrderIndex,
} from "@/server/queries/journey";
import {
  parseMonthKey,
  toMonthKeySP,
  startOfMonthFromKey,
  endOfMonthFromKey,
} from "@/lib/datetime";
import { formatBRL } from "@/lib/format";

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  accent?: "neutral" | "positive" | "negative";
};

function StatCard({ label, value, sub, accent = "neutral" }: StatCardProps) {
  const valueColor =
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
      <span className={`text-2xl font-bold tabular-nums tracking-tight ${valueColor}`}>
        {value}
      </span>
      {sub ? <span className="text-xs text-fg-muted">{sub}</span> : null}
    </div>
  );
}

function TicketDelta({ fast, slow }: { fast: number; slow: number }) {
  if (fast <= 0 || slow <= 0) return null;
  const delta = ((slow - fast) / fast) * 100;
  const positive = delta > 0;
  return (
    <p className={`text-xs ${positive ? "text-status-success" : "text-status-error"}`}>
      {positive ? "+" : ""}
      {delta.toFixed(1)}% nas jornadas longas
    </p>
  );
}

export default async function JornadaPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthKey(params.month) ?? toMonthKeySP(new Date());
  const from = startOfMonthFromKey(month);
  const to = endOfMonthFromKey(month);

  const [trend, distribution, summary, byChannel, byOrderIndex] =
    await Promise.all([
      getJourneyDailyTrend(from, to),
      getJourneyDistribution(from, to),
      getJourneySummary(from, to),
      getJourneyByChannel(from, to),
      getJourneyByOrderIndex(from, to),
    ]);

  const hasData = summary.ordersWithJourney > 0;
  const coveragePct =
    summary.totalOrders > 0
      ? ((summary.ordersWithJourney / summary.totalOrders) * 100).toFixed(0)
      : "0";

  const avgLabel =
    !hasData
      ? "—"
      : summary.avgDays < 1
        ? "< 1 dia"
        : `${summary.avgDays}d`;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Jornada de Compra"
          subtitle="Tempo entre primeira visita e conversão"
        />
        <MonthPicker month={month} />
      </div>

      {/* ── Resumo principal ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Jornada média"
          value={avgLabel}
          sub="do primeiro contato à compra"
        />
        <StatCard
          label="Mesmo dia"
          value={hasData ? `${summary.sameDayPct.toFixed(1)}%` : "—"}
          sub={`${distribution.find((b) => b.key === "same_day")?.count ?? 0} pedidos`}
          accent={summary.sameDayPct >= 50 ? "positive" : "neutral"}
        />
        <StatCard
          label="Cobertura"
          value={`${coveragePct}%`}
          sub={`${summary.ordersWithJourney} de ${summary.totalOrders} pedidos`}
        />
        <StatCard
          label="Pedidos com jornada"
          value={summary.ordersWithJourney.toLocaleString("pt-BR")}
          sub={`total no período`}
        />
      </div>

      {/* ── Comparativo de ticket por velocidade ── */}
      {(summary.fastAvgTicket > 0 || summary.slowAvgTicket > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 rounded-lg border border-border-default bg-surface-card p-5">
            <span className="text-xs font-medium uppercase tracking-wider text-fg-muted">
              Ticket — jornada rápida
            </span>
            <span className="text-xs text-fg-muted">Compras em até 3 dias</span>
            <span className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-fg-primary">
              {summary.fastAvgTicket > 0 ? formatBRL(summary.fastAvgTicket, 2) : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-lg border border-border-default bg-surface-card p-5">
            <span className="text-xs font-medium uppercase tracking-wider text-fg-muted">
              Ticket — jornada longa
            </span>
            <span className="text-xs text-fg-muted">Compras a partir de 8 dias</span>
            <span className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-fg-primary">
              {summary.slowAvgTicket > 0 ? formatBRL(summary.slowAvgTicket, 2) : "—"}
            </span>
            <TicketDelta fast={summary.fastAvgTicket} slow={summary.slowAvgTicket} />
          </div>
        </div>
      )}

      {/* ── Tendência diária ── */}
      <JourneyTrendChart data={trend} />

      {/* ── Distribuição por faixa + ticket médio ── */}
      <JourneyDistributionChart data={distribution} />

      {/* ── Tabelas de análise ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <JourneyChannelTable data={byChannel} />
        <JourneyOrderIndexTable data={byOrderIndex} />
      </div>
    </div>
  );
}
