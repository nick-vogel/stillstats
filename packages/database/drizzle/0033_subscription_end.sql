-- The end of a subscription (#787): record_subscription takes the purge date an end event carries,
-- and guards the row against Stripe's unordered events. It still runs as app_billing in the
-- anonymous scope only, and answers 'recorded', 'unchanged', 'no_channel' or 'other_subscription'.
-- On top of 0030's rules (a null keeps the stored value; a repeat answers 'unchanged'):
--   - A paid status, 'active' or 'past_due', clears the purge date: a return before it keeps the
--     history.
--   - A purge date is stored only when the row holds none, so a later end event never moves it.
--   - updated_at holds when Stripe created the newest event the row holds, and an event of the
--     stored subscription created before it only fills a plan or a period end the row holds as
--     null, and changes nothing else: Stripe delivers a failed event again after later ones, so a
--     retried 'unpaid' after an 'active', or a monthly update after the switch to annual, never
--     undoes the newer state. The fill keeps what a partial newer event left out: Stripe creates
--     the subscription before its Checkout completes, and the Checkout carries no period end. An
--     event that changes no field still moves the time on, so an older one cannot undo what it
--     confirmed.
--   - The same subscription, stored 'canceled', stays 'canceled' with its purge date whatever a
--     later event of it says: Stripe's 'canceled' is terminal, so an update delivered after the
--     deletion never makes the channel paid again.
--   - Another subscription replaces the stored one only when the stored one is not paid and the
--     event's is not 'canceled', with its own plan, status and period end and none of the old
--     one's. A stored 'incomplete' one is a new subscription whose first payment is under way, so
--     only an event created no earlier than the newest the row holds replaces it: an older one is
--     a late event of the subscription it replaced.
--   - Another subscription's event, not 'canceled', for a channel whose stored one is paid answers
--     'other_subscription' and changes nothing: the row never re-points a paid channel, but a
--     second paid Checkout is a live subscription Stripe charges, so the webhook reports it.
--   - Otherwise the event answers 'unchanged': a late event of an old subscription never
--     re-points the channel, and a canceled other subscription says nothing of it.
DROP FUNCTION record_subscription(uuid, text, text, text, text, timestamptz);--> statement-breakpoint
CREATE FUNCTION record_subscription(
  subscribed_channel_id uuid,
  customer text,
  subscription text,
  chosen_plan text,
  subscription_status text,
  period_end timestamptz,
  ends_purge_after timestamptz,
  event_created timestamptz
)
RETURNS text
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
      RETURN 'no_channel';
    END;
    IF written = 1 THEN
      RETURN 'recorded';
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
    RETURN CASE WHEN written = 1 THEN 'recorded' ELSE 'unchanged' END;
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
    RETURN 'other_subscription';
  ELSE
    RETURN 'unchanged';
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
    RETURN 'unchanged';
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
  RETURN 'recorded';
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION record_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION record_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz) TO app_web;--> statement-breakpoint
-- As in 0030: the migration role gives the function away only to a role it can SET ROLE to, and
-- only when that role may create in the schema. The CREATE privilege is needed for this step alone.
GRANT CREATE ON SCHEMA public TO app_billing;--> statement-breakpoint
ALTER FUNCTION record_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz) OWNER TO app_billing;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM app_billing;
