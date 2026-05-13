CREATE TABLE "daily_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "daily_sessions_date_key" ON "daily_sessions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "daily_sessions_date_idx" ON "daily_sessions" USING btree ("date");