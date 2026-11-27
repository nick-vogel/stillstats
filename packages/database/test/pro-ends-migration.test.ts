import { randomUUID } from 'node:crypto'
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate as runMigrations } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
// The product's read of a channel's purge date. The entitlements package depends on this one, so
// the test reaches it by path, as the web app's tests reach the API's.
import { entitlementOf } from '../../entitlements/src/entitlements.ts'
import type { JobQueue } from '../src/jobs.ts'
import { forceRowLevelSecurity, migrate } from '../src/migrate.ts'
import { openWorkerDatabase } from '../src/open.ts'
import { databaseUrls } from './harness.ts'

// stillstats#19: migration 0040 moves each subscription's purge date onto its channel's pro_ends
// row. Staging and production run it on a database that 0039 left with row-level security forced
// on every table, which the shared test database never is mid-migration, so this test builds that
// state in a database of its own in the same server, migrates it on, and reads the product's answer.

const lastBefore = '0039_subscription_turned_paid'
const clock = () => new Date('2027-01-01T12:00:00.000Z')
const purgeAfter = new Date('2027-01-16T12:00:00.000Z')

// Reading an Entitlement sends no job.
const jobs: JobQueue = {
  send: () => Promise.reject(new Error('No job queue in this test')),
  count: () => Promise.reject(new Error('No job queue in this test')),
}

const database = `pro_ends_migration_${randomUUID().replaceAll('-', '')}`

function urlFor(url: string, role?: string): string {
  const next = new URL(url)
  next.pathname = `/${database}`
  if (role) {
    next.username = role
    next.password = role
  }
  return next.toString()
}

/**
 * The migrations folder up to `lastBefore`, as the release before 0040 shipped it. The roles are
 * the server's, which the shared test database's migration already created, so each CREATE ROLE
 * here creates only a role the server lacks.
 */
function migrationsBefore0040(): string {
  const source = join(import.meta.dirname, '../drizzle')
  const folder = mkdtempSync(join(tmpdir(), 'pro-ends-migration-'))
  cpSync(source, folder, { recursive: true })
  const journalPath = join(folder, 'meta/_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { tag: string }[] }
  const end = journal.entries.findIndex(({ tag }) => tag === lastBefore)
  if (end < 0) throw new Error(`No ${lastBefore} in the journal`)
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

const channels = { ended: randomUUID(), active: randomUUID(), purged: randomUUID() }

describe('migration 0040 under forced row-level security, as staging and production run it', () => {
  let admin: pg.Pool
  let folder: string

  beforeAll(async () => {
    const urls = databaseUrls()
    admin = new pg.Pool({ connectionString: urls.admin })
    await admin.query(`create database ${database} owner app_migrator`)
    folder = migrationsBefore0040()

    const migrator = new pg.Pool({ connectionString: urlFor(urls.admin, 'app_migrator') })
    try {
      await runMigrations(drizzle({ client: migrator }), { migrationsFolder: folder })
      await forceRowLevelSecurity(migrator)
    } finally {
      await migrator.end()
    }

    // Setup only: the rows 0039's release left, written past the policies.
    const setup = new pg.Pool({ connectionString: urlFor(urls.admin) })
    try {
      for (const id of Object.values(channels)) {
        await setup.query('insert into channels (id, youtube_channel_id) values ($1, $2)', [
          id,
          `UC${id}`,
        ])
      }
      const subscription = `insert into subscriptions (channel_id, stripe_customer_id,
        stripe_subscription_id, status, purge_after, updated_at) values ($1, $2, $3, $4, $5, $6)`
      const at = new Date('2026-12-17T12:00:00.000Z')
      await setup.query(subscription, [
        channels.ended,
        'cus_test_a',
        'sub_test_a',
        'canceled',
        purgeAfter,
        at,
      ])
      await setup.query(subscription, [
        channels.active,
        'cus_test_b',
        'sub_test_b',
        'active',
        null,
        at,
      ])
      await setup.query(subscription, [
        channels.purged,
        'cus_test_c',
        'sub_test_c',
        'canceled',
        null,
        at,
      ])
    } finally {
      await setup.end()
    }
  })

  afterAll(async () => {
    await admin?.query(`drop database if exists ${database} with (force)`)
    await admin?.end()
    if (folder) rmSync(folder, { recursive: true, force: true })
  })

  test("moves each subscription's purge date onto its channel, so the channel keeps it without the subscription's", async () => {
    const urls = databaseUrls()
    const migrator = new pg.Pool({ connectionString: urlFor(urls.admin, 'app_migrator') })
    try {
      await migrate(migrator)
    } finally {
      await migrator.end()
    }
    // What the remove release does to the subscription's copy.
    const setup = new pg.Pool({ connectionString: urlFor(urls.admin) })
    try {
      await setup.query('update subscriptions set purge_after = null')
    } finally {
      await setup.end()
    }

    const app = new pg.Pool({ connectionString: urlFor(urls.app) })
    try {
      const worker = await openWorkerDatabase(app, { jobs, clock })
      const entitlement = (channelId: string) =>
        worker.forChannel(channelId, (scope) => entitlementOf(scope, channelId))

      expect(await entitlement(channels.ended)).toEqual({ tier: 'free', purgeDate: purgeAfter })
      expect(await entitlement(channels.active)).toEqual({ tier: 'paid', purgeDate: null })
      expect(await entitlement(channels.purged)).toEqual({ tier: 'free', purgeDate: null })
    } finally {
      await app.end()
    }
  }, 60_000)
})
