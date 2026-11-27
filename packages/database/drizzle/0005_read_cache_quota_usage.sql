CREATE TABLE "quota_usage" (
	"api" text NOT NULL,
	"quota_day" date NOT NULL,
	"units" integer NOT NULL,
	CONSTRAINT "quota_usage_api_quota_day_pk" PRIMARY KEY("api","quota_day")
);
--> statement-breakpoint
ALTER TABLE "quota_usage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "read_cache" (
	"key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "read_cache_expiry_within_24_hours" CHECK ("read_cache"."expires_at" <= "read_cache"."fetched_at" + interval '24 hours')
);
--> statement-breakpoint
ALTER TABLE "read_cache" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "read_cache" ADD CONSTRAINT "read_cache_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "read_cache_channel_id_idx" ON "read_cache" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "read_cache_channel_id_key_idx" ON "read_cache" USING btree ("channel_id","key");--> statement-breakpoint
CREATE POLICY "quota_usage_web" ON "quota_usage" AS PERMISSIVE FOR ALL TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user')) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user'));--> statement-breakpoint
CREATE POLICY "quota_usage_worker" ON "quota_usage" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel')) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel'));--> statement-breakpoint
CREATE POLICY "read_cache_web" ON "read_cache" AS PERMISSIVE FOR ALL TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "read_cache"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '')))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "read_cache"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "read_cache_worker" ON "read_cache" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "read_cache"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "read_cache"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));