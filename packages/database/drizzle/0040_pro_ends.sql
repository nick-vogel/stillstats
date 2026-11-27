-- The purge date moves from the subscription to its channel (stillstats#19): pro_ends holds, one
-- row per channel, when the channel stopped being Pro and when its stored history is deleted, so
-- each channel a subscription covers can end Pro at its own time. This is the expand release of
-- docs/deploy.md, "The release step": subscriptions.purge_after stays, and record_subscription
-- keeps writing it, the same value as the channel's pro_ends row, for the previous release's
-- images, which read it during and after the deploy. The remove release drops it.
CREATE TABLE "pro_ends" (
	"ended_at" timestamp with time zone NOT NULL,
	"purge_after" timestamp with time zone,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "pro_ends_pkey" PRIMARY KEY("channel_id")
);
--> statement-breakpoint
ALTER TABLE "pro_ends" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pro_ends" ADD CONSTRAINT "pro_ends_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "pro_ends_web" ON "pro_ends" AS PERMISSIVE FOR ALL TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "pro_ends"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '')))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "pro_ends"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "pro_ends_worker" ON "pro_ends" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "pro_ends"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "pro_ends"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "pro_ends_billing" ON "pro_ends" AS PERMISSIVE FOR ALL TO "app_billing" USING ((nullif(current_setting('app.scope', true), '') = 'anonymous')) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'anonymous'));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON pro_ends TO app_billing;--> statement-breakpoint
-- The existing purge dates move onto their channels, with the end of Pro 30 days before each
-- (ADR 0022), the window purgeDateOf adds. A purge date the history purge already cleared moves
-- nothing: that channel ended Pro at a time no row holds, and answers the same Entitlement without
-- a row. Staging and production force row-level security on subscriptions and no policy admits
-- the migration role, so the copy runs with it lifted, or it reads no row and moves nothing.
ALTER TABLE subscriptions NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO pro_ends (channel_id, ended_at, purge_after)
  SELECT channel_id, purge_after - interval '30 days', purge_after FROM subscriptions
  WHERE purge_after IS NOT NULL;--> statement-breakpoint
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- record_subscription keeps its signature and every rule of 0033 and 0039 for the subscription
-- row; its purge date is now the channel's pro_ends row:
--   - The stored purge date is the channel's pro_ends.purge_after, null with no row.
--   - A paid status, 'active' or 'past_due', deletes the channel's pro_ends row: a return before
--     the purge date keeps the history, and a Pro channel has no end of Pro.
--   - A status not paid keeps a stored purge date and stores the event's only when the channel
--     holds none, so a later end event never moves it. A newly stored purge date writes the end of
--     Pro 30 days before it: every end event computes its purge date through purgeDateOf.
--   - subscriptions.purge_after gets the same next purge date, for the previous release's images.
-- The subscription row is locked first, as before, then the pro_ends row, so the history purge,
-- which locks them in the same order, either sees a return's cleared date or waits for it.
DROP FUNCTION record_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz);--> statement-breakpoint
CREATE FUNCTION record_subscription(
  subscribed_channel_id uuid,
  customer text,
  subscription text,
  chosen_plan text,
  subscription_status text,
  period_end timestamptz,
  ends_purge_after timestamptz,
  event_created timestamptz,
  OUT outcome text,
  OUT turned_paid boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  paid_statuses constant text[] := array['active', 'past_due'];
  purge_window constant interval := interval '30 days';
  stored subscriptions%ROWTYPE;
  next subscriptions%ROWTYPE;
  stored_purge timestamptz;
  next_purge timestamptz;
  written integer;
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'anonymous' THEN
    RAISE EXCEPTION 'record_subscription runs only in the anonymous scope';
  END IF;
  turned_paid := false;

  SELECT * INTO stored FROM subscriptions WHERE channel_id = subscribed_channel_id FOR UPDATE;
  IF NOT FOUND THEN
    next_purge := CASE WHEN coalesce(subscription_status, 'incomplete') = ANY (paid_statuses)
      THEN NULL ELSE ends_purge_after END;
    BEGIN
      INSERT INTO subscriptions (
        channel_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end,
        purge_after, updated_at
      )
      VALUES (
        subscribed_channel_id, customer, subscription, chosen_plan,
        coalesce(subscription_status, 'incomplete'), period_end, next_purge, event_created
      )
      ON CONFLICT (channel_id) DO NOTHING;
      GET DIAGNOSTICS written = ROW_COUNT;
    EXCEPTION WHEN foreign_key_violation THEN
      outcome := 'no_channel';
      RETURN;
    END;
    IF written = 1 THEN
      IF coalesce(subscription_status, 'incomplete') = ANY (paid_statuses) THEN
        DELETE FROM pro_ends WHERE channel_id = subscribed_channel_id;
      ELSIF next_purge IS NOT NULL THEN
        INSERT INTO pro_ends (channel_id, ended_at, purge_after)
          VALUES (subscribed_channel_id, next_purge - purge_window, next_purge)
          ON CONFLICT (channel_id) DO UPDATE
            SET ended_at = excluded.ended_at, purge_after = excluded.purge_after;
      END IF;
      outcome := 'recorded';
      turned_paid := coalesce(subscription_status, 'incomplete') = ANY (paid_statuses);
      RETURN;
    END IF;
    -- Another delivery inserted the row first; it is read as any stored row.
    SELECT * INTO STRICT stored FROM subscriptions
      WHERE channel_id = subscribed_channel_id FOR UPDATE;
  END IF;
  SELECT purge_after INTO stored_purge FROM pro_ends
    WHERE channel_id = subscribed_channel_id FOR UPDATE;

  next := stored;
  IF stored.stripe_subscription_id = subscription AND event_created < stored.updated_at THEN
    UPDATE subscriptions SET
      plan = coalesce(plan, chosen_plan),
      current_period_end = coalesce(current_period_end, period_end)
    WHERE channel_id = subscribed_channel_id
      AND ((plan IS NULL AND chosen_plan IS NOT NULL)
        OR (current_period_end IS NULL AND period_end IS NOT NULL));
    GET DIAGNOSTICS written = ROW_COUNT;
    outcome := CASE WHEN written = 1 THEN 'recorded' ELSE 'unchanged' END;
    RETURN;
  ELSIF stored.stripe_subscription_id = subscription THEN
    next.stripe_customer_id := customer;
    next.plan := coalesce(chosen_plan, stored.plan);
    next.status := CASE WHEN stored.status = 'canceled' THEN 'canceled'
      ELSE coalesce(subscription_status, stored.status) END;
    next.current_period_end := coalesce(period_end, stored.current_period_end);
  ELSIF NOT (stored.status = ANY (paid_statuses))
    AND subscription_status IS DISTINCT FROM 'canceled'
    AND (stored.status <> 'incomplete' OR event_created >= stored.updated_at) THEN
    next.stripe_customer_id := customer;
    next.stripe_subscription_id := subscription;
    next.plan := chosen_plan;
    next.status := coalesce(subscription_status, 'incomplete');
    next.current_period_end := period_end;
  ELSIF stored.status = ANY (paid_statuses)
    AND subscription_status IS DISTINCT FROM 'canceled' THEN
    outcome := 'other_subscription';
    RETURN;
  ELSE
    outcome := 'unchanged';
    RETURN;
  END IF;
  next_purge := CASE WHEN next.status = ANY (paid_statuses) THEN NULL
    ELSE coalesce(stored_purge, ends_purge_after) END;

  IF (next.stripe_customer_id, next.stripe_subscription_id, next.plan, next.status,
      next.current_period_end, next_purge)
    IS NOT DISTINCT FROM (stored.stripe_customer_id, stored.stripe_subscription_id, stored.plan,
      stored.status, stored.current_period_end, stored_purge) THEN
    IF event_created > stored.updated_at THEN
      UPDATE subscriptions SET updated_at = event_created
        WHERE channel_id = subscribed_channel_id;
    END IF;
    outcome := 'unchanged';
    RETURN;
  END IF;

  UPDATE subscriptions SET
    stripe_customer_id = next.stripe_customer_id,
    stripe_subscription_id = next.stripe_subscription_id,
    plan = next.plan,
    status = next.status,
    current_period_end = next.current_period_end,
    purge_after = next_purge,
    updated_at = event_created
  WHERE channel_id = subscribed_channel_id;
  IF next.status = ANY (paid_statuses) THEN
    DELETE FROM pro_ends WHERE channel_id = subscribed_channel_id;
  ELSIF next_purge IS DISTINCT FROM stored_purge THEN
    INSERT INTO pro_ends (channel_id, ended_at, purge_after)
      VALUES (subscribed_channel_id, next_purge - purge_window, next_purge)
      ON CONFLICT (channel_id) DO UPDATE
        SET ended_at = excluded.ended_at, purge_after = excluded.purge_after;
  END IF;
  outcome := 'recorded';
  turned_paid := NOT (stored.status = ANY (paid_statuses)) AND next.status = ANY (paid_statuses);
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION record_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION record_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz) TO app_web;--> statement-breakpoint
-- As in 0030: the migration role gives the function away only to a role it can SET ROLE to, and
-- only when that role may create in the schema. The CREATE privilege is needed for this step alone.
GRANT CREATE ON SCHEMA public TO app_billing;--> statement-breakpoint
ALTER FUNCTION record_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz) OWNER TO app_billing;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM app_billing;
