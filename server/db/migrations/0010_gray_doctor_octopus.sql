CREATE TABLE "tracked_sessions" (
	"session_id" varchar(128) PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"tracked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tracked_sessions_date_idx" ON "tracked_sessions" USING btree ("date");