import { sql } from 'drizzle-orm'
import pg from 'pg'
import { describe, expect, test } from 'vitest'
import type { JobQueue } from '../src/jobs.ts'
import { openWebDatabase, openWorkerDatabase } from '../src/open.ts'
import type { DrizzleTransaction } from '../src/scopes.ts'
import { databaseUrls } from './harness.ts'

async function readCurrentUser(scope: { sql: DrizzleTransaction }): Promise<string | undefined> {
  const { rows } = await scope.sql.execute<{ current_user: string }>(sql`select current_user`)
  return rows[0]?.current_user
}

// Opening sends no job, so these tests need no pg-boss.
const jobs: JobQueue = {
  send: () => Promise.reject(new Error('No job queue in these tests')),
  count: () => Promise.reject(new Error('No job queue in these tests')),
}

const openers = [
  {
    name: 'openWebDatabase',
    role: 'app_web',
    currentUser: async (pool: pg.Pool) =>
      (await openWebDatabase(pool, { jobs })).asAnonymous(readCurrentUser),
  },
  {
    name: 'openWorkerDatabase',
    role: 'app_worker',
    currentUser: async (pool: pg.Pool) =>
      (await openWorkerDatabase(pool, { jobs })).asSystem(readCurrentUser),
  },
]

describe.each(openers)('$name', ({ role, currentUser }) => {
  async function currentUserAs(url: string): Promise<string | undefined> {
    const pool = new pg.Pool({ connectionString: url })
    try {
      return await currentUser(pool)
    } finally {
      await pool.end()
    }
  }

  test(`opens for a non-owner login role and runs its scopes as ${role}`, async () => {
    expect(await currentUserAs(databaseUrls().app)).toBe(role)
  })

  test('refuses a superuser login role', async () => {
    await expect(currentUserAs(databaseUrls().admin)).rejects.toMatchObject({ reason: 'superuser' })
  })

  test('refuses a login role with BYPASSRLS', async () => {
    await expect(currentUserAs(databaseUrls().bypass)).rejects.toMatchObject({
      reason: 'bypassrls',
    })
  })

  test('refuses a login role that owns a table', async () => {
    await expect(currentUserAs(databaseUrls().migrator)).rejects.toMatchObject({
      reason: 'table_owner',
    })
  })
})
