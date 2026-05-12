CREATE TABLE "daily_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" varchar(7) NOT NULL,
	"day" integer NOT NULL,
	"weight" numeric(6, 3) DEFAULT '1' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"month" varchar(7) NOT NULL,
	"revenue_goal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gross_profit_goal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "daily_weights_month_day_key" ON "daily_weights" USING btree ("month","day");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_goals_month_key" ON "monthly_goals" USING btree ("month");