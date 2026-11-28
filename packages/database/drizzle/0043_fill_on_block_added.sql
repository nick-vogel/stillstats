-- A block added while paid fills its new slots at once (stillstats#22, ADR 0024). Settings raises
-- the subscription's quantity through Stripe, and the API records Stripe's answer through this
-- function, as the webhook records its later event, so the raise lands before the API answers.
--
-- record_user_subscription keeps its signature, its owner (app_billing), its grants and every rule
-- of 0033, 0039, 0040 and 0041, and is dropped and created again as 0040 did. One change: the fill
-- and turned_pro run on a turn to paid, as before, and on a raise while paid, a stored paid row
-- whose next quantity is above the stored one. On a raise the free slots fill with the owned
-- channels no pick of the user's holds, oldest owner membership first, exactly as on a turn to
-- paid, and turned_pro answers only the picks that were not Pro before it and are now: the ones
-- the fill picked, and the ones a cut left outside the capacity that rank inside it again, at most
-- 4 slots for each next block. Their pro_ends rows are deleted, so a
-- channel taken out of a block that is picked again before its purge date keeps its history, and
-- the caller sends each one's history download. An event older than the stored row changes no
-- quantity, by the ordering rule, so it raises nothing. A cut while paid fills nothing.
--
-- The previous release's images call it with the same arguments during the deploy, and get the
-- same answers but for a raise, which only this release's API sends.
DROP FUNCTION record_user_subscription(text, uuid, text, text, text, text, timestamptz, integer, timestamptz, timestamptz);--> statement-breakpoint
CREATE FUNCTION record_user_subscription(
  subscriber text,
  legacy_channel uuid,
  customer text,
  subscription text,
  chosen_plan text,
  subscription_status text,
  period_end timestamptz,
  chosen_quantity integer,
  ends_purge_after timestamptz,
  event_created timestamptz,
  OUT outcome text,
  OUT turned_pro uuid[]
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  paid_statuses constant text[] := array['active', 'past_due'];
  purge_window constant interval := interval '30 days';
  slots_per_block constant integer := 4;
  picked_at_now constant timestamptz :=
    coalesce(nullif(current_setting('app.now', true), '')::timestamptz, now());
  user_key text := subscriber;
  stored user_subscriptions%ROWTYPE;
  next user_subscriptions%ROWTYPE;
  was_paid boolean := false;
  pro_before uuid[] := array[]::uuid[];
  row_changed boolean := true;
  ends_written integer := 0;
  written integer;
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'anonymous' THEN
    RAISE EXCEPTION 'record_user_subscription runs only in the anonymous scope';
  END IF;
  turned_pro := array[]::uuid[];

  IF user_key IS NULL AND legacy_channel IS NOT NULL THEN
    SELECT m.user_id INTO user_key FROM memberships m
      WHERE m.channel_id = legacy_channel AND m.role = 'owner';
  END IF;
  IF user_key IS NULL THEN
    outcome := 'no_user';
    RETURN;
  END IF;

  SELECT * INTO stored FROM user_subscriptions WHERE user_id = user_key FOR UPDATE;
  IF NOT FOUND THEN
    BEGIN
      INSERT INTO user_subscriptions (
        user_id, stripe_customer_id, stripe_subscription_id, plan, status, quantity,
        current_period_end, updated_at
      )
      VALUES (
        user_key, customer, subscription, chosen_plan, coalesce(subscription_status, 'incomplete'),
        coalesce(chosen_quantity, 1), period_end, event_created
      )
      ON CONFLICT (user_id) DO NOTHING;
      GET DIAGNOSTICS written = ROW_COUNT;
    EXCEPTION WHEN foreign_key_violation THEN
      outcome := 'no_user';
      RETURN;
    END;
    IF written = 1 THEN
      SELECT * INTO STRICT next FROM user_subscriptions WHERE user_id = user_key;
      outcome := 'recorded';
    ELSE
      -- Another delivery inserted the row first; it is read as any stored row.
      SELECT * INTO STRICT stored FROM user_subscriptions WHERE user_id = user_key FOR UPDATE;
    END IF;
  END IF;

  IF outcome IS NULL THEN
    was_paid := stored.status = ANY (paid_statuses);
    next := stored;
    IF stored.stripe_subscription_id = subscription AND event_created < stored.updated_at THEN
      UPDATE user_subscriptions SET
        plan = coalesce(plan, chosen_plan),
        current_period_end = coalesce(current_period_end, period_end)
      WHERE user_id = user_key
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
      next.quantity := coalesce(chosen_quantity, stored.quantity);
      next.current_period_end := coalesce(period_end, stored.current_period_end);
    ELSIF NOT was_paid
      AND subscription_status IS DISTINCT FROM 'canceled'
      AND (stored.status <> 'incomplete' OR event_created >= stored.updated_at) THEN
      next.stripe_customer_id := customer;
      next.stripe_subscription_id := subscription;
      next.plan := chosen_plan;
      next.status := coalesce(subscription_status, 'incomplete');
      next.quantity := coalesce(chosen_quantity, 1);
      next.current_period_end := period_end;
    ELSIF was_paid AND subscription_status IS DISTINCT FROM 'canceled' THEN
      outcome := 'other_subscription';
      RETURN;
    ELSE
      outcome := 'unchanged';
      RETURN;
    END IF;

    row_changed := (next.stripe_customer_id, next.stripe_subscription_id, next.plan, next.status,
        next.quantity, next.current_period_end)
      IS DISTINCT FROM (stored.stripe_customer_id, stored.stripe_subscription_id, stored.plan,
        stored.status, stored.quantity, stored.current_period_end);
    IF row_changed THEN
      UPDATE user_subscriptions SET
        stripe_customer_id = next.stripe_customer_id,
        stripe_subscription_id = next.stripe_subscription_id,
        plan = next.plan,
        status = next.status,
        quantity = next.quantity,
        current_period_end = next.current_period_end,
        updated_at = event_created
      WHERE user_id = user_key;
    ELSIF event_created > stored.updated_at THEN
      UPDATE user_subscriptions SET updated_at = event_created WHERE user_id = user_key;
    END IF;
  END IF;

  PERFORM 1 FROM pro_picks WHERE user_id = user_key ORDER BY channel_id FOR UPDATE;

  IF next.status = ANY (paid_statuses) THEN
    IF NOT was_paid OR next.quantity > stored.quantity THEN
      -- The picks Pro before the raise, inside the stored capacity; none on a turn to paid.
      IF was_paid THEN
        SELECT coalesce(array_agg(channel_id), array[]::uuid[]) INTO pro_before
          FROM (
            SELECT p.channel_id,
              row_number() OVER (ORDER BY p.picked_at, o.created_at, p.channel_id) AS rank
            FROM pro_picks p
              JOIN memberships o ON o.channel_id = p.channel_id AND o.user_id = p.user_id
                AND o.role = 'owner'
            WHERE p.user_id = user_key
          ) counted
          WHERE rank <= slots_per_block * stored.quantity;
      END IF;
      -- The free slots, filled with the owned channels no pick of the user's holds, oldest owner
      -- membership first, on a turn to paid and on a raise while paid alike. A pick of the
      -- channel by an earlier owner counts for no one, so it is taken over.
      INSERT INTO pro_picks (channel_id, user_id, picked_at)
        SELECT m.channel_id, user_key, picked_at_now
        FROM memberships m
        WHERE m.user_id = user_key AND m.role = 'owner'
          AND NOT EXISTS (
            SELECT 1 FROM pro_picks p WHERE p.channel_id = m.channel_id AND p.user_id = user_key
          )
        ORDER BY m.created_at, m.channel_id
        LIMIT greatest(slots_per_block * next.quantity - (
          SELECT count(*) FROM pro_picks p
            JOIN memberships o ON o.channel_id = p.channel_id AND o.user_id = p.user_id
              AND o.role = 'owner'
          WHERE p.user_id = user_key
        ), 0)
      ON CONFLICT (channel_id) DO UPDATE
        SET user_id = excluded.user_id, picked_at = excluded.picked_at;
      SELECT coalesce(array_agg(channel_id ORDER BY rank), array[]::uuid[]) INTO turned_pro
        FROM (
          SELECT p.channel_id,
            row_number() OVER (ORDER BY p.picked_at, o.created_at, p.channel_id) AS rank
          FROM pro_picks p
            JOIN memberships o ON o.channel_id = p.channel_id AND o.user_id = p.user_id
              AND o.role = 'owner'
          WHERE p.user_id = user_key
        ) counted
        WHERE rank <= slots_per_block * next.quantity AND NOT (channel_id = ANY (pro_before));
      DELETE FROM pro_ends WHERE channel_id = ANY (turned_pro);
    END IF;
  ELSIF ends_purge_after IS NOT NULL THEN
    INSERT INTO pro_ends (channel_id, ended_at, purge_after)
      SELECT channel_id, ends_purge_after - purge_window, ends_purge_after
      FROM (
        SELECT p.channel_id,
          row_number() OVER (ORDER BY p.picked_at, o.created_at, p.channel_id) AS rank
        FROM pro_picks p
          JOIN memberships o ON o.channel_id = p.channel_id AND o.user_id = p.user_id
            AND o.role = 'owner'
        WHERE p.user_id = user_key
      ) counted
      WHERE rank <= slots_per_block * next.quantity
      ORDER BY channel_id
    ON CONFLICT (channel_id) DO UPDATE
      SET ended_at = excluded.ended_at, purge_after = excluded.purge_after
      WHERE pro_ends.purge_after IS NULL;
    GET DIAGNOSTICS ends_written = ROW_COUNT;
  END IF;

  IF outcome IS NULL THEN
    outcome := CASE WHEN row_changed OR ends_written > 0 THEN 'recorded' ELSE 'unchanged' END;
  END IF;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION record_user_subscription(text, uuid, text, text, text, text, timestamptz, integer, timestamptz, timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION record_user_subscription(text, uuid, text, text, text, text, timestamptz, integer, timestamptz, timestamptz) TO app_web;--> statement-breakpoint
-- As in 0030: the migration role gives a function away only to a role it can SET ROLE to, and only
-- when that role may create in the schema. The CREATE privilege is needed for this step alone.
GRANT CREATE ON SCHEMA public TO app_billing;--> statement-breakpoint
ALTER FUNCTION record_user_subscription(text, uuid, text, text, text, text, timestamptz, integer, timestamptz, timestamptz) OWNER TO app_billing;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM app_billing;
