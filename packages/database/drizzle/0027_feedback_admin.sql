CREATE POLICY "feedback_messages_admin_select" ON "feedback_messages" AS PERMISSIVE FOR SELECT TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'admin'));--> statement-breakpoint
CREATE POLICY "feedback_messages_admin_update" ON "feedback_messages" AS PERMISSIVE FOR UPDATE TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'admin')) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'admin'));--> statement-breakpoint
-- A policy admits rows, not columns, so the admin scope's update policy alone would let it change
-- any column of a message. The column grant is what holds it to the "Done" time: app_web keeps
-- UPDATE on done_at only, in every scope, and no other app_web scope has an update policy here.
REVOKE UPDATE ON feedback_messages FROM app_web;--> statement-breakpoint
GRANT UPDATE (done_at) ON feedback_messages TO app_web;
