-- drizzle-kit manages roles and policies but no privileges. The default privileges cover every
-- table the migration role creates later, so a new table needs no grant of its own.
GRANT USAGE ON SCHEMA public TO app_web, app_worker;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_web, app_worker;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES FOR ROLE app_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_web, app_worker;
