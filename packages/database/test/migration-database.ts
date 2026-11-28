import { randomUUID } from 'node:crypto'
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate as runMigrations } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import { installJobs, type JobQueue } from '../src/jobs.ts'
import { forceRowLevelSecurity } from '../src/migrate.ts'
import { databaseUrls } from './harness.ts'

// Staging and production run a migration on a database that the release before left with
// row-level security forced on every table, which the shared test database never is mid-migration.
// A database of its own in the same server builds that state, so a test migrates it on and reads
// the product's answer.

/** A job queue for a test whose reads send no job. */
export const noJobs: JobQueue = {
  send: () => Promise.reject(new Error('No job queue in this test')),
  count: () => Promise.reject(new Error('No job queue in this test')),
}

/**
 * The migrations folder up to `lastTag`, as the release that ended with it shipped it, or the
 * whole folder without one. The roles are the server's, which the shared test database's migration
 * already created, so each CREATE ROLE here creates only a role the server lacks.
 */
function migrationsThrough(lastTag?: string): string {
  const source = join(import.meta.dirname, '../drizzle')
  const folder = mkdtempSync(join(tmpdir(), 'migration-database-'))
  cpSync(source, folder, { recursive: true })
  const journalPath = join(folder, 'meta/_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] }
  const end =
    lastTag === undefined
      ? journal.entries.length - 1
      : journal.entries.findIndex(({ tag }) => tag === lastTag)
  if (end < 0) throw new Error(`No ${lastTag} in the journal`)
  writeFileSync(
    journalPath,
    JSON.stringify({ ...journal, entries: journal.entries.slice(0, end + 1) }),
  )
  for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql'))) {
    const path = join(folder, file)
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        /CREATE ROLE "(\w+)";/g,
        (_, role: string) =>
          `DO $$ BEGIN CREATE ROLE "${role}"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
      ),
    )
  }
  return folder
}

/** A database of its own, migrated through one release, with row-level security forced. */
export interface MigrationDatabase {
  /** Runs `work` on a pool as the server's admin, past every policy: setup only. */
  asAdmin<T>(work: (pool: pg.Pool) => Promise<T>): Promise<T>
  /** Runs `work` on a pool as the test's login role, which the product's scopes open on. */
  asApp<T>(work: (pool: pg.Pool) => Promise<T>): Promise<T>
  /**
   * The release step, as the migrate step runs it: every migration after `lastTag`, then the
   * forced row-level security and the job queues, as the migration role.
   */
  migrateOn(): Promise<void>
  drop(): Promise<void>
}

export async function migrationDatabase(name: string, lastTag: string): Promise<MigrationDatabase> {
  const database = `${name}_${randomUUID().replaceAll('-', '')}`
  const urls = databaseUrls()
  const urlFor = (url: string, role?: string) => {
    const next = new URL(url)
    next.pathname = `/${database}`
    if (role) {
      next.username = role
      next.password = role
    }
    return next.toString()
  }
  const withPool = async <T>(url: string, work: (pool: pg.Pool) => Promise<T>) => {
    const pool = new pg.Pool({ connectionString: url })
    try {
      return await work(pool)
    } finally {
      await pool.end()
    }
  }

  const folder = migrationsThrough(lastTag)
  const wholeFolder = migrationsThrough()
  await withPool(urls.admin, (admin) =>
    admin.query(`create database ${database} owner app_migrator`),
  )
  await withPool(urlFor(urls.admin, 'app_migrator'), async (migrator) => {
    await runMigrations(drizzle({ client: migrator }), { migrationsFolder: folder })
    await forceRowLevelSecurity(migrator)
  })

  return {
    asAdmin: (work) => withPool(urlFor(urls.admin), work),
    asApp: (work) => withPool(urlFor(urls.app), work),
    migrateOn: () =>
      withPool(urlFor(urls.admin, 'app_migrator'), async (migrator) => {
        await runMigrations(drizzle({ client: migrator }), { migrationsFolder: wholeFolder })
        await forceRowLevelSecurity(migrator)
        await installJobs(migrator)
      }),
    async drop() {
      await withPool(urls.admin, (admin) =>
        admin.query(`drop database if exists ${database} with (force)`),
      )
      rmSync(folder, { recursive: true, force: true })
      rmSync(wholeFolder, { recursive: true, force: true })
    },
  }
}
