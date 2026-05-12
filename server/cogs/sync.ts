import "server-only";
import { db } from "@/server/db/client";
import { orders } from "@/server/db/schema";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { fetchDsersOrders, type DsersOrder } from "@/server/dsers/client";

export type CogsSyncResult = {
  // Quantos pedidos a API do DSers retornou no período
  totalDsersOrders: number;
  // Pedidos do nosso banco no mesmo período
  ourOrdersInRange: number;
  ourOrdersWithName: number;
  // Pedidos confirmados pelo DSers → COGS real atualizado
  matched: number;
  // Pedidos que tinham COGS antigo (estimado) mas DSers não confirma → limpos
  cleared: number;
  // Chunks (dias) que falharam — útil para retry
  failedChunks: string[];
  // Pedidos do DSers que não casaram com nenhum pedido nosso
  unmatchedSample: string[];
  durationMs: number;
};

const normalize = (s: string) => s.replace(/^#/, "").trim();

// A API do DSers só aguenta ~1 dia de janela por chamada (~43s).
// Quebramos o range em chunks diários e rodamos com paralelismo limitado.
async function fetchDsersChunked(
  dateFrom: Date,
  dateTo: Date,
): Promise<{ orders: DsersOrder[]; failedChunks: string[] }> {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const CONCURRENCY = 3;

  type Chunk = { startUnix: number; endUnix: number; label: string };
  const chunks: Chunk[] = [];
  let cursor = dateFrom.getTime();
  while (cursor < dateTo.getTime()) {
    const dayEnd = Math.min(cursor + ONE_DAY_MS, dateTo.getTime());
    chunks.push({
      startUnix: Math.floor(cursor / 1000),
      endUnix: Math.floor((dayEnd - 1000) / 1000),
      label: new Date(cursor).toISOString().slice(0, 10),
    });
    cursor = dayEnd;
  }

  const all: DsersOrder[] = [];
  const failedChunks: string[] = [];

  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((c) => fetchDsersOrders(c.startUnix, c.endUnix)),
    );
    results.forEach((r, j) => {
      if (r.status === "fulfilled") all.push(...r.value);
      else failedChunks.push(batch[j].label);
    });
  }

  return { orders: all, failedChunks };
}

export async function syncCogs(
  dateFrom: Date,
  dateTo: Date,
): Promise<CogsSyncResult> {
  const startedAt = Date.now();

  // 1. Busca pedidos efetivamente processados no DSers (fonte da verdade).
  // Chunked por dia porque a API trava em ranges maiores.
  const { orders: dsersOrders, failedChunks } = await fetchDsersChunked(
    dateFrom,
    dateTo,
  );

  const dsersByName = new Map<string, number>();
  for (const d of dsersOrders) {
    if (d.name) dsersByName.set(normalize(d.name), d.totalCostCents / 100);
  }

  // 2. Pedidos do nosso DB no mesmo período
  const ourOrders = await db
    .select({
      id: orders.id,
      orderName: orders.orderName,
      cogsAmount: orders.cogsAmount,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, dateFrom), lt(orders.createdAt, dateTo)));

  const ourOrdersWithName = ourOrders.filter((o) => o.orderName).length;
  const now = new Date();

  // Conjunto dos nomes que casaram para identificar os "unmatched do DSers"
  const matchedNames = new Set<string>();

  let matched = 0;
  let cleared = 0;

  for (const o of ourOrders) {
    if (!o.orderName) continue;
    const norm = normalize(o.orderName);
    const dsersCost = dsersByName.get(norm);

    if (dsersCost !== undefined) {
      // Confirmado pelo DSers → atualiza com custo real
      await db
        .update(orders)
        .set({
          cogsAmount: dsersCost.toFixed(2),
          cogsSource: "dsers",
          cogsUpdatedAt: now,
        })
        .where(eq(orders.id, o.id));
      matched++;
      matchedNames.add(norm);
    } else if (o.cogsAmount !== null) {
      // Tinha COGS (provavelmente estimado pela Profitfy) mas DSers não confirma
      // → limpa, é dado não-confiável
      await db
        .update(orders)
        .set({
          cogsAmount: null,
          cogsSource: null,
          cogsUpdatedAt: null,
        })
        .where(eq(orders.id, o.id));
      cleared++;
    }
  }

  // Pedidos do DSers que não achamos no nosso banco (amostra para debug)
  const unmatchedSample: string[] = [];
  for (const d of dsersOrders) {
    if (!d.name) continue;
    if (!matchedNames.has(normalize(d.name))) {
      if (unmatchedSample.length < 10) unmatchedSample.push(d.name);
    }
  }

  return {
    totalDsersOrders: dsersOrders.length,
    ourOrdersInRange: ourOrders.length,
    ourOrdersWithName,
    matched,
    cleared,
    failedChunks,
    unmatchedSample,
    durationMs: Date.now() - startedAt,
  };
}

// Última sincronização registrada
export async function getLastSyncTimestamp(): Promise<Date | null> {
  const [row] = await db
    .select({ latest: sql<string | Date | null>`MAX(${orders.cogsUpdatedAt})` })
    .from(orders);
  const raw = row?.latest;
  if (raw == null) return null;
  return raw instanceof Date ? raw : new Date(raw);
}
