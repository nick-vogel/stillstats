CREATE TABLE "retention_curve_reads" (
	"video_id" text NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "retention_curve_reads_pkey" PRIMARY KEY("channel_id","video_id")
);
--> statement-breakpoint
ALTER TABLE "retention_curve_reads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "retention_curves" (
	"video_id" text NOT NULL,
	"elapsed_video_time_ratio" double precision NOT NULL,
	"audience_watch_ratio" double precision NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "retention_curves_elapsed_video_time_ratio" CHECK ("retention_curves"."elapsed_video_time_ratio" between 0 and 1),
	CONSTRAINT "retention_curves_audience_watch_ratio" CHECK ("retention_curves"."audience_watch_ratio" >= 0)
);
--> statement-breakpoint
ALTER TABLE "retention_curves" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "retention_curve_reads" ADD CONSTRAINT "retention_curve_reads_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_curves" ADD CONSTRAINT "retention_curves_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "retention_curve_reads_channel_id_idx" ON "retention_curve_reads" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "retention_curves_channel_id_idx" ON "retention_curves" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "retention_curves_point_idx" ON "retention_curves" USING btree ("channel_id","video_id","elapsed_video_time_ratio");--> statement-breakpoint
CREATE POLICY "retention_curve_reads_web" ON "retention_curve_reads" AS PERMISSIVE FOR ALL TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "retention_curve_reads"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '')))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "retention_curve_reads"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "retention_curve_reads_worker" ON "retention_curve_reads" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "retention_curve_reads"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "retention_curve_reads"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "retention_curves_web" ON "retention_curves" AS PERMISSIVE FOR ALL TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "retention_curves"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '')))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "retention_curves"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "retention_curves_worker" ON "retention_curves" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "retention_curves"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "retention_curves"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));