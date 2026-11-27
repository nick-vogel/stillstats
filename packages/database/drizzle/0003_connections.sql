CREATE ROLE "app_claim";--> statement-breakpoint
CREATE TABLE "connections" (
	"refresh_token" text NOT NULL,
	"access_token" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"key_version" integer NOT NULL,
	"scopes" jsonb NOT NULL,
	"status" text NOT NULL,
	"connected_at" timestamp with time zone NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "connections_pkey" PRIMARY KEY("channel_id")
);
--> statement-breakpoint
ALTER TABLE "connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consent_states" (
	"state" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consent_states" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "youtube_channel_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_states" ADD CONSTRAINT "consent_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_states_user_id_idx" ON "consent_states" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_one_owner_idx" ON "memberships" USING btree ("channel_id") WHERE "memberships"."role" = 'owner';--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_youtube_channel_id_unique" UNIQUE("youtube_channel_id");--> statement-breakpoint
CREATE POLICY "channels_claim" ON "channels" AS PERMISSIVE FOR ALL TO "app_claim" USING ((nullif(current_setting('app.scope', true), '') = 'user')) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user'));--> statement-breakpoint
CREATE POLICY "memberships_claim" ON "memberships" AS PERMISSIVE FOR ALL TO "app_claim" USING ((nullif(current_setting('app.scope', true), '') = 'user')) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user'));--> statement-breakpoint
CREATE POLICY "connections_web" ON "connections" AS PERMISSIVE FOR ALL TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "connections"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '')))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "connections"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "connections_worker" ON "connections" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "connections"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "connections"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "consent_states_web" ON "consent_states" AS PERMISSIVE FOR ALL TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "consent_states"."user_id" = nullif(current_setting('app.user_id', true), ''))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "consent_states"."user_id" = nullif(current_setting('app.user_id', true), '')));