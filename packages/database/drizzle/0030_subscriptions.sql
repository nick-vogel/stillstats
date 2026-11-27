CREATE ROLE "app_billing";--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"plan" text,
	"status" text NOT NULL,
	"current_period_end" timestamp with time zone,
	"purge_after" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "subscriptions_pkey" PRIMARY KEY("channel_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id"),
	CONSTRAINT "subscriptions_plan" CHECK ("subscriptions"."plan" in ('monthly', 'annual'))
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "subscriptions_web" ON "subscriptions" AS PERMISSIVE FOR ALL TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "subscriptions"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), '')))) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'user' and "subscriptions"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "subscriptions_worker" ON "subscriptions" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "subscriptions"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "subscriptions"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "subscriptions_billing" ON "subscriptions" AS PERMISSIVE FOR ALL TO "app_billing" USING ((nullif(current_setting('app.scope', true), '') = 'anonymous')) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'anonymous'));--> statement-breakpoint
-- The one write path of Stripe's webhook to subscriptions. It runs as app_billing, whose one policy
-- admits every row in the anonymous scope and which holds SELECT, INSERT and UPDATE on this table
-- only, so the anonymous scope as app_web still reads and writes no subscription row. Stripe orders
-- none of its events, so a null argument keeps the stored value and each event fills what it
-- carries. A new row with no status yet is 'incomplete', Stripe's status of a subscription whose
-- first payment has not succeeded. Outcomes: 'recorded' for a written row, 'unchanged' for a
-- repeated event, 'no_channel' for a channel that does not exist, such as one deleted while its
-- owner was on Stripe's page; the channel's foreign key says so, so the role reads no channel.
CREATE FUNCTION record_subscription(
  subscribed_channel_id uuid,
  customer text,
  subscription text,
  chosen_plan text,
  subscription_status text,
  period_end timestamptz
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  written integer;
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'anonymous' THEN
    RAISE EXCEPTION 'record_subscription runs only in the anonymous scope';
  END IF;

  BEGIN
    INSERT INTO subscriptions AS s (
      channel_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end,
      updated_at
    )
    VALUES (
      subscribed_channel_id, customer, subscription, chosen_plan,
      coalesce(subscription_status, 'incomplete'), period_end,
      nullif(current_setting('app.now', true), '')::timestamptz
    )
    ON CONFLICT (channel_id) DO UPDATE SET
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      plan = coalesce(chosen_plan, s.plan),
      status = coalesce(subscription_status, s.status),
      current_period_end = coalesce(period_end, s.current_period_end),
      updated_at = excluded.updated_at
    WHERE (s.stripe_customer_id, s.stripe_subscription_id, s.plan, s.status, s.current_period_end)
      IS DISTINCT FROM (
        excluded.stripe_customer_id, excluded.stripe_subscription_id,
        coalesce(chosen_plan, s.plan), coalesce(subscription_status, s.status),
        coalesce(period_end, s.current_period_end)
      );
    GET DIAGNOSTICS written = ROW_COUNT;
  EXCEPTION WHEN foreign_key_violation THEN
    RETURN 'no_channel';
  END;

  RETURN CASE WHEN written = 0 THEN 'unchanged' ELSE 'recorded' END;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION record_subscription(uuid, text, text, text, text, timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION record_subscription(uuid, text, text, text, text, timestamptz) TO app_web;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON subscriptions TO app_billing;--> statement-breakpoint
-- As in 0004: the migration role gives the function away only to a role it can SET ROLE to, and
-- only when that role may create in the schema. The CREATE privilege is needed for this step alone.
GRANT app_billing TO app_migrator;--> statement-breakpoint
GRANT CREATE ON SCHEMA public TO app_billing;--> statement-breakpoint
ALTER FUNCTION record_subscription(uuid, text, text, text, text, timestamptz) OWNER TO app_billing;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM app_billing;
