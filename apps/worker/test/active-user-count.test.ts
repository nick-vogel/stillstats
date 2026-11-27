// Limits: these run the active user count's handler, directly or through `work` with a recording
// pg-boss, inside the test's transaction, against a fake OpenPanel. pg-boss's cron pass sending the
// job at 00:15 UTC, and pg-boss retrying a failed one, are outside them: the schedule test reads
// back the stored schedule, and creator-analytics#659's manual check sees the point in OpenPanel.
import {
  activityDays,
  type JobData,
  type WebDatabase,
  type WorkerDatabase,
} from '@creator-analytics/database'
import { seedUser, test } from '@creator-analytics/database/testing'
import { createEventRelay, type EventRelay } from '@creator-analytics/event-relay'
import { startFakeOpenPanel } from '@creator-analytics/event-relay/testing'
import { type Reporter, recordingReporter } from '@creator-analytics/reporter'
import { createRetention } from '@creator-analytics/retention-engine'
import type { Job, WorkHandler } from 'pg-boss'
import { describe, expect } from 'vitest'
import { jobHandlers, work } from '../src/jobs.ts'
import { reportingStub } from './reporting-harness.ts'

/** The worker's handlers, with the active user count sending through `relay`, if any. */
function handlersWith(
  relay: Pick<EventRelay, 'deliverServerEvent'> | undefined,
  reporter: Reporter = recordingReporter(),
) {
  return jobHandlers(
    createRetention({ deletionLogKey: 'key', reporter }),
    { probe: async () => {} },
    { relay, reporter },
    { gateway: reportingStub, reporter },
  )
}

async function recordDays(web: WebDatabase, userId: string, days: string[]): Promise<void> {
  await seedUser(web, userId)
  for (const day of days) {
    await web.asUser(userId, (scope) => scope.sql.insert(activityDays).values({ userId, day }))
  }
}

function readDays(worker: WorkerDatabase) {
  return worker.asSystem((tx) =>
    tx.sql
      .select({ userId: activityDays.userId, day: activityDays.day })
      .from(activityDays)
      .orderBy(activityDays.userId, activityDays.day),
  )
}

/**
 * Activity days over 40 days, for a counted day of 2026-11-10: 2 users active on it, 3 in the 7
 * days ending on it and 6 in the 30 days ending on it, with each user counted once across days.
 */
async function recordFortyDays(web: WebDatabase): Promise<void> {
  // On the counted day and on three more of the 7 days ending on it.
  await recordDays(web, 'counted-user-a', ['2026-11-10', '2026-11-09', '2026-11-07', '2026-11-04'])
  await recordDays(web, 'counted-user-d', ['2026-11-10'])
  // The first of the 7 days.
  await recordDays(web, 'counted-user-i', ['2026-11-04'])
  // The day before the 7 days, and one inside the 30.
  await recordDays(web, 'counted-user-f', ['2026-11-03', '2026-10-21'])
  // The first day the next day's 30 days still cover.
  await recordDays(web, 'counted-user-h', ['2026-10-13'])
  // The first of the 30 days.
  await recordDays(web, 'counted-user-b', ['2026-10-12'])
  // Before the 30 days.
  await recordDays(web, 'counted-user-c', ['2026-10-11'])
  await recordDays(web, 'counted-user-g', ['2026-10-02'])
  // After the counted day: a read between midnight and the run.
  await recordDays(web, 'counted-user-e', ['2026-11-11'])
}

/** The one request the count sends, as the fake OpenPanel receives it. */
function countedRequest(
  openPanel: { clientId: string; clientSecret: string },
  counts: { dau: number; wau: number; mau: number },
  timestamp = '2026-11-10T12:00:00.000Z',
) {
  return {
    method: 'POST',
    path: '/track',
    headers: expect.objectContaining({
      'openpanel-client-id': openPanel.clientId,
      'openpanel-client-secret': openPanel.clientSecret,
    }),
    // The exact body is the proof of no profile id: OpenPanel reads a profile only from profileId.
    body: {
      type: 'track',
      payload: {
        name: 'active_users_counted',
        properties: { ...counts, __timestamp: timestamp },
      },
    },
  }
}

describe('seam 2: the active user count', () => {
  test('it sends one active_users_counted with the distinct users of the counted day, the 7 days and the 30 days ending on it', async ({
    web,
    worker,
    clock,
  }) => {
    await recordFortyDays(web)
    clock.set(new Date('2026-11-11T00:15:00.000Z'))
    const openPanel = await startFakeOpenPanel()
    const reporter = recordingReporter()
    const handlers = handlersWith(createEventRelay(openPanel, { reporter }), reporter)

    // A scheduled job carries no data.
    await handlers.activeUserCount(worker, {})

    expect(openPanel.received).toEqual([countedRequest(openPanel, { dau: 2, wau: 3, mau: 6 })])
    expect(reporter.reports).toEqual([])
  })

  test.for([{ time: '2026-11-11T00:00:00.000Z' }, { time: '2026-11-11T23:59:59.999Z' }])(
    'a run at $time counts 2026-11-10 and stamps the event at noon UTC on it',
    async ({ time }, { web, worker, clock }) => {
      await recordDays(web, 'counted-user-a', ['2026-11-10', '2026-11-11'])
      clock.set(new Date(time))
      const openPanel = await startFakeOpenPanel()
      const handlers = handlersWith(createEventRelay(openPanel, { reporter: recordingReporter() }))

      await handlers.activeUserCount(worker, {})

      expect(openPanel.received).toEqual([
        countedRequest(openPanel, { dau: 1, wau: 1, mau: 1 }, '2026-11-10T12:00:00.000Z'),
      ])
    },
  )

  test('the request carries no profile id, no forwarded IP and no forwarded user agent', async ({
    web,
    worker,
    clock,
  }) => {
    await recordDays(web, 'counted-user-a', ['2026-11-10'])
    clock.set(new Date('2026-11-11T00:15:00.000Z'))
    const openPanel = await startFakeOpenPanel()
    const handlers = handlersWith(createEventRelay(openPanel, { reporter: recordingReporter() }))

    await handlers.activeUserCount(worker, {})

    expect(openPanel.received).toHaveLength(1)
    const [sent] = openPanel.received
    // Node's own fetch user agent, which OpenPanel files as a server event.
    expect(sent?.headers['user-agent']).toBe('node')
    expect(sent?.headers['openpanel-client-ip']).toBeUndefined()
    expect(sent?.headers['x-client-ip']).toBeUndefined()
    expect(sent?.body).toHaveProperty('payload')
    expect(sent?.body).not.toHaveProperty('payload.profileId')
  })

  test('after the count, the activity days older than D-28 are gone and the rest stay', async ({
    web,
    worker,
    clock,
  }) => {
    await recordFortyDays(web)
    clock.set(new Date('2026-11-11T00:15:00.000Z'))
    const openPanel = await startFakeOpenPanel()
    const handlers = handlersWith(createEventRelay(openPanel, { reporter: recordingReporter() }))

    await handlers.activeUserCount(worker, {})

    expect(await readDays(worker)).toEqual([
      { userId: 'counted-user-a', day: '2026-11-04' },
      { userId: 'counted-user-a', day: '2026-11-07' },
      { userId: 'counted-user-a', day: '2026-11-09' },
      { userId: 'counted-user-a', day: '2026-11-10' },
      { userId: 'counted-user-d', day: '2026-11-10' },
      { userId: 'counted-user-e', day: '2026-11-11' },
      { userId: 'counted-user-f', day: '2026-10-21' },
      { userId: 'counted-user-f', day: '2026-11-03' },
      { userId: 'counted-user-h', day: '2026-10-13' },
      { userId: 'counted-user-i', day: '2026-11-04' },
    ])
  })

  test('with no activity days, it sends zeros', async ({ worker, clock }) => {
    clock.set(new Date('2026-11-11T00:15:00.000Z'))
    const openPanel = await startFakeOpenPanel()
    const handlers = handlersWith(createEventRelay(openPanel, { reporter: recordingReporter() }))

    await handlers.activeUserCount(worker, {})

    expect(openPanel.received).toEqual([countedRequest(openPanel, { dau: 0, wau: 0, mau: 0 })])
  })

  // pg-boss retries a job whose work callback rejects. This observes the rejection and runs the
  // handler again, not pg-boss's retry: a committed job would be visible to every test file
  // running beside this one.
  test.for([{ failure: 'refuses' }, { failure: 'never answers' }] as const)(
    'with OpenPanel that $failure, the job is reported and fails, the prune of the D-29 rows rolls back, and a rerun sends the same counts',
    async ({ failure }, { web, worker, clock }) => {
      await recordFortyDays(web)
      clock.set(new Date('2026-11-11T00:15:00.000Z'))
      const before = await readDays(worker)
      const openPanel = await startFakeOpenPanel()
      // One send timeout per send, so the rerun's send is not ended by the first one's.
      const timeouts: AbortController[] = []
      const relay = createEventRelay(openPanel, {
        reporter: recordingReporter(),
        sendTimeout: () => {
          const timeout = new AbortController()
          timeouts.push(timeout)
          return timeout.signal
        },
      })
      const callbacks = new Map<string, WorkHandler<JobData>>()
      const boss = {
        work: async (name: string, callback: WorkHandler<JobData>) => {
          callbacks.set(name, callback)
          return name
        },
      }
      const reporter = recordingReporter()
      await work(boss, worker, handlersWith(relay, reporter), reporter)
      const job = { id: '00000000-0000-4000-8000-000000000001', data: {} } as Job<JobData>
      if (failure === 'refuses') openPanel.answerWith(503)
      else openPanel.answerNothing()

      const ran = callbacks.get('activeUserCount')?.([job])
      const rejected = ran?.then(
        () => undefined,
        (error: unknown) => error,
      )
      if (failure === 'never answers') {
        await openPanel.untilReceived(1)
        timeouts[0]?.abort(new DOMException('The send timeout fired', 'TimeoutError'))
      }
      const error = await rejected

      expect(error).toBeInstanceOf(Error)
      expect(reporter.reports).toEqual([
        { message: 'A activeUserCount job failed', context: { jobId: job.id }, error },
      ])
      expect(await readDays(worker)).toEqual(before.filter(({ day }) => day >= '2026-10-12'))

      openPanel.answerWith(200)
      await callbacks.get('activeUserCount')?.([job])

      expect(openPanel.received).toHaveLength(2)
      expect(openPanel.received[1]?.body).toEqual(openPanel.received[0]?.body)
      expect(openPanel.received[1]).toEqual(countedRequest(openPanel, { dau: 2, wau: 3, mau: 6 }))
    },
  )

  test('three days of refused sends leave no activity day older than D-29', async ({
    web,
    worker,
    clock,
  }) => {
    await recordDays(web, 'old-user', ['2026-10-02'])
    const openPanel = await startFakeOpenPanel()
    openPanel.answerWith(401)
    const reporter = recordingReporter()
    const handlers = handlersWith(createEventRelay(openPanel, { reporter }), reporter)

    for (const run of ['2026-11-11', '2026-11-12', '2026-11-13']) {
      clock.set(new Date(`${run}T00:15:00.000Z`))
      await handlers.activeUserCount(worker, {}).catch(() => undefined)
    }

    expect(openPanel.received).toHaveLength(3)
    expect(await readDays(worker)).toEqual([])
  })

  // With no relay there is nothing to send through, so "sends nothing" holds by construction.
  test('with no OpenPanel settings, it prunes, reports once per run and does not fail', async ({
    web,
    worker,
    clock,
  }) => {
    await recordDays(web, 'counted-user-b', ['2026-10-12', '2026-11-10'])
    clock.set(new Date('2026-11-11T00:15:00.000Z'))
    const reporter = recordingReporter()
    const handlers = handlersWith(undefined, reporter)

    await handlers.activeUserCount(worker, {})
    await handlers.activeUserCount(worker, {})

    const notSent = {
      message: 'The active user count was not sent: OpenPanel is not configured',
      context: { countedDay: '2026-11-10' },
    }
    expect(reporter.reports).toEqual([notSent, notSent])
    expect(await readDays(worker)).toEqual([{ userId: 'counted-user-b', day: '2026-11-10' }])
  })
})
