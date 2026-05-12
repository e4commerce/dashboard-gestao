ALTER TABLE "orders" ADD COLUMN "order_name" varchar(64);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cogs_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cogs_source" varchar(32);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cogs_updated_at" timestamp with time zone;