import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnóstico: para cada dia dos últimos 14, mostra:
// - total de pedidos extraídos (independente de status)
// - decomposição por financial_status
// - quantos foram excluídos por cada filtro (preço zero, TROCA, VOUCHER, Reenvio)
// - faturamento bruto (todos PAID) vs líquido (pós filtros)
// - logs de extração do dia
//
// Objetivo: identificar undercount comparando dias.

export async function GET(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const days = Math.min(60, Math.max(1, parseInt(url.searchParams.get("days") ?? "14", 10)));

  // Breakdown por dia em America/Sao_Paulo
  const daily = await db.execute(sql`
    WITH days AS (
      SELECT generate_series(
        (now() AT TIME ZONE 'America/Sao_Paulo')::date - ${days - 1}::int,
        (now() AT TIME ZONE 'America/Sao_Paulo')::date,
        '1 day'::interval
      )::date AS sp_date
    ),
    by_day AS (
      SELECT
        (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS sp_date,
        COUNT(*) AS total_orders,
        COUNT(*) FILTER (WHERE financial_status = 'PAID') AS paid_orders,
        COUNT(*) FILTER (WHERE financial_status = 'PENDING') AS pending_orders,
        COUNT(*) FILTER (WHERE financial_status = 'REFUNDED') AS refunded_orders,
        COUNT(*) FILTER (WHERE financial_status = 'VOIDED') AS voided_orders,
        COUNT(*) FILTER (WHERE financial_status NOT IN ('PAID', 'PENDING', 'REFUNDED', 'VOIDED') OR financial_status IS NULL) AS other_status,
        COUNT(*) FILTER (WHERE financial_status = 'PAID' AND total_price::numeric = 0) AS paid_zero_price,
        COUNT(*) FILTER (WHERE financial_status = 'PAID' AND discount_codes ILIKE '%TROCA%') AS troca,
        COUNT(*) FILTER (WHERE financial_status = 'PAID' AND discount_codes ILIKE '%VOUCHER%') AS voucher,
        COUNT(*) FILTER (WHERE financial_status = 'PAID' AND tags ILIKE '%Reenvio%') AS reenvio,
        COUNT(*) FILTER (
          WHERE financial_status = 'PAID'
            AND total_price::numeric > 0
            AND COALESCE(discount_codes, '') NOT ILIKE '%TROCA%'
            AND COALESCE(discount_codes, '') NOT ILIKE '%VOUCHER%'
            AND COALESCE(tags, '') NOT ILIKE '%Reenvio%'
        ) AS valid_orders,
        SUM(total_price::numeric) FILTER (WHERE financial_status = 'PAID') AS paid_revenue,
        SUM(total_price::numeric) FILTER (
          WHERE financial_status = 'PAID'
            AND total_price::numeric > 0
            AND COALESCE(discount_codes, '') NOT ILIKE '%TROCA%'
            AND COALESCE(discount_codes, '') NOT ILIKE '%VOUCHER%'
            AND COALESCE(tags, '') NOT ILIKE '%Reenvio%'
        ) AS valid_revenue
      FROM orders
      WHERE created_at >= (now() - interval '${sql.raw(String(days + 2))} days')
      GROUP BY 1
    )
    SELECT
      days.sp_date::text AS date,
      COALESCE(by_day.total_orders, 0) AS total_orders,
      COALESCE(by_day.paid_orders, 0) AS paid_orders,
      COALESCE(by_day.pending_orders, 0) AS pending_orders,
      COALESCE(by_day.refunded_orders, 0) AS refunded_orders,
      COALESCE(by_day.voided_orders, 0) AS voided_orders,
      COALESCE(by_day.other_status, 0) AS other_status,
      COALESCE(by_day.paid_zero_price, 0) AS paid_zero_price,
      COALESCE(by_day.troca, 0) AS troca,
      COALESCE(by_day.voucher, 0) AS voucher,
      COALESCE(by_day.reenvio, 0) AS reenvio,
      COALESCE(by_day.valid_orders, 0) AS valid_orders,
      COALESCE(by_day.paid_revenue, 0)::float AS paid_revenue,
      COALESCE(by_day.valid_revenue, 0)::float AS valid_revenue
    FROM days
    LEFT JOIN by_day USING (sp_date)
    ORDER BY days.sp_date DESC
  `);

  // Logs de extração do período
  const extractions = await db.execute(sql`
    SELECT
      id, source, status, started_at, completed_at,
      orders_extracted, orders_new, orders_skipped, errors_count,
      (date_from AT TIME ZONE 'America/Sao_Paulo')::date AS from_sp,
      (date_to AT TIME ZONE 'America/Sao_Paulo')::date AS to_sp,
      execution_time_ms,
      error_message
    FROM extraction_logs
    WHERE started_at >= (now() - interval '${sql.raw(String(days + 1))} days')
    ORDER BY started_at DESC
    LIMIT 100
  `);

  return NextResponse.json({
    ok: true,
    days,
    daily,
    extractions,
  });
}
