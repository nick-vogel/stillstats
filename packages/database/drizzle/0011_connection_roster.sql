CREATE ROLE "app_roster";--> statement-breakpoint
CREATE POLICY "connection_identifiers_roster" ON "connection_identifiers" AS PERMISSIVE FOR SELECT TO "app_roster" USING ((nullif(current_setting('app.scope', true), '') = 'system'));--> statement-breakpoint
CREATE POLICY "connections_roster" ON "connections" AS PERMISSIVE FOR SELECT TO "app_roster" USING ((nullif(current_setting('app.scope', true), '') = 'system'));--> statement-breakpoint
-- The one read of the connection roster: each active connection's channel id, the HMAC of its
-- Google subject and its connection time. It runs as app_roster, which holds SELECT on those
-- columns only, so the system scope reads no token and app_worker keeps no policy on connections.
CREATE FUNCTION connection_roster()
RETURNS TABLE (channel_id uuid, subject_hmac text, connected_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'system' THEN
    RAISE EXCEPTION 'connection_roster runs only in the system scope';
  END IF;

  RETURN QUERY
    SELECT c.channel_id, i.hmac, c.connected_at
    FROM connections c
    LEFT JOIN connection_identifiers i ON i.channel_id = c.channel_id AND i.kind = 'subject'
    WHERE c.status = 'active'
    ORDER BY c.channel_id;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION connection_roster() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION connection_roster() TO app_worker;--> statement-breakpoint
GRANT SELECT (channel_id, status, connected_at) ON connections TO app_roster;--> statement-breakpoint
GRANT SELECT (channel_id, kind, hmac) ON connection_identifiers TO app_roster;--> statement-breakpoint
-- As in 0004: the migration role gives the function away only to a role it can SET ROLE to, and
-- only when that role may create in the schema. The CREATE privilege is needed for this step alone.
GRANT app_roster TO app_migrator;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO app_roster;--> statement-breakpoint
ALTER FUNCTION connection_roster() OWNER TO app_roster;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM app_roster;
