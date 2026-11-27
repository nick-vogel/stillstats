CREATE ROLE "app_feedback_count";--> statement-breakpoint
CREATE TABLE "feedback_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"screen" text NOT NULL,
	"app_version" text,
	"reply_to" text,
	"created_at" timestamp with time zone NOT NULL,
	"done_at" timestamp with time zone,
	CONSTRAINT "feedback_messages_type" CHECK ("feedback_messages"."type" in ('something_wrong', 'idea', 'other')),
	CONSTRAINT "feedback_messages_screen" CHECK ("feedback_messages"."screen" in ('video_list', 'video_detail', 'audience', 'settings', 'whats_new'))
);
--> statement-breakpoint
ALTER TABLE "feedback_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "feedback_messages" ADD CONSTRAINT "feedback_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_messages_user_id_created_at_idx" ON "feedback_messages" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE POLICY "feedback_messages_web_insert" ON "feedback_messages" AS PERMISSIVE FOR INSERT TO "app_web" WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "feedback_messages"."user_id" = nullif(current_setting('app.user_id', true), '')));--> statement-breakpoint
CREATE POLICY "feedback_messages_count" ON "feedback_messages" AS PERMISSIVE FOR SELECT TO "app_feedback_count" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "feedback_messages"."user_id" = nullif(current_setting('app.user_id', true), '')));--> statement-breakpoint
-- The daily limit's count: how many messages the scope's user sent in the 24 hours before the
-- scope's pinned time. The user scope sends a message and reads none, so the count runs as
-- app_feedback_count, which holds SELECT on the user and the time only, and whose one policy admits
-- the scope user's own rows. The advisory lock holds the user until the transaction ends, so two
-- sends at once count one after the other and cannot both pass the limit. VOLATILE, so the count
-- reads a snapshot taken after the lock, which a send that held it has committed into.
CREATE FUNCTION feedback_count_today()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  sender text := nullif(current_setting('app.user_id', true), '');
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'user' OR sender IS NULL THEN
    RAISE EXCEPTION 'feedback_count_today runs only in a user scope';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('feedback_messages'), hashtext(sender));

  RETURN (
    SELECT count(*)::integer
    FROM feedback_messages f
    WHERE f.user_id = sender
      AND f.created_at > nullif(current_setting('app.now', true), '')::timestamptz - interval '24 hours'
  );
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION feedback_count_today() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION feedback_count_today() TO app_web;--> statement-breakpoint
GRANT SELECT (user_id, created_at) ON feedback_messages TO app_feedback_count;--> statement-breakpoint
-- As in 0004: the migration role gives the function away only to a role it can SET ROLE to, and
-- only when that role may create in the schema. The CREATE privilege is needed for this step alone.
GRANT app_feedback_count TO app_migrator;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO app_feedback_count;--> statement-breakpoint
ALTER FUNCTION feedback_count_today() OWNER TO app_feedback_count;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM app_feedback_count;
