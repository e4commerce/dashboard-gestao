CREATE TYPE "public"."mp_sync_source" AS ENUM('manual', 'cron');--> statement-breakpoint
CREATE TYPE "public"."mp_sync_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "mp_payments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"status" varchar(32),
	"status_detail" varchar(64),
	"date_created" timestamp with time zone,
	"date_approved" timestamp with time zone,
	"transaction_amount" numeric(12, 2),
	"fee_amount" numeric(12, 2),
	"net_received_amount" numeric(12, 2),
	"external_reference" varchar(128),
	"payment_method_id" varchar(64),
	"payment_type_id" varchar(64),
	"currency" varchar(8),
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mp_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" "mp_sync_source" DEFAULT 'manual' NOT NULL,
	"status" "mp_sync_status" DEFAULT 'running' NOT NULL,
	"date_from" timestamp with time zone NOT NULL,
	"date_to" timestamp with time zone NOT NULL,
	"payments_fetched" integer DEFAULT 0 NOT NULL,
	"payments_upserted" integer DEFAULT 0 NOT NULL,
	"total_fees" numeric(14, 2),
	"error_message" text,
	"execution_time_ms" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "mp_payments_date_approved_idx" ON "mp_payments" USING btree ("date_approved");--> statement-breakpoint
CREATE INDEX "mp_payments_external_ref_idx" ON "mp_payments" USING btree ("external_reference");--> statement-breakpoint
CREATE INDEX "mp_sync_logs_started_at_idx" ON "mp_sync_logs" USING btree ("started_at");