CREATE TABLE "tips" (
	"checkout_session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tips_user_id_idx" ON "tips" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "tips_anonymous_insert" ON "tips" AS PERMISSIVE FOR INSERT TO "app_web" WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'anonymous'));--> statement-breakpoint
CREATE POLICY "tips_web_select" ON "tips" AS PERMISSIVE FOR SELECT TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "tips"."user_id" = nullif(current_setting('app.user_id', true), '')));--> statement-breakpoint
CREATE POLICY "tips_web_delete" ON "tips" AS PERMISSIVE FOR DELETE TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "tips"."user_id" = nullif(current_setting('app.user_id', true), '')));