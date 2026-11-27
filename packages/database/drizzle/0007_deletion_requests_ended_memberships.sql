-- The default fills the requests written before the column, then goes: every new request states its count.
ALTER TABLE "deletion_requests" ADD COLUMN "ended_memberships" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "deletion_requests" ALTER COLUMN "ended_memberships" DROP DEFAULT;