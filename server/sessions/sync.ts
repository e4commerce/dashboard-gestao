import "server-only";
import { db } from "@/server/db/client";
import { dailySessions } from "@/server/db/schema";
import { fetchDailySessions } from "@/server/shopify/sessions";
import { sql } from "drizzle-orm";

export type SessionsSyncResult = {
  upserted: number;
  dateFrom: string;
  dateTo: string;
  executionTimeMs: number;
};

export async function syncSessions(
  dateFrom: Date,
  dateTo: Date,
): Promise<SessionsSyncResult> {
  const t0 = Date.now();
  const rows = await fetchDailySessions(dateFrom, dateTo);

  if (rows.length > 0) {
    await db
      .insert(dailySessions)
      .values(
        rows.map((r) => ({
          date: r.date,
          sessions: r.sessions,
          syncedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: dailySessions.date,
        set: {
          sessions: sql`excluded.sessions`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }

  return {
    upserted: rows.length,
    dateFrom: dateFrom.toISOString().slice(0, 10),
    dateTo: dateTo.toISOString().slice(0, 10),
    executionTimeMs: Date.now() - t0,
  };
}
