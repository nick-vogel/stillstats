CREATE ROLE "app_web";--> statement-breakpoint
CREATE ROLE "app_worker";--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" text NOT NULL,
	"channel_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_user_id_channel_id_pk" PRIMARY KEY("user_id","channel_id")
);
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memberships_channel_id_idx" ON "memberships" USING btree ("channel_id");--> statement-breakpoint
CREATE POLICY "channels_web" ON "channels" AS PERMISSIVE FOR SELECT TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "channels"."id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "channels_worker" ON "channels" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "channels"."id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "channels"."id" = nullif(current_setting('app.channel_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "memberships_web" ON "memberships" AS PERMISSIVE FOR SELECT TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "memberships"."user_id" = nullif(current_setting('app.user_id', true), '')));--> statement-breakpoint
CREATE POLICY "memberships_worker" ON "memberships" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "memberships"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "memberships"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));