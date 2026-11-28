import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { openWebDatabase, openWorkerDatabase } from '../src/open.ts'
import { channels, memberships } from '../src/schema.ts'
import type { Scoped, WebDatabase, WorkerDatabase } from '../src/scopes.ts'
import { type MigrationDatabase, migrationDatabase, noJobs } from './migration-database.ts'
import { type PickAnswer, pickChannel, recordUserSubscription, unpickChannel } from './pro.ts'
import { seedUser } from './seed.ts'

// stillstats#21: pick_pro_channel and unpick_pro_channel lock the user's subscription row and
// picks first, so two tabs picking the last free slot at once leave one picked and the other
// refused. The harness's `test` runs every scope as a savepoint on one connection, one at a time,
// so it cannot show two picks at once. This file opens the web and worker databases on a pool, as
// the API and worker do, in a database of its own, so each scope is a transaction on a connection
// of its own and two can run at once. Its setup commits, and the database is dropped at the end.
//
// Limits: which of two picks that arrive together takes the lock first is Postgres's choice, so
// each test fixes the order: it holds the first pick's transaction open until the second is seen
// waiting on a lock, or has answered, and only then lets the first commit.

const now = new Date('2027-01-01T12:00:00.000Z')
const clock = () => now
const dayMs = 24 * 60 * 60 * 1000

let database: MigrationDatabase

beforeAll(async () => {
  database = await migrationDatabase('pro_picks_locks')
}, 60_000)

afterAll(async () => {
  await database?.drop()
})

interface Databases {
  pool: pg.Pool
  web: WebDatabase
  worker: WorkerDatabase
}

function withDatabases<T>(work: (databases: Databases) => Promise<T>): Promise<T> {
  return database.asApp(async (pool) => {
    const web = await openWebDatabase(pool, { jobs: noJobs, clock })
    const worker = await openWorkerDatabase(pool, { jobs: noJobs, clock })
    return work({ pool, web, worker })
  })
}

/**
 * An owner with `count` channels, connected in order, whose subscription of one block filled a
 * slot with each of the first `picked`, committed; answers the owner and the channels.
 */
async function ownerWithChannels(
  { web, worker }: Databases,
  count: number,
  picked: number,
): Promise<{ ownerId: string; ids: string[] }> {
  const ownerId = `locks-owner-${randomUUID()}`
  await seedUser(web, ownerId)
  const connect = async (n: number) => {
    const channelId = randomUUID()
    await worker.forChannel(channelId, async (scope) => {
      await scope.sql.insert(channels).values({ id: channelId, youtubeChannelId: `UC${channelId}` })
      await scope.sql.insert(memberships).values({
        channelId,
        userId: ownerId,
        role: 'owner',
        createdAt: new Date(now.getTime() - (count - n) * 60 * 1000),
      })
    })
    return channelId
  }
  const ids: string[] = []
  for (let n = 1; n <= picked; n++) ids.push(await connect(n))
  await web.asAnonymous((scope) =>
    recordUserSubscription(scope, {
      userId: ownerId,
      customer: `cus_${ownerId}`,
      subscription: `sub_${ownerId}`,
      plan: 'monthly',
      status: 'active',
      periodEnd: null,
      quantity: 1,
      eventCreated: now,
    }),
  )
  for (let n = picked + 1; n <= count; n++) ids.push(await connect(n))
  return { ownerId, ids }
}

function proStatesOf({ web }: Databases, ownerId: string, ids: string[]) {
  return web.asUser(ownerId, async (scope) => {
    const states: boolean[] = []
    for (const id of ids) {
      const { rows } = await scope.sql.execute<{ pro: boolean }>(
        sql`select pro_state(${id}::uuid) as pro`,
      )
      states.push(rows[0]?.pro === true)
    }
    return states
  })
}

/** Whether a session of this database waits on a lock in a pick or an unpick, until `settled`. */
async function seenWaiting(pool: pg.Pool, settled: () => boolean): Promise<boolean> {
  const deadline = Date.now() + 5_000
  while (!settled() && Date.now() < deadline) {
    const { rows } = await pool.query(
      `select 1 from pg_stat_activity
        where datname = current_database() and pid <> pg_backend_pid()
          and wait_event_type = 'Lock' and query like '%pro_channel(%'`,
    )
    if (rows.length > 0) return true
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return false
}

type Change = (scope: Scoped<'user'>) => Promise<PickAnswer>

/**
 * Runs `first` in the owner's user scope and holds its transaction open while `second` runs in
 * another, until `second` is seen waiting on a lock or has answered; answers both, and whether
 * `second` waited.
 */
async function whileTheFirstHolds(
  { pool, web }: Databases,
  ownerId: string,
  first: Change,
  second: Change,
) {
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let answered = () => {}
  const firstAnswered = new Promise<void>((resolve) => {
    answered = resolve
  })
  const firstScope = web.asUser(ownerId, async (scope) => {
    const answer = await first(scope)
    answered()
    await released
    return answer
  })
  await Promise.race([firstAnswered, firstScope])
  let settled = false
  const secondScope = web.asUser(ownerId, second).finally(() => {
    settled = true
  })
  const waited = await seenWaiting(pool, () => settled)
  release()
  const [firstAnswer, secondAnswer] = await Promise.all([firstScope, secondScope])
  return { first: firstAnswer, second: secondAnswer, waited }
}

describe('the locks of pick_pro_channel and unpick_pro_channel, on connections of their own (stillstats#21)', () => {
  test('two picks of the last free slot at once: the second waits for the first, counts its pick and is refused', async () => {
    await withDatabases(async (databases) => {
      const { ownerId, ids } = await ownerWithChannels(databases, 5, 3)
      const [, , , fourth = '', fifth = ''] = ids

      const answers = await whileTheFirstHolds(
        databases,
        ownerId,
        (scope) => pickChannel(scope, fourth),
        (scope) => pickChannel(scope, fifth),
      )

      expect(answers).toEqual({
        first: { outcome: 'picked', turnedPro: [fourth] },
        second: { outcome: 'no_free_slot', turnedPro: [] },
        waited: true,
      })
      expect(await proStatesOf(databases, ownerId, ids)).toEqual([true, true, true, true, false])
    })
  })

  test('an unpick waits for a pick in flight, in the same lock order', async () => {
    await withDatabases(async (databases) => {
      const { ownerId, ids } = await ownerWithChannels(databases, 4, 3)
      const [first = '', , , fourth = ''] = ids

      const answers = await whileTheFirstHolds(
        databases,
        ownerId,
        (scope) => pickChannel(scope, fourth),
        (scope) => unpickChannel(scope, first, new Date(now.getTime() + 30 * dayMs)),
      )

      expect(answers).toEqual({
        first: { outcome: 'picked', turnedPro: [fourth] },
        second: { outcome: 'unpicked', turnedPro: [] },
        waited: true,
      })
      expect(await proStatesOf(databases, ownerId, ids)).toEqual([false, true, true, true])
    })
  })
})
