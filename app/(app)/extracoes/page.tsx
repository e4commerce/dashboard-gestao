import { PageHeader } from "@/components/layout/page-header";
import { getRecentExtractionLogs } from "@/server/etl/extract";
import { AutoRefreshOnSync } from "@/components/auto-refresh-on-sync";
import { ExtractForm } from "./extract-form";
import { formatDateTimeSP, formatDateBR } from "@/lib/format";

function fmtRange(from: Date, to: Date): string {
  return `${formatDateBR(from)} → ${formatDateBR(to)}`;
}

const STATUS_STYLES: Record<string, string> = {
  completed: "text-status-success",
  running: "text-status-info",
  failed: "text-status-error",
};

export default async function ExtracoesPage() {
  const logs = await getRecentExtractionLogs(20);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8">
      <AutoRefreshOnSync channel="shopify" />
      <PageHeader
        title="Extrações"
        subtitle="Histórico de importações do Shopify"
      />

      <ExtractForm />

      <div className="rounded-lg border border-border-default bg-surface-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-xs uppercase tracking-wider text-fg-muted">
              <th className="px-4 py-3 font-medium">Iniciado</th>
              <th className="px-4 py-3 font-medium">Período</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Pedidos</th>
              <th className="px-4 py-3 font-medium text-right">Novos</th>
              <th className="px-4 py-3 font-medium text-right">Dup.</th>
              <th className="px-4 py-3 font-medium text-right">Erros</th>
              <th className="px-4 py-3 font-medium text-right">Duração</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-fg-muted"
                >
                  Nenhuma extração executada ainda.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border-subtle last:border-0"
                >
                  <td className="px-4 py-3 text-fg-secondary">
                    {formatDateTimeSP(log.startedAt)}
                  </td>
                  <td className="px-4 py-3 text-fg-secondary">
                    {fmtRange(log.dateFrom, log.dateTo)}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${STATUS_STYLES[log.status] ?? "text-fg-muted"}`}
                  >
                    {log.status}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg-primary">
                    {log.ordersExtracted}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-status-success">
                    {log.ordersNew}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg-muted">
                    {log.ordersSkipped}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-status-error">
                    {log.errorsCount}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg-secondary">
                    {log.executionTimeMs
                      ? `${(log.executionTimeMs / 1000).toFixed(1)}s`
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
