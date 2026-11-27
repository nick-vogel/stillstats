-- No foreign key: a consent state belongs to its user and lives ten minutes, so the table stays out of the channel-owned set.
ALTER TABLE "consent_states" ADD COLUMN "channel_id" uuid;--> statement-breakpoint
ALTER TABLE "consent_states" ADD CONSTRAINT "consent_states_revenue_names_channel" CHECK (("consent_states"."purpose" = 'revenue') = ("consent_states"."channel_id" is not null));