import "server-only";
import { db } from "@/server/db/client";
import { cogsSyncLogs, orders } from "@/server/db/schema";
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

async function executeCogsSync(
  logId: number,
  dateFrom: Date,
  dateTo: Date,
): Promise<CogsSyncResult> {
  try {
    const result = await syncCogs(dateFrom, dateTo);
    await db
      .update(cogsSyncLogs)
      .set({
        status: "completed",
        totalDsersOrders: result.totalDsersOrders,
        ourOrdersInRange: result.ourOrdersInRange,
        ourOrdersWithName: result.ourOrdersWithName,
        matched: result.matched,
        cleared: result.cleared,
        failedChunks: JSON.stringify(result.failedChunks),
        unmatchedSample: JSON.stringify(result.unmatchedSample),
        executionTimeMs: result.durationMs,
        completedAt: new Date(),
      })
      .where(eq(cogsSyncLogs.id, logId));
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(cogsSyncLogs)
      .set({
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(cogsSyncLogs.id, logId));
    throw err;
  }
}

// Cria log e dispara o sync em background; retorna o logId imediatamente.
export async function startCogsSyncBackground(
  dateFrom: Date,
  dateTo: Date,
  source: "manual" | "cron" = "manual",
): Promise<{ logId: number }> {
  const [log] = await db
    .insert(cogsSyncLogs)
    .values({ source, status: "running", dateFrom, dateTo })
    .returning({ id: cogsSyncLogs.id });

  void executeCogsSync(log.id, dateFrom, dateTo).catch((err) => {
    console.error("[cogs-sync:bg] background sync failed", err);
  });

  return { logId: log.id };
}

// Variante síncrona: cria log, executa, e retorna o resultado. Usada pelo cron.
export async function runCogsSync(
  dateFrom: Date,
  dateTo: Date,
  source: "manual" | "cron" = "manual",
): Promise<{ logId: number; result: CogsSyncResult }> {
  const [log] = await db
    .insert(cogsSyncLogs)
    .values({ source, status: "running", dateFrom, dateTo })
    .returning({ id: cogsSyncLogs.id });

  const result = await executeCogsSync(log.id, dateFrom, dateTo);
  return { logId: log.id, result };
}

export async function getRecentCogsSyncLogs(limit = 10) {
  return db
    .select()
    .from(cogsSyncLogs)
    .orderBy(sql`${cogsSyncLogs.startedAt} DESC`)
    .limit(limit);
}

export async function isCogsSyncRunning(): Promise<boolean> {
  const [row] = await db
    .select({ id: cogsSyncLogs.id })
    .from(cogsSyncLogs)
    .where(eq(cogsSyncLogs.status, "running"))
    .limit(1);
  return Boolean(row);
}

export async function cleanupOrphanedCogsSyncs(): Promise<number> {
  const result = await db
    .update(cogsSyncLogs)
    .set({
      status: "failed",
      errorMessage: "Interrompida pelo restart do servidor",
      completedAt: new Date(),
    })
    .where(eq(cogsSyncLogs.status, "running"))
    .returning({ id: cogsSyncLogs.id });
  return result.length;
}
