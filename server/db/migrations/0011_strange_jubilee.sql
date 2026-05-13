DROP TABLE IF EXISTS "tracked_sessions";--> statement-breakpoint
CREATE TABLE "tracked_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" varchar(64) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_activity_at" timestamp with time zone NOT NULL,
	"sp_date" date NOT NULL,
	"page_views" integer DEFAULT 1 NOT NULL,
	"user_agent" text,
	"is_bot" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tracked_sessions_client_idx" ON "tracked_sessions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "tracked_sessions_last_activity_idx" ON "tracked_sessions" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "tracked_sessions_sp_date_idx" ON "tracked_sessions" USING btree ("sp_date");
