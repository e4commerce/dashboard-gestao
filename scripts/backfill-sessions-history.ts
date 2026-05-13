// Backfill manual de daily_sessions com dados históricos exportados do
// Shopify Admin (Analytics → Reports → Sessions over time).
// Idempotente: UPSERT por data, sobrescreve o valor existente.
//
// Uso:
//   npx tsx scripts/backfill-sessions-history.ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "dotenv";
import { dailySessions } from "../server/db/schema";
import { sql } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env", override: false });

// Dados de 2026-01-01 a 2026-05-12 do relatório Shopify "Sessions over time"
const HISTORICAL: Array<{ date: string; sessions: number }> = [
  { date: "2026-01-01", sessions: 22596 },
  { date: "2026-01-02", sessions: 20910 },
  { date: "2026-01-03", sessions: 21378 },
  { date: "2026-01-04", sessions: 20675 },
  { date: "2026-01-05", sessions: 21452 },
  { date: "2026-01-06", sessions: 19651 },
  { date: "2026-01-07", sessions: 20232 },
  { date: "2026-01-08", sessions: 19286 },
  { date: "2026-01-09", sessions: 20099 },
  { date: "2026-01-10", sessions: 24555 },
  { date: "2026-01-11", sessions: 23302 },
  { date: "2026-01-12", sessions: 21734 },
  { date: "2026-01-13", sessions: 22403 },
  { date: "2026-01-14", sessions: 17324 },
  { date: "2026-01-15", sessions: 17090 },
  { date: "2026-01-16", sessions: 16132 },
  { date: "2026-01-17", sessions: 15595 },
  { date: "2026-01-18", sessions: 18539 },
  { date: "2026-01-19", sessions: 19547 },
  { date: "2026-01-20", sessions: 16035 },
  { date: "2026-01-21", sessions: 16990 },
  { date: "2026-01-22", sessions: 15914 },
  { date: "2026-01-23", sessions: 16282 },
  { date: "2026-01-24", sessions: 16270 },
  { date: "2026-01-25", sessions: 15437 },
  { date: "2026-01-26", sessions: 18079 },
  { date: "2026-01-27", sessions: 16234 },
  { date: "2026-01-28", sessions: 15827 },
  { date: "2026-01-29", sessions: 15638 },
  { date: "2026-01-30", sessions: 13261 },
  { date: "2026-01-31", sessions: 17785 },
  { date: "2026-02-01", sessions: 19409 },
  { date: "2026-02-02", sessions: 15656 },
  { date: "2026-02-03", sessions: 16892 },
  { date: "2026-02-04", sessions: 15827 },
  { date: "2026-02-05", sessions: 16183 },
  { date: "2026-02-06", sessions: 13503 },
  { date: "2026-02-07", sessions: 13734 },
  { date: "2026-02-08", sessions: 15993 },
  { date: "2026-02-09", sessions: 15068 },
  { date: "2026-02-10", sessions: 14406 },
  { date: "2026-02-11", sessions: 14438 },
  { date: "2026-02-12", sessions: 12693 },
  { date: "2026-02-13", sessions: 13943 },
  { date: "2026-02-14", sessions: 13416 },
  { date: "2026-02-15", sessions: 13686 },
  { date: "2026-02-16", sessions: 15123 },
  { date: "2026-02-17", sessions: 15464 },
  { date: "2026-02-18", sessions: 16101 },
  { date: "2026-02-19", sessions: 16357 },
  { date: "2026-02-20", sessions: 15371 },
  { date: "2026-02-21", sessions: 15909 },
  { date: "2026-02-22", sessions: 19492 },
  { date: "2026-02-23", sessions: 17262 },
  { date: "2026-02-24", sessions: 18360 },
  { date: "2026-02-25", sessions: 15439 },
  { date: "2026-02-26", sessions: 18047 },
  { date: "2026-02-27", sessions: 18133 },
  { date: "2026-02-28", sessions: 21309 },
  { date: "2026-03-01", sessions: 20078 },
  { date: "2026-03-02", sessions: 15888 },
  { date: "2026-03-03", sessions: 15801 },
  { date: "2026-03-04", sessions: 15761 },
  { date: "2026-03-05", sessions: 15566 },
  { date: "2026-03-06", sessions: 13884 },
  { date: "2026-03-07", sessions: 15597 },
  { date: "2026-03-08", sessions: 20305 },
  { date: "2026-03-09", sessions: 19381 },
  { date: "2026-03-10", sessions: 18854 },
  { date: "2026-03-11", sessions: 19104 },
  { date: "2026-03-12", sessions: 24311 },
  { date: "2026-03-13", sessions: 34762 },
  { date: "2026-03-14", sessions: 30155 },
  { date: "2026-03-15", sessions: 40449 },
  { date: "2026-03-16", sessions: 18365 },
  { date: "2026-03-17", sessions: 20700 },
  { date: "2026-03-18", sessions: 16363 },
  { date: "2026-03-19", sessions: 17537 },
  { date: "2026-03-20", sessions: 16081 },
  { date: "2026-03-21", sessions: 15543 },
  { date: "2026-03-22", sessions: 20149 },
  { date: "2026-03-23", sessions: 20396 },
  { date: "2026-03-24", sessions: 21556 },
  { date: "2026-03-25", sessions: 21360 },
  { date: "2026-03-26", sessions: 22601 },
  { date: "2026-03-27", sessions: 19375 },
  { date: "2026-03-28", sessions: 14894 },
  { date: "2026-03-29", sessions: 17081 },
  { date: "2026-03-30", sessions: 15208 },
  { date: "2026-03-31", sessions: 13245 },
  { date: "2026-04-01", sessions: 11840 },
  { date: "2026-04-02", sessions: 15669 },
  { date: "2026-04-03", sessions: 15606 },
  { date: "2026-04-04", sessions: 13267 },
  { date: "2026-04-05", sessions: 15635 },
  { date: "2026-04-06", sessions: 15651 },
  { date: "2026-04-07", sessions: 17547 },
  { date: "2026-04-08", sessions: 18101 },
  { date: "2026-04-09", sessions: 16149 },
  { date: "2026-04-10", sessions: 18046 },
  { date: "2026-04-11", sessions: 20995 },
  { date: "2026-04-12", sessions: 25750 },
  { date: "2026-04-13", sessions: 20483 },
  { date: "2026-04-14", sessions: 21018 },
  { date: "2026-04-15", sessions: 22639 },
  { date: "2026-04-16", sessions: 21418 },
  { date: "2026-04-17", sessions: 22072 },
  { date: "2026-04-18", sessions: 22198 },
  { date: "2026-04-19", sessions: 22731 },
  { date: "2026-04-20", sessions: 22523 },
  { date: "2026-04-21", sessions: 21788 },
  { date: "2026-04-22", sessions: 19606 },
  { date: "2026-04-23", sessions: 20562 },
  { date: "2026-04-24", sessions: 22140 },
  { date: "2026-04-25", sessions: 21363 },
  { date: "2026-04-26", sessions: 34204 },
  { date: "2026-04-27", sessions: 30080 },
  { date: "2026-04-28", sessions: 32491 },
  { date: "2026-04-29", sessions: 31946 },
  { date: "2026-04-30", sessions: 35654 },
  { date: "2026-05-01", sessions: 33624 },
  { date: "2026-05-02", sessions: 23633 },
  { date: "2026-05-03", sessions: 23717 },
  { date: "2026-05-04", sessions: 23587 },
  { date: "2026-05-05", sessions: 20995 },
  { date: "2026-05-06", sessions: 21217 },
  { date: "2026-05-07", sessions: 18533 },
  { date: "2026-05-08", sessions: 17721 },
  { date: "2026-05-09", sessions: 15238 },
  { date: "2026-05-10", sessions: 17608 },
  { date: "2026-05-11", sessions: 19322 },
  { date: "2026-05-12", sessions: 20589 },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definido");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log(`→ Inserindo/atualizando ${HISTORICAL.length} dias em daily_sessions...`);

  const now = new Date();
  await db
    .insert(dailySessions)
    .values(HISTORICAL.map((r) => ({ date: r.date, sessions: r.sessions, syncedAt: now })))
    .onConflictDoUpdate({
      target: dailySessions.date,
      set: {
        sessions: sql`excluded.sessions`,
        syncedAt: sql`excluded.synced_at`,
      },
    });

  const total = HISTORICAL.reduce((s, r) => s + r.sessions, 0);
  console.log(`✓ ${HISTORICAL.length} dias gravados · total ${total.toLocaleString("pt-BR")} sessões`);
  console.log(`  primeira data: ${HISTORICAL[0].date}`);
  console.log(`  última data:   ${HISTORICAL[HISTORICAL.length - 1].date}`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
