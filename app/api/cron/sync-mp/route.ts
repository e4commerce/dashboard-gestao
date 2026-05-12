import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { mpPayments } from "@/server/db/schema";
import { runMpSync } from "@/server/mercadopago/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const initial = await isInitialSync();
  const windowHours = initial ? 30 * 24 : 12;

  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - windowHours * 60 * 60 * 1000);

  try {
    const { logId, result } = await runMpSync(dateFrom, dateTo, "cron");
    return NextResponse.json({ ok: true, initial, windowHours, logId, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
