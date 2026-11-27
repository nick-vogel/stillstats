-- The one write path to channels and memberships. It runs as app_claim, whose policies admit every
-- row in a user scope, so it can see a channel another user holds; app_web cannot.
-- Outcomes: 'created' and 'held' carry the channel id; 'channel_held_elsewhere' carries none.
-- A channel with no owner membership is waiting for its deletion, and it is held elsewhere too.
-- The database cannot check that the caller holds a Google grant for the channel: the API calls
-- this only with a grant the YouTube gateway identified. What it does prove is that no claim
-- gives a user a channel another user holds.
CREATE FUNCTION claim_channel(claimed_youtube_channel_id text)
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
  ELSE
    RETURN QUERY SELECT 'channel_held_elsewhere', NULL::uuid;
  END IF;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION claim_channel(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION claim_channel(text) TO app_web;--> statement-breakpoint
GRANT SELECT, INSERT ON channels, memberships TO app_claim;--> statement-breakpoint
-- Postgres lets the migration role give the function away only to a role it can SET ROLE to, and
-- only when that role may create in the schema. The CREATE privilege is needed for this step alone.
GRANT app_claim TO app_migrator;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO app_claim;--> statement-breakpoint
ALTER FUNCTION claim_channel(text) OWNER TO app_claim;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM app_claim;
