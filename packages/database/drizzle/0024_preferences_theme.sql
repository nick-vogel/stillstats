ALTER TABLE "preferences" ADD COLUMN "theme" text;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_theme" CHECK ("preferences"."theme" in ('light', 'dark', 'system'));