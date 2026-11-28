-- The owner picks and unpicks their Pro channels (stillstats#21, ADR 0024). A pick takes a free
-- slot, 4 for each block of a live paid subscription; an unpick frees one and starts the channel's
-- 30 days to its purge date. Both run as app_pro_pick, which no login role is a member of, so the
-- user scope as app_web still writes no pick and locks no subscription row itself.
CREATE ROLE "app_pro_pick";--> statement-breakpoint
CREATE POLICY "memberships_pro_pick" ON "memberships" AS PERMISSIVE FOR SELECT TO "app_pro_pick" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "memberships"."user_id" = nullif(current_setting('app.user_id', true), '')));--> statement-breakpoint
CREATE POLICY "pro_ends_pro_pick_all" ON "pro_ends" AS PERMISSIVE FOR ALL TO "app_pro_pick" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "pro_ends"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '') and m.role = 'owner'))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "pro_ends"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '') and m.role = 'owner')));--> statement-breakpoint
CREATE POLICY "pro_picks_pro_pick_all" ON "pro_picks" AS PERMISSIVE FOR ALL TO "app_pro_pick" USING ((nullif(current_setting('app.scope', true), '') = 'user' and ("pro_picks"."user_id" = nullif(current_setting('app.user_id', true), '') or "pro_picks"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '') and m.role = 'owner')))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and ("pro_picks"."user_id" = nullif(current_setting('app.user_id', true), '') or "pro_picks"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '') and m.role = 'owner'))));--> statement-breakpoint
CREATE POLICY "user_subscriptions_pro_pick_select" ON "user_subscriptions" AS PERMISSIVE FOR SELECT TO "app_pro_pick" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "user_subscriptions"."user_id" = nullif(current_setting('app.user_id', true), '')));--> statement-breakpoint
CREATE POLICY "user_subscriptions_pro_pick_update" ON "user_subscriptions" AS PERMISSIVE FOR UPDATE TO "app_pro_pick" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "user_subscriptions"."user_id" = nullif(current_setting('app.user_id', true), ''))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "user_subscriptions"."user_id" = nullif(current_setting('app.user_id', true), '')));--> statement-breakpoint

-- What the two functions read and write as app_pro_pick, whose policies admit only the user
-- scope's own memberships, subscription row and picks, and the pro_ends rows of the channels it
-- owns. The update on user_subscriptions is for the FOR UPDATE lock alone; neither updates it.
GRANT SELECT ON memberships TO app_pro_pick;--> statement-breakpoint
GRANT SELECT, UPDATE ON user_subscriptions TO app_pro_pick;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON pro_picks, pro_ends TO app_pro_pick;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION pro_state(uuid) TO app_pro_pick;--> statement-breakpoint
-- The owner's pick of a channel into a free slot, in the user scope only. It answers
-- 'not_connected' for a channel the user holds no membership to, 'not_owner' for one they hold and
-- do not own, 'unchanged' for one they already picked, 'no_free_slot' without a live paid
-- subscription or when their counting picks fill 4 slots for each block, and 'picked' otherwise.
-- A pick takes over an earlier owner's pick of the channel, which counts for no one, as the fill
-- does. A pick that turns the channel Pro deletes its pro_ends row, so a pick before the purge
-- date keeps its history, and answers the channel in turned_pro, so its history downloads now;
-- after the purge it starts again from what YouTube still holds, as a return does.
--
-- The locks are taken in record_user_subscription's order: the user's subscription row, then the
-- user's picks, then the channel's pro_ends row. Two picks of the last free slot at once wait on
-- the subscription row, and the second counts the first's pick.
CREATE FUNCTION pick_pro_channel(picked_channel uuid, OUT outcome text, OUT turned_pro uuid[])
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
  PERFORM 1 FROM pro_picks WHERE user_id = user_key ORDER BY channel_id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM pro_picks p WHERE p.channel_id = picked_channel AND p.user_id = user_key
  ) THEN
    outcome := 'unchanged';
    RETURN;
  END IF;
  IF stored.user_id IS NULL OR NOT (stored.status = ANY (paid_statuses)) THEN
    outcome := 'no_free_slot';
    RETURN;
  END IF;
  SELECT count(*) INTO counting FROM pro_picks p
    JOIN memberships o ON o.channel_id = p.channel_id AND o.user_id = p.user_id
      AND o.role = 'owner'
  WHERE p.user_id = user_key;
  IF counting >= slots_per_block * stored.quantity THEN
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
-- The owner's unpick of a channel, in the user scope only, which frees its slot. It answers
-- 'not_connected' and 'not_owner' as the pick does, 'unchanged' for a channel the user has not
-- picked, and 'unpicked' otherwise. A channel that was Pro at the unpick gets its pro_ends row,
-- ended now and purged on ends_purge_after, the purge date the caller passes 30 days on
-- (purgeDateOf), replacing any it held; one already free, its subscription ended or its history
-- purged, keeps what its row holds, since its 30 days already run. The freed slot fills with
-- nothing: a swap picks the next channel itself. A pick beyond the capacity that ranks inside it
-- once this one leaves turns Pro, which only a cut in the capacity makes: its pro_ends row goes
-- and it is answered in turned_pro, as a pick's is. The locks are taken as the pick takes them.
CREATE FUNCTION unpick_pro_channel(
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
REVOKE ALL ON FUNCTION pick_pro_channel(uuid) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION unpick_pro_channel(uuid, timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION pick_pro_channel(uuid) TO app_web;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION unpick_pro_channel(uuid, timestamptz) TO app_web;--> statement-breakpoint
-- As in 0030: the migration role gives a function away only to a role it can SET ROLE to, and only
-- when that role may create in the schema. The CREATE privilege is needed for this step alone.
GRANT app_pro_pick TO app_migrator;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO app_pro_pick;--> statement-breakpoint
ALTER FUNCTION pick_pro_channel(uuid) OWNER TO app_pro_pick;--> statement-breakpoint
ALTER FUNCTION unpick_pro_channel(uuid, timestamptz) OWNER TO app_pro_pick;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM app_pro_pick;
