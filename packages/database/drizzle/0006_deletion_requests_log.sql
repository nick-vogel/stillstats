CREATE TABLE "deletion_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_channel_hmac" text NOT NULL,
	"reason" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"row_counts" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deletion_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid,
	"reason" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "deletion_requests_open_until_cleared" CHECK (("deletion_requests"."completed_at" is null) = ("deletion_requests"."channel_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "deletion_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "deletion_log_youtube_channel_hmac_idx" ON "deletion_log" USING btree ("youtube_channel_hmac");--> statement-breakpoint
CREATE UNIQUE INDEX "deletion_requests_one_open_idx" ON "deletion_requests" USING btree ("channel_id") WHERE "deletion_requests"."completed_at" is null;--> statement-breakpoint
CREATE POLICY "memberships_web_delete" ON "memberships" AS PERMISSIVE FOR DELETE TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "memberships"."user_id" = nullif(current_setting('app.user_id', true), '')));--> statement-breakpoint
CREATE POLICY "deletion_log_worker_channel_insert" ON "deletion_log" AS PERMISSIVE FOR INSERT TO "app_worker" WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel'));--> statement-breakpoint
CREATE POLICY "deletion_log_worker_system_select" ON "deletion_log" AS PERMISSIVE FOR SELECT TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'system'));--> statement-breakpoint
CREATE POLICY "deletion_requests_web" ON "deletion_requests" AS PERMISSIVE FOR SELECT TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "deletion_requests"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "deletion_requests_web_insert" ON "deletion_requests" AS PERMISSIVE FOR INSERT TO "app_web" WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "deletion_requests"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "deletion_requests_worker" ON "deletion_requests" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "deletion_requests"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "deletion_requests"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "deletion_requests_worker_complete" ON "deletion_requests" AS PERMISSIVE FOR UPDATE TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "deletion_requests"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "deletion_requests"."channel_id" is null));