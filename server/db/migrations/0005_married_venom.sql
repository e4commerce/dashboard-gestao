CREATE TYPE "public"."cogs_sync_source" AS ENUM('manual', 'cron');--> statement-breakpoint
CREATE TYPE "public"."cogs_sync_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "cogs_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" "cogs_sync_source" DEFAULT 'manual' NOT NULL,
	"status" "cogs_sync_status" DEFAULT 'running' NOT NULL,
	"date_from" timestamp with time zone NOT NULL,
	"date_to" timestamp with time zone NOT NULL,
	"total_dsers_orders" integer,
	"our_orders_in_range" integer,
	"our_orders_with_name" integer,
	"matched" integer DEFAULT 0 NOT NULL,
	"cleared" integer DEFAULT 0 NOT NULL,
	"failed_chunks" text,
	"unmatched_sample" text,
	"error_message" text,
	"execution_time_ms" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "cogs_sync_logs_started_at_idx" ON "cogs_sync_logs" USING btree ("started_at");