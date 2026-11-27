CREATE TABLE "sponsor_report_figures" (
	"figures" text[] NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "sponsor_report_figures_pkey" PRIMARY KEY("channel_id"),
	CONSTRAINT "sponsor_report_figures_figures" CHECK (cardinality("sponsor_report_figures"."figures") > 0 and "sponsor_report_figures"."figures" <@ array['views', 'engagedViews', 'estimatedMinutesWatched', 'averageViewDuration', 'averageViewPercentage', 'likes', 'comments', 'shares', 'subscribersGained', 'impressions', 'ctr']::text[])
);
--> statement-breakpoint
ALTER TABLE "sponsor_report_figures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sponsor_report_figures" ADD CONSTRAINT "sponsor_report_figures_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "sponsor_report_figures_web" ON "sponsor_report_figures" AS PERMISSIVE FOR ALL TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "sponsor_report_figures"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '')))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "sponsor_report_figures"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "sponsor_report_figures_worker" ON "sponsor_report_figures" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "sponsor_report_figures"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "sponsor_report_figures"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));