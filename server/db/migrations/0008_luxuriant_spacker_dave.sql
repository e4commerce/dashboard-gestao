CREATE TYPE "public"."cogs_change_reason" AS ENUM('dsers_initial', 'dsers_update', 'manual_set', 'manual_clear', 'backfill');--> statement-breakpoint
CREATE TABLE "dsers_orders" (
	"dsers_order_id" varchar(64) PRIMARY KEY NOT NULL,
	"order_name" varchar(64),
	"product_cost_cents" integer,
	"shipping_cost_cents" integer,
	"total_cost_cents" integer,
	"raw_json" jsonb,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sync_id" integer
);
--> statement-breakpoint
CREATE TABLE "order_cogs_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"cogs_amount" numeric(12, 2),
	"cogs_source" varchar(32),
	"change_reason" "cogs_change_reason" NOT NULL,
	"sync_log_id" integer,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_cogs_history" ADD CONSTRAINT "order_cogs_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dsers_orders_order_name_idx" ON "dsers_orders" USING btree ("order_name");--> statement-breakpoint
CREATE INDEX "dsers_orders_last_seen_idx" ON "dsers_orders" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "order_cogs_history_order_idx" ON "order_cogs_history" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_cogs_history_changed_at_idx" ON "order_cogs_history" USING btree ("changed_at");