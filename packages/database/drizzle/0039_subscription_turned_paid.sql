-- A new subscription downloads its history right away (#1034): record_subscription also answers
-- whether the channel's stored row turned paid in the same statement, so the webhook sends the
-- channel's history download on what the row did, not on what the event says. Stripe delivers its
-- events in no fixed order, so an event newer than the one that changed the status can land first
-- and the older one then changes nothing. It answers two columns, `outcome` as in 0033 and
-- `turned_paid`, true only when the statement leaves a paid row, 'active' or 'past_due', where
-- there was no row or one with any other status. Every rule of 0033 for the row stays as it was:
--   - An older event of the stored subscription only fills a null plan or period end and never
--     changes the status, so it turns nothing paid even when it answers 'recorded'.
--   - A repeated delivery answers 'unchanged', and turns nothing paid.
--   - A change from one paid status to the other, a renewal or a switch of plan turns nothing paid.
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
  stored subscriptions%ROWTYPE;
  next subscriptions%ROWTYPE;
  written integer;
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'anonymous' THEN
    RAISE EXCEPTION 'record_subscription runs only in the anonymous scope';
  END IF;
  turned_paid := false;

  SELECT * INTO stored FROM subscriptions WHERE channel_id = subscribed_channel_id FOR UPDATE;
  IF NOT FOUND THEN
    BEGIN
      INSERT INTO subscriptions (
        channel_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end,
        purge_after, updated_at
      )
      VALUES (
        subscribed_channel_id, customer, subscription, chosen_plan,
        coalesce(subscription_status, 'incomplete'), period_end,
        CASE WHEN coalesce(subscription_status, 'incomplete') = ANY (paid_statuses) THEN NULL
          ELSE ends_purge_after END,
        event_created
      )
      ON CONFLICT (channel_id) DO NOTHING;
      GET DIAGNOSTICS written = ROW_COUNT;
    EXCEPTION WHEN foreign_key_violation THEN
      outcome := 'no_channel';
      RETURN;
    END;
    IF written = 1 THEN
      outcome := 'recorded';
      turned_paid := coalesce(subscription_status, 'incomplete') = ANY (paid_statuses);
      RETURN;
    END IF;
    -- Another delivery inserted the row first; it is read as any stored row.
    SELECT * INTO STRICT stored FROM subscriptions
      WHERE channel_id = subscribed_channel_id FOR UPDATE;
  END IF;

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
  next.purge_after := CASE WHEN next.status = ANY (paid_statuses) THEN NULL
    ELSE coalesce(stored.purge_after, ends_purge_after) END;

  IF (next.stripe_customer_id, next.stripe_subscription_id, next.plan, next.status,
      next.current_period_end, next.purge_after)
    IS NOT DISTINCT FROM (stored.stripe_customer_id, stored.stripe_subscription_id, stored.plan,
      stored.status, stored.current_period_end, stored.purge_after) THEN
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
    purge_after = next.purge_after,
    updated_at = event_created
  WHERE channel_id = subscribed_channel_id;
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
