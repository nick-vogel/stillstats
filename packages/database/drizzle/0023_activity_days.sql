CREATE TABLE "activity_days" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "activity_days_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "activity_days" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "activity_days" ADD CONSTRAINT "activity_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "activity_days_web_insert" ON "activity_days" AS PERMISSIVE FOR INSERT TO "app_web" WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "activity_days"."user_id" = nullif(current_setting('app.user_id', true), '')));--> statement-breakpoint
CREATE POLICY "activity_days_worker_system_select" ON "activity_days" AS PERMISSIVE FOR SELECT TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'system'));--> statement-breakpoint
CREATE POLICY "activity_days_worker_system_delete" ON "activity_days" AS PERMISSIVE FOR DELETE TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'system'));