import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate as runMigrations } from 'drizzle-orm/node-postgres/migrator'
import type { Pool } from 'pg'
import { installJobs } from './jobs.ts'

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))

// drizzle-kit emits ENABLE ROW LEVEL SECURITY but never FORCE, and without FORCE the owning
// migration role skips the policies.
export async function forceRowLevelSecurity(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ name: string }>(`
    select format('%I.%I', n.nspname, c.relname) as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and c.relrowsecurity and not c.relforcerowsecurity`)
  for (const { name } of rows) {
    await pool.query(`alter table ${name} force row level security`)
  }
}

/** Runs as the migration role, as a release step before the new API starts. */
export async function migrate(pool: Pool): Promise<void> {
  await runMigrations(drizzle({ client: pool }), { migrationsFolder })
  await forceRowLevelSecurity(pool)
  await installJobs(pool)
}
