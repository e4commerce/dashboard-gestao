import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { orders } from "@/server/db/schema";
import { runExtraction } from "@/server/etl/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function isInitialSync(): Promise<boolean> {
  const [row] = await db.select({ id: orders.id }).from(orders).limit(1);
  return !row;
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const daysParam = url.searchParams.get("days");

  let windowHours: number;
  let initial = false;

  if (daysParam) {
    windowHours = Math.max(1, Math.min(30, Number(daysParam))) * 24;
  } else {
    initial = await isInitialSync();
    windowHours = initial ? 30 * 24 : 12;
  }

  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - windowHours * 60 * 60 * 1000);

  try {
    const result = await runExtraction(dateFrom, dateTo, "shopify");
    return NextResponse.json({
      ok: true,
      initial,
      windowHours,
      logId: result.logId,
      stats: result.stats,
      durationMs: result.durationMs,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
