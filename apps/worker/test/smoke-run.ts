// The smoke run of the worker image, which the test suite cannot cover: pg-boss in a running worker
// fetches a committed job, as a real non-owner login role. CI starts the image against a migrated
// database, then runs this with DATABASE_URL set to a login role that is a member of app_worker:
//   node apps/worker/test/smoke-run.ts
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import {
  channels,
  deletionRequests,
  jobQueue,
  openWorkerDatabase,
  startJobRunner,
  type WorkerDatabase,
} from '@creator-analytics/database'
import { requestDeletion } from '@creator-analytics/retention-engine'
import pg from 'pg'

const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 60_000)

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

// What app_worker sees in the channel's scope. The scope's policies already limit both tables to
// the channel, so no WHERE clause is needed for the channel row.
function observe(worker: WorkerDatabase, channelId: string, requestId: string) {
  return worker.forChannel(channelId, async (tx) => {
    const channelRows = await tx.sql.select({ id: channels.id }).from(channels)
    const requests = await tx.sql
      .select({ id: deletionRequests.id, completedAt: deletionRequests.completedAt })
      .from(deletionRequests)
    const openRequests = requests.filter((r) => r.id === requestId && r.completedAt === null)
    return { channels: channelRows.length, openRequests: openRequests.length }
  })
}

const pool = new pg.Pool({ connectionString: url })
const boss = await startJobRunner(pool)
try {
  const worker = await openWorkerDatabase(pool, { jobs: jobQueue(boss) })
  const channelId = randomUUID()
  const { requestId } = await worker.forChannel(channelId, async (tx) => {
    await tx.sql.insert(channels).values({ id: channelId, youtubeChannelId: `UC${channelId}` })
    return requestDeletion(tx, channelId, 'user_deletion')
  })
  console.log(`Committed deletion request ${requestId} of channel ${channelId}`)

  // Otherwise a SELECT policy that hid the rows would pass the wait below with no worker at all.
  const before = await observe(worker, channelId, requestId)
  if (before.channels !== 1 || before.openRequests !== 1) {
    throw new Error(
      `app_worker sees ${before.channels} channel rows and ${before.openRequests} open requests ` +
        'after the commit, not 1 and 1, so the wait would prove nothing',
    )
  }
  console.log('app_worker sees the channel and its open request; waiting for the worker')

  // app_worker cannot read a completed request: completing it clears its channel id, which no
  // SELECT policy admits. The CHECK constraint clears the id only with completedAt set, so the
  // open request leaving the scope is deleteChannel completing it, as far as this role can see.
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const now = await observe(worker, channelId, requestId)
    if (now.channels === 0 && now.openRequests === 0) break
    if (Date.now() > deadline) {
      throw new Error(
        `The worker did not complete the deleteChannel job within ${timeoutMs} ms ` +
          `(${now.channels} channel rows, ${now.openRequests} open requests left)`,
      )
    }
    await sleep(1_000)
  }
  console.log(
    'The worker fetched the committed deleteChannel job, deleted the channel and completed the request',
  )
} finally {
  await boss.stop({ graceful: false })
  await pool.end()
}
