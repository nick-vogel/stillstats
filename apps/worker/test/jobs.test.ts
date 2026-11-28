// Limits: these run each handler the way `work` does, on the jobs a request enqueued, inside the
// test's transaction. pg-boss fetching a committed job and calling `work` is outside them; the
// smoke run of the worker image (`smoke-run.ts`, run by CI) covers it.
import { randomUUID } from 'node:crypto'
import {
  channels,
  connections,
  deletionLog,
  deletionRequests,
  feedbackMessages,
  type JobData,
  jobNames,
  proEnds,
  reachHistory,
  readCache,
  securityEvents,
} from '@creator-analytics/database'
import {
  readFeedbackMessages,
  seedChannel,
  seedUser,
  subscribeOwner,
  test,
} from '@creator-analytics/database/testing'
import { purgeDateOf, requestAccountCancellation } from '@creator-analytics/entitlements'
import { startFakeStripe } from '@creator-analytics/fake-stripe'
import { type Reporter, recordingReporter } from '@creator-analytics/reporter'
import {
  createRetention,
  createStripeCanceller,
  requestDeletion,
  type SubscriptionCanceller,
} from '@creator-analytics/retention-engine'
import type { ConnectionProbe } from '@creator-analytics/token-vault'
import { eq } from 'drizzle-orm'
import type { WorkHandler } from 'pg-boss'
import { describe, expect, onTestFinished } from 'vitest'
import { jobHandlers, work } from '../src/jobs.ts'
import { reportingStub } from './reporting-harness.ts'

/** A connection probe that records the scope and channel it ran in, and calls no Google. */
function probeRecorder() {
  const probes: { scope: string; channelId: string }[] = []
  const prober: ConnectionProbe = {
    async probe(tx, channelId) {
      probes.push({ scope: tx.kind, channelId })
    },
  }
  return { prober, probes }
}

/**
 * The worker's handlers, with a recording reporter and probe unless given others, no Stripe
 * canceller unless given one, and a gateway whose every channel already has its reporting job.
 */
function handlersWith({
  reporter = recordingReporter(),
  prober = probeRecorder().prober,
  canceller,
}: {
  reporter?: Reporter
  prober?: ConnectionProbe
  canceller?: SubscriptionCanceller
} = {}) {
  return jobHandlers(
    createRetention({ deletionLogKey: 'key', reporter, ...(canceller && { canceller }) }),
    prober,
    { relay: undefined, reporter },
    { gateway: reportingStub, reporter },
  )
}

describe('seam 2: the job worker', () => {
  test("every job a deletion request enqueues runs through its queue's handler", async ({
    web,
    worker,
    findJobs,
  }) => {
    const channelId = await seedChannel(web, worker, 'jobs-user-a')
    await worker.forChannel(channelId, (tx) => requestDeletion(tx, channelId, 'user_deletion'))
    const reporter = recordingReporter()
    const handlers = handlersWith({ reporter })

    for (const name of jobNames) {
      for (const job of await findJobs(name)) await handlers[name](worker, job.data)
    }

    const left = await worker.forChannel(channelId, (tx) => tx.sql.select().from(channels))
    expect(left).toEqual([])
    expect(reporter.reports).toEqual([])
  })

  test("a paid owner's account deletion runs through every queue's handler, and cancels and refunds the subscription", async ({
    web,
    worker,
    clock,
    findJobs,
  }) => {
    const stripe = await startFakeStripe()
    onTestFinished(() => stripe.close())
    const periodStart = new Date('2026-11-01T00:00:00.000Z')
    const channelId = await seedChannel(web, worker, 'jobs-paid-owner')
    await subscribeOwner(web, worker, channelId)
    stripe.addSubscription({
      id: `sub_${channelId}`,
      customer: 'cus_jobs-paid-owner',
      periodStart,
      periodEnd: new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000),
      amountPaid: 700,
    })
    clock.set(new Date(periodStart.getTime() + 10 * 24 * 60 * 60 * 1000))
    stripe.setNow(clock.now())
    // What DELETE /me does in its user scope, before it deletes the user row.
    await web.asUser('jobs-paid-owner', async (tx) => {
      await requestAccountCancellation(tx)
      await requestDeletion(tx, channelId, 'user_deletion')
    })
    const reporter = recordingReporter()
    const canceller = createStripeCanceller({
      secretKey: 'sk_test_stillstats',
      stripeApi: { host: stripe.host, port: stripe.port, protocol: stripe.protocol },
    })
    const handlers = handlersWith({ reporter, canceller })

    for (const name of jobNames) {
      for (const job of await findJobs(name)) await handlers[name](worker, job.data)
    }

    const left = await worker.forChannel(channelId, (tx) => tx.sql.select().from(channels))
    expect(left).toEqual([])
    expect(stripe.cancellations.map(({ subscription }) => subscription)).toEqual([
      `sub_${channelId}`,
    ])
    expect(stripe.refunds).toHaveLength(1)
    expect(reporter.reports).toEqual([])
  })

  // Only the system scope deletes an expired cache row, a deletion log entry past 24 months, a
  // request completed more than 24 months ago or a feedback message handled more than one year
  // ago, so a handler that ran in any other scope would leave each row in place.
  test('the cache sweep, the deletion log retention, the deletion request retention and the feedback retention run in the system scope', async ({
    web,
    worker,
    transaction,
    clock,
  }) => {
    clock.set(new Date('2026-10-04T12:00:00.000Z'))
    // The seeded channel's cache row expires at the clock reading.
    const channelId = await seedChannel(web, worker, 'system-jobs-owner')
    const expiredAt = new Date('2024-10-04T11:00:00.000Z')
    await worker.forChannel(randomUUID(), (tx) =>
      tx.sql.insert(deletionLog).values({
        youtubeChannelHmac: 'expired',
        reason: 'user_deletion',
        requestedAt: expiredAt,
        completedAt: expiredAt,
        rowCounts: {},
      }),
    )
    // No scope reads a completed request, so this seeds one now and an identical one after the
    // handler runs. The engine's own delete then finds 1, not 2, only if the handler deleted the
    // first.
    const seedCompletedRequest = async () => {
      const requestChannelId = randomUUID()
      await worker.forChannel(requestChannelId, async (tx) => {
        await tx.sql.insert(deletionRequests).values({
          channelId: requestChannelId,
          reason: 'user_deletion',
          endedMemberships: 0,
          requestedAt: expiredAt,
        })
        // No WHERE clause, as the deletion job completes a request: the channel scope limits it.
        await tx.sql.update(deletionRequests).set({ channelId: null, completedAt: expiredAt })
      })
    }
    await seedCompletedRequest()
    // The user scope inserts its own message, so it can seed one already handled.
    await seedUser(web, 'system-jobs-sender')
    await web.asUser('system-jobs-sender', (tx) =>
      tx.sql.insert(feedbackMessages).values({
        id: randomUUID(),
        userId: 'system-jobs-sender',
        type: 'idea',
        text: 'A handled thought',
        screen: 'video_list',
        createdAt: expiredAt,
        doneAt: expiredAt,
      }),
    )
    expect(await readFeedbackMessages(transaction)).toHaveLength(1)
    const readRows = async () => ({
      cache: await worker.forChannel(channelId, (tx) => tx.sql.select().from(readCache)),
      log: await worker.asSystem((tx) => tx.sql.select().from(deletionLog)),
    })
    expect(await readRows()).toEqual({ cache: [expect.anything()], log: [expect.anything()] })
    const handlers = handlersWith()

    // A scheduled job carries no data.
    await handlers.cacheSweep(worker, {})
    await handlers.deletionLogRetention(worker, {})
    await handlers.deletionRequestRetention(worker, {})
    await handlers.feedbackRetention(worker, {})

    expect(await readRows()).toEqual({ cache: [], log: [] })
    expect(await readFeedbackMessages(transaction)).toEqual([])
    await seedCompletedRequest()
    const retention = createRetention({ deletionLogKey: 'key', reporter: recordingReporter() })
    expect(await worker.asSystem(retention.deletionRequestRetention)).toBe(1)
  })

  // Only the system scope reads the identifiers of every connection, and only the channel's scope
  // writes its connection, so a handler that ran in any other scope would revoke nothing.
  test("a security event's jobs find the channel in the system scope and revoke it in the channel's scope", async ({
    web,
    worker,
    findJobs,
  }) => {
    // The seeded channel's subject identifier is `hmac-` followed by its id.
    const channelId = await seedChannel(web, worker, 'security-event-owner')
    await web.asAnonymous(async (tx) => {
      const eventId = randomUUID()
      await tx.sql
        .insert(securityEvents)
        .values({ id: eventId, kind: 'subject', hmac: `hmac-${channelId}`, receivedAt: tx.now })
      await tx.enqueue('securityEvent', { eventId })
    })
    const handlers = handlersWith()

    for (const name of ['securityEvent', 'googleRevocation'] as const) {
      for (const job of await findJobs(name)) await handlers[name](worker, job.data)
    }

    const read = await worker.forChannel(channelId, async (tx) => ({
      connections: await tx.sql.select({ status: connections.status }).from(connections),
      requests: await tx.sql.select({ reason: deletionRequests.reason }).from(deletionRequests),
    }))
    expect(read).toEqual({
      connections: [{ status: 'revoked' }],
      requests: [{ reason: 'google_revocation' }],
    })
  })

  // Only the system scope reads the connection roster, so a roster handler that ran in any other
  // scope would fail; the probe needs the channel's scope to write its connection.
  test("the roster job reads the roster in the system scope and probes each channel in the channel's scope", async ({
    web,
    worker,
    findJobs,
  }) => {
    const channelId = await seedChannel(web, worker, 'roster-job-owner')
    const { prober, probes } = probeRecorder()
    const handlers = handlersWith({ prober })

    // A scheduled job carries no data.
    await handlers.probeRoster(worker, {})
    for (const job of await findJobs('probeConnection')) {
      await handlers.probeConnection(worker, job.data)
    }

    expect(probes).toEqual([{ scope: 'channel', channelId }])
  })

  // Only the system scope reads the connection roster, and only the channel's scope reads and
  // deletes its history and its subscription row.
  test("the history purge roster reads the roster in the system scope and purges each due channel in the channel's scope", async ({
    web,
    worker,
    clock,
    findJobs,
  }) => {
    // Each channel's subscription ends when it is seeded: the first on day 0, the second on day 10.
    const endedAt = new Date('2026-11-02T12:00:00.000Z')
    const endNow = (channelId: string) =>
      worker.forChannel(channelId, (scope) => {
        const ended = { endedAt: scope.now, purgeAfter: purgeDateOf(scope.now) }
        return scope.sql
          .insert(proEnds)
          .values({ channelId, ...ended })
          .onConflictDoUpdate({ target: proEnds.channelId, set: ended })
      })
    clock.set(endedAt)
    const due = await seedChannel(web, worker, 'purge-job-owner-a')
    await endNow(due)
    clock.set(new Date(endedAt.getTime() + 10 * 24 * 60 * 60 * 1000))
    const ahead = await seedChannel(web, worker, 'purge-job-owner-b')
    await endNow(ahead)
    clock.set(new Date(endedAt.getTime() + 31 * 24 * 60 * 60 * 1000))
    const handlers = handlersWith()

    // A scheduled job carries no data.
    await handlers.historyPurgeRoster(worker, {})
    for (const job of await findJobs('historyPurge')) {
      await handlers.historyPurge(worker, job.data)
    }

    const held = await Promise.all(
      [due, ahead].map((channelId) =>
        worker.forChannel(channelId, (scope) =>
          scope.sql
            .select({ videoId: reachHistory.videoId })
            .from(reachHistory)
            .where(eq(reachHistory.channelId, channelId)),
        ),
      ),
    )
    expect(held).toEqual([[], [{ videoId: 'fixture' }]])
  })

  // pg-boss retries a job whose work callback rejects. This observes the rejection, not the retry:
  // a committed job would be visible to every test file running beside this one.
  test('a job whose handler throws is reported, and its failure goes back to pg-boss', async ({
    web,
    worker,
    findJobs,
  }) => {
    const channelId = await seedChannel(web, worker, 'failing-job-owner')
    await worker.forChannel(channelId, (tx) => requestDeletion(tx, channelId, 'user_deletion'))
    const [job] = await findJobs('deleteChannel')
    if (!job) throw new Error('The deletion request enqueued no deletion')
    const callbacks = new Map<string, WorkHandler<JobData>>()
    const boss = {
      work: async (name: string, callback: WorkHandler<JobData>) => {
        callbacks.set(name, callback)
        return name
      },
    }
    const failure = new Error('the handler failed')
    const fail = async () => {
      throw failure
    }
    const handlers = handlersWith()
    for (const name of jobNames) handlers[name] = fail
    const reporter = recordingReporter()

    await work(boss, worker, handlers, reporter)
    const rejected = await callbacks
      .get('deleteChannel')?.([job])
      .catch((error: unknown) => error)

    expect(rejected).toBe(failure)
    expect(reporter.reports).toEqual([
      { message: 'A deleteChannel job failed', context: { jobId: job.id }, error: failure },
    ])
  })
})
