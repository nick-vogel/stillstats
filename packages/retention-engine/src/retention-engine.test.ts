import { createHmac, randomUUID } from 'node:crypto'
import {
  type DeletionReason,
  deletionLog,
  deletionRequests,
  feedbackMessages,
  memberships,
} from '@creator-analytics/database'
import {
  channelRowCounts,
  test as databaseTest,
  readFeedbackMessages,
  seedChannel,
  seedUser,
} from '@creator-analytics/database/testing'
import { type RecordingReporter, recordingReporter } from '@creator-analytics/reporter'
import { describe, expect } from 'vitest'
import { createRetention, requestDeletion } from './retention-engine.ts'

const deletionLogKey = 'a deletion log key for the tests'
const hourMs = 60 * 60 * 1000

const test = databaseTest.extend<{
  $test: {
    reporter: RecordingReporter
    retention: ReturnType<typeof createRetention>
  }
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest reads a fixture's dependencies from this pattern.
  reporter: async ({}, use) => use(recordingReporter()),
  retention: async ({ reporter }, use) => use(createRetention({ deletionLogKey, reporter })),
})

async function request(
  worker: Parameters<typeof seedChannel>[1],
  channelId: string,
  reason: DeletionReason = 'in_app_revocation',
) {
  return worker.forChannel(channelId, (scope) => requestDeletion(scope, channelId, reason))
}

describe('seam 2: the retention engine', () => {
  test('a deletion request enqueues the deletion now, its check at 1 hour and its alarm at 12 hours', async ({
    web,
    worker,
    clock,
    findJobs,
  }) => {
    clock.set(new Date('2026-10-04T12:00:00.000Z'))
    const channelId = await seedChannel(web, worker, 'retention-user-a')

    const { requestId } = await request(worker, channelId)

    const data = { requestId, channelId }
    const at = (offsetMs: number) => new Date(clock.now().getTime() + offsetMs)
    const enqueued = async (name: 'deleteChannel' | 'deletionCheck' | 'deletionAlarm') =>
      (await findJobs(name)).map((job) => ({ data: job.data, startAfter: job.startAfter }))
    expect(await enqueued('deleteChannel')).toEqual([{ data, startAfter: at(0) }])
    expect(await enqueued('deletionCheck')).toEqual([{ data, startAfter: at(hourMs) }])
    expect(await enqueued('deletionAlarm')).toEqual([{ data, startAfter: at(12 * hourMs) }])
  })

  test('a user requests the deletion of a channel they hold', async ({ web, worker, findJobs }) => {
    const channelId = await seedChannel(web, worker, 'retention-user-a')

    const requested = await web.asUser('retention-user-a', (scope) =>
      requestDeletion(scope, channelId, 'user_deletion'),
    )

    expect(requested).toEqual({ requestId: expect.any(String), alreadyRequested: false })
    expect((await findJobs('deleteChannel')).map((job) => job.data)).toEqual([
      { requestId: requested.requestId, channelId },
    ])
  })

  test('a request that rolls back leaves no request and no job', async ({
    web,
    worker,
    findJobs,
  }) => {
    const channelId = await seedChannel(web, worker, 'retention-user-a')

    await worker
      .forChannel(channelId, async (scope) => {
        await requestDeletion(scope, channelId, 'in_app_revocation')
        throw new Error('the disconnect failed')
      })
      .catch(() => undefined)

    const requests = await worker.forChannel(channelId, (scope) =>
      scope.sql.select().from(deletionRequests),
    )
    expect(requests).toEqual([])
    expect(await findJobs('deleteChannel')).toEqual([])
    expect(await findJobs('deletionCheck')).toEqual([])
    expect(await findJobs('deletionAlarm')).toEqual([])
  })

  test('a second request for a channel with an open request returns the first and enqueues nothing', async ({
    web,
    worker,
    findJobs,
  }) => {
    const channelId = await seedChannel(web, worker, 'retention-user-a')
    const first = await request(worker, channelId, 'in_app_revocation')

    const second = await request(worker, channelId, 'google_revocation')

    expect(second).toEqual({ requestId: first.requestId, alreadyRequested: true })
    expect(await findJobs('deleteChannel')).toHaveLength(1)
  })

  test("the deletion removes every row of the channel in every channel-owned table, and no other channel's", async ({
    web,
    worker,
    retention,
  }) => {
    const channelId = await seedChannel(web, worker, 'retention-user-a')
    const otherChannelId = await seedChannel(web, worker, 'retention-user-b')
    const counts = (id: string) => worker.forChannel(id, (scope) => channelRowCounts(scope, id))
    const seeded = await counts(channelId)
    // A channel's subscription payments are the release before blocks' rows, which nothing writes
    // any more (stillstats#20); channel-owned.test.ts proves they cascade.
    const { subscription_payments: _, ...held } = seeded
    expect(Object.values(held)).not.toContain(0)
    const other = await counts(otherChannelId)
    const { requestId } = await request(worker, channelId)

    await worker.forChannel(channelId, (tx) =>
      retention.deleteChannel(tx, { requestId, channelId }),
    )

    expect(await counts(channelId)).toEqual(
      Object.fromEntries(Object.keys(seeded).map((table) => [table, 0])),
    )
    expect(await counts(otherChannelId)).toEqual(other)
  })

  test('the deletion log entry holds the HMAC of the YouTube channel id, the reason, both times and the row counts, and nothing else', async ({
    web,
    worker,
    clock,
    retention,
  }) => {
    const channelId = await seedChannel(web, worker, 'retention-user-a')
    const seeded = await worker.forChannel(channelId, (scope) => channelRowCounts(scope, channelId))
    clock.set(new Date('2026-10-04T12:00:00.000Z'))
    const requestedAt = clock.now()
    const { requestId } = await request(worker, channelId, 'in_app_revocation')
    clock.advance(5000)

    await worker.forChannel(channelId, (tx) =>
      retention.deleteChannel(tx, { requestId, channelId }),
    )

    // Every column of the table, so a column added later fails this test until it is justified.
    const entries = await worker.asSystem((scope) => scope.sql.select().from(deletionLog))
    expect(entries).toEqual([
      {
        id: expect.any(String),
        youtubeChannelHmac: createHmac('sha256', deletionLogKey)
          .update(`UC${channelId}`)
          .digest('hex'),
        reason: 'in_app_revocation',
        requestedAt,
        completedAt: clock.now(),
        rowCounts: seeded,
      },
    ])
  })

  test("a user's deletion request ends their membership of the channel at once", async ({
    web,
    worker,
  }) => {
    const channelId = await seedChannel(web, worker, 'retention-user-a')

    await web.asUser('retention-user-a', (scope) =>
      requestDeletion(scope, channelId, 'user_deletion'),
    )

    const left = await worker.forChannel(channelId, (scope) => scope.sql.select().from(memberships))
    expect(left).toEqual([])
  })

  // A completed request matches no scope's policy, so the rule is proven on the insert the
  // database refuses. The check and alarm tests prove the deletion completes its request.
  test('a deletion request cannot be complete and keep its channel id', async ({
    web,
    worker,
    clock,
  }) => {
    const channelId = await seedChannel(web, worker, 'retention-user-a')

    const refused = await worker
      .forChannel(channelId, (scope) =>
        scope.sql.insert(deletionRequests).values({
          channelId,
          reason: 'in_app_revocation',
          endedMemberships: 0,
          requestedAt: clock.now(),
          completedAt: clock.now(),
        }),
      )
      .catch((error: { cause?: { constraint?: string } }) => error.cause?.constraint)

    expect(refused).toBe('deletion_requests_open_until_cleared')
  })

  test('the check job re-enqueues a deletion that has not completed', async ({
    web,
    worker,
    clock,
    retention,
    findJobs,
  }) => {
    const channelId = await seedChannel(web, worker, 'retention-user-a')
    const { requestId } = await request(worker, channelId)
    clock.advance(hourMs)

    await worker.forChannel(channelId, (tx) =>
      retention.deletionCheck(tx, { requestId, channelId }),
    )

    expect((await findJobs('deleteChannel')).map((job) => job.data)).toEqual([
      { requestId, channelId },
      { requestId, channelId },
    ])
  })

  test('the check job enqueues nothing for a completed deletion', async ({
    web,
    worker,
    retention,
    findJobs,
  }) => {
    const channelId = await seedChannel(web, worker, 'retention-user-a')
    const { requestId } = await request(worker, channelId)
    await worker.forChannel(channelId, (tx) =>
      retention.deleteChannel(tx, { requestId, channelId }),
    )

    await worker.forChannel(channelId, (tx) =>
      retention.deletionCheck(tx, { requestId, channelId }),
    )

    expect(await findJobs('deleteChannel')).toHaveLength(1)
  })

  test('the alarm reports a deletion that has not completed, with internal ids only', async ({
    web,
    worker,
    retention,
    reporter,
  }) => {
    const channelId = await seedChannel(web, worker, 'retention-user-a')
    const { requestId } = await request(worker, channelId)

    await worker.forChannel(channelId, (tx) =>
      retention.deletionAlarm(tx, { requestId, channelId }),
    )

    expect(reporter.reports).toEqual([
      {
        message: 'A channel deletion is still incomplete 12 hours after its request',
        context: { requestId, channelId },
      },
    ])
  })

  test('the alarm reports nothing for a completed deletion', async ({
    web,
    worker,
    retention,
    reporter,
  }) => {
    const channelId = await seedChannel(web, worker, 'retention-user-a')
    const { requestId } = await request(worker, channelId)
    await worker.forChannel(channelId, (tx) =>
      retention.deleteChannel(tx, { requestId, channelId }),
    )

    await worker.forChannel(channelId, (tx) =>
      retention.deletionAlarm(tx, { requestId, channelId }),
    )

    expect(reporter.reports).toEqual([])
  })

  test('the operator finds the deletion log entry of a deleted channel by its YouTube channel id', async ({
    web,
    worker,
    retention,
  }) => {
    const channelId = await seedChannel(web, worker, 'retention-user-a')
    const { requestId } = await request(worker, channelId, 'user_deletion')
    await worker.forChannel(channelId, (tx) =>
      retention.deleteChannel(tx, { requestId, channelId }),
    )

    const found = await worker.asSystem((scope) => retention.wasDeleted(scope, `UC${channelId}`))
    const notFound = await worker.asSystem((scope) => retention.wasDeleted(scope, 'UC-other'))

    expect(found.map((entry) => entry.reason)).toEqual(['user_deletion'])
    expect(notFound).toEqual([])
  })
  test('the daily job deletes the deletion log entries older than 24 months by the pinned clock, and keeps the younger ones', async ({
    worker,
    clock,
    retention,
  }) => {
    clock.set(new Date('2026-10-04T12:00:00.000Z'))
    const completedAt = {
      older: new Date('2024-10-04T11:59:59.999Z'),
      exactly24Months: new Date('2024-10-04T12:00:00.000Z'),
      younger: new Date('2026-10-04T11:00:00.000Z'),
    }
    // Only a channel scope writes the log, as the deletion job does.
    await worker.forChannel(randomUUID(), (scope) =>
      scope.sql.insert(deletionLog).values(
        Object.entries(completedAt).map(([hmac, at]) => ({
          youtubeChannelHmac: hmac,
          reason: 'in_app_revocation' as const,
          requestedAt: at,
          completedAt: at,
          rowCounts: {},
        })),
      ),
    )
    const readHmacs = () =>
      worker.asSystem((scope) =>
        scope.sql
          .select({ hmac: deletionLog.youtubeChannelHmac })
          .from(deletionLog)
          .orderBy(deletionLog.completedAt),
      )
    expect(await readHmacs()).toEqual([
      { hmac: 'older' },
      { hmac: 'exactly24Months' },
      { hmac: 'younger' },
    ])

    const deleted = await worker.asSystem(retention.deletionLogRetention)

    expect(deleted).toBe(1)
    expect(await readHmacs()).toEqual([{ hmac: 'exactly24Months' }, { hmac: 'younger' }])
  })

  test('the daily job deletes the requests completed more than 24 months ago by the pinned clock, and keeps the open and the younger ones', async ({
    web,
    worker,
    clock,
    retention,
  }) => {
    const completeAt = async (at: Date) => {
      clock.set(at)
      const channelId = await seedChannel(web, worker, 'retention-user-c')
      const { requestId } = await request(worker, channelId)
      await worker.forChannel(channelId, (tx) =>
        retention.deleteChannel(tx, { requestId, channelId }),
      )
    }
    await completeAt(new Date('2024-10-04T11:59:59.999Z'))
    await completeAt(new Date('2024-10-04T12:00:00.000Z'))
    await completeAt(new Date('2026-10-04T11:00:00.000Z'))
    clock.set(new Date('2024-10-01T12:00:00.000Z'))
    const openChannelId = await seedChannel(web, worker, 'retention-user-c')
    await request(worker, openChannelId)
    clock.set(new Date('2026-10-04T12:00:00.000Z'))
    const readOpen = () =>
      worker.forChannel(openChannelId, (scope) =>
        scope.sql.select({ channelId: deletionRequests.channelId }).from(deletionRequests),
      )
    expect(await readOpen()).toEqual([{ channelId: openChannelId }])

    // No scope reads a completed request, so the counts show which ones the job deleted.
    const deleted = await worker.asSystem(retention.deletionRequestRetention)
    const deletedAgain = await worker.asSystem(retention.deletionRequestRetention)
    clock.advance(1)
    const deletedPastExactly24Months = await worker.asSystem(retention.deletionRequestRetention)

    expect([deleted, deletedAgain, deletedPastExactly24Months]).toEqual([1, 0, 1])
    expect(await readOpen()).toEqual([{ channelId: openChannelId }])
  })

  test('the daily job deletes the feedback messages handled more than one year ago by the pinned clock, and keeps the younger and the open ones', async ({
    web,
    worker,
    transaction,
    clock,
    retention,
  }) => {
    const now = new Date('2026-11-15T12:00:00.000Z')
    clock.set(now)
    const userId = 'retention-user-d'
    await seedUser(web, userId)
    const send = (text: string, doneAt: Date | null, createdAt: Date) =>
      web.asUser(userId, (scope) =>
        scope.sql.insert(feedbackMessages).values({
          id: randomUUID(),
          userId,
          type: 'idea',
          text,
          screen: 'video_list',
          createdAt,
          doneAt,
        }),
      )
    const yearAndADayAgo = new Date('2025-11-14T12:00:00.000Z')
    const daysAgo364 = new Date(now.getTime() - 364 * 24 * hourMs)
    await send('A year and a day', yearAndADayAgo, yearAndADayAgo)
    await send('364 days', daysAgo364, daysAgo364)
    await send('Never done', null, now)

    const deleted = await worker.asSystem(retention.feedbackRetention)
    const deletedAgain = await worker.asSystem(retention.feedbackRetention)

    expect([deleted, deletedAgain]).toEqual([1, 0])
    expect(await readFeedbackMessages(transaction)).toMatchObject([
      { text: '364 days' },
      { text: 'Never done', doneAt: null },
    ])
  })
})
