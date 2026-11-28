-- Pro in blocks of 4 channels on the user's subscription (stillstats#20, ADR 0024). The
-- Subscription moves from the channel to its user, with its quantity, the number of Blocks; a
-- channel is Pro while its owner has picked it and the pick ranks inside the owner's capacity, 4
-- slots for each live paid block. This is the expand release of docs/deploy.md, "The release
-- step": the user-keyed tables are new, and the channel-keyed subscriptions, subscription_payments
-- and subscription_cancellations stay as they are for the previous release's images, which read
-- them during and after the deploy. Their rows are copied below, not moved. The remove release
-- drops them.
CREATE ROLE "app_pro_state";--> statement-breakpoint
CREATE TABLE "account_cancellations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_cancellations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pro_picks" (
	"channel_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"picked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "pro_picks_pkey" PRIMARY KEY("channel_id")
);
--> statement-breakpoint
ALTER TABLE "pro_picks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_subscription_payments" (
	"stripe_invoice_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_subscription_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"plan" text,
	"status" text NOT NULL,
	"quantity" integer NOT NULL,
	"current_period_end" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id"),
	CONSTRAINT "user_subscriptions_plan" CHECK ("user_subscriptions"."plan" in ('monthly', 'annual')),
	CONSTRAINT "user_subscriptions_quantity" CHECK ("user_subscriptions"."quantity" >= 1)
);
--> statement-breakpoint
ALTER TABLE "user_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pro_picks" ADD CONSTRAINT "pro_picks_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pro_picks" ADD CONSTRAINT "pro_picks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscription_payments" ADD CONSTRAINT "user_subscription_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pro_picks_user_id_idx" ON "pro_picks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_subscription_payments_user_id_idx" ON "user_subscription_payments" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "memberships_billing" ON "memberships" AS PERMISSIVE FOR SELECT TO "app_billing" USING ((nullif(current_setting('app.scope', true), '') = 'anonymous'));--> statement-breakpoint
CREATE POLICY "memberships_pro_state" ON "memberships" AS PERMISSIVE FOR SELECT TO "app_pro_state" USING (((nullif(current_setting('app.scope', true), '') = 'user') or (nullif(current_setting('app.scope', true), '') = 'channel')));--> statement-breakpoint
CREATE POLICY "account_cancellations_web_insert" ON "account_cancellations" AS PERMISSIVE FOR INSERT TO "app_web" WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "account_cancellations"."stripe_subscription_id" in (select s.stripe_subscription_id from user_subscriptions s)));--> statement-breakpoint
CREATE POLICY "account_cancellations_worker_system_select" ON "account_cancellations" AS PERMISSIVE FOR SELECT TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'system'));--> statement-breakpoint
CREATE POLICY "account_cancellations_worker_system_delete" ON "account_cancellations" AS PERMISSIVE FOR DELETE TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'system'));--> statement-breakpoint
CREATE POLICY "pro_picks_web" ON "pro_picks" AS PERMISSIVE FOR SELECT TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and ("pro_picks"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '')) or "pro_picks"."user_id" = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "pro_picks_worker_channel_select" ON "pro_picks" AS PERMISSIVE FOR SELECT TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "pro_picks"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "pro_picks_billing" ON "pro_picks" AS PERMISSIVE FOR ALL TO "app_billing" USING ((nullif(current_setting('app.scope', true), '') = 'anonymous')) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'anonymous'));--> statement-breakpoint
CREATE POLICY "pro_picks_pro_state" ON "pro_picks" AS PERMISSIVE FOR SELECT TO "app_pro_state" USING (((nullif(current_setting('app.scope', true), '') = 'user') or (nullif(current_setting('app.scope', true), '') = 'channel')));--> statement-breakpoint
CREATE POLICY "user_subscription_payments_web" ON "user_subscription_payments" AS PERMISSIVE FOR SELECT TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "user_subscription_payments"."user_id" = nullif(current_setting('app.user_id', true), '')));--> statement-breakpoint
CREATE POLICY "user_subscription_payments_billing" ON "user_subscription_payments" AS PERMISSIVE FOR ALL TO "app_billing" USING ((nullif(current_setting('app.scope', true), '') = 'anonymous')) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'anonymous'));--> statement-breakpoint
CREATE POLICY "user_subscriptions_web" ON "user_subscriptions" AS PERMISSIVE FOR SELECT TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "user_subscriptions"."user_id" = nullif(current_setting('app.user_id', true), '')));--> statement-breakpoint
CREATE POLICY "user_subscriptions_billing" ON "user_subscriptions" AS PERMISSIVE FOR ALL TO "app_billing" USING ((nullif(current_setting('app.scope', true), '') = 'anonymous')) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'anonymous'));--> statement-breakpoint
CREATE POLICY "user_subscriptions_pro_state" ON "user_subscriptions" AS PERMISSIVE FOR SELECT TO "app_pro_state" USING (((nullif(current_setting('app.scope', true), '') = 'user') or (nullif(current_setting('app.scope', true), '') = 'channel')));--> statement-breakpoint

-- The fill and the end of record_user_subscription, and the copy below, read and write these as
-- app_billing; pro_state reads its three as app_pro_state. Neither role logs in.
GRANT SELECT, INSERT, UPDATE ON user_subscriptions TO app_billing;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON pro_picks TO app_billing;--> statement-breakpoint
GRANT SELECT, INSERT ON user_subscription_payments TO app_billing;--> statement-breakpoint
GRANT SELECT ON memberships TO app_billing;--> statement-breakpoint
GRANT SELECT ON pro_picks, user_subscriptions, memberships TO app_pro_state;--> statement-breakpoint
-- The one write path of Stripe's webhook to a user's subscription, its channel picks and the
-- pro_ends rows of its picked channels. It runs as app_billing, whose policies admit every row in
-- the anonymous scope, so the anonymous scope as app_web still reads and writes no row of any of
-- them. Every rule of 0033, 0039 and 0040 for the stored row stays, keyed on the user:
--   - Stripe orders none of its events, so a null argument keeps the stored value, and an older
--     event of the stored subscription only fills a null plan or period end.
--   - The same subscription, once canceled, stays canceled.
--   - Another subscription replaces only one that is not paid, and a live one of a paid user
--     answers 'other_subscription' and records nothing.
--   - A null quantity, the Checkout event's, keeps the stored one, and is 1 for a new row.
-- The subscriber is the user the metadata names. A subscription made before blocks names a channel
-- instead, and records onto the channel's owner. No such owner, or no such user, answers 'no_user'.
--
-- A turn to paid, from no row or a status that is not paid, fills the user's free slots with their
-- owned channels that no pick of theirs holds, in the order their owner memberships were created,
-- deletes the pro_ends row of every pick inside the capacity, and answers those channels in
-- turned_pro, so the webhook sends each one's history download. A status that is not paid gives
-- every pick inside the capacity the event's purge date on its pro_ends row, keeping a stored one,
-- so a later end never moves it. Picks survive the end, so a return keeps its channels.
--
-- A pick counts while its channel still holds its user's owner membership, and picks rank by
-- picked_at, then by the owner membership's creation, as pro_state ranks them. The locks are taken
-- in one order: the user's subscription row, then the user's picks, then their pro_ends rows.
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
    IF NOT was_paid THEN
      -- The free slots, filled with the owned channels no pick of the user's holds, oldest owner
      -- membership first. A pick of the channel by an earlier owner counts for no one, so it is
      -- taken over.
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
        WHERE rank <= slots_per_block * next.quantity;
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
-- The one write path to user_subscription_payments: each paid invoice of a user's subscription
-- once, so a repeated delivery of invoice.paid sends OpenPanel no second revenue event. True for a
-- new row; false for an invoice already recorded, by this delivery's twin too, since the insert
-- waits on its uncommitted row, and for no such user. The user is resolved as
-- record_user_subscription resolves it.
CREATE FUNCTION record_user_subscription_payment(invoice text, subscriber text, legacy_channel uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  user_key text := subscriber;
  written integer;
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'anonymous' THEN
    RAISE EXCEPTION 'record_user_subscription_payment runs only in the anonymous scope';
  END IF;

  IF user_key IS NULL AND legacy_channel IS NOT NULL THEN
    SELECT m.user_id INTO user_key FROM memberships m
      WHERE m.channel_id = legacy_channel AND m.role = 'owner';
  END IF;
  IF user_key IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    INSERT INTO user_subscription_payments (stripe_invoice_id, user_id)
    VALUES (invoice, user_key)
    ON CONFLICT (stripe_invoice_id) DO NOTHING;
    GET DIAGNOSTICS written = ROW_COUNT;
  EXCEPTION WHEN foreign_key_violation THEN
    RETURN false;
  END;

  RETURN written = 1;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION record_user_subscription_payment(text, text, uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION record_user_subscription_payment(text, text, uuid) TO app_web;--> statement-breakpoint
-- As in 0030: the migration role gives a function away only to a role it can SET ROLE to, and only
-- when that role may create in the schema. The CREATE privilege is needed for this step alone.
GRANT CREATE ON SCHEMA public TO app_billing;--> statement-breakpoint
ALTER FUNCTION record_user_subscription(text, uuid, text, text, text, text, timestamptz, integer, timestamptz, timestamptz) OWNER TO app_billing;--> statement-breakpoint
ALTER FUNCTION record_user_subscription_payment(text, text, uuid) OWNER TO app_billing;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM app_billing;--> statement-breakpoint
-- Whether a channel is Pro: it has a pick whose user still holds its owner membership, the user's
-- subscription is active or past due, and the pick ranks inside the user's capacity, 4 slots for
-- each block, by picked_at and then the owner membership's creation. It answers only for a channel
-- the caller's scope already admits, a channel the user scope's user holds or the channel scope's
-- own, and false for any other, so it tells a caller one boolean of a channel it may read, less
-- than a member read of a channel's subscription row before blocks. It runs as app_pro_state,
-- which holds SELECT on the three tables it reads, and whose policies admit every row in the two
-- scopes it answers in.
CREATE FUNCTION pro_state(checked_channel uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH admitted AS (
    SELECT 1 WHERE
      (nullif(current_setting('app.scope', true), '') = 'user' AND EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.channel_id = checked_channel
          AND m.user_id = nullif(current_setting('app.user_id', true), '')
      ))
      OR (nullif(current_setting('app.scope', true), '') = 'channel'
        AND checked_channel = nullif(current_setting('app.channel_id', true), '')::uuid)
  ),
  picker AS (
    SELECT p.user_id FROM pro_picks p, admitted WHERE p.channel_id = checked_channel
  ),
  counted AS (
    SELECT p.channel_id,
      row_number() OVER (ORDER BY p.picked_at, o.created_at, p.channel_id) AS rank
    FROM pro_picks p
      JOIN memberships o ON o.channel_id = p.channel_id AND o.user_id = p.user_id
        AND o.role = 'owner'
    WHERE p.user_id = (SELECT user_id FROM picker)
  )
  SELECT coalesce((
    SELECT c.rank <= 4 * s.quantity
    FROM counted c
      JOIN user_subscriptions s ON s.user_id = (SELECT user_id FROM picker)
    WHERE c.channel_id = checked_channel AND s.status IN ('active', 'past_due')
  ), false)
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION pro_state(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION pro_state(uuid) TO app_web, app_worker;--> statement-breakpoint
GRANT app_pro_state TO app_migrator;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO app_pro_state;--> statement-breakpoint
ALTER FUNCTION pro_state(uuid) OWNER TO app_pro_state;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM app_pro_state;--> statement-breakpoint
-- The copy. Each channel subscription whose channel has an owner becomes its owner's subscription
-- with quantity 1 and its channel picked at its updated_at. An owner of several keeps one row, a
-- paid one first, then the newest, and every one of those channels picked. A channel with no owner
-- membership is waiting for its deletion, which cascades its rows, and is not copied. Each paid
-- invoice of a channel with an owner becomes its owner's. A pick inside a paid user's capacity
-- is Pro, so its pro_ends row goes, as a turn to paid deletes it. Staging and production force
-- row-level security on these tables and no policy admits the migration role, so the copy runs
-- with it lifted, or it reads no row and copies nothing. The new tables are not forced yet.
ALTER TABLE subscriptions NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE subscription_payments NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE memberships NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE pro_ends NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO user_subscriptions (
  user_id, stripe_customer_id, stripe_subscription_id, plan, status, quantity, current_period_end,
  updated_at
)
  SELECT DISTINCT ON (m.user_id)
    m.user_id, s.stripe_customer_id, s.stripe_subscription_id, s.plan, s.status, 1,
    s.current_period_end, s.updated_at
  FROM subscriptions s
    JOIN memberships m ON m.channel_id = s.channel_id AND m.role = 'owner'
  ORDER BY m.user_id, (s.status IN ('active', 'past_due')) DESC, s.updated_at DESC;--> statement-breakpoint
INSERT INTO pro_picks (channel_id, user_id, picked_at)
  SELECT s.channel_id, m.user_id, s.updated_at
  FROM subscriptions s
    JOIN memberships m ON m.channel_id = s.channel_id AND m.role = 'owner';--> statement-breakpoint
INSERT INTO user_subscription_payments (stripe_invoice_id, user_id)
  SELECT p.stripe_invoice_id, m.user_id
  FROM subscription_payments p
    JOIN memberships m ON m.channel_id = p.channel_id AND m.role = 'owner'
  ON CONFLICT (stripe_invoice_id) DO NOTHING;--> statement-breakpoint
DELETE FROM pro_ends WHERE channel_id IN (
  SELECT counted.channel_id
  FROM (
    SELECT p.channel_id, p.user_id,
      row_number() OVER (
        PARTITION BY p.user_id ORDER BY p.picked_at, o.created_at, p.channel_id
      ) AS rank
    FROM pro_picks p
      JOIN memberships o ON o.channel_id = p.channel_id AND o.user_id = p.user_id
        AND o.role = 'owner'
  ) counted
    JOIN user_subscriptions u ON u.user_id = counted.user_id
  WHERE u.status IN ('active', 'past_due') AND counted.rank <= 4 * u.quantity
);--> statement-breakpoint
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE subscription_payments FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE pro_ends FORCE ROW LEVEL SECURITY;--> statement-breakpoint
-- The previous release's webhook calls these two. Dropped and created again to raise, with the
-- same signatures, grants and owner, so a delivery that reaches an old API image during the
-- deploy answers 500 and Stripe delivers it again to the new one, instead of answering 200 for a
-- write to tables nothing reads any more. The remove release drops them.
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
BEGIN
  RAISE EXCEPTION 'record_subscription is retired: a subscription belongs to its user (record_user_subscription)';
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION record_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION record_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz) TO app_web;--> statement-breakpoint
DROP FUNCTION record_subscription_payment(text, uuid);--> statement-breakpoint
CREATE FUNCTION record_subscription_payment(invoice text, paid_channel_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'record_subscription_payment is retired: a subscription belongs to its user (record_user_subscription_payment)';
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION record_subscription_payment(text, uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION record_subscription_payment(text, uuid) TO app_web;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO app_billing;--> statement-breakpoint
ALTER FUNCTION record_subscription(uuid, text, text, text, text, timestamptz, timestamptz, timestamptz) OWNER TO app_billing;--> statement-breakpoint
ALTER FUNCTION record_subscription_payment(text, uuid) OWNER TO app_billing;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM app_billing;
