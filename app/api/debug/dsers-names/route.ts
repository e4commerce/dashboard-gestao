import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { cogsSyncLogs, orders } from "@/server/db/schema";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Endpoint temporário de diagnóstico — mostra os nomes que o Profitfy retorna
// e compara com os orderName do Shopify no DB.
// Acesse: GET /api/debug/dsers-names
// Remova após resolver o problema de matching.
export async function GET() {
  const rawUrl = process.env.PROFITFY_API_URL;
  const apiKey = process.env.PROFITFY_API_KEY;

  if (!rawUrl || !apiKey) {
    return NextResponse.json({ error: "PROFITFY_API_URL ou PROFITFY_API_KEY não configurados" }, { status: 500 });
  }

  const baseUrl = rawUrl.replace(/\/$/, "").replace(/\/api$/, "");

  // Pega os 5 orderNames mais recentes do nosso DB
  const dbSample = await db
    .select({ orderName: orders.orderName, createdAt: orders.createdAt })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(5);

  // Tenta 30 dias para garantir que há pedidos no período
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 86400;

  let rawResponse: unknown = null;
  let dsersError: string | null = null;

  try {
    const res = await fetch(`${baseUrl}/api/v1/dsers/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        startTime: String(thirtyDaysAgo),
        endTime: String(now),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });

    const text = await res.text();
    if (!res.ok) {
      dsersError = `HTTP ${res.status}: ${text}`;
    } else {
      try {
        rawResponse = JSON.parse(text);
      } catch {
        dsersError = `Resposta não é JSON: ${text.slice(0, 200)}`;
      }
    }
  } catch (err) {
    dsersError = err instanceof Error ? err.message : String(err);
  }

  // Extrai amostra dos pedidos do DSers para mostrar a estrutura real
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = rawResponse as any;
  const dsersOrdersSample = Array.isArray(raw?.orders)
    ? raw.orders.slice(0, 5).map((o: Record<string, unknown>) => ({
        id: o.id,
        name: o.name,
        totalCost: o.totalCost,
        // mostra todos os campos para diagnóstico
        keys: Object.keys(o),
      }))
    : null;

  const normalize = (s: string) => s.replace(/^#/, "").trim();

  // Últimos 5 logs de sync — pra debugar falhas
  const recentLogs = await db
    .select({
      id: cogsSyncLogs.id,
      status: cogsSyncLogs.status,
      source: cogsSyncLogs.source,
      startedAt: cogsSyncLogs.startedAt,
      completedAt: cogsSyncLogs.completedAt,
      totalDsersOrders: cogsSyncLogs.totalDsersOrders,
      ourOrdersInRange: cogsSyncLogs.ourOrdersInRange,
      matched: cogsSyncLogs.matched,
      cleared: cogsSyncLogs.cleared,
      failedChunks: cogsSyncLogs.failedChunks,
      unmatchedSample: cogsSyncLogs.unmatchedSample,
      errorMessage: cogsSyncLogs.errorMessage,
      executionTimeMs: cogsSyncLogs.executionTimeMs,
    })
    .from(cogsSyncLogs)
    .orderBy(desc(cogsSyncLogs.startedAt))
    .limit(5);

  return NextResponse.json({
    api_url: baseUrl,
    shopify_sample: dbSample.map((r) => ({
      raw: r.orderName,
      normalized: r.orderName ? normalize(r.orderName) : null,
      createdAt: r.createdAt,
    })),
    dsers_response_top_keys: raw ? Object.keys(raw) : null,
    dsers_total: raw?.total ?? null,
    dsers_orders_count: Array.isArray(raw?.orders) ? raw.orders.length : null,
    dsers_sample: dsersOrdersSample,
    dsers_error: dsersError,
    recent_sync_logs: recentLogs,
  });
}
