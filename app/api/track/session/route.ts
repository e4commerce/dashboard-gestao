import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { dailySessions, trackedSessions } from "@/server/db/schema";
import { isBotUserAgent } from "@/lib/bot-detection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const CLIENT_ID_MAX = 64;

type Payload = {
  clientId?: unknown;
  timestamp?: unknown;
  userAgent?: unknown;
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function spDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400, headers: CORS });
  }

  const clientId =
    typeof body.clientId === "string" && body.clientId.length > 0 && body.clientId.length <= CLIENT_ID_MAX
      ? body.clientId
      : null;

  const rawTs = typeof body.timestamp === "number"
    ? body.timestamp
    : typeof body.timestamp === "string"
      ? Date.parse(body.timestamp)
      : NaN;

  const userAgent =
    typeof body.userAgent === "string" && body.userAgent.length > 0
      ? body.userAgent.slice(0, 1000)
      : null;

  if (!clientId || !Number.isFinite(rawTs)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400, headers: CORS });
  }

  const now = new Date();
  const eventTs = new Date(rawTs);

  // Rejeita timestamps absurdos (5 min no futuro, mais de 1 dia atrás).
  if (eventTs.getTime() > now.getTime() + 5 * 60 * 1000) {
    return NextResponse.json({ ok: false, reason: "future" }, { headers: CORS });
  }
  if (eventTs.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
    return NextResponse.json({ ok: false, reason: "stale" }, { headers: CORS });
  }

  const isBot = isBotUserAgent(userAgent);
  const date = spDate(eventTs);

  const counted = await db.transaction(async (tx) => {
    // Pega a sessão mais recente (não-encerrada) deste clientId.
    const [latest] = await tx
      .select()
      .from(trackedSessions)
      .where(
        and(eq(trackedSessions.clientId, clientId), eq(trackedSessions.isBot, isBot)),
      )
      .orderBy(desc(trackedSessions.lastActivityAt))
      .limit(1)
      .for("update");

    const isContinuation =
      latest &&
      eventTs.getTime() - latest.lastActivityAt.getTime() <= SESSION_TIMEOUT_MS &&
      latest.spDate === date;

    if (isContinuation) {
      await tx
        .update(trackedSessions)
        .set({
          lastActivityAt: eventTs,
          pageViews: latest.pageViews + 1,
        })
        .where(eq(trackedSessions.id, latest.id));
      return false;
    }

    await tx.insert(trackedSessions).values({
      clientId,
      startedAt: eventTs,
      lastActivityAt: eventTs,
      spDate: date,
      pageViews: 1,
      userAgent,
      isBot,
    });

    if (!isBot) {
      await tx
        .insert(dailySessions)
        .values({ date, sessions: 1, syncedAt: now })
        .onConflictDoUpdate({
          target: dailySessions.date,
          set: {
            sessions: sql`${dailySessions.sessions} + 1`,
            syncedAt: sql`now()`,
          },
        });
    }

    return true;
  });

  return NextResponse.json({ ok: true, counted, isBot }, { headers: CORS });
}
