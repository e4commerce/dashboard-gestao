import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { adsInsights } from "@/server/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebhookEntry = {
  date: string;
  accountId?: string;
  spend: number;
  clicks?: number;
  impressions?: number;
  conversions?: number;
  conversionValue?: number;
  currency?: string;
};

type WebhookBody = {
  entries?: WebhookEntry[];
};

const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function POST(req: Request) {
  const expected = process.env.GOOGLE_ADS_WEBHOOK_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "GOOGLE_ADS_WEBHOOK_SECRET não configurado no servidor" },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: WebhookBody;
  try {
    body = (await req.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entries = body.entries ?? [];
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json(
      { error: "entries array é obrigatório e não pode estar vazio" },
      { status: 400 },
    );
  }

  const now = new Date();
  let imported = 0;
  const skipped: string[] = [];

  for (const e of entries) {
    if (!e || !isValidDate(e.date) || typeof e.spend !== "number") {
      skipped.push(JSON.stringify(e));
      continue;
    }

    await db
      .insert(adsInsights)
      .values({
        platform: "google",
        accountId: e.accountId ?? "default",
        date: e.date,
        spend: e.spend.toFixed(2),
        currency: e.currency ?? "BRL",
        clicks: e.clicks ?? null,
        impressions: e.impressions ?? null,
        conversions: e.conversions != null ? e.conversions.toFixed(2) : null,
        conversionValue:
          e.conversionValue != null ? e.conversionValue.toFixed(2) : null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [adsInsights.platform, adsInsights.accountId, adsInsights.date],
        set: {
          spend: e.spend.toFixed(2),
          currency: e.currency ?? "BRL",
          clicks: e.clicks ?? null,
          impressions: e.impressions ?? null,
          conversions: e.conversions != null ? e.conversions.toFixed(2) : null,
          conversionValue:
            e.conversionValue != null ? e.conversionValue.toFixed(2) : null,
          updatedAt: now,
        },
      });
    imported++;
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped: skipped.length,
  });
}
