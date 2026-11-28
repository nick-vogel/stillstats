import { AsyncLocalStorage } from 'node:async_hooks'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import type { JobWithMetadata, PgBoss } from 'pg-boss'
import { test as base, inject } from 'vitest'
import {
  type JobName,
  type JobQueue,
  jobQueue,
  startJobRunner,
  transactionDb,
} from '../src/jobs.ts'
import { assertSafeLoginRole } from '../src/open.ts'
import {
  type DrizzleTransaction,
  type WebDatabase,
  type WorkerDatabase,
  webDatabase,
  workerDatabase,
} from '../src/scopes.ts'
// Loads the Vitest ProvidedContext augmentation that types inject('databaseUrls').
import type {} from './database-urls.ts'

export { channelRowCounts } from './channel-rows.ts'
export { readFeedbackMessages } from './feedback-rows.ts'
export { fixtureNotes } from './fixtures.ts'
export {
  endGrant,
  type GrantAnswer,
  grantBlocks,
  ownerOf,
  type PickAnswer,
  pickChannel,
  type RecordedEvent,
  recordUserSubscription,
  subscribeOwner,
  unpickChannel,
} from './pro.ts'
export { seedChannel, seedUser } from './seed.ts'

export const databaseUrls = () => inject('databaseUrls')

/** The jobs of one queue, as the test's transaction sees them, oldest first. */
export type FindJobs = (name: JobName) => Promise<JobWithMetadata<Record<string, string>>[]>

/** The clock every scope of a test reads: system time until the test sets it. */
export interface TestClock {
  now(): Date
  set(time: Date): void
  advance(ms: number): void
}

function testClock(): TestClock {
  let pinned: Date | undefined
  const now = () => pinned ?? new Date()
  return {
    now,
    set(time) {
      pinned = time
    },
    advance(ms) {
      pinned = new Date(now().getTime() + ms)
    },
  }
}

// The drizzle adapter hands pg-boss timestamps as text, so the times are read back as dates.
const jobTimes = ['createdOn', 'startAfter', 'startedOn', 'completedOn', 'keepUntil'] as const

/** Runs scope openings one at a time; a scope opened inside a running one runs at once. */
type TakeTurn = <T>(openScope: () => Promise<T>) => Promise<T>

/**
 * A test runs every scope as a savepoint on its one connection, and a scope's SET LOCAL settings
 * belong to the whole transaction. Two scopes open at once would read each other's role and user,
 * collide on one savepoint name, and abort the transaction for both (Postgres 25P02), so a test's
 * scopes, `web` and `worker` alike, take turns. A scope opened inside a running scope cannot wait
 * for it, so it runs at once, as a savepoint inside its parent.
 */
function oneAtATime(): TakeTurn {
  const currentScope = new AsyncLocalStorage<{ running: boolean }>()
  let previous: Promise<unknown> = Promise.resolve()
  return (openScope) => {
    if (currentScope.getStore()?.running) return openScope()
    const turn = previous.then(() => {
      const scope = { running: true }
      return currentScope.run(scope, openScope).finally(() => {
        // Work the scope started and did not await still carries this store once the scope
        // settles. A scope that work opens then must queue, since running at once would collide
        // with whichever scope holds the next turn.
        scope.running = false
      })
    })
    previous = turn.catch(() => undefined)
    return turn
  }
}

const turnQueues = new WeakMap<DrizzleTransaction, TakeTurn>()

/** The one turn-taking queue of a test's transaction, shared by its `web` and `worker`. */
function turnQueueOf(transaction: DrizzleTransaction): TakeTurn {
  let takeTurn = turnQueues.get(transaction)
  if (!takeTurn) {
    takeTurn = oneAtATime()
    turnQueues.set(transaction, takeTurn)
  }
  return takeTurn
}

/**
 * A test built on this `test` runs as the non-owner login role inside one transaction that rolls
 * back. Scopes opened on `web` or `worker` become savepoints inside it, one at a time even under
 * `Promise.all`, and so does every job they enqueue.
 *
 * Limits: production gives each scope its own pooled connection, so these tests cannot show two
 * requests or scopes running in parallel. A scope's work must not await a request to an API the
 * test started: the request's scopes queue behind the scope awaiting them, and the test hangs until
 * it times out. An API started inside a scope's work would let its requests skip the queue while
 * that scope runs, since they inherit the scope's place through AsyncLocalStorage. Each test gets a
 * connection of its own that ends with the test, so a scope opened on a test's `web` or `worker`
 * after that test ends, such as by a test body still running past its timeout, is refused.
 */
export const test = base.extend<{
  $file: { pool: pg.Pool; boss: PgBoss }
  $test: {
    transaction: DrizzleTransaction
    clock: TestClock
    jobs: JobQueue
    findJobs: FindJobs
    web: WebDatabase
    worker: WorkerDatabase
  }
}>({
  pool: [
    // biome-ignore lint/correctness/noEmptyPattern: Vitest reads a fixture's dependencies from this pattern.
    async ({}, use) => {
      const pool = new pg.Pool({ connectionString: databaseUrls().app })
      await assertSafeLoginRole(pool)
      await use(pool)
      await pool.end()
    },
    { scope: 'file' },
  ],
  boss: [
    async ({ pool }, use) => {
      const boss = await startJobRunner(pool)
      await use(boss)
      await boss.stop({ graceful: false })
    },
    { scope: 'file' },
  ],
  // Vitest cannot cancel a test body that times out, so its scopes keep running into the next test.
  // Given back to the pool, the test's connection would usually carry the next test's transaction,
  // and the leftover scopes' savepoints would collide with that test's own and abort it (Postgres
  // 3B001, then 25P02; creator-analytics#299). So each test runs on a connection of its own, and
  // teardown ends that connection: Postgres rolls back the open transaction, and every later query
  // on it fails. The connection ends before any ROLLBACK is sent, because a statement a leftover
  // scope queued behind the ROLLBACK would run in autocommit and could commit. Drizzle's own
  // ROLLBACK then fails on the ended connection, and that failure is expected.
  transaction: async ({ pool }, use) => {
    const client = await pool.connect()
    let ended = false
    const end = () => {
      ended = true
      client.release(true)
    }
    try {
      await drizzle({ client }).transaction(async (tx) => {
        await use(tx)
        end()
        tx.rollback()
      })
    } catch (error) {
      if (!ended) throw error
    } finally {
      if (!ended) end()
    }
  },
  jobs: async ({ boss }, use) => use(jobQueue(boss)),
  findJobs: async ({ boss, transaction }, use) =>
    use(async (name) => {
      const jobs = await boss.findJobs<Record<string, string>>(name, {
        db: transactionDb(transaction),
      })
      for (const job of jobs) {
        for (const time of jobTimes) {
          const value: unknown = job[time]
          if (typeof value === 'string') Object.assign(job, { [time]: new Date(value) })
        }
      }
      return jobs.sort((a, b) => a.createdOn.getTime() - b.createdOn.getTime())
    }),
  // biome-ignore lint/correctness/noEmptyPattern: Vitest reads a fixture's dependencies from this pattern.
  clock: async ({}, use) => use(testClock()),
  web: async ({ transaction, jobs, clock }, use) => {
    const web = webDatabase(transaction, { jobs, clock: clock.now })
    const takeTurn = turnQueueOf(transaction)
    await use({
      asUser: (userId, work) => takeTurn(() => web.asUser(userId, work)),
      asAnonymous: (work) => takeTurn(() => web.asAnonymous(work)),
      asAdmin: (userId, work) => takeTurn(() => web.asAdmin(userId, work)),
    })
  },
  worker: async ({ transaction, jobs, clock }, use) => {
    const worker = workerDatabase(transaction, { jobs, clock: clock.now })
    const takeTurn = turnQueueOf(transaction)
    await use({
      forChannel: (channelId, work) => takeTurn(() => worker.forChannel(channelId, work)),
      asSystem: (work) => takeTurn(() => worker.asSystem(work)),
    })
  },
})
