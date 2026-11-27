CREATE TABLE "reporting_jobs" (
	"job_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "reporting_jobs_pkey" PRIMARY KEY("channel_id")
);
--> statement-breakpoint
ALTER TABLE "reporting_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reporting_jobs" ADD CONSTRAINT "reporting_jobs_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "reporting_jobs_web" ON "reporting_jobs" AS PERMISSIVE FOR ALL TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "reporting_jobs"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '')))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "reporting_jobs"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "reporting_jobs_worker" ON "reporting_jobs" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "reporting_jobs"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "reporting_jobs"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));