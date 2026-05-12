import { NextResponse } from "next/server";
import { isCogsSyncRunning, startCogsSyncBackground } from "@/server/cogs/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  // Lock contra sobreposição: cogs sync pode levar ~8min na carga inicial de
  // 30 dias. Se o cron rodar de novo enquanto o anterior está rodando, pula.
  if (await isCogsSyncRunning()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "sync already in progress" });
  }

  const url = new URL(req.url);
  const daysParam = url.searchParams.get("days");
  const days = daysParam ? Math.max(1, Math.min(90, Number(daysParam))) : 30;

  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - days * 24 * 60 * 60 * 1000);

  try {
    // Background: HTTP retorna em <1s, o trabalho continua server-side.
    // Resultado fica em cogs_sync_logs — visível no histórico do dashboard.
    const { logId } = await startCogsSyncBackground(dateFrom, dateTo, "cron");
    return NextResponse.json({ ok: true, logId, mode: "background" });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
