// Script idempotente que cria 1 linha em order_cogs_history para cada pedido
// que já tem cogsAmount preenchido mas ainda não tem nenhum registro histórico.
//
// Roda uma vez após aplicar a migration que cria order_cogs_history.
// Idempotente: pode ser rodado várias vezes, só insere o que falta.
//
// Uso:
//   npx tsx scripts/backfill-cogs-history.ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "dotenv";
import { orderCogsHistory, orders } from "../server/db/schema";
import { sql } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env", override: false });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definido");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log("→ Selecionando pedidos com cogsAmount mas sem histórico...");

  // Pedidos que têm COGS e ainda não estão em order_cogs_history
  const rows = await db
    .select({
      id: orders.id,
      cogsAmount: orders.cogsAmount,
      cogsSource: orders.cogsSource,
      cogsUpdatedAt: orders.cogsUpdatedAt,
    })
    .from(orders)
    .where(
      sql`${orders.cogsAmount} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ${orderCogsHistory} WHERE ${orderCogsHistory.orderId} = ${orders.id})`,
    );

  console.log(`→ Encontrados ${rows.length} pedidos para fazer backfill`);

  if (rows.length === 0) {
    console.log("✓ Nada a fazer — histórico já está completo.");
    await client.end();
    return;
  }

  // Insere em batches
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await db.insert(orderCogsHistory).values(
      chunk.map((r) => ({
        orderId: r.id,
        cogsAmount: r.cogsAmount,
        cogsSource: r.cogsSource,
        changeReason: "backfill" as const,
        syncLogId: null,
        changedAt: r.cogsUpdatedAt ?? new Date(),
      })),
    );
    console.log(`  inseridos ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  console.log("✓ Backfill concluído.");
  await client.end();
}

main().catch((err) => {
  console.error("✗ Erro no backfill:", err);
  process.exit(1);
});
