-- Pro grants: blocks given to a user without a purchase, from the admin screen (stillstats#24,
-- ADR 0024). A grant is its own row, never a user_subscriptions row, and cascades from its user. Its
-- blocks add 4 slots each to the user's capacity beside the paid ones, everywhere the capacity is
-- counted: pro_state, record_user_subscription's fill and end, and the owner's pick. The admin
-- scope makes and removes grants, and the system scope ends one at its end date, only through the
-- functions below, which run as app_pro_grant; neither scope reads or writes a grant, a user's
-- email or another user's subscription itself.
--
-- A grant counts while its row exists. Its end, at the end date or on removal, deletes the row and
-- in the same transaction gives the picks that fall out of the capacity their purge date, so the
-- capacity never shrinks without them. Picks rank oldest first, so the newest leave first.
--
-- The locks are taken in one order everywhere: the user's subscription row, then their grants,
-- then their picks, then pro_ends rows. A user with grants and no subscription has no subscription
-- row to lock, so their grants serialize two picks of their last free slot.
CREATE ROLE "app_pro_grant";--> statement-breakpoint
CREATE TABLE "pro_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"blocks" integer NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "pro_grants_blocks" CHECK ("pro_grants"."blocks" >= 1)
);
--> statement-breakpoint
ALTER TABLE "pro_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pro_grants" ADD CONSTRAINT "pro_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pro_grants_user_id_idx" ON "pro_grants" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "memberships_pro_grant_select" ON "memberships" AS PERMISSIVE FOR SELECT TO "app_pro_grant" USING (((nullif(current_setting('app.scope', true), '') = 'admin') or (nullif(current_setting('app.scope', true), '') = 'system')));--> statement-breakpoint
CREATE POLICY "pro_ends_pro_grant_all" ON "pro_ends" AS PERMISSIVE FOR ALL TO "app_pro_grant" USING (((nullif(current_setting('app.scope', true), '') = 'admin') or (nullif(current_setting('app.scope', true), '') = 'system'))) WITH CHECK (((nullif(current_setting('app.scope', true), '') = 'admin') or (nullif(current_setting('app.scope', true), '') = 'system')));--> statement-breakpoint
CREATE POLICY "pro_picks_pro_grant_all" ON "pro_picks" AS PERMISSIVE FOR ALL TO "app_pro_grant" USING (((nullif(current_setting('app.scope', true), '') = 'admin') or (nullif(current_setting('app.scope', true), '') = 'system'))) WITH CHECK (((nullif(current_setting('app.scope', true), '') = 'admin') or (nullif(current_setting('app.scope', true), '') = 'system')));--> statement-breakpoint
CREATE POLICY "user_subscriptions_pro_grant_select" ON "user_subscriptions" AS PERMISSIVE FOR SELECT TO "app_pro_grant" USING (((nullif(current_setting('app.scope', true), '') = 'admin') or (nullif(current_setting('app.scope', true), '') = 'system')));--> statement-breakpoint
CREATE POLICY "user_subscriptions_pro_grant_update" ON "user_subscriptions" AS PERMISSIVE FOR UPDATE TO "app_pro_grant" USING (((nullif(current_setting('app.scope', true), '') = 'admin') or (nullif(current_setting('app.scope', true), '') = 'system'))) WITH CHECK (((nullif(current_setting('app.scope', true), '') = 'admin') or (nullif(current_setting('app.scope', true), '') = 'system')));--> statement-breakpoint
CREATE POLICY "users_pro_grant_select" ON "users" AS PERMISSIVE FOR SELECT TO "app_pro_grant" USING (((nullif(current_setting('app.scope', true), '') = 'admin') or (nullif(current_setting('app.scope', true), '') = 'system')));--> statement-breakpoint
CREATE POLICY "pro_grants_web" ON "pro_grants" AS PERMISSIVE FOR SELECT TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "pro_grants"."user_id" = nullif(current_setting('app.user_id', true), '')));--> statement-breakpoint
CREATE POLICY "pro_grants_pro_state" ON "pro_grants" AS PERMISSIVE FOR SELECT TO "app_pro_state" USING (((nullif(current_setting('app.scope', true), '') = 'user') or (nullif(current_setting('app.scope', true), '') = 'channel')));--> statement-breakpoint
CREATE POLICY "pro_grants_billing" ON "pro_grants" AS PERMISSIVE FOR ALL TO "app_billing" USING ((nullif(current_setting('app.scope', true), '') = 'anonymous')) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'anonymous'));--> statement-breakpoint
CREATE POLICY "pro_grants_pro_pick_select" ON "pro_grants" AS PERMISSIVE FOR SELECT TO "app_pro_pick" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "pro_grants"."user_id" = nullif(current_setting('app.user_id', true), '')));--> statement-breakpoint
CREATE POLICY "pro_grants_pro_pick_update" ON "pro_grants" AS PERMISSIVE FOR UPDATE TO "app_pro_pick" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "pro_grants"."user_id" = nullif(current_setting('app.user_id', true), ''))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "pro_grants"."user_id" = nullif(current_setting('app.user_id', true), '')));--> statement-breakpoint
CREATE POLICY "pro_grants_pro_grant_all" ON "pro_grants" AS PERMISSIVE FOR ALL TO "app_pro_grant" USING (((nullif(current_setting('app.scope', true), '') = 'admin') or (nullif(current_setting('app.scope', true), '') = 'system'))) WITH CHECK (((nullif(current_setting('app.scope', true), '') = 'admin') or (nullif(current_setting('app.scope', true), '') = 'system')));--> statement-breakpoint
-- What each definer role reads and writes; app_web and app_worker hold their table privileges from
-- 0001, and the policies above admit only the user scope's own grants to app_web. app_pro_grant
-- reads only the ID and email of a user; its update on user_subscriptions is for the FOR UPDATE
-- lock alone. app_billing and app_pro_pick lock a user's grants through their update, and update
-- none.
GRANT SELECT (id, email) ON users TO app_pro_grant;--> statement-breakpoint
GRANT SELECT ON memberships TO app_pro_grant;--> statement-breakpoint
GRANT SELECT, UPDATE ON user_subscriptions TO app_pro_grant;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON pro_picks, pro_ends, pro_grants TO app_pro_grant;--> statement-breakpoint
GRANT SELECT ON pro_grants TO app_pro_state;--> statement-breakpoint
GRANT SELECT, UPDATE ON pro_grants TO app_billing;--> statement-breakpoint
GRANT SELECT, UPDATE ON pro_grants TO app_pro_pick;--> statement-breakpoint
-- The blocks the user's grants give, 0 without one: the one place the grant sum is written. It runs
-- as its caller, so each definer role that counts a capacity reads the grants under its own policy.
CREATE FUNCTION granted_blocks(grantee text)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(sum(g.blocks), 0)::integer FROM pro_grants g WHERE g.user_id = grantee
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION granted_blocks(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION granted_blocks(text) TO app_pro_state, app_billing, app_pro_pick, app_pro_grant;--> statement-breakpoint
-- pro_state keeps its signature, owner, grants and every rule of 0041; the capacity is 4 slots for
-- each block of a live paid subscription, none without one, and 4 for each granted block, so a
-- pick of a user with grants and no subscription counts.
CREATE OR REPLACE FUNCTION pro_state(checked_channel uuid)
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
    SELECT c.rank <= 4 * (
      coalesce((
        SELECT s.quantity FROM user_subscriptions s
        WHERE s.user_id = (SELECT user_id FROM picker) AND s.status IN ('active', 'past_due')
      ), 0)
      + granted_blocks((SELECT user_id FROM picker))
    )
    FROM counted c
    WHERE c.channel_id = checked_channel
  ), false)
$$;--> statement-breakpoint
-- record_user_subscription keeps its signature, its owner (app_billing), its grants and every rule
-- of 0041 and 0043. The granted slots come first in the capacity, and the paid ones after them:
--   - It locks the user's grants after the subscription row and before the picks.
--   - A turn to paid, or a raise while paid, fills the free slots of the granted and paid blocks
--     together, and answers in turned_pro only the picks that were not Pro before it: on a turn to
--     paid the picks inside the granted slots already were, and on a raise those inside the stored
--     paid ones too.
--   - An end writes the purge date only on the picks ranked inside the paid slots, after the
--     granted ones. The picks inside the granted slots stay Pro and get no date.
CREATE OR REPLACE FUNCTION record_user_subscription(
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
  granted_slots integer := 0;
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

  PERFORM 1 FROM pro_grants WHERE user_id = user_key ORDER BY id FOR UPDATE;
  PERFORM 1 FROM pro_picks WHERE user_id = user_key ORDER BY channel_id FOR UPDATE;
  granted_slots := slots_per_block * granted_blocks(user_key);

  IF next.status = ANY (paid_statuses) THEN
    IF NOT was_paid OR next.quantity > stored.quantity THEN
      -- The picks Pro before: inside the granted slots, and on a raise inside the stored paid
      -- ones too.
      SELECT coalesce(array_agg(channel_id), array[]::uuid[]) INTO pro_before
        FROM (
          SELECT p.channel_id,
            row_number() OVER (ORDER BY p.picked_at, o.created_at, p.channel_id) AS rank
          FROM pro_picks p
            JOIN memberships o ON o.channel_id = p.channel_id AND o.user_id = p.user_id
              AND o.role = 'owner'
          WHERE p.user_id = user_key
        ) counted
        WHERE rank <= granted_slots
          + CASE WHEN was_paid THEN slots_per_block * stored.quantity ELSE 0 END;
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
        LIMIT greatest(granted_slots + slots_per_block * next.quantity - (
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
        WHERE rank <= granted_slots + slots_per_block * next.quantity
          AND NOT (channel_id = ANY (pro_before));
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
      WHERE rank > granted_slots AND rank <= granted_slots + slots_per_block * next.quantity
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
-- pick_pro_channel keeps its signature, owner, grants and every rule of 0042. It locks the user's
-- grants after the subscription row and before the picks, and its free slots are 4 for each block
-- of a live paid subscription, none without one, and 4 for each granted block, so a user with
-- grants and no subscription picks into the granted slots.
CREATE OR REPLACE FUNCTION pick_pro_channel(picked_channel uuid, OUT outcome text, OUT turned_pro uuid[])
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  paid_statuses constant text[] := array['active', 'past_due'];
  slots_per_block constant integer := 4;
  user_key constant text := nullif(current_setting('app.user_id', true), '');
  picked_at_now constant timestamptz :=
    coalesce(nullif(current_setting('app.now', true), '')::timestamptz, now());
  held_role text;
  stored user_subscriptions%ROWTYPE;
  capacity integer;
  counting integer;
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'user' OR user_key IS NULL THEN
    RAISE EXCEPTION 'pick_pro_channel runs only in the user scope';
  END IF;
  turned_pro := array[]::uuid[];

  SELECT m.role INTO held_role FROM memberships m
    WHERE m.channel_id = picked_channel AND m.user_id = user_key;
  IF NOT FOUND THEN
    outcome := 'not_connected';
    RETURN;
  END IF;
  IF held_role <> 'owner' THEN
    outcome := 'not_owner';
    RETURN;
  END IF;

  SELECT * INTO stored FROM user_subscriptions WHERE user_id = user_key FOR UPDATE;
  PERFORM 1 FROM pro_grants WHERE user_id = user_key ORDER BY id FOR UPDATE;
  PERFORM 1 FROM pro_picks WHERE user_id = user_key ORDER BY channel_id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM pro_picks p WHERE p.channel_id = picked_channel AND p.user_id = user_key
  ) THEN
    outcome := 'unchanged';
    RETURN;
  END IF;
  capacity := slots_per_block * granted_blocks(user_key);
  IF stored.user_id IS NOT NULL AND stored.status = ANY (paid_statuses) THEN
    capacity := capacity + slots_per_block * stored.quantity;
  END IF;
  SELECT count(*) INTO counting FROM pro_picks p
    JOIN memberships o ON o.channel_id = p.channel_id AND o.user_id = p.user_id
      AND o.role = 'owner'
  WHERE p.user_id = user_key;
  IF counting >= capacity THEN
    outcome := 'no_free_slot';
    RETURN;
  END IF;

  INSERT INTO pro_picks (channel_id, user_id, picked_at)
  VALUES (picked_channel, user_key, picked_at_now)
  ON CONFLICT (channel_id) DO UPDATE
    SET user_id = excluded.user_id, picked_at = excluded.picked_at;
  IF pro_state(picked_channel) THEN
    DELETE FROM pro_ends WHERE channel_id = picked_channel;
    turned_pro := array[picked_channel];
  END IF;
  outcome := 'picked';
END
$$;--> statement-breakpoint
-- unpick_pro_channel keeps its signature, owner, grants and every rule of 0042, and takes the
-- pick's locks in the pick's order, the user's grants now among them. pro_state counts the granted
-- slots for it.
CREATE OR REPLACE FUNCTION unpick_pro_channel(
  unpicked_channel uuid,
  ends_purge_after timestamptz,
  OUT outcome text,
  OUT turned_pro uuid[]
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  purge_window constant interval := interval '30 days';
  user_key constant text := nullif(current_setting('app.user_id', true), '');
  held_role text;
  was_pro boolean;
  pro_before uuid[];
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'user' OR user_key IS NULL THEN
    RAISE EXCEPTION 'unpick_pro_channel runs only in the user scope';
  END IF;
  turned_pro := array[]::uuid[];

  SELECT m.role INTO held_role FROM memberships m
    WHERE m.channel_id = unpicked_channel AND m.user_id = user_key;
  IF NOT FOUND THEN
    outcome := 'not_connected';
    RETURN;
  END IF;
  IF held_role <> 'owner' THEN
    outcome := 'not_owner';
    RETURN;
  END IF;

  PERFORM 1 FROM user_subscriptions WHERE user_id = user_key FOR UPDATE;
  PERFORM 1 FROM pro_grants WHERE user_id = user_key ORDER BY id FOR UPDATE;
  PERFORM 1 FROM pro_picks WHERE user_id = user_key ORDER BY channel_id FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM pro_picks p WHERE p.channel_id = unpicked_channel AND p.user_id = user_key
  ) THEN
    outcome := 'unchanged';
    RETURN;
  END IF;

  SELECT coalesce(array_agg(p.channel_id), array[]::uuid[]) INTO pro_before
    FROM pro_picks p WHERE p.user_id = user_key AND pro_state(p.channel_id);
  was_pro := unpicked_channel = ANY (pro_before);

  DELETE FROM pro_picks WHERE channel_id = unpicked_channel AND user_id = user_key;
  IF was_pro THEN
    INSERT INTO pro_ends (channel_id, ended_at, purge_after)
    VALUES (unpicked_channel, ends_purge_after - purge_window, ends_purge_after)
    ON CONFLICT (channel_id) DO UPDATE
      SET ended_at = excluded.ended_at, purge_after = excluded.purge_after;
  END IF;

  SELECT coalesce(array_agg(p.channel_id ORDER BY p.channel_id), array[]::uuid[]) INTO turned_pro
    FROM pro_picks p
    WHERE p.user_id = user_key AND NOT (p.channel_id = ANY (pro_before)) AND pro_state(p.channel_id);
  DELETE FROM pro_ends WHERE channel_id = ANY (turned_pro);
  outcome := 'unpicked';
END
$$;--> statement-breakpoint
-- The admin's grant of blocks to the user whose email is given, compared lower-cased, in the
-- admin scope only. 'no_user' for no such user, which writes nothing. Else it locks the user's
-- subscription row, grants and picks, records the grant at the scope's clock, and fills the
-- user's free slots exactly as a turn to paid does (ADR 0024: a granted Block fills slots as a
-- bought one does): their owned channels no pick of theirs holds, oldest owner membership first,
-- taking over an earlier owner's pick. It answers 'granted', the grant's ID, and in turned_pro
-- every pick that was not Pro before and is now, whose pro_ends row it deletes, so the caller
-- sends each one's history download.
CREATE FUNCTION create_pro_grant(
  grantee_email text,
  granted integer,
  ends timestamptz,
  OUT outcome text,
  OUT grant_id uuid,
  OUT turned_pro uuid[]
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  paid_statuses constant text[] := array['active', 'past_due'];
  slots_per_block constant integer := 4;
  made_at constant timestamptz :=
    coalesce(nullif(current_setting('app.now', true), '')::timestamptz, now());
  user_key text;
  stored user_subscriptions%ROWTYPE;
  capacity integer;
  pro_before uuid[];
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'create_pro_grant runs only in the admin scope';
  END IF;
  turned_pro := array[]::uuid[];

  SELECT u.id INTO user_key FROM users u
    WHERE lower(u.email) = lower(grantee_email)
    ORDER BY (u.email = grantee_email) DESC, u.id
    LIMIT 1;
  IF user_key IS NULL THEN
    outcome := 'no_user';
    RETURN;
  END IF;

  SELECT * INTO stored FROM user_subscriptions WHERE user_id = user_key FOR UPDATE;
  PERFORM 1 FROM pro_grants WHERE user_id = user_key ORDER BY id FOR UPDATE;
  PERFORM 1 FROM pro_picks WHERE user_id = user_key ORDER BY channel_id FOR UPDATE;

  capacity := slots_per_block * granted_blocks(user_key);
  IF stored.user_id IS NOT NULL AND stored.status = ANY (paid_statuses) THEN
    capacity := capacity + slots_per_block * stored.quantity;
  END IF;
  SELECT coalesce(array_agg(channel_id), array[]::uuid[]) INTO pro_before
    FROM (
      SELECT p.channel_id,
        row_number() OVER (ORDER BY p.picked_at, o.created_at, p.channel_id) AS rank
      FROM pro_picks p
        JOIN memberships o ON o.channel_id = p.channel_id AND o.user_id = p.user_id
          AND o.role = 'owner'
      WHERE p.user_id = user_key
    ) counted
    WHERE rank <= capacity;

  INSERT INTO pro_grants (user_id, blocks, ends_at, created_at)
  VALUES (user_key, granted, ends, made_at)
  RETURNING id INTO grant_id;
  capacity := capacity + slots_per_block * granted;

  INSERT INTO pro_picks (channel_id, user_id, picked_at)
    SELECT m.channel_id, user_key, made_at
    FROM memberships m
    WHERE m.user_id = user_key AND m.role = 'owner'
      AND NOT EXISTS (
        SELECT 1 FROM pro_picks p WHERE p.channel_id = m.channel_id AND p.user_id = user_key
      )
    ORDER BY m.created_at, m.channel_id
    LIMIT greatest(capacity - (
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
    WHERE rank <= capacity AND NOT (channel_id = ANY (pro_before));
  DELETE FROM pro_ends WHERE channel_id = ANY (turned_pro);
  outcome := 'granted';
END
$$;--> statement-breakpoint
-- The end of a grant: the admin's removal, in the admin scope, or the worker's end at the grant's
-- end date, in the system scope. 'no_grant' for a grant that is gone: removed, ended, or its user
-- deleted. Else it locks the user's subscription row, grants and picks, and gives every pick that
-- falls out of the capacity as the grant's blocks leave it, the newest since picks rank oldest
-- first, the purge date the caller passes, ended 30 days before it, replacing any row it held: a
-- pick inside the capacity was Pro and held none but one the purge had cleared. Then it deletes
-- the grant and answers 'ended'.
CREATE FUNCTION end_pro_grant(ended_grant uuid, ends_purge_after timestamptz, OUT outcome text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  paid_statuses constant text[] := array['active', 'past_due'];
  purge_window constant interval := interval '30 days';
  slots_per_block constant integer := 4;
  user_key text;
  stored user_subscriptions%ROWTYPE;
  ending pro_grants%ROWTYPE;
  capacity_before integer;
  capacity_after integer;
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'admin'
    AND nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'system' THEN
    RAISE EXCEPTION 'end_pro_grant runs only in the admin and system scopes';
  END IF;

  SELECT g.user_id INTO user_key FROM pro_grants g WHERE g.id = ended_grant;
  IF user_key IS NULL THEN
    outcome := 'no_grant';
    RETURN;
  END IF;

  SELECT * INTO stored FROM user_subscriptions WHERE user_id = user_key FOR UPDATE;
  PERFORM 1 FROM pro_grants WHERE user_id = user_key ORDER BY id FOR UPDATE;
  PERFORM 1 FROM pro_picks WHERE user_id = user_key ORDER BY channel_id FOR UPDATE;

  -- A removal and an end of the same grant at once: the second finds it gone once the first ends.
  SELECT * INTO ending FROM pro_grants WHERE id = ended_grant;
  IF NOT FOUND THEN
    outcome := 'no_grant';
    RETURN;
  END IF;

  capacity_before := slots_per_block * granted_blocks(user_key);
  IF stored.user_id IS NOT NULL AND stored.status = ANY (paid_statuses) THEN
    capacity_before := capacity_before + slots_per_block * stored.quantity;
  END IF;
  capacity_after := capacity_before - slots_per_block * ending.blocks;

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
    WHERE rank > capacity_after AND rank <= capacity_before
    ORDER BY channel_id
  ON CONFLICT (channel_id) DO UPDATE
    SET ended_at = excluded.ended_at, purge_after = excluded.purge_after;

  DELETE FROM pro_grants WHERE id = ended_grant;
  outcome := 'ended';
END
$$;--> statement-breakpoint
-- The end date of a grant, for the worker's end job in the system scope only, which reads no grant
-- row itself; null for a grant that is gone or has no end.
CREATE FUNCTION pro_grant_end_of(checked_grant uuid)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'system' THEN
    RAISE EXCEPTION 'pro_grant_end_of runs only in the system scope';
  END IF;
  RETURN (SELECT g.ends_at FROM pro_grants g WHERE g.id = checked_grant);
END
$$;--> statement-breakpoint
-- Every grant, newest first, for the admin screen in the admin scope only: its user's email, its
-- blocks and end, and beside them the user's paid blocks, those of a live paid subscription, 0
-- without one, and the sum of the user's grants.
CREATE FUNCTION pro_grants_list()
RETURNS TABLE (
  id uuid,
  email text,
  blocks integer,
  ends_at timestamptz,
  created_at timestamptz,
  paid_blocks integer,
  granted_blocks integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'pro_grants_list runs only in the admin scope';
  END IF;
  RETURN QUERY
    SELECT g.id, u.email, g.blocks, g.ends_at, g.created_at,
      coalesce((
        SELECT s.quantity FROM user_subscriptions s
        WHERE s.user_id = g.user_id AND s.status IN ('active', 'past_due')
      ), 0)::integer,
      public.granted_blocks(g.user_id)
    FROM pro_grants g
      JOIN users u ON u.id = g.user_id
    ORDER BY g.created_at DESC, g.id;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION create_pro_grant(text, integer, timestamptz) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION end_pro_grant(uuid, timestamptz) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION pro_grant_end_of(uuid) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION pro_grants_list() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION create_pro_grant(text, integer, timestamptz) TO app_web;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION pro_grants_list() TO app_web;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION end_pro_grant(uuid, timestamptz) TO app_web, app_worker;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION pro_grant_end_of(uuid) TO app_worker;--> statement-breakpoint
-- As in 0030: the migration role gives a function away only to a role it can SET ROLE to, and only
-- when that role may create in the schema. The CREATE privilege is needed for this step alone.
GRANT app_pro_grant TO app_migrator;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO app_pro_grant;--> statement-breakpoint
ALTER FUNCTION create_pro_grant(text, integer, timestamptz) OWNER TO app_pro_grant;--> statement-breakpoint
ALTER FUNCTION end_pro_grant(uuid, timestamptz) OWNER TO app_pro_grant;--> statement-breakpoint
ALTER FUNCTION pro_grant_end_of(uuid) OWNER TO app_pro_grant;--> statement-breakpoint
ALTER FUNCTION pro_grants_list() OWNER TO app_pro_grant;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM app_pro_grant;