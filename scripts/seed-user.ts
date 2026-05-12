import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env", override: false });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { users } from "../server/db/schema";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  const rl = readline.createInterface({ input, output });
  const email = (await rl.question("E-mail: ")).trim().toLowerCase();
  const name = (await rl.question("Nome (opcional): ")).trim() || null;
  const password = await rl.question("Senha (mín. 8 chars): ");
  rl.close();

  if (password.length < 8) {
    console.error("Senha precisa de pelo menos 8 caracteres.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, name })
      .where(eq(users.email, email));
    console.log(`✓ Usuário ${email} atualizado.`);
  } else {
    await db.insert(users).values({ email, name, passwordHash, role: "admin" });
    console.log(`✓ Usuário ${email} criado.`);
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
