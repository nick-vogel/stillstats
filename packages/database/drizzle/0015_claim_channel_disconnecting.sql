-- claim_channel as 0004 wrote it, with one more outcome: 'channel_disconnecting' for a channel with
-- no owner membership, which is waiting for its deletion after a disconnect, so a creator who
-- reconnects too soon is told to wait rather than that another user holds the channel.
-- 'channel_held_elsewhere' stays for a channel another user owns and for a lost insert race.
-- CREATE OR REPLACE keeps the function's owner, app_claim, and its grants from 0004.
CREATE OR REPLACE FUNCTION claim_channel(claimed_youtube_channel_id text)
RETURNS TABLE (outcome text, channel_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  claimant text := nullif(current_setting('app.user_id', true), '');
  claimed uuid;
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'user' OR claimant IS NULL THEN
    RAISE EXCEPTION 'claim_channel runs only in a user scope';
  END IF;

  SELECT c.id INTO claimed FROM channels c WHERE c.youtube_channel_id = claimed_youtube_channel_id;

  IF claimed IS NULL THEN
    claimed := gen_random_uuid();
    BEGIN
      INSERT INTO channels (id, youtube_channel_id) VALUES (claimed, claimed_youtube_channel_id);
    EXCEPTION WHEN unique_violation THEN
      -- Another claim of the same channel committed first.
      RETURN QUERY SELECT 'channel_held_elsewhere', NULL::uuid;
      RETURN;
    END;
    INSERT INTO memberships (user_id, channel_id, role) VALUES (claimant, claimed, 'owner');
    RETURN QUERY SELECT 'created', claimed;
  ELSIF EXISTS (
    SELECT 1 FROM memberships m
    WHERE m.channel_id = claimed AND m.user_id = claimant AND m.role = 'owner'
  ) THEN
    RETURN QUERY SELECT 'held', claimed;
  ELSIF NOT EXISTS (
    SELECT 1 FROM memberships m WHERE m.channel_id = claimed AND m.role = 'owner'
  ) THEN
    RETURN QUERY SELECT 'channel_disconnecting', NULL::uuid;
  ELSE
    RETURN QUERY SELECT 'channel_held_elsewhere', NULL::uuid;
  END IF;
END
$$;
