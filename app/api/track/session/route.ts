import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { dailySessions } from "@/server/db/schema";
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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400, headers: CORS });
  }

  const date =
    typeof (body as Record<string, unknown>)?.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test((body as Record<string, unknown>).date as string)
      ? ((body as Record<string, unknown>).date as string)
      : null;

  if (!date) {
    return NextResponse.json({ error: "invalid date" }, { status: 400, headers: CORS });
  }

  // Rejeita datas futuras (proteção básica contra abuso)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
  if (date > today) {
    return NextResponse.json({ ok: false }, { headers: CORS });
  }

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

  return NextResponse.json({ ok: true }, { headers: CORS });
}
