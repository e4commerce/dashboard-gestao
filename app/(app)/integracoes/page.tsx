import Link from "next/link";
import {
  ShoppingBag,
  Megaphone,
  Search,
  CreditCard,
  Package,
  Users,
  ExternalLink,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/month-picker";
import { AutoRefreshOnSync } from "@/components/auto-refresh-on-sync";
import { ExtractForm } from "./extract-form";
import { CopyButton } from "./copy-button";
import {
  SyncCogsButton,
  SyncMpButton,
  SyncMetaButton,
} from "./sync-buttons";
import { getRecentExtractionLogs } from "@/server/etl/extract";
import { getRecentCogsSyncLogs } from "@/server/cogs/sync";
import { getRecentMpSyncLogs } from "@/server/mercadopago/sync";
import { getAdsSummary } from "@/server/queries/ads";
import { getHourlySessions, type HourlySession } from "@/server/queries/sessions";
import { db } from "@/server/db/client";
import { dailySessions } from "@/server/db/schema";
import { desc } from "drizzle-orm";
import { DayPicker } from "@/components/day-picker";
import { toIsoDateSP } from "@/lib/datetime";
import {
  parseMonthKey,
  toMonthKeySP,
  startOfMonthFromKey,
  endOfMonthFromKey,
} from "@/lib/datetime";
import { formatBRL, formatDateBR, formatDateTimeSP } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  completed: "text-status-success",
  running: "text-status-info",
  failed: "text-status-error",
};

function relativeFromNow(d: Date | string | null): string {
  if (!d) return "nunca";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  return `há ${days} dia${days !== 1 ? "s" : ""}`;
}

function durationLabel(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function sourceLabel(s: string | null | undefined): string {
  if (!s) return "—";
  if (s === "manual") return "Manual";
  if (s === "cron") return "Cron";
  if (s === "shopify") return "Webhook";
  return s;
}

type SectionHeaderProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  lastSync: Date | string | null;
  cron: string;
};

function SectionHeader({
  icon,
  title,
  description,
  lastSync,
  cron,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-surface-input text-fg-primary [&_svg]:size-5">
          {icon}
        </div>
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-fg-primary">{title}</h3>
          <p className="text-xs text-fg-muted">{description}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 text-right">
        <span className="text-[11px] text-fg-muted">
          Último sync: {relativeFromNow(lastSync)}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-fg-muted">
          <Clock className="size-3" strokeWidth={2.25} />
          {cron}
        </span>
      </div>
    </div>
  );
}

type HistoryTableProps = {
  columns: string[];
  rows: Array<{
    id: number;
    cells: Array<string | React.ReactNode>;
  }>;
  emptyLabel?: string;
};

function HistoryTable({
  columns,
  rows,
  emptyLabel = "Nenhum sync registrado ainda.",
}: HistoryTableProps) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border-subtle text-left">
          {columns.map((c, i) => (
            <th
              key={c}
              className={`pb-2 font-medium text-fg-muted ${i === 0 ? "pr-4" : i === columns.length - 1 ? "" : "px-4"} ${i === 0 ? "" : "text-right"}`}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border-subtle">
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={columns.length}
              className="py-6 text-center text-fg-muted"
            >
              {emptyLabel}
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.id}>
              {r.cells.map((cell, i) => (
                <td
                  key={i}
                  className={`py-2.5 ${i === 0 ? "pr-4" : i === r.cells.length - 1 ? "" : "px-4"} ${i === 0 ? "text-fg-secondary" : "text-right tabular-nums text-fg-secondary"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

type DailySessionRow = { id: number; date: string; sessions: number; syncedAt: Date };

function HourlySessionsCard({
  day,
  hourly,
}: {
  day: string;
  hourly: HourlySession[];
}) {
  const totalSessions = hourly.reduce((s, h) => s + h.sessions, 0);
  const totalPageViews = hourly.reduce((s, h) => s + h.pageViews, 0);
  const peak = hourly.reduce((m, h) => Math.max(m, h.sessions), 0);
  const peakHour = hourly.find((h) => h.sessions === peak && peak > 0);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border-default bg-surface-input p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-fg-primary">
            Detalhamento horário
          </p>
          <p className="text-[11px] text-fg-muted">
            {totalSessions.toLocaleString("pt-BR")} sessões ·{" "}
            {totalPageViews.toLocaleString("pt-BR")} page views
            {peakHour
              ? ` · pico ${String(peakHour.hour).padStart(2, "0")}h (${peak.toLocaleString("pt-BR")})`
              : ""}
          </p>
        </div>
        <DayPicker day={day} paramName="sessionsDay" />
      </div>

      <div className="overflow-hidden rounded border border-border-subtle bg-surface-card">
        <div className="grid grid-cols-[44px_1fr_64px] gap-0 border-b border-border-subtle bg-surface-input px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-fg-muted">
          <span>Hora</span>
          <span>Sessões</span>
          <span className="text-right">Page views</span>
        </div>
        {hourly.map((h) => {
          const pct = peak > 0 ? (h.sessions / peak) * 100 : 0;
          return (
            <div
              key={h.hour}
              className="grid grid-cols-[44px_1fr_64px] items-center border-b border-border-subtle/40 px-2 py-1 text-xs last:border-b-0"
            >
              <span className="font-medium tabular-nums text-fg-muted">
                {String(h.hour).padStart(2, "0")}h
              </span>
              <div className="relative h-5">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm bg-action-primary/25"
                  style={{ width: `${pct}%` }}
                />
                <span className="absolute inset-y-0 left-2 flex items-center font-medium tabular-nums text-fg-primary">
                  {h.sessions > 0 ? h.sessions.toLocaleString("pt-BR") : "—"}
                </span>
              </div>
              <span className="text-right tabular-nums text-fg-muted">
                {h.pageViews > 0 ? h.pageViews.toLocaleString("pt-BR") : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildPixelCode(appUrl: string): string {
  const endpoint = `${appUrl.replace(/\/$/, "")}/api/track/session`;
  return `// Dashboard Gestão — Web Pixel (sessões)
// Instale em: Shopify Admin → Settings → Customer events → Add custom pixel
// Envia todo page_viewed para o backend; agregação de sessão (30 min +
// virada de dia em SP) e filtro de bot rodam server-side.

const ENDPOINT = '${endpoint}';

analytics.subscribe('page_viewed', (event) => {
  try {
    const ua = event.context?.navigator?.userAgent ?? null;
    const payload = {
      clientId: event.clientId,
      timestamp: event.timestamp,
      userAgent: ua,
    };

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify(payload),
    });
  } catch (_) {}
});`;
}

function SessionsSection({
  recentSessions,
  appUrl,
  sessionsDay,
  hourly,
}: {
  recentSessions: DailySessionRow[];
  appUrl: string;
  sessionsDay: string;
  hourly: HourlySession[];
}) {
  const pixelCode = buildPixelCode(appUrl);
  const lastSync = recentSessions[0]?.syncedAt ?? null;

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border-default bg-surface-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-surface-input text-fg-primary [&_svg]:size-5">
            <Users strokeWidth={1.75} />
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-fg-primary">
              Shopify · Sessões
            </h3>
            <p className="text-xs text-fg-muted">
              Contagem diária via Custom Web Pixel
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-[11px] text-fg-muted">
            Último registro: {lastSync ? relativeFromNow(lastSync) : "nunca"}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-fg-muted">
            <Clock className="size-3" strokeWidth={2.25} />
            Tempo real (por page view)
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-border-default bg-surface-input p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-fg-primary">
            1. Vá em{" "}
            <span className="font-semibold">
              Shopify Admin → Settings → Customer events → Add custom pixel
            </span>
          </p>
          <CopyButton text={pixelCode} />
        </div>
        <p className="text-xs text-fg-muted">
          2. Cole o código abaixo, dê um nome (ex: &quot;Dashboard Sessões&quot;) e salve.
        </p>
        <pre className="mt-1 overflow-x-auto rounded border border-border-subtle bg-surface-card p-3 text-[10px] leading-relaxed text-fg-secondary">
          {pixelCode}
        </pre>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-fg-primary">Como funciona</p>
        <p className="text-xs text-fg-muted">
          O pixel envia todo evento <code className="rounded bg-surface-input px-1 py-0.5 text-[10px]">page_viewed</code> com{" "}
          <code className="rounded bg-surface-input px-1 py-0.5 text-[10px]">clientId</code> (identificador
          do visitante fornecido pela Shopify, sucessor do <code className="rounded bg-surface-input px-1 py-0.5 text-[10px]">_shopify_y</code>),
          timestamp e User-Agent. O backend agrega em sessões: 30 min de inatividade encerra,
          virada de dia em São Paulo encerra, bots conhecidos no User-Agent ficam de fora do
          contador. Resultado deve bater com Analytics → Sessions do Shopify Admin (margem 1-3%).
        </p>
      </div>

      <HourlySessionsCard day={sessionsDay} hourly={hourly} />

      <HistoryTable
        columns={["Data", "Sessões", "Último registro"]}
        rows={recentSessions.map((r) => ({
          id: r.id,
          cells: [r.date, r.sessions.toLocaleString("pt-BR"), formatDateTimeSP(r.syncedAt)],
        }))}
        emptyLabel="Nenhuma sessão registrada ainda. Instale o pixel para começar."
      />
    </section>
  );
}

export default async function IntegracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; sessionsDay?: string }>;
}) {
  const params = await searchParams;
  const month = parseMonthKey(params.month) ?? toMonthKeySP(new Date());
  const from = startOfMonthFromKey(month);
  const to = endOfMonthFromKey(month);

  const sessionsDay =
    typeof params.sessionsDay === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.sessionsDay)
      ? params.sessionsDay
      : toIsoDateSP(new Date());

  const [extractionLogs, cogsLogs, mpLogs, adsSummary, recentSessions, hourly] =
    await Promise.all([
      getRecentExtractionLogs(10),
      getRecentCogsSyncLogs(10),
      getRecentMpSyncLogs(10),
      getAdsSummary(from, to),
      db
        .select()
        .from(dailySessions)
        .orderBy(desc(dailySessions.date))
        .limit(10),
      getHourlySessions(sessionsDay),
    ]);

  const lastExtraction =
    extractionLogs.find((l) => l.status === "completed") ?? extractionLogs[0];
  const lastCogs = cogsLogs.find((l) => l.status === "completed") ?? cogsLogs[0];
  const lastMp = mpLogs.find((l) => l.status === "completed") ?? mpLogs[0];

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
      <AutoRefreshOnSync channel="cogs" />
      <AutoRefreshOnSync channel="mp" />
      <AutoRefreshOnSync channel="shopify" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Integrações"
          subtitle="Status, sincronização manual e histórico de cada plataforma"
        />
        <MonthPicker month={month} />
      </div>

      {/* ── Shopify ── */}
      <section className="flex flex-col gap-5 rounded-lg border border-border-default bg-surface-card p-6">
        <SectionHeader
          icon={<ShoppingBag strokeWidth={1.75} />}
          title="Shopify · Pedidos"
          description="Importa pedidos da loja para a base local"
          lastSync={
            lastExtraction?.completedAt ?? lastExtraction?.startedAt ?? null
          }
          cron="A cada 5 min"
        />
        <ExtractForm />
        <HistoryTable
          columns={[
            "Iniciado",
            "Origem",
            "Status",
            "Período",
            "Pedidos",
            "Novos",
            "Dup.",
            "Erros",
            "Duração",
          ]}
          rows={extractionLogs.map((log) => ({
            id: log.id,
            cells: [
              formatDateTimeSP(log.startedAt),
              sourceLabel(log.source),
              <span
                key="status"
                className={`font-medium ${STATUS_STYLES[log.status] ?? "text-fg-muted"}`}
              >
                {log.status}
              </span>,
              `${formatDateBR(log.dateFrom)} → ${formatDateBR(log.dateTo)}`,
              log.ordersExtracted,
              <span key="new" className="text-status-success">
                {log.ordersNew}
              </span>,
              <span key="dup" className="text-fg-muted">
                {log.ordersSkipped}
              </span>,
              <span
                key="err"
                className={log.errorsCount > 0 ? "text-status-error" : ""}
              >
                {log.errorsCount}
              </span>,
              durationLabel(log.executionTimeMs),
            ],
          }))}
        />
      </section>

      {/* ── Meta Ads ── */}
      <section className="flex flex-col gap-5 rounded-lg border border-border-default bg-surface-card p-6">
        <SectionHeader
          icon={<Megaphone strokeWidth={1.75} />}
          title="Meta Ads"
          description="Insights de campanhas via Graph API"
          lastSync={adsSummary.lastSyncByPlatform.meta}
          cron="A cada 5 min"
        />
        <div className="flex flex-wrap items-center gap-3">
          <SyncMetaButton month={month} />
          <Link
            href="/marketing/contas"
            className="flex items-center gap-1.5 rounded-md border border-border-default bg-surface-card px-3 py-2 text-xs font-medium text-fg-secondary hover:bg-surface-card-hover hover:text-fg-primary"
          >
            Contas Meta
            <ExternalLink className="size-3" strokeWidth={2.25} />
          </Link>
        </div>
        <p className="text-xs text-fg-muted">
          Sincronização manual processa o mês selecionado. O cron interno cobre
          apenas os últimos dias para alimentar a Visão Geral em tempo real.
        </p>
      </section>

      {/* ── Google Ads ── */}
      <section className="flex flex-col gap-5 rounded-lg border border-border-default bg-surface-card p-6">
        <SectionHeader
          icon={<Search strokeWidth={1.75} />}
          title="Google Ads"
          description="Spend diário enviado pelo Google Ads Script"
          lastSync={adsSummary.lastSyncByPlatform.google}
          cron="Script externo (horária)"
        />
        <p className="text-xs text-fg-muted">
          Não há sincronização manual a partir do backend — os dados são
          enviados pelo Google Ads Script via webhook. Para forçar coleta de
          histórico, edite{" "}
          <code className="rounded bg-surface-input px-1 py-0.5 text-[10px] text-fg-primary">
            DAYS_TO_SYNC
          </code>{" "}
          no script e rode &quot;Preview&quot; manualmente.
        </p>
      </section>

      {/* ── Shopify Sessions (Web Pixel) ── */}
      <SessionsSection
        recentSessions={recentSessions}
        appUrl={process.env.NEXTAUTH_URL ?? "https://dashboard-gestao-production.up.railway.app"}
        sessionsDay={sessionsDay}
        hourly={hourly}
      />

      {/* ── Mercado Pago ── */}
      <section className="flex flex-col gap-5 rounded-lg border border-border-default bg-surface-card p-6">
        <SectionHeader
          icon={<CreditCard strokeWidth={1.75} />}
          title="Mercado Pago"
          description="Taxas de gateway por pagamento aprovado"
          lastSync={lastMp?.completedAt ?? lastMp?.startedAt ?? null}
          cron="A cada 5 min"
        />
        <SyncMpButton month={month} />
        <HistoryTable
          columns={[
            "Iniciado",
            "Origem",
            "Status",
            "Período",
            "Buscados",
            "Salvos",
            "Taxa total",
            "Duração",
          ]}
          rows={mpLogs.map((log) => ({
            id: log.id,
            cells: [
              formatDateTimeSP(log.startedAt),
              sourceLabel(log.source),
              <span
                key="status"
                className={`font-medium ${STATUS_STYLES[log.status] ?? "text-fg-muted"}`}
              >
                {log.status}
              </span>,
              `${formatDateBR(log.dateFrom)} → ${formatDateBR(log.dateTo)}`,
              log.paymentsFetched,
              log.paymentsUpserted,
              log.totalFees ? formatBRL(Number(log.totalFees), 2) : "—",
              durationLabel(log.executionTimeMs),
            ],
          }))}
        />
      </section>

      {/* ── DSers ── */}
      <section className="flex flex-col gap-5 rounded-lg border border-border-default bg-surface-card p-6">
        <SectionHeader
          icon={<Package strokeWidth={1.75} />}
          title="DSers · COGS"
          description="Custo de produto sincronizado por pedido"
          lastSync={lastCogs?.completedAt ?? lastCogs?.startedAt ?? null}
          cron="Diário às 00:30 (SP)"
        />
        <SyncCogsButton month={month} />
        <HistoryTable
          columns={[
            "Iniciado",
            "Origem",
            "Status",
            "DSers/Nossos",
            "Confirmados",
            "Limpos",
            "Duração",
          ]}
          rows={cogsLogs.map((log) => ({
            id: log.id,
            cells: [
              formatDateTimeSP(log.startedAt),
              sourceLabel(log.source),
              <span
                key="status"
                className={`font-medium ${STATUS_STYLES[log.status] ?? "text-fg-muted"}`}
              >
                {log.status}
              </span>,
              `${log.totalDsersOrders ?? "—"} / ${log.ourOrdersInRange ?? "—"}`,
              <span key="matched" className="text-status-success">
                {log.matched}
              </span>,
              <span key="cleared" className="text-fg-muted">
                {log.cleared}
              </span>,
              durationLabel(log.executionTimeMs),
            ],
          }))}
        />
      </section>
    </div>
  );
}
