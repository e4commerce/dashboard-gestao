CREATE TABLE "ads_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" varchar(32) NOT NULL,
	"account_id" varchar(64) NOT NULL,
	"date" date NOT NULL,
	"spend" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(8),
	"clicks" integer,
	"impressions" integer,
	"conversions" numeric(10, 2),
	"conversion_value" numeric(14, 2),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_tokens" (
	"service" varchar(64) PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ads_insights_platform_account_date_key" ON "ads_insights" USING btree ("platform","account_id","date");--> statement-breakpoint
CREATE INDEX "ads_insights_platform_date_idx" ON "ads_insights" USING btree ("platform","date");