import "server-only";
import { db } from "@/server/db/client";
import { mpPayments } from "@/server/db/schema";
import { and, gte, isNotNull, lt, sql } from "drizzle-orm";
import { toIsoDateSP, daysBetweenSP } from "@/lib/datetime";

export type DailyGatewayFee = {
  date: string;
  feeTotal: number;
  paymentCount: number;
};

export type MpSummary = {
  totalFees: number;
  paymentCount: number;
  avgFeePerPayment: number;
  feePct: number; // feeTotal / transactionTotal
  transactionTotal: number;
  lastSyncAt: Date | null;
};

// Agregado por dia de aprovação no fuso de SP. Filtra para status="approved"
// porque pagamentos não-aprovados não geram taxa real.
export async function getDailyGatewayFees(
  dateFrom: Date,
  dateTo: Date,
): Promise<DailyGatewayFee[]> {
  // SP = UTC-3. Convertendo para data ISO local antes de agrupar.
  const rows = await db
    .select({
      date: sql<string>`to_char((${mpPayments.dateApproved} AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD')`,
      feeTotal: sql<number>`COALESCE(SUM(${mpPayments.feeAmount})::float, 0)`,
      paymentCount: sql<number>`COUNT(*)::int`,
    })
    .from(mpPayments)
    .where(
      and(
        isNotNull(mpPayments.dateApproved),
        gte(mpPayments.dateApproved, dateFrom),
        lt(mpPayments.dateApproved, dateTo),
        sql`${mpPayments.status} = 'approved'`,
      ),
    )
    .groupBy(
      sql`to_char((${mpPayments.dateApproved} AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD')`,
    );

  const map = new Map<string, DailyGatewayFee>();
  for (const r of rows) {
    map.set(r.date, {
      date: r.date,
      feeTotal: r.feeTotal ?? 0,
      paymentCount: r.paymentCount ?? 0,
    });
  }

  const today = toIsoDateSP(new Date());
  const points: DailyGatewayFee[] = [];
  for (const d of daysBetweenSP(dateFrom, dateTo)) {
    const key = toIsoDateSP(d);
    if (key > today) break;
    points.push(map.get(key) ?? { date: key, feeTotal: 0, paymentCount: 0 });
  }
  return points;
}

export async function getMpSummary(
  dateFrom: Date,
  dateTo: Date,
): Promise<MpSummary> {
  const [agg] = await db
    .select({
      totalFees: sql<number>`COALESCE(SUM(${mpPayments.feeAmount})::float, 0)`,
      transactionTotal: sql<number>`COALESCE(SUM(${mpPayments.transactionAmount})::float, 0)`,
      paymentCount: sql<number>`COUNT(*)::int`,
      lastSync: sql<string | Date | null>`MAX(${mpPayments.syncedAt})`,
    })
    .from(mpPayments)
    .where(
      and(
        isNotNull(mpPayments.dateApproved),
        gte(mpPayments.dateApproved, dateFrom),
        lt(mpPayments.dateApproved, dateTo),
        sql`${mpPayments.status} = 'approved'`,
      ),
    );

  const totalFees = agg?.totalFees ?? 0;
  const transactionTotal = agg?.transactionTotal ?? 0;
  const paymentCount = agg?.paymentCount ?? 0;
  const lastSyncRaw = agg?.lastSync ?? null;

  return {
    totalFees,
    transactionTotal,
    paymentCount,
    avgFeePerPayment: paymentCount > 0 ? totalFees / paymentCount : 0,
    feePct: transactionTotal > 0 ? (totalFees / transactionTotal) * 100 : 0,
    lastSyncAt:
      lastSyncRaw == null
        ? null
        : lastSyncRaw instanceof Date
          ? lastSyncRaw
          : new Date(lastSyncRaw),
  };
}
