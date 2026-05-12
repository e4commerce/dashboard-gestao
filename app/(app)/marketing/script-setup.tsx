import { headers } from "next/headers";
import { ScriptCopyBlock } from "./script-copy";

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function generateScript(webhookUrl: string, secret: string): string {
  return `// Google Ads Script: envia spend diario para o dashboard
// 1. Cole o script inteiro no Google Ads (Bulk actions -> Scripts -> Novo script)
// 2. Salve, autorize a execucao
// 3. Agende para rodar Hourly (frequencia minima do Google Ads Scripts)
// 4. Para sincronizar manualmente: clique em Preview -> Run now

var WEBHOOK_URL = '${webhookUrl}';
var SECRET = '${secret}';

// Dias a re-enviar a cada execucao (1 = ontem; 7 = backfill da ultima semana)
var DAYS_TO_SYNC = 7;

function main() {
  var accountId = String(AdsApp.currentAccount().getCustomerId()).replace(/-/g, '');
  var entries = [];
  var today = new Date();

  for (var i = 0; i < DAYS_TO_SYNC; i++) {
    var date = new Date(today.getTime() - i * 86400000);
    var dateStr = Utilities.formatDate(date, 'America/Sao_Paulo', 'yyyy-MM-dd');

    var query =
      "SELECT segments.date, metrics.cost_micros, metrics.clicks, " +
      "metrics.impressions, metrics.conversions, metrics.conversions_value, " +
      "customer.currency_code " +
      "FROM customer " +
      "WHERE segments.date = '" + dateStr + "'";

    var iter = AdsApp.search(query);
    while (iter.hasNext()) {
      var row = iter.next();
      entries.push({
        date: dateStr,
        accountId: accountId,
        spend: Number(row.metrics.costMicros || 0) / 1000000,
        clicks: parseInt(row.metrics.clicks || 0),
        impressions: parseInt(row.metrics.impressions || 0),
        conversions: Number(row.metrics.conversions || 0),
        conversionValue: Number(row.metrics.conversionsValue || 0),
        currency: row.customer.currencyCode || 'BRL'
      });
    }
  }

  if (entries.length === 0) {
    Logger.log('Nenhuma data com gasto no intervalo.');
    return;
  }

  var response = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ entries: entries }),
    headers: { Authorization: 'Bearer ' + SECRET },
    muteHttpExceptions: true
  });

  Logger.log('HTTP ' + response.getResponseCode() + ': ' + response.getContentText());
}
`;
}

type Props = { collapsed?: boolean };

export async function ScriptSetupCard({ collapsed = false }: Props) {
  const origin = await getOrigin();
  const webhookUrl = `${origin}/api/webhooks/google-ads`;
  const secret = process.env.GOOGLE_ADS_WEBHOOK_SECRET ?? "";
  const script = generateScript(webhookUrl, secret);
  const secretMissing = !secret;

  if (collapsed) {
    return (
      <details className="rounded-lg border border-border-default bg-surface-card p-4">
        <summary className="cursor-pointer text-xs font-medium text-fg-muted hover:text-fg-primary">
          Setup do Google Ads Script (clique para expandir)
        </summary>
        <div className="mt-4">
          <SetupContent
            webhookUrl={webhookUrl}
            script={script}
            secretMissing={secretMissing}
          />
        </div>
      </details>
    );
  }

  return (
    <section className="rounded-lg border border-border-default bg-surface-card p-6">
      <h3 className="mb-2 text-sm font-semibold text-fg-primary">
        Configure o Google Ads Script
      </h3>
      <p className="mb-4 text-xs text-fg-muted">
        Setup único: cola o script no Google Ads, agenda hourly, pronto. Sem
        developer token, sem OAuth.
      </p>
      <SetupContent
        webhookUrl={webhookUrl}
        script={script}
        secretMissing={secretMissing}
      />
    </section>
  );
}

function SetupContent({
  webhookUrl,
  script,
  secretMissing,
}: {
  webhookUrl: string;
  script: string;
  secretMissing: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 text-xs">
      {secretMissing ? (
        <div className="rounded-md border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-status-warning">
          ⚠ <code className="font-mono">GOOGLE_ADS_WEBHOOK_SECRET</code> não está
          definido em <code className="font-mono">.env.local</code>. Adicione e reinicie o servidor.
        </div>
      ) : null}

      <ol className="ml-4 list-decimal space-y-2 text-fg-secondary">
        <li>
          No Google Ads, vá em <span className="font-semibold">Ferramentas → Bulk actions → Scripts</span>{" "}
          → <span className="font-semibold">+ Novo script</span>
        </li>
        <li>Apague o código de exemplo e cole o script abaixo (use o botão Copiar)</li>
        <li>
          Clique em <span className="font-semibold">Authorize</span> (libera o fetch
          para o webhook)
        </li>
        <li>
          Salve, depois agende: <span className="font-semibold">Frequency: Hourly</span>{" "}
          (mínimo permitido pelo Google Ads)
        </li>
        <li>
          Para testar agora: clique em{" "}
          <span className="font-semibold">Preview</span> → <span className="font-semibold">Run now</span>.
          Confira em <code className="font-mono">Logs</code> que retornou{" "}
          <code className="font-mono">HTTP 200</code>
        </li>
      </ol>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">
          Webhook URL
        </span>
        <code className="rounded-md border border-border-subtle bg-surface-input px-3 py-2 text-[11px] text-fg-primary">
          {webhookUrl}
        </code>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-fg-muted">
          Script (já com webhook e secret embutidos — copie tudo)
        </span>
        <ScriptCopyBlock script={script} />
      </div>
    </div>
  );
}
