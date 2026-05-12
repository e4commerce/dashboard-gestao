CREATE TYPE "public"."extraction_source" AS ENUM('shopify', 'manual');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."visit_type" AS ENUM('first_visit', 'last_visit');--> statement-breakpoint
CREATE TABLE "channel_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" varchar(64) NOT NULL,
	"month" varchar(7) NOT NULL,
	"revenue_goal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"orders_goal" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extraction_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" "extraction_source" DEFAULT 'manual' NOT NULL,
	"status" "extraction_status" DEFAULT 'running' NOT NULL,
	"date_from" timestamp with time zone NOT NULL,
	"date_to" timestamp with time zone NOT NULL,
	"orders_extracted" integer DEFAULT 0 NOT NULL,
	"orders_new" integer DEFAULT 0 NOT NULL,
	"orders_skipped" integer DEFAULT 0 NOT NULL,
	"errors_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"execution_time_ms" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_attribution" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"shopify_order_id" varchar(64) NOT NULL,
	"channel_name" varchar(64),
	"sub_channel_name" varchar(64),
	"channel_handle" varchar(64),
	"is_marketplace" boolean,
	"customer_order_index" integer,
	"days_to_conversion" integer,
	"journey_ready" boolean,
	"first_visit_source" varchar(128),
	"last_visit_source" varchar(128),
	"first_visit_referrer_url" text,
	"last_visit_referrer_url" text,
	"first_visit_occurred_at" timestamp with time zone,
	"last_visit_occurred_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopify_order_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"total_price" numeric(12, 2) NOT NULL,
	"currency" varchar(8) NOT NULL,
	"financial_status" varchar(32),
	"fulfillment_status" varchar(32),
	"customer_email" varchar(320),
	"customer_name" varchar(256),
	"source_name" varchar(128),
	"app_name" varchar(128),
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"name" varchar(128),
	"role" "user_role" DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utm_parameters" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"shopify_order_id" varchar(64) NOT NULL,
	"visit_type" "visit_type" NOT NULL,
	"utm_source" varchar(128),
	"utm_medium" varchar(128),
	"utm_campaign" varchar(128),
	"utm_content" varchar(256),
	"utm_term" varchar(256)
);
--> statement-breakpoint
ALTER TABLE "order_attribution" ADD CONSTRAINT "order_attribution_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_parameters" ADD CONSTRAINT "utm_parameters_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_goals_channel_month_key" ON "channel_goals" USING btree ("channel","month");--> statement-breakpoint
CREATE INDEX "extraction_logs_started_at_idx" ON "extraction_logs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "order_attribution_order_id_key" ON "order_attribution" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_attribution_channel_name_idx" ON "order_attribution" USING btree ("channel_name");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_shopify_order_id_key" ON "orders" USING btree ("shopify_order_id");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "utm_parameters_order_id_idx" ON "utm_parameters" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "utm_parameters_campaign_idx" ON "utm_parameters" USING btree ("utm_campaign");