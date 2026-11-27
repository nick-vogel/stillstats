// Repro: the retentionCurveRefresh job runs every Analytics read of its run inside the one
// transaction worker.forChannel opens, and each read's `spend` upserts the quota_usage row
// (api, quota_day) every channel shares. From the run's first Analytics read until the run commits,
// the job holds that row's lock, so a web user's Analytics read of another channel waits on its
// own quota upsert. Red until the refresh commits per read.
//
// Unlike the harness's `test`, which runs every scope as a savepoint on one connection, this opens
// the web and worker databases on a pool as the API and worker do, so each scope is a transaction
// of its own and two can run at once. Setup rows commit, in the throwaway test container.
//
// Limits: Google is the fake Google server, which answers in milliseconds; a real Analytics call
// takes longer, and so does each read's hold on the row. Only a run on production shows the real
// hold time.
import { randomBytes } from 'node:crypto'
import { sql } from 'drizzle-orm'
import pg from 'pg'
import type { PgBoss } from 'pg-boss'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { jobHandlers } from '../../../../apps/worker/src/jobs.ts'
import { connectedChannel, subscribe } from '../../../../apps/worker/test/reporting-harness.ts'
import {
  jobQueue,
  openWebDatabase,
  openWorkerDatabase,
  startJobRunner,
  type WebDatabase,
  type WorkerDatabase,
} from '../../../../packages/database/src/index.ts'
import { databaseUrls } from '../../../../packages/database/test/harness.ts'
import { type FakeGoogle, startFakeGoogle } from '../../../../packages/fake-google/src/index.ts'
import { createLogger, recordingReporter } from '../../../../packages/reporter/src/index.ts'
import { createRetention } from '../../../../packages/retention-engine/src/index.ts'
import {
  createConnectionAuthority,
  parseTokenKeys,
} from '../../../../packages/token-vault/src/index.ts'
import {
  createYouTubeGateway,
  reportingDayOf,
  type YouTubeGateway,
} from '../../../../packages/youtube-gateway/src/index.ts'

const dayMs = 24 * 60 * 60 * 1000
const lockTimeout = '2s'

interface SpendOutcome {
  outcome: 'completed' | 'refused' | 'threw'
  code?: string
  ms: number
}

function sqlStateOf(error: unknown): string | undefined {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  return undefined
}

let pool: pg.Pool
let boss: PgBoss
let google: FakeGoogle
let web: WebDatabase
let worker: WorkerDatabase

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: databaseUrls().app, max: 10 })
  boss = await startJobRunner(pool)
  const jobs = jobQueue(boss)
  web = await openWebDatabase(pool, { jobs })
  worker = await openWorkerDatabase(pool, { jobs })
  google = await startFakeGoogle()
})

afterAll(async () => {
  await google?.close()
  await boss?.stop({ graceful: false })
  await pool?.end()
})

describe('retentionCurveRefresh and the shared Analytics quota row', () => {
  test('a running curve refresh does not hold the Analytics quota row for the rest of its run', async () => {
    const keys = parseTokenKeys(`1:${randomBytes(32).toString('base64')}`)
    const now = new Date()
    const published = (videoId: string, days: number) => ({
      videoId,
      title: videoId,
      publishedAt: new Date(now.getTime() - days * dayMs).toISOString(),
      retention: [
        { elapsedVideoTimeRatio: 0.01, audienceWatchRatio: 1, relativeRetentionPerformance: 0.5 },
        { elapsedVideoTimeRatio: 1, audienceWatchRatio: 0.25, relativeRetentionPerformance: 0.5 },
      ],
    })

    // Channel A is paid and has three videos never read: the refresh reads all three.
    google.signInAs({ sub: '700001', email: 'lock-a@example.com', name: 'Lock A' })
    const channelA = await connectedChannel(web, google, keys, 'lock-user-a', 'UC-lock-a')
    google.setChannel('UC-lock-a', {
      createdAt: '2020-01-01T00:00:00Z',
      uploads: [published('a1', 3), published('a2', 4), published('a3', 5)],
    })
    await subscribe(worker, channelA)

    // Channel B belongs to another user, who opens a video page while A's refresh runs.
    google.signInAs({ sub: '700002', email: 'lock-b@example.com', name: 'Lock B' })
    const channelB = await connectedChannel(web, google, keys, 'lock-user-b', 'UC-lock-b')
    google.setChannel('UC-lock-b', {
      createdAt: '2020-01-01T00:00:00Z',
      uploads: [published('b1', 3), published('b2', 3), published('b3', 3)],
    })

    const { tokenEndpoint, clientId, clientSecret } = google
    const gateway = createYouTubeGateway({
      vault: createConnectionAuthority({ google: { tokenEndpoint, clientId, clientSecret }, keys }),
      rootUrls: {
        data: google.youtubeRootUrl,
        analytics: google.youtubeRootUrl,
        reporting: google.youtubeRootUrl,
      },
      logger: createLogger(() => {}),
    })

    /** User B's real Analytics read of a video not yet cached, in a web scope of its own. */
    async function userBReadsAnalytics(videoId: string): Promise<SpendOutcome> {
      const started = performance.now()
      try {
        const read = await web.asUser('lock-user-b', async (tx) => {
          await tx.sql.execute(sql.raw(`set local lock_timeout = '${lockTimeout}'`))
          return gateway.read(tx, channelB, 'audienceRetention', {
            videoId,
            startDate: reportingDayOf(new Date(now.getTime() - 3 * dayMs)),
            endDate: reportingDayOf(now),
          })
        })
        return { outcome: read.ok ? 'completed' : 'refused', ms: performance.now() - started }
      } catch (error) {
        return { outcome: 'threw', code: sqlStateOf(error), ms: performance.now() - started }
      }
    }

    // Control: with no refresh running, B's read completes, so the probe itself works.
    const before = await userBReadsAnalytics('b1')

    // The refresh gets the real gateway, but its second Analytics read first waits for B's read.
    let retentionReads = 0
    let during: SpendOutcome | undefined
    let waiting: { query: string; blockedBy: number[] }[] = []
    const readStartedAt: number[] = []
    const read: YouTubeGateway['read'] = async (...args) => {
      if (args[2] === 'audienceRetention') {
        retentionReads += 1
        readStartedAt.push(performance.now())
        if (retentionReads === 2) {
          const probe = userBReadsAnalytics('b2')
          // Halfway into B's lock timeout, a third connection reads what B's scope waits on.
          await new Promise((resolve) => setTimeout(resolve, 500))
          const { rows } = await pool.query<{ query: string; blockedBy: number[] }>(
            `select left(query, 160) as query, pg_blocking_pids(pid) as "blockedBy"
               from pg_stat_activity where wait_event_type = 'Lock'`,
          )
          waiting = rows
          during = await probe
        }
      }
      return gateway.read(...args)
    }
    const reporter = recordingReporter()
    const handlers = jobHandlers(
      createRetention({ deletionLogKey: 'key', reporter }),
      { probe: async () => {} },
      { relay: undefined, reporter },
      { gateway: { ...gateway, read }, reporter },
    )
    const runStarted = performance.now()
    await handlers.retentionCurveRefresh(worker, { channelId: channelA })
    const runMs = performance.now() - runStarted

    // Control: once the run has committed, B's read completes again.
    const after = await userBReadsAnalytics('b3')

    console.log('REPRO quota row lock:', {
      retentionReads,
      before,
      during,
      waiting,
      after,
      runMs: Math.round(runMs),
      readGapsMs: readStartedAt.slice(1).map((t, i) => Math.round(t - (readStartedAt[i] ?? t))),
      reported: reporter.reports.map((r) => r.message),
    })

    expect(retentionReads).toBe(3)
    expect(before.outcome).toBe('completed')
    expect(after.outcome).toBe('completed')
    // The rule: an Analytics spend elsewhere is not blocked by the refresh still running.
    expect(during).toMatchObject({ outcome: 'completed' })
  })
})
