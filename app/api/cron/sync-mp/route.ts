import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpPayments } from "@/server/db/schema";
import { isMpSyncRunning, startMpSyncBackground } from "@/server/mercadopago/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isInitialSync(): Promise<boolean> {
  const [row] = await db.select({ id: mpPayments.id }).from(mpPayments).limit(1);
  return !row;
}

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.replace(/^Bearer\s+/i, "") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isMpSyncRunning()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "sync already in progress" });
  }

  const initial = await isInitialSync();
  const windowHours = initial ? 30 * 24 : 12;

  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - windowHours * 60 * 60 * 1000);

  try {
    const { logId } = await startMpSyncBackground(dateFrom, dateTo, "cron");
    return NextResponse.json({ ok: true, initial, windowHours, logId, mode: "background" });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
