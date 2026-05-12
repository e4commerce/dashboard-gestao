import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });
const rows = await sql`
  SELECT id, source, status, started_at, completed_at,
         total_dsers_orders, our_orders_in_range, matched, cleared,
         failed_chunks, unmatched_sample, error_message,
         execution_time_ms
  FROM cogs_sync_logs
  ORDER BY started_at DESC
  LIMIT 8
`;
console.log(JSON.stringify(rows, null, 2));
await sql.end();
