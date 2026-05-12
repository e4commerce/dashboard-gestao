import "server-only";
import { db } from "@/server/db/client";
import {
  orders,
  orderAttribution,
  utmParameters,
  extractionLogs,
} from "@/server/db/schema";
import { fetchOrdersPaginated, type ShopifyOrderNode } from "@/server/shopify/orders";
import { consolidaCanalPorSource } from "./channels";
import { eq, sql } from "drizzle-orm";

type ExtractionStats = {
  ordersExtracted: number;
  ordersNew: number;
  ordersSkipped: number;
  errorsCount: number;
};

function truncate(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  return value.length > max ? value.slice(0, max) : value;
}

async function processBatch(
  nodes: ShopifyOrderNode[],
  stats: ExtractionStats,
): Promise<void> {
  for (const node of nodes) {
    stats.ordersExtracted += 1;
    try {
      const totalAmount = node.totalPriceSet.shopMoney.amount;
      const currency = node.totalPriceSet.shopMoney.currencyCode;
      const journey = node.customerJourneySummary;
      const firstVisit = journey?.firstVisit ?? null;
      const lastVisit = journey?.lastVisit ?? null;
      const lastUtm = lastVisit?.utmParameters ?? null;
      const firstUtm = firstVisit?.utmParameters ?? null;

      const classification = consolidaCanalPorSource({
        sourceName: node.sourceName,
        firstVisitSource: firstVisit?.source,
        lastVisitSource: lastVisit?.source,
        utmMedium: lastUtm?.medium ?? firstUtm?.medium ?? null,
        utmCampaign: lastUtm?.campaign ?? firstUtm?.campaign ?? null,
      });

      const discountCodesStr =
        node.discountCodes.length > 0
          ? node.discountCodes.join(",")
          : null;
      const tagsStr = node.tags.length > 0 ? node.tags.join(",") : null;

      const inserted = await db
        .insert(orders)
        .values({
          shopifyOrderId: node.id,
          orderName: node.name,
          createdAt: new Date(node.createdAt),
          totalPrice: totalAmount,
          currency,
          financialStatus: node.displayFinancialStatus,
          fulfillmentStatus: node.displayFulfillmentStatus,
          customerEmail: node.customer?.email ?? null,
          customerName: node.customer?.displayName ?? null,
          sourceName: node.sourceName,
          appName: node.app?.name ?? null,
          discountCodes: discountCodesStr,
          tags: tagsStr,
        })
        .onConflictDoUpdate({
          target: orders.shopifyOrderId,
          set: {
            orderName: node.name,
            discountCodes: discountCodesStr,
            tags: tagsStr,
          },
        })
        .returning({ id: orders.id, isNew: sql<boolean>`(xmax = 0)` });

      if (inserted.length === 0) {
        stats.ordersSkipped += 1;
        continue;
      }
      const isNew = inserted[0].isNew;
      const orderId = inserted[0].id;
      if (isNew) {
        stats.ordersNew += 1;
      } else {
        stats.ordersSkipped += 1;
        continue;
      }

      await db.insert(orderAttribution).values({
        orderId,
        shopifyOrderId: node.id,
        channelName: truncate(classification.channelName, 64),
        subChannelName: truncate(classification.subChannelName, 64),
        channelHandle: truncate(classification.channelHandle, 64),
        isMarketplace: classification.isMarketplace,
        customerOrderIndex: journey?.customerOrderIndex ?? null,
        daysToConversion: journey?.daysToConversion ?? null,
        journeyReady: journey?.ready ?? null,
        firstVisitSource: truncate(firstVisit?.source ?? null, 128),
        lastVisitSource: truncate(lastVisit?.source ?? null, 128),
        firstVisitReferrerUrl: firstVisit?.referrerUrl ?? null,
        lastVisitReferrerUrl: lastVisit?.referrerUrl ?? null,
        firstVisitOccurredAt: firstVisit?.occurredAt
          ? new Date(firstVisit.occurredAt)
          : null,
        lastVisitOccurredAt: lastVisit?.occurredAt
          ? new Date(lastVisit.occurredAt)
          : null,
      });

      const utmRows = [];
      if (firstUtm) {
        utmRows.push({
          orderId,
          shopifyOrderId: node.id,
          visitType: "first_visit" as const,
          utmSource: truncate(firstUtm.source, 128),
          utmMedium: truncate(firstUtm.medium, 128),
          utmCampaign: truncate(firstUtm.campaign, 128),
          utmContent: truncate(firstUtm.content, 256),
          utmTerm: truncate(firstUtm.term, 256),
        });
      }
      if (lastUtm) {
        utmRows.push({
          orderId,
          shopifyOrderId: node.id,
          visitType: "last_visit" as const,
          utmSource: truncate(lastUtm.source, 128),
          utmMedium: truncate(lastUtm.medium, 128),
          utmCampaign: truncate(lastUtm.campaign, 128),
          utmContent: truncate(lastUtm.content, 256),
          utmTerm: truncate(lastUtm.term, 256),
        });
      }
      if (utmRows.length > 0) {
        await db.insert(utmParameters).values(utmRows);
      }
    } catch (err) {
      console.error("Failed processing order", node.id, err);
      stats.errorsCount += 1;
    }
  }
}

export async function runExtraction(
  dateFrom: Date,
  dateTo: Date,
  source: "shopify" | "manual" = "manual",
): Promise<{
  logId: number;
  stats: ExtractionStats;
  durationMs: number;
}> {
  const startedAt = Date.now();
  const [log] = await db
    .insert(extractionLogs)
    .values({
      source,
      status: "running",
      dateFrom,
      dateTo,
    })
    .returning({ id: extractionLogs.id });

  const stats: ExtractionStats = {
    ordersExtracted: 0,
    ordersNew: 0,
    ordersSkipped: 0,
    errorsCount: 0,
  };

  try {
    for await (const page of fetchOrdersPaginated(dateFrom, dateTo)) {
      await processBatch(page, stats);
    }

    const durationMs = Date.now() - startedAt;
    await db
      .update(extractionLogs)
      .set({
        status: "completed",
        ordersExtracted: stats.ordersExtracted,
        ordersNew: stats.ordersNew,
        ordersSkipped: stats.ordersSkipped,
        errorsCount: stats.errorsCount,
        executionTimeMs: durationMs,
        completedAt: new Date(),
      })
      .where(eq(extractionLogs.id, log.id));

    return { logId: log.id, stats, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(extractionLogs)
      .set({
        status: "failed",
        ordersExtracted: stats.ordersExtracted,
        ordersNew: stats.ordersNew,
        ordersSkipped: stats.ordersSkipped,
        errorsCount: stats.errorsCount + 1,
        errorMessage: message,
        executionTimeMs: durationMs,
        completedAt: new Date(),
      })
      .where(eq(extractionLogs.id, log.id));
    throw err;
  }
}

export async function getRecentExtractionLogs(limit = 10) {
  return db
    .select()
    .from(extractionLogs)
    .orderBy(sql`${extractionLogs.startedAt} DESC`)
    .limit(limit);
}
