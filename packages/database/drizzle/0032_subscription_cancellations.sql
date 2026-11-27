CREATE TABLE "subscription_cancellations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"deletion_request_id" uuid NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "subscription_cancellations_deletion_request_id_unique" UNIQUE("deletion_request_id")
);
--> statement-breakpoint
ALTER TABLE "subscription_cancellations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "subscription_cancellations_worker" ON "subscription_cancellations" AS PERMISSIVE FOR ALL TO "app_worker" USING ((nullif(current_setting('app.scope', true), '') = 'channel' and "subscription_cancellations"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid)) WITH CHECK ((nullif(current_setting('app.scope', true), '') = 'channel' and "subscription_cancellations"."channel_id" = nullif(current_setting('app.channel_id', true), '')::uuid));