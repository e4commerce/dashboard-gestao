import "server-only";
import { db } from "@/server/db/client";
import { mpPayments, mpSyncLogs } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { fetchPaymentsInRange } from "./payments";

export type MpSyncResult = {
  paymentsFetched: number;
  paymentsUpserted: number;
  totalFees: number;
  durationMs: number;
};

async function executeMpSync(
  logId: number,
  dateFrom: Date,
  dateTo: Date,
): Promise<MpSyncResult> {
  const startedAt = Date.now();
  let paymentsFetched = 0;
  let paymentsUpserted = 0;
  let totalFees = 0;

  try {
    await fetchPaymentsInRange(dateFrom, dateTo, async (batch) => {
      paymentsFetched += batch.length;
      const now = new Date();

      for (const p of batch) {
        await db
          .insert(mpPayments)
          .values({
            id: p.id,
            status: p.status,
            statusDetail: p.statusDetail,
            dateCreated: p.dateCreated,
            dateApproved: p.dateApproved,
            transactionAmount:
              p.transactionAmount != null
                ? p.transactionAmount.toFixed(2)
                : null,
            feeAmount: p.feeAmount.toFixed(2),
            netReceivedAmount:
              p.netReceivedAmount != null
                ? p.netReceivedAmount.toFixed(2)
                : null,
            externalReference: p.externalReference,
            paymentMethodId: p.paymentMethodId,
            paymentTypeId: p.paymentTypeId,
            currency: p.currency,
            syncedAt: now,
          })
          .onConflictDoUpdate({
            target: mpPayments.id,
            set: {
              status: p.status,
              statusDetail: p.statusDetail,
              dateApproved: p.dateApproved,
              transactionAmount:
                p.transactionAmount != null
                  ? p.transactionAmount.toFixed(2)
                  : null,
              feeAmount: p.feeAmount.toFixed(2),
              netReceivedAmount:
                p.netReceivedAmount != null
                  ? p.netReceivedAmount.toFixed(2)
                  : null,
              externalReference: p.externalReference,
              syncedAt: now,
            },
          });
        paymentsUpserted++;
        totalFees += p.feeAmount;
      }
    });

    const durationMs = Date.now() - startedAt;
    await db
      .update(mpSyncLogs)
      .set({
        status: "completed",
        paymentsFetched,
        paymentsUpserted,
        totalFees: totalFees.toFixed(2),
        executionTimeMs: durationMs,
        completedAt: new Date(),
      })
      .where(eq(mpSyncLogs.id, logId));

    return { paymentsFetched, paymentsUpserted, totalFees, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(mpSyncLogs)
      .set({
        status: "failed",
        paymentsFetched,
        paymentsUpserted,
        errorMessage: message,
        executionTimeMs: durationMs,
        completedAt: new Date(),
      })
      .where(eq(mpSyncLogs.id, logId));
    throw err;
  }
}

// Fire-and-forget: cria log com status "running", dispara o trabalho em
// background e retorna o logId imediatamente.
export async function startMpSyncBackground(
  dateFrom: Date,
  dateTo: Date,
  source: "manual" | "cron" = "manual",
): Promise<{ logId: number }> {
  const [log] = await db
    .insert(mpSyncLogs)
    .values({ source, status: "running", dateFrom, dateTo })
    .returning({ id: mpSyncLogs.id });

  void executeMpSync(log.id, dateFrom, dateTo).catch((err) => {
    console.error("[mp-sync:bg] background sync failed", err);
  });

  return { logId: log.id };
}

// Síncrona: usada pelo cron interno.
export async function runMpSync(
  dateFrom: Date,
  dateTo: Date,
  source: "manual" | "cron" = "manual",
): Promise<{ logId: number; result: MpSyncResult }> {
  const [log] = await db
    .insert(mpSyncLogs)
    .values({ source, status: "running", dateFrom, dateTo })
    .returning({ id: mpSyncLogs.id });

  const result = await executeMpSync(log.id, dateFrom, dateTo);
  return { logId: log.id, result };
}

export async function getRecentMpSyncLogs(limit = 10) {
  return db
    .select()
    .from(mpSyncLogs)
    .orderBy(sql`${mpSyncLogs.startedAt} DESC`)
    .limit(limit);
}

export async function isMpSyncRunning(): Promise<boolean> {
  const [row] = await db
    .select({ id: mpSyncLogs.id })
    .from(mpSyncLogs)
    .where(eq(mpSyncLogs.status, "running"))
    .limit(1);
  return Boolean(row);
}

export async function cleanupOrphanedMpSyncs(): Promise<number> {
  const result = await db
    .update(mpSyncLogs)
    .set({
      status: "failed",
      errorMessage: "Interrompida pelo restart do servidor",
      completedAt: new Date(),
    })
    .where(eq(mpSyncLogs.status, "running"))
    .returning({ id: mpSyncLogs.id });
  return result.length;
}
