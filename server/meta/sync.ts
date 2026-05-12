import "server-only";
import { db } from "@/server/db/client";
import { adsInsights, metaAdAccounts } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { fetchAccountDailyInsights } from "./insights";
import { listMyAdAccounts } from "./client";

export type MetaSyncResult = {
  accountsProcessed: number;
  daysImported: number;
  errors: Array<{ accountId: string; message: string }>;
  durationMs: number;
};

export type DiscoverResult = {
  discovered: number;
  newlyAdded: number;
};

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Lê /me/adaccounts e faz upsert na tabela meta_ad_accounts.
// Preserva o campo `enabled` em rows existentes — só atualiza metadata.
export async function discoverMetaAccounts(): Promise<DiscoverResult> {
  const accounts = await listMyAdAccounts();
  const now = new Date();
  let newlyAdded = 0;

  for (const acc of accounts) {
    const result = await db
      .insert(metaAdAccounts)
      .values({
        id: acc.id,
        name: acc.name,
        currency: acc.currency ?? null,
        accountStatus: acc.accountStatus ?? null,
        enabled: false,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: metaAdAccounts.id,
        set: {
          name: acc.name,
          currency: acc.currency ?? null,
          accountStatus: acc.accountStatus ?? null,
          updatedAt: now,
          // enabled NÃO é tocado — preserva a escolha do usuário
        },
      })
      .returning({ inserted: metaAdAccounts.discoveredAt });
    // Heurística: se discoveredAt == updatedAt (recém-criado), é novo
    if (result.length > 0) {
      const wasNew =
        result[0].inserted.getTime() === now.getTime() ||
        Math.abs(result[0].inserted.getTime() - now.getTime()) < 1000;
      if (wasNew) newlyAdded++;
    }
  }

  return { discovered: accounts.length, newlyAdded };
}

export async function setMetaAccountEnabled(
  id: string,
  enabled: boolean,
): Promise<void> {
  await db
    .update(metaAdAccounts)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(metaAdAccounts.id, id));
}

export async function getEnabledMetaAccountIds(): Promise<string[]> {
  const rows = await db
    .select({ id: metaAdAccounts.id })
    .from(metaAdAccounts)
    .where(eq(metaAdAccounts.enabled, true));
  return rows.map((r) => r.id);
}

export async function getAllMetaAccounts() {
  return db
    .select()
    .from(metaAdAccounts)
    .orderBy(metaAdAccounts.enabled, metaAdAccounts.name);
}

// Puxa insights diários das contas marcadas como `enabled=true` e grava em
// ads_insights com upsert por (platform, account_id, date).
export async function syncMetaInsights(
  dateFrom: Date,
  dateTo: Date,
): Promise<MetaSyncResult> {
  const startedAt = Date.now();
  const accounts = await getEnabledMetaAccountIds();
  if (accounts.length === 0) {
    return {
      accountsProcessed: 0,
      daysImported: 0,
      errors: [
        {
          accountId: "—",
          message:
            "Nenhuma conta Meta habilitada. Vá em /marketing/contas e marque pelo menos uma.",
        },
      ],
      durationMs: Date.now() - startedAt,
    };
  }

  const since = toIsoDate(dateFrom);
  const until = toIsoDate(new Date(dateTo.getTime() - 1));
  const now = new Date();
  const errors: Array<{ accountId: string; message: string }> = [];
  let daysImported = 0;
  let accountsProcessed = 0;

  for (const accountId of accounts) {
    try {
      const rows = await fetchAccountDailyInsights(accountId, since, until);
      const stripped = accountId.replace(/^act_/, "");

      for (const row of rows) {
        await db
          .insert(adsInsights)
          .values({
            platform: "meta",
            accountId: stripped,
            date: row.date,
            spend: row.spend.toFixed(2),
            currency: row.currency,
            clicks: row.clicks,
            impressions: row.impressions,
            conversions: row.conversions.toFixed(2),
            conversionValue: row.conversionValue.toFixed(2),
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              adsInsights.platform,
              adsInsights.accountId,
              adsInsights.date,
            ],
            set: {
              spend: row.spend.toFixed(2),
              currency: row.currency,
              clicks: row.clicks,
              impressions: row.impressions,
              conversions: row.conversions.toFixed(2),
              conversionValue: row.conversionValue.toFixed(2),
              updatedAt: now,
            },
          });
        daysImported++;
      }
      accountsProcessed++;
    } catch (err) {
      errors.push({
        accountId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    accountsProcessed,
    daysImported,
    errors,
    durationMs: Date.now() - startedAt,
  };
}
