CREATE TABLE "subscription_payments" (
	"stripe_invoice_id" text PRIMARY KEY NOT NULL,
	"channel_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_payments_channel_id_idx" ON "subscription_payments" USING btree ("channel_id");--> statement-breakpoint
CREATE POLICY "subscription_payments_web" ON "subscription_payments" AS PERMISSIVE FOR SELECT TO "app_web" USING ((nullif(current_setting('app.scope', true), '') = 'user' and "subscription_payments"."channel_id" in (select m.channel_id from memberships m where m.user_id = nullif(current_setting('app.user_id', true), ''))));--> statement-breakpoint
CREATE POLICY "subscription_payments_worker_channel_select" ON "subscription_payments" AS PERMISSIVE FOR SELECT TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "subscription_payments"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "subscription_payments_billing" ON "subscription_payments" AS PERMISSIVE FOR ALL TO "app_billing" USING ((nullif(current_setting('app.scope', true), '') = 'anonymous')) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'anonymous'));--> statement-breakpoint
-- The one write path to subscription_payments: Stripe's webhook records each paid invoice of a
-- channel's subscription once, so a repeated delivery of invoice.paid sends OpenPanel no second
-- revenue event. It runs as app_billing, whose one policy here admits every row in the anonymous
-- scope and which holds SELECT and INSERT on this table, so the anonymous scope as app_web still
-- reads and writes no payment row. It answers true for a new row and false for an invoice already
-- recorded, by this delivery's twin too, since the insert waits on its uncommitted row. A channel
-- that does not exist writes no row and answers false; the channel's foreign key says so, so the
-- role reads no channel.
CREATE FUNCTION record_subscription_payment(invoice text, paid_channel_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  written integer;
BEGIN
  IF nullif(current_setting('app.scope', true), '') IS DISTINCT FROM 'anonymous' THEN
    RAISE EXCEPTION 'record_subscription_payment runs only in the anonymous scope';
  END IF;

  BEGIN
    INSERT INTO subscription_payments (stripe_invoice_id, channel_id)
    VALUES (invoice, paid_channel_id)
    ON CONFLICT (stripe_invoice_id) DO NOTHING;
    GET DIAGNOSTICS written = ROW_COUNT;
  EXCEPTION WHEN foreign_key_violation THEN
    RETURN false;
  END;

  RETURN written = 1;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION record_subscription_payment(text, uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION record_subscription_payment(text, uuid) TO app_web;--> statement-breakpoint
GRANT SELECT, INSERT ON subscription_payments TO app_billing;--> statement-breakpoint
-- As in 0030: the migration role gives the function away only to a role it can SET ROLE to, and
-- only when that role may create in the schema. The CREATE privilege is needed for this step alone.
GRANT CREATE ON SCHEMA public TO app_billing;--> statement-breakpoint
ALTER FUNCTION record_subscription_payment(text, uuid) OWNER TO app_billing;--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM app_billing;
