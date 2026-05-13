import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { dailySessions, trackedSessions } from "@/server/db/schema";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  let body: { sessionId?: unknown; date?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400, headers: CORS });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : null;

  if (!sessionId || sessionId.length > 128 || !date) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400, headers: CORS });
  }

  const todayInSp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  if (date > todayInSp) {
    return NextResponse.json({ ok: false, reason: "future date" }, { headers: CORS });
  }

  // Tenta inserir o sessionId — se já existir, este é um page_viewed
  // adicional da mesma sessão e não conta como nova.
  const inserted = await db
    .insert(trackedSessions)
    .values({ sessionId, date })
    .onConflictDoNothing()
    .returning({ sessionId: trackedSessions.sessionId });

  if (inserted.length === 0) {
    return NextResponse.json({ ok: true, counted: false }, { headers: CORS });
  }

  // Sessão nova → incrementa o contador do dia.
  await db
    .insert(dailySessions)
    .values({ date, sessions: 1, syncedAt: new Date() })
    .onConflictDoUpdate({
      target: dailySessions.date,
      set: {
        sessions: sql`${dailySessions.sessions} + 1`,
        syncedAt: sql`now()`,
      },
    });

  return NextResponse.json({ ok: true, counted: true }, { headers: CORS });
}
