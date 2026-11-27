CREATE TABLE "connection_identifiers" (
	"kind" text NOT NULL,
	"hmac" text NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "connection_identifiers_channel_id_kind_key" UNIQUE("channel_id","kind")
);
--> statement-breakpoint
ALTER TABLE "connection_identifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"hmac" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connection_identifiers" ADD CONSTRAINT "connection_identifiers_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connection_identifiers_channel_id_idx" ON "connection_identifiers" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "connection_identifiers_kind_hmac_idx" ON "connection_identifiers" USING btree ("kind","hmac");--> statement-breakpoint
CREATE POLICY "connection_identifiers_web" ON "connection_identifiers" AS PERMISSIVE FOR ALL TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "connection_identifiers"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '')))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "connection_identifiers"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "connection_identifiers_worker" ON "connection_identifiers" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "connection_identifiers"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "connection_identifiers"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "connection_identifiers_worker_system_select" ON "connection_identifiers" AS PERMISSIVE FOR SELECT TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'system'));--> statement-breakpoint
CREATE POLICY "security_events_anonymous_insert" ON "security_events" AS PERMISSIVE FOR INSERT TO "app_web" WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'anonymous'));--> statement-breakpoint
CREATE POLICY "security_events_worker_system_select" ON "security_events" AS PERMISSIVE FOR SELECT TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'system'));--> statement-breakpoint
CREATE POLICY "security_events_worker_system_delete" ON "security_events" AS PERMISSIVE FOR DELETE TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'system'));