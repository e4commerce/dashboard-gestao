// Roda as migrations Drizzle apontando para o DATABASE_URL atual.
// Usado pelo Railway como Pre-Deploy command (npx tsx scripts/migrate-prod.ts).
// Em dev local, prefira `pnpm db:migrate`.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definido");

  console.log("→ Conectando ao banco e aplicando migrations...");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "server/db/migrations" });
  await client.end();
  console.log("✓ Migrations aplicadas.");
}

main().catch((e) => {
  console.error("✗ Falha em migrate-prod:", e);
  process.exit(1);
});
