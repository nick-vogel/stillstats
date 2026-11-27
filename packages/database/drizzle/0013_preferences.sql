CREATE TABLE "preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"page_size" smallint,
	"views_column" boolean,
	"watch_time_column" boolean,
	"revenue_column" boolean,
	"chart_mode" text,
	"chart_card" text,
	"currency" text,
	"visibility" text,
	CONSTRAINT "preferences_page_size" CHECK ("preferences"."page_size" in (10, 25, 50)),
	CONSTRAINT "preferences_chart_mode" CHECK ("preferences"."chart_mode" in ('daily', 'aggregate')),
	CONSTRAINT "preferences_chart_card" CHECK ("preferences"."chart_card" in ('engagedViews', 'watchTime', 'revenue')),
	CONSTRAINT "preferences_visibility" CHECK ("preferences"."visibility" in ('public', 'all')),
	CONSTRAINT "preferences_currency" CHECK ("preferences"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "preferences_web" ON "preferences" AS PERMISSIVE FOR ALL TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "preferences"."user_id" = nullif(current_setting('app.user_id', true), ''))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "preferences"."user_id" = nullif(current_setting('app.user_id', true), '')));