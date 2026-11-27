import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { describe, expect } from 'vitest'
import { installJobs, jobNames, startJobRunner } from '../src/jobs.ts'
import { databaseUrls, test } from './harness.ts'

describe('enqueue', () => {
  test('a job enqueued in a scope that commits exists with its data', async ({
    worker,
    findJobs,
  }) => {
    const channelId = randomUUID()

    const id = await worker.forChannel(channelId, (scope) =>
      scope.enqueue('deleteChannel', { channelId }),
    )

    const jobs = await findJobs('deleteChannel')
    expect(jobs.map((job) => ({ id: job.id, data: job.data }))).toEqual([
      { id, data: { channelId } },
    ])
  })

  test('a job enqueued in a scope that rolls back does not exist', async ({ worker, findJobs }) => {
    const channelId = randomUUID()

    const failed = await worker
      .forChannel(channelId, async (scope) => {
        await scope.enqueue('deleteChannel', { channelId })
        throw new Error('the action failed')
      })
      .catch((error: Error) => error.message)

    expect(failed).toBe('the action failed')
    expect(await findJobs('deleteChannel')).toEqual([])
  })

  test('a job whose data holds a value other than an internal id is refused', async ({
    worker,
    findJobs,
  }) => {
    const channelId = randomUUID()

    const refused = await worker
      .forChannel(channelId, (scope) =>
        scope.enqueue('deleteChannel', { channelId, youtubeChannelId: 'UC-creator' }),
      )
      .catch((error: Error) => error.name)

    expect(refused).toBe('JobDataError')
    expect(await findJobs('deleteChannel')).toEqual([])
  })

  test('a job throttled by its key is sent once in its time slot, and the second send resolves null', async ({
    worker,
    findJobs,
  }) => {
    const channelId = randomUUID()
    const throttle = { key: channelId, seconds: 60 }

    const ids = await worker.forChannel(channelId, async (scope) => [
      await scope.enqueue('probeConnection', { channelId }, { throttle }),
      await scope.enqueue('probeConnection', { channelId }, { throttle }),
    ])

    const jobs = await findJobs('probeConnection')
    expect(jobs.map((job) => job.id)).toEqual([ids[0]])
    expect(ids[1]).toBeNull()
  })

  // pg-boss holds one job per queue, key and slot start, whatever the window, so a day's slot and
  // the first shorter slot of that day share a start. The same window here makes the starts equal
  // at any time of day.
  test('throttles of one key with different purposes never share a time slot', async ({
    worker,
    findJobs,
  }) => {
    const channelId = randomUUID()
    const daily = { key: channelId, seconds: 60 }

    const ids = await worker.forChannel(channelId, async (scope) => [
      await scope.enqueue('probeConnection', { channelId }, { throttle: daily }),
      await scope.enqueue(
        'probeConnection',
        { channelId },
        { throttle: { ...daily, purpose: 'subscribed' } },
      ),
    ])

    // Both are created at the transaction's one time, so they come back in no set order.
    const jobs = await findJobs('probeConnection')
    expect(ids).not.toContain(null)
    expect(jobs.map((job) => job.id).sort()).toEqual([...ids].sort())
  })

  test('a throttle with a purpose is sent once in its time slot, and the second send resolves null', async ({
    worker,
    findJobs,
  }) => {
    const channelId = randomUUID()
    const subscribed = { key: channelId, seconds: 60, purpose: 'subscribed' as const }

    const ids = await worker.forChannel(channelId, async (scope) => [
      await scope.enqueue('probeConnection', { channelId }, { throttle: subscribed }),
      await scope.enqueue('probeConnection', { channelId }, { throttle: subscribed }),
    ])

    const jobs = await findJobs('probeConnection')
    expect(jobs.map((job) => job.id)).toEqual([ids[0]])
    expect(ids[1]).toBeNull()
  })

  test("a count of a queue's jobs counts those whose data holds every field asked, the scope's own sends included", async ({
    worker,
  }) => {
    const channelId = randomUUID()
    const download = randomUUID()

    const count = await worker.forChannel(channelId, async (scope) => {
      await scope.enqueue('ensureReportingJob', { channelId, download })
      await scope.enqueue('ensureReportingJob', { channelId, download })
      await scope.enqueue('ensureReportingJob', { channelId })
      await scope.enqueue('ensureReportingJob', { channelId: randomUUID(), download })
      await scope.enqueue('probeConnection', { channelId, download })
      return scope.countJobs('ensureReportingJob', { channelId, download })
    })

    expect(count).toBe(2)
  })

  test('a throttle key other than an internal id is refused', async ({ worker, findJobs }) => {
    const channelId = randomUUID()

    const refused = await worker
      .forChannel(channelId, (scope) =>
        scope.enqueue(
          'probeConnection',
          { channelId },
          { throttle: { key: 'UC-creator', seconds: 60 } },
        ),
      )
      .catch((error: Error) => error.name)

    expect(refused).toBe('JobDataError')
    expect(await findJobs('probeConnection')).toEqual([])
  })
})

describe('queues', () => {
  test('every job name has a queue after the migrate step, so a new job name gets its queue', async ({
    boss,
  }) => {
    const queues = await Promise.all(jobNames.map((name) => boss.getQueue(name)))

    expect(queues.map((queue) => queue?.name)).toEqual([...jobNames])
  })

  test('the retries of a failed active user count span at least ten minutes', async ({ boss }) => {
    const queue = await boss.getQueue('activeUserCount')

    expect((queue?.retryLimit ?? 0) * (queue?.retryDelay ?? 0)).toBeGreaterThanOrEqual(600)
  })

  // The deletion alarm at 12 hours reports a cancellation still pending, so the last retry has to
  // run before it.
  test("a failed subscription cancellation retries hourly, its last retry before the deletion's alarm at 12 hours", async ({
    boss,
  }) => {
    const queue = await boss.getQueue('cancelSubscription')

    expect({ retryLimit: queue?.retryLimit, retryDelay: queue?.retryDelay }).toEqual({
      retryLimit: 11,
      retryDelay: 3600,
    })
    expect((queue?.retryLimit ?? 0) * (queue?.retryDelay ?? 0)).toBeLessThan(12 * 60 * 60)
  })

  test('the migrate step spaces the retries of an active user count queue it created before', async () => {
    const migrator = new pg.Pool({ connectionString: databaseUrls().migrator })
    const app = new pg.Pool({ connectionString: databaseUrls().app })
    try {
      const boss = await startJobRunner(app)
      try {
        await boss.updateQueue('activeUserCount', { retryLimit: 2, retryDelay: 0 })
        await installJobs(migrator)
        const queue = await boss.getQueue('activeUserCount')

        expect({ retryLimit: queue?.retryLimit, retryDelay: queue?.retryDelay }).toEqual({
          retryLimit: 6,
          retryDelay: 300,
        })
      } finally {
        await boss.stop({ graceful: false })
      }
    } finally {
      await Promise.all([migrator.end(), app.end()])
    }
  })
})

describe('schedules', () => {
  // Limits: this reads back the schedules the migrate step stored. The worker's cron pass sending a
  // job on the hour, and a missed occurrence being sent once after a deploy, are outside it, and no
  // automated test covers them: the CI smoke run (`apps/worker/test/smoke-run.ts`) waits on a
  // deleteChannel job only, and the daily runs of the connection roster, the reporting job roster,
  // the deleted video check roster, the history purge roster and the retention curve roster are not
  // observed.
  test('the cache sweep runs hourly, and the active user count, the deletion log retention, the deletion request retention, the feedback retention, the history purge roster, the connection roster, the reporting job roster, the deleted video check roster and the retention curve roster daily, in UTC', async ({
    boss,
  }) => {
    const schedules = await boss.getSchedules()

    expect(
      schedules
        .map(({ name, cron, timezone, options }) => ({
          name,
          cron,
          timezone,
          missed: options?.missed,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ).toEqual([
      { name: 'activeUserCount', cron: '15 0 * * *', timezone: 'UTC', missed: 'once' },
      { name: 'cacheSweep', cron: '0 * * * *', timezone: 'UTC', missed: 'once' },
      { name: 'deletedVideoCheckRoster', cron: '0 5 * * *', timezone: 'UTC', missed: 'once' },
      { name: 'deletionLogRetention', cron: '0 3 * * *', timezone: 'UTC', missed: 'once' },
      { name: 'deletionRequestRetention', cron: '0 3 * * *', timezone: 'UTC', missed: 'once' },
      { name: 'feedbackRetention', cron: '0 3 * * *', timezone: 'UTC', missed: 'once' },
      { name: 'historyPurgeRoster', cron: '0 3 * * *', timezone: 'UTC', missed: 'once' },
      { name: 'probeRoster', cron: '0 4 * * *', timezone: 'UTC', missed: 'once' },
      { name: 'reportingJobRoster', cron: '30 4 * * *', timezone: 'UTC', missed: 'once' },
      { name: 'retentionCurveRoster', cron: '0 9 * * *', timezone: 'UTC', missed: 'once' },
    ])
  })
})
