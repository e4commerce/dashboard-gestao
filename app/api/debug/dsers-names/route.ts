import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { orders } from "@/server/db/schema";
import { fetchDsersOrders } from "@/server/dsers/client";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Endpoint temporário de diagnóstico — mostra os nomes que o Profitfy retorna
// e compara com os orderName do Shopify no DB.
// Acesse: GET /api/debug/dsers-names
// Remova após resolver o problema de matching.
export async function GET() {
  // Pega os 5 orderNames mais recentes do nosso DB
  const dbSample = await db
    .select({ orderName: orders.orderName, createdAt: orders.createdAt })
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(5);

  // Busca 1 dia recente do DSers (ontem, em Unix seconds)
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 86400;

  let dsersSample: string[] = [];
  let dsersError: string | null = null;
  let dsersTotal = 0;

  try {
    const dsersOrders = await fetchDsersOrders(oneDayAgo, now);
    dsersTotal = dsersOrders.length;
    dsersSample = dsersOrders.slice(0, 10).map((o) => o.name);
  } catch (err) {
    dsersError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    shopify_orderName_sample: dbSample.map((r) => ({
      orderName: r.orderName,
      createdAt: r.createdAt,
    })),
    dsers_name_sample: dsersSample,
    dsers_total_last_24h: dsersTotal,
    dsers_error: dsersError,
  });
}
