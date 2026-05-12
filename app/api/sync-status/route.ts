import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { cogsSyncLogs, extractionLogs } from "@/server/db/schema";
import { desc, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    shopifyRunningRows,
    cogsRunningRows,
    [latestShopify],
    [latestCogs],
  ] = await Promise.all([
    db
      .select({ id: extractionLogs.id, startedAt: extractionLogs.startedAt })
      .from(extractionLogs)
      .where(eq(extractionLogs.status, "running"))
      .orderBy(desc(extractionLogs.startedAt))
      .limit(1),
    db
      .select({ id: cogsSyncLogs.id, startedAt: cogsSyncLogs.startedAt })
      .from(cogsSyncLogs)
      .where(eq(cogsSyncLogs.status, "running"))
      .orderBy(desc(cogsSyncLogs.startedAt))
      .limit(1),
    db
      .select({
        id: extractionLogs.id,
        status: extractionLogs.status,
        completedAt: extractionLogs.completedAt,
      })
      .from(extractionLogs)
      .orderBy(desc(extractionLogs.startedAt))
      .limit(1),
    db
      .select({
        id: cogsSyncLogs.id,
        status: cogsSyncLogs.status,
        completedAt: cogsSyncLogs.completedAt,
      })
      .from(cogsSyncLogs)
      .orderBy(desc(cogsSyncLogs.startedAt))
      .limit(1),
  ]);

  return NextResponse.json({
    shopify: {
      running: shopifyRunningRows.length > 0,
      runningLogId: shopifyRunningRows[0]?.id ?? null,
      runningSince: shopifyRunningRows[0]?.startedAt ?? null,
      latest: latestShopify ?? null,
    },
    cogs: {
      running: cogsRunningRows.length > 0,
      runningLogId: cogsRunningRows[0]?.id ?? null,
      runningSince: cogsRunningRows[0]?.startedAt ?? null,
      latest: latestCogs ?? null,
    },
  });
}
