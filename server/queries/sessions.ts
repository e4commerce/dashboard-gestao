import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { trackedSessions } from "@/server/db/schema";

export type HourlySession = {
  hour: number; // 0-23 em América/Sao_Paulo
  sessions: number;
  pageViews: number;
};

// Agrupa sessões pela hora de início (started_at convertido para SP).
// Filtra bots. Retorna 24 entradas mesmo quando não há tráfego em alguma hora.
export async function getHourlySessions(spDate: string): Promise<HourlySession[]> {
  const rows = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${trackedSessions.startedAt} AT TIME ZONE 'America/Sao_Paulo')::int`,
      sessions: sql<number>`COUNT(*)::int`,
      pageViews: sql<number>`COALESCE(SUM(${trackedSessions.pageViews}), 0)::int`,
    })
    .from(trackedSessions)
    .where(
      and(
        eq(trackedSessions.spDate, spDate),
        eq(trackedSessions.isBot, false),
      ),
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const map = new Map<number, HourlySession>();
  for (const r of rows) map.set(r.hour, r);

  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    sessions: map.get(h)?.sessions ?? 0,
    pageViews: map.get(h)?.pageViews ?? 0,
  }));
}
