import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// Lazy: o connection só é criado quando o `db` é efetivamente usado em runtime.
// Isso evita que o build do Next.js (que importa módulos para coletar metadata
// de páginas) estoure quando DATABASE_URL não está disponível em build-time.

declare global {
  // eslint-disable-next-line no-var
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not defined");

  const client =
    globalThis.__pgClient ??
    postgres(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__pgClient = client;
  }

  return drizzle(client, { schema });
}

let dbInstance: ReturnType<typeof createDb> | null = null;

export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    if (!dbInstance) dbInstance = createDb();
    const value = Reflect.get(dbInstance as object, prop);
    return typeof value === "function" ? value.bind(dbInstance) : value;
  },
});

export { schema };
