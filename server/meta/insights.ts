import "server-only";
import { metaGet } from "./client";

export type MetaDailyInsight = {
  date: string; // YYYY-MM-DD
  accountId: string; // sem prefixo "act_"
  spend: number;
  clicks: number;
  impressions: number;
  reach: number | null;
  conversions: number; // ações do tipo "purchase"
  conversionValue: number; // valor das purchases
  currency: string;
};

type InsightAction = { action_type: string; value: string };

type InsightRow = {
  account_id: string;
  date_start: string;
  date_stop: string;
  spend?: string;
  clicks?: string;
  impressions?: string;
  reach?: string;
  actions?: InsightAction[];
  action_values?: InsightAction[];
  account_currency?: string;
};

type InsightsResponse = {
  data: InsightRow[];
  paging?: { cursors?: { before: string; after: string }; next?: string };
};

const PURCHASE_ACTION_TYPES = new Set([
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
]);

function sumPurchases(actions?: InsightAction[]): number {
  if (!actions) return 0;
  let total = 0;
  for (const a of actions) {
    if (PURCHASE_ACTION_TYPES.has(a.action_type)) {
      total += Number(a.value) || 0;
    }
  }
  return total;
}

// Busca insights diários (time_increment=1) account-level no período informado.
// Lida com paginação por cursor.
export async function fetchAccountDailyInsights(
  accountIdWithPrefix: string,
  since: string, // YYYY-MM-DD
  until: string, // YYYY-MM-DD inclusivo
): Promise<MetaDailyInsight[]> {
  const params = {
    level: "account",
    time_increment: 1,
    time_range: JSON.stringify({ since, until }),
    fields:
      "account_id,date_start,date_stop,spend,clicks,impressions,reach,actions,action_values,account_currency",
    limit: 200,
  } as const;

  const results: MetaDailyInsight[] = [];
  let path: string | null = `/${accountIdWithPrefix}/insights`;
  let queryParams: Record<string, string | number> | null = params;

  while (path) {
    const res: InsightsResponse = await metaGet<InsightsResponse>(
      path,
      queryParams ?? {},
    );
    for (const row of res.data) {
      results.push({
        date: row.date_start,
        accountId: row.account_id,
        spend: Number(row.spend ?? "0") || 0,
        clicks: Number(row.clicks ?? "0") || 0,
        impressions: Number(row.impressions ?? "0") || 0,
        reach: row.reach != null ? Number(row.reach) : null,
        conversions: sumPurchases(row.actions),
        conversionValue: sumPurchases(row.action_values),
        currency: row.account_currency ?? "BRL",
      });
    }
    // Próxima página vem como URL absoluta — extraímos só o path
    if (res.paging?.next) {
      const next = new URL(res.paging.next);
      path = next.pathname.replace(/^\/v\d+\.\d+/, "");
      queryParams = Object.fromEntries(next.searchParams.entries());
      // remove access_token da query — metaGet adiciona de novo
      delete (queryParams as Record<string, string>).access_token;
    } else {
      path = null;
      queryParams = null;
    }
  }

  return results;
}
