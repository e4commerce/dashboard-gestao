import { NextResponse } from "next/server";
import { syncSessions } from "@/server/sessions/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.replace(/^Bearer\s+/i, "") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sync last 35 days to keep a rolling window with enough history.
  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - 35 * 24 * 60 * 60 * 1000);

  try {
    const result = await syncSessions(dateFrom, dateTo);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
