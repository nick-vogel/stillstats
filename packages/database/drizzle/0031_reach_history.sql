CREATE TABLE "reach_history" (
	"video_id" text NOT NULL,
	"day" date NOT NULL,
	"traffic_source_type" integer NOT NULL,
	"impressions" integer NOT NULL,
	"ctr" double precision NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "reach_history_impressions" CHECK ("reach_history"."impressions" >= 0),
	CONSTRAINT "reach_history_ctr" CHECK ("reach_history"."ctr" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "reach_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reach_history_days" (
	"day" date NOT NULL,
	"report_created_at" timestamp with time zone NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "reach_history_days_pkey" PRIMARY KEY("channel_id","day")
);
--> statement-breakpoint
ALTER TABLE "reach_history_days" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "preferences" DROP CONSTRAINT "preferences_chart_card";--> statement-breakpoint
ALTER TABLE "reporting_jobs" ADD COLUMN "downloads_failing_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reach_history" ADD CONSTRAINT "reach_history_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reach_history_days" ADD CONSTRAINT "reach_history_days_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reach_history_channel_id_idx" ON "reach_history" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reach_history_row_idx" ON "reach_history" USING btree ("channel_id","video_id","day","traffic_source_type");--> statement-breakpoint
CREATE INDEX "reach_history_channel_id_day_idx" ON "reach_history" USING btree ("channel_id","day");--> statement-breakpoint
CREATE INDEX "reach_history_days_channel_id_idx" ON "reach_history_days" USING btree ("channel_id");--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_chart_card" CHECK ("preferences"."chart_card" in ('engagedViews', 'watchTime', 'revenue', 'rpm', 'impressions', 'ctr'));--> statement-breakpoint
CREATE POLICY "reach_history_web" ON "reach_history" AS PERMISSIVE FOR ALL TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "reach_history"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '')))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "reach_history"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "reach_history_worker" ON "reach_history" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "reach_history"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "reach_history"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "reach_history_days_web" ON "reach_history_days" AS PERMISSIVE FOR ALL TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "reach_history_days"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '')))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "reach_history_days"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "reach_history_days_worker" ON "reach_history_days" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "reach_history_days"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "reach_history_days"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));