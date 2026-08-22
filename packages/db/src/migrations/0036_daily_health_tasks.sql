CREATE TABLE IF NOT EXISTS "daily_guidance_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"notification_date" date NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"tone" varchar(40) DEFAULT 'guide' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_guidance_notifications_user_date_title_idx" UNIQUE("user_id","notification_date","title")
);

CREATE TABLE IF NOT EXISTS "health_task_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"task_date" date NOT NULL,
	"task_key" varchar(80) NOT NULL,
	"title" varchar(180) NOT NULL,
	"category" varchar(60) NOT NULL,
	"status" varchar(24) DEFAULT 'started' NOT NULL,
	"exercise_key" varchar(40),
	"target_reps" integer,
	"counted_reps" integer DEFAULT 0 NOT NULL,
	"medal_code" varchar(80),
	"medal_name" varchar(140),
	"medal_tier" varchar(40),
	"medal_points" integer DEFAULT 0 NOT NULL,
	"proof" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "health_task_completions_user_date_task_idx" UNIQUE("user_id","task_date","task_key")
);

DO $$ BEGIN
 ALTER TABLE "daily_guidance_notifications" ADD CONSTRAINT "daily_guidance_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "health_task_completions" ADD CONSTRAINT "health_task_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "daily_guidance_notifications_user_date_idx" ON "daily_guidance_notifications" USING btree ("user_id","notification_date");
CREATE INDEX IF NOT EXISTS "health_task_completions_leaderboard_idx" ON "health_task_completions" USING btree ("completed_at","medal_points");
