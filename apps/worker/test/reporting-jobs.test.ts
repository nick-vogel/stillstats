// Limits: Google is the fake Google server, so these tests cannot prove that YouTube accepts the
// reporting job, that `channel_reach_combined_a1` is the report type's real id, or that YouTube
// produces the daily reach files. Nick connecting his own channel on the deployed product, then
// seeing its reach files listed for the job within 48 hours (#783), covers them. They run each
// handler the way `work` does, inside the test's transaction; pg-boss's cron pass sending the roster
// job at 04:30 UTC is outside them, and the schedules test reads back the stored schedule.
import { randomUUID } from 'node:crypto'
import {
  connections,
  reachHistoryDays,
  reportingJobs,
  type WebDatabase,
  type WorkerDatabase,
  workerDatabase,
} from '@creator-analytics/database'
import { recordSubscription } from '@creator-analytics/entitlements'
import { recordingReporter } from '@creator-analytics/reporter'
import { drizzle } from 'drizzle-orm/node-postgres'
import { describe, expect, onTestFinished, vi } from 'vitest'
import { ensureReportingJob } from '../src/reporting-jobs.ts'
import { connectedChannel, reachReportType, reportingStub, test } from './reporting-harness.ts'

function storedJobs(worker: WorkerDatabase, channelId: string) {
  return worker.forChannel(channelId, (tx) =>
    tx.sql
      .select({ jobId: reportingJobs.jobId, createdAt: reportingJobs.createdAt })
      .from(reportingJobs),
  )
}

describe('seam 2: the reporting job of every connected channel', () => {
  test('a channel with no reporting job gets one for its daily reach report at Google, and stores its id and creation time', async ({
    web,
    worker,
    google,
    keys,
    handlers,
  }) => {
    const channelId = await connectedChannel(web, google, keys, 'reporting-user-a', 'UC-reach-a')

    await handlers.ensureReportingJob(worker, { channelId })

    const atGoogle = google.reportingJobsOf('UC-reach-a')
    expect(atGoogle.map((job) => job.reportTypeId)).toEqual([reachReportType])
    expect(await storedJobs(worker, channelId)).toEqual(
      atGoogle.map((job) => ({ jobId: job.id, createdAt: new Date(job.createTime) })),
    )
  })

  test('a channel that has a stored reporting job gets no second one, and calls Google for nothing', async ({
    web,
    worker,
    google,
    keys,
    handlers,
  }) => {
    const channelId = await connectedChannel(web, google, keys, 'reporting-user-b', 'UC-reach-b')
    await handlers.ensureReportingJob(worker, { channelId })
    const callsBefore = google.reportingRequests.length

    await handlers.ensureReportingJob(worker, { channelId })

    expect(google.reportingRequests.length).toBe(callsBefore)
    expect(google.reportingJobsOf('UC-reach-b')).toHaveLength(1)
    expect(await storedJobs(worker, channelId)).toHaveLength(1)
  })

  test('a reporting job Google already holds for the channel is stored, not created again', async ({
    web,
    worker,
    google,
    keys,
    handlers,
  }) => {
    const channelId = await connectedChannel(web, google, keys, 'reporting-user-c', 'UC-reach-c')
    const held = {
      id: 'held-at-google',
      reportTypeId: reachReportType,
      name: 'An earlier job',
      createTime: '2026-11-01T08:00:00.000Z',
    }
    google.setReportingJob('UC-reach-c', held)

    await handlers.ensureReportingJob(worker, { channelId })

    expect(google.reportingJobsOf('UC-reach-c')).toEqual([held])
    expect(await storedJobs(worker, channelId)).toEqual([
      { jobId: 'held-at-google', createdAt: new Date(held.createTime) },
    ])
  })

  // Only the system scope reads the connection roster, and only a channel's own scope writes its
  // reporting job, so a roster or a channel job run in any other scope stores no job.
  test('the daily roster job gives every connected channel a reporting job, each in its own scope, and none to a revoked connection', async ({
    web,
    worker,
    findJobs,
    google,
    keys,
    handlers,
  }) => {
    const first = await connectedChannel(web, google, keys, 'roster-user-a', 'UC-roster-a')
    const second = await connectedChannel(web, google, keys, 'roster-user-b', 'UC-roster-b')
    const revoked = await connectedChannel(web, google, keys, 'roster-user-c', 'UC-roster-c')
    await worker.forChannel(revoked, (tx) => tx.sql.update(connections).set({ status: 'revoked' }))

    // A scheduled job carries no data.
    await handlers.reportingJobRoster(worker, {})
    for (const job of await findJobs('ensureReportingJob')) {
      await handlers.ensureReportingJob(worker, job.data)
    }

    expect({
      first: (await storedJobs(worker, first)).length,
      second: (await storedJobs(worker, second)).length,
      revoked: (await storedJobs(worker, revoked)).length,
    }).toEqual({ first: 1, second: 1, revoked: 0 })
    expect(
      ['UC-roster-a', 'UC-roster-b', 'UC-roster-c'].map((id) => google.reportingJobsOf(id).length),
    ).toEqual([1, 1, 0])
  })

  test('a roster job run twice in a UTC day sends each channel one reporting job', async ({
    web,
    worker,
    findJobs,
    google,
    keys,
    handlers,
  }) => {
    await connectedChannel(web, google, keys, 'roster-twice-user', 'UC-roster-twice')

    await handlers.reportingJobRoster(worker, {})
    await handlers.reportingJobRoster(worker, {})

    expect(await findJobs('ensureReportingJob')).toHaveLength(1)
  })

  test('a channel still without a reporting job a day after it connected raises an error report naming only its id, and one connected under a day ago does not', async ({
    web,
    worker,
    clock,
    google,
    keys,
    reporter,
    handlers,
  }) => {
    clock.set(new Date('2026-11-17T10:00:00.000Z'))
    const late = await connectedChannel(web, google, keys, 'alarm-user-a', 'UC-alarm-a')
    clock.set(new Date('2026-11-18T09:00:00.000Z'))
    const recent = await connectedChannel(web, google, keys, 'alarm-user-b', 'UC-alarm-b')
    google.failReporting(503)
    // 25 hours after the first connected, and 23 hours after the second.
    clock.set(new Date('2026-11-18T11:00:00.000Z'))

    await handlers.ensureReportingJob(worker, { channelId: late })
    await handlers.ensureReportingJob(worker, { channelId: recent })

    expect(reporter.reports).toEqual([
      {
        message: 'A connected channel still has no reporting job a day after it connected',
        context: { channelId: late },
      },
    ])
  })
})

/** The channel's stored reach days. */
function storedDays(worker: WorkerDatabase, channelId: string) {
  return worker.forChannel(channelId, async (tx) =>
    (await tx.sql.select({ day: reachHistoryDays.day }).from(reachHistoryDays)).map(
      ({ day }) => day,
    ),
  )
}

/** The Stripe webhook records a Checkout that turns the channel paid, as the API does. */
function recordPaidCheckout(web: WebDatabase, channelId: string, at: Date) {
  return web.asAnonymous((tx) =>
    recordSubscription(tx, {
      channelId,
      customer: 'cus_test_return',
      subscription: 'sub_test_return',
      plan: 'monthly',
      status: 'active',
      periodEnd: null,
      purgeAfter: null,
      eventCreated: at,
    }),
  )
}

const afterRoster = new Date('2026-11-17T09:00:00.000Z')

// The roster's run and the subscription fall in one UTC day here: the test's one transaction gives
// every job it sends that transaction's time.
describe('seam 2: a channel that turns paid downloads its history at once', () => {
  test("a channel that turns paid after the day's roster run has stored days once the job its subscription sent runs", async ({
    web,
    worker,
    findJobs,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(afterRoster)
    google.setNow(afterRoster)
    const channelId = await connectedChannel(web, google, keys, 'turns-paid', 'UC-turns-paid')
    google.addReachReport('UC-turns-paid', {
      day: '2026-11-15',
      createTime: '2026-11-16T10:00:00Z',
      rows: [{ videoId: 'v1', trafficSourceType: 5, impressions: 100, ctr: 0.05 }],
    })
    await handlers.reportingJobRoster(worker, {})
    const [rosterJob] = await findJobs('ensureReportingJob')
    if (!rosterJob) throw new Error('The roster sent no job')
    await handlers.ensureReportingJob(worker, rosterJob.data)
    expect(await storedDays(worker, channelId)).toEqual([])

    await recordPaidCheckout(web, channelId, afterRoster)
    const sent = (await findJobs('ensureReportingJob')).filter((job) => job.id !== rosterJob.id)
    for (const job of sent) await handlers.ensureReportingJob(worker, job.data)

    expect(sent.map((job) => job.data)).toEqual([{ channelId }])
    expect(await storedDays(worker, channelId)).toEqual(['2026-11-15'])
  })

  test("the job a subscription sent leaves the day's roster run its own job for the channel", async ({
    web,
    worker,
    findJobs,
    google,
    keys,
    handlers,
  }) => {
    const channelId = await connectedChannel(web, google, keys, 'paid-first', 'UC-paid-first')
    await recordPaidCheckout(web, channelId, new Date())

    await handlers.reportingJobRoster(worker, {})

    expect((await findJobs('ensureReportingJob')).map((job) => job.data)).toEqual([
      { channelId },
      { channelId },
    ])
  })

  // pg-boss holds one job per queue, key and slot start, and a day's slot and the first shorter slot
  // of that day share a start, so a re-queue throttled under the channel's own key would take the
  // roster's slot for the day when sent in its first slot. A job with no slot can take none at any
  // time of day, which the test's one transaction time cannot place at midnight.
  test("a rate-limited job's re-queue takes no throttle slot, so the day's roster and a subscription still send the channel's jobs", async ({
    web,
    worker,
    findJobs,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(afterRoster)
    google.setNow(afterRoster)
    const channelId = await connectedChannel(web, google, keys, 'slot-429', 'UC-slot-429')
    google.addReachReport('UC-slot-429', {
      day: '2026-11-15',
      createTime: '2026-11-16T10:00:00Z',
      rows: [{ videoId: 'v1', trafficSourceType: 5, impressions: 100, ctr: 0.05 }],
    })
    google.limitReportDownloads(0)
    await recordPaidCheckout(web, channelId, afterRoster)
    const [subscribed] = await findJobs('ensureReportingJob')
    await handlers.ensureReportingJob(worker, subscribed?.data ?? {})

    await handlers.reportingJobRoster(worker, {})

    const slots = (await findJobs('ensureReportingJob'))
      .map((job) => ({ key: job.singletonKey, slotted: job.singletonOn !== null }))
      .sort((a, b) => String(a.key).localeCompare(String(b.key)))
    expect(slots).toEqual([
      { key: channelId, slotted: true },
      { key: null, slotted: false },
      { key: `subscribed:${channelId}`, slotted: true },
    ])
  })

  // The harness runs every scope on one connection, where an advisory lock never waits, so this
  // test runs its jobs on connections of their own from the pool. Their channels do not exist, so
  // each job reads its channel as free and writes nothing: the lock is all it takes.
  test('a second job for a channel waits for the first to end before it reaches Google, and a job for another channel does not', async ({
    pool,
    jobs,
  }) => {
    const channelId = randomUUID()
    const otherChannelId = randomUUID()
    const started: string[] = []
    let endFirst = () => {}
    const firstEnds = new Promise<void>((resolve) => {
      endFirst = resolve
    })
    const onPoolConnections = workerDatabase(drizzle({ client: pool }), { jobs })
    const run = (label: string, id: string, until?: Promise<void>) =>
      onPoolConnections.forChannel(id, (tx) =>
        ensureReportingJob({
          gateway: {
            ...reportingStub,
            ensureReportingJob: async () => {
              started.push(label)
              await until
              return { ok: true, created: false }
            },
          },
          reporter: recordingReporter(),
        })(tx, { channelId: id }),
      )
    const waitingOnLock = async () => {
      const { rows } = await pool.query<{ waiting: number }>(
        `select count(*)::int as waiting from pg_locks
         where locktype = 'advisory' and not granted and objsubid = 2
           and classid = hashtext('reach_history')::oid and objid = hashtext($1)::oid`,
        [channelId],
      )
      return rows[0]?.waiting ?? 0
    }

    const first = run('first', channelId, firstEnds)
    let second: Promise<void> = Promise.resolve()
    // A failed expectation must still end both jobs, or their open transactions hold the pool.
    onTestFinished(async () => {
      endFirst()
      await Promise.allSettled([first, second])
    })
    await vi.waitFor(() => expect(started).toEqual(['first']))
    second = run('second', channelId)
    await run('other', otherChannelId)
    await vi.waitFor(async () => expect(await waitingOnLock()).toBe(1))
    expect(started).toEqual(['first', 'other'])

    endFirst()
    await Promise.all([first, second])

    expect(started).toEqual(['first', 'other', 'second'])
  })
})
