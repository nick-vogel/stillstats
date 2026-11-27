// Limits: these run the deletion and its cancellation job against the fake Stripe server, so they
// show which calls the canceller makes and what it does with Stripe's answers. They cannot prove
// that Stripe accepts the parameters, that Managed Payments lets Stillstats refund its customer,
// the exchange rate a refund of a payment in another currency takes, or that the customer is told:
// Nick's walk of Pro on production (creator-analytics#791) covers those. pg-boss
// spacing the retries an hour apart is the queue's options, which `jobs.test.ts` reads back; here
// each retry is a handler run on a clock the test moves.
import { randomUUID } from 'node:crypto'
import {
  type DeletionReason,
  type Scoped,
  type ScopeKind,
  subscriptionCancellations,
  subscriptions,
  type WebDatabase,
  type WorkerDatabase,
} from '@creator-analytics/database'
import {
  channelRowCounts,
  test as databaseTest,
  type FindJobs,
  seedChannel,
  type TestClock,
} from '@creator-analytics/database/testing'
import { type FakeStripe, startFakeStripe } from '@creator-analytics/fake-stripe'
import { type RecordingReporter, recordingReporter } from '@creator-analytics/reporter'
import { eq } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import {
  createRetention,
  deletionJobData,
  type Retention,
  requestDeletion,
} from './retention-engine.ts'
import {
  createStripeCanceller,
  type SubscriptionCanceller,
  stripeSecretKeyOf,
} from './subscription-cancellation.ts'

const hourMs = 60 * 60 * 1000
const dayMs = 24 * hourMs
const periodStart = new Date('2026-11-01T00:00:00.000Z')
const periodEnd = new Date(periodStart.getTime() + 30 * dayMs)
const tenDaysIn = new Date(periodStart.getTime() + 10 * dayMs)

const test = databaseTest.extend<{
  $test: {
    reporter: RecordingReporter
    stripe: FakeStripe
    canceller: SubscriptionCanceller
    retention: ReturnType<typeof createRetention>
  }
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest reads a fixture's dependencies from this pattern.
  reporter: async ({}, use) => use(recordingReporter()),
  // biome-ignore lint/correctness/noEmptyPattern: Vitest reads a fixture's dependencies from this pattern.
  stripe: async ({}, use) => {
    const stripe = await startFakeStripe()
    await use(stripe)
    await stripe.close()
  },
  canceller: async ({ stripe }, use) =>
    use(
      createStripeCanceller({
        secretKey: 'sk_test_stillstats',
        stripeApi: {
          host: stripe.host,
          port: stripe.port,
          protocol: stripe.protocol,
          maxNetworkRetries: 0,
        },
      }),
    ),
  retention: async ({ reporter, canceller }, use) =>
    use(createRetention({ deletionLogKey: 'a deletion log key', reporter, canceller })),
})

/** The fixtures the helpers below share; each test destructures its own, as Vitest requires. */
interface Scene {
  web: WebDatabase
  worker: WorkerDatabase
  clock: TestClock
  stripe: FakeStripe
  retention: Retention
  findJobs: FindJobs
}

/**
 * A channel on Pro ten days into its 30-day period, paid $7.00: its subscriptions row is
 * active, and the fake Stripe server holds its subscription, latest invoice and PaymentIntent.
 * Both clocks read ten days in.
 */
async function paidChannel({ web, worker, clock, stripe }: Scene, owner: string) {
  const channelId = await seedChannel(web, worker, owner)
  await worker.forChannel(channelId, (tx) =>
    tx.sql
      .update(subscriptions)
      .set({ status: 'active' })
      .where(eq(subscriptions.channelId, channelId)),
  )
  const { paymentIntent } = stripe.addSubscription({
    id: `sub_${channelId}`,
    customer: `cus_${channelId}`,
    periodStart,
    periodEnd,
    amountPaid: 700,
  })
  clock.set(tenDaysIn)
  stripe.setNow(tenDaysIn)
  return { channelId, paymentIntent }
}

async function deleted(
  { worker, retention, findJobs }: Scene,
  channelId: string,
  reason: DeletionReason = 'in_app_revocation',
) {
  const { requestId } = await worker.forChannel(channelId, (tx) =>
    requestDeletion(tx, channelId, reason),
  )
  await worker.forChannel(channelId, (tx) => retention.deleteChannel(tx, { requestId, channelId }))
  const jobs = await findJobs('cancelSubscription')
  return {
    requestId,
    cancellationJobs: jobs.map((job) => deletionJobData('cancelSubscription', job.data)),
  }
}

function runCancellation(
  { worker, retention }: Scene,
  data: { requestId: string; channelId: string },
) {
  return worker.forChannel(data.channelId, (tx) => retention.cancelSubscription(tx, data))
}

function pendingCancellations({ worker }: Scene, channelId: string) {
  return worker.forChannel(channelId, (tx) => tx.sql.select().from(subscriptionCancellations))
}

// 700 x 20 of 30 days, 466.67 rounded to the cent.
const unusedTwentyDays = '467'

describe('seam 2: a channel deletion cancels its subscription', () => {
  for (const [reason, cause] of [
    ['google_revocation', 'a revocation'],
    ['in_app_revocation', 'a disconnect'],
    ['user_deletion', 'an account deletion'],
  ] as const) {
    test(`${cause} of a paid channel cancels its subscription at once and refunds the unused part of the period`, async ({
      web,
      worker,
      clock,
      stripe,
      retention,
      findJobs,
    }) => {
      const scene = { web, worker, clock, stripe, retention, findJobs }
      const { channelId, paymentIntent } = await paidChannel(scene, 'cancel-owner')

      const { requestId, cancellationJobs } = await deleted(scene, channelId, reason)
      for (const data of cancellationJobs) await runCancellation(scene, data)

      expect(cancellationJobs).toEqual([{ requestId, channelId }])
      expect(
        stripe.cancellations.map(({ subscription, params }) => ({
          subscription,
          ...Object.fromEntries(params),
        })),
      ).toEqual([
        expect.objectContaining({
          subscription: `sub_${channelId}`,
          prorate: 'false',
          invoice_now: 'false',
        }),
      ])
      expect(stripe.refunds.map((body) => Object.fromEntries(body))).toEqual([
        expect.objectContaining({ payment_intent: paymentIntent, amount: unusedTwentyDays }),
      ])
      expect(await pendingCancellations(scene, channelId)).toEqual([])
    })
  }

  test("a free channel's deletion enqueues no cancellation and makes no Stripe call", async ({
    web,
    worker,
    clock,
    stripe,
    retention,
    findJobs,
  }) => {
    const scene = { web, worker, clock, stripe, retention, findJobs }
    // The seeded channel's subscription is canceled, as every free channel's that once paid is.
    const channelId = await seedChannel(web, worker, 'cancel-owner')

    const { cancellationJobs } = await deleted(scene, channelId)

    expect(cancellationJobs).toEqual([])
    expect(await pendingCancellations(scene, channelId)).toEqual([])
    expect(stripe.requests).toEqual([])
  })

  test('a Stripe outage deletes the rows on time, retries the cancellation, and raises the alarm at 12 hours; the first run after it ends cancels and refunds once', async ({
    web,
    worker,
    clock,
    stripe,
    retention,
    findJobs,
    reporter,
  }) => {
    const scene = { web, worker, clock, stripe, retention, findJobs }
    const { channelId } = await paidChannel(scene, 'cancel-owner')
    stripe.failAll(503)

    const { requestId, cancellationJobs } = await deleted(scene, channelId)
    const data = { requestId, channelId }
    const counts = await worker.forChannel(channelId, (tx) => channelRowCounts(tx, channelId))
    expect(Object.values(counts).every((n) => n === 0)).toBe(true)
    expect(cancellationJobs).toEqual([data])
    for (let run = 0; run < 12; run += 1) {
      await expect(runCancellation(scene, data)).rejects.toThrow()
      clock.advance(hourMs)
    }
    expect(await pendingCancellations(scene, channelId)).toHaveLength(1)
    const [alarm] = await findJobs('deletionAlarm')
    expect(alarm?.startAfter).toEqual(new Date(tenDaysIn.getTime() + 12 * hourMs))
    clock.set(alarm?.startAfter ?? new Date(0))

    await worker.forChannel(channelId, (tx) => retention.deletionAlarm(tx, data))

    expect(reporter.reports).toEqual([
      {
        message: 'A subscription cancellation is still pending 12 hours after its deletion request',
        context: { requestId, channelId },
      },
    ])

    stripe.failAll(null)
    stripe.setNow(clock.now())
    await runCancellation(scene, data)
    await worker.forChannel(channelId, (tx) => retention.deletionAlarm(tx, data))

    expect(stripe.cancellations).toHaveLength(1)
    // 700 x 19.5 of 30 days, exactly 455: the subscription ended in Stripe 12 hours after the
    // request.
    expect(stripe.refunds.map((body) => body.get('amount'))).toEqual(['455'])
    expect(await pendingCancellations(scene, channelId)).toEqual([])
    expect(reporter.reports).toHaveLength(1)
  })

  test('a retry after the cancellation succeeded and the refund failed cancels nothing again and refunds once', async ({
    web,
    worker,
    clock,
    stripe,
    retention,
    findJobs,
  }) => {
    const scene = { web, worker, clock, stripe, retention, findJobs }
    const { channelId } = await paidChannel(scene, 'cancel-owner')
    stripe.failRefunds(503)
    const { requestId } = await deleted(scene, channelId)
    const data = { requestId, channelId }

    await expect(runCancellation(scene, data)).rejects.toThrow()
    stripe.failRefunds(null)
    await runCancellation(scene, data)

    expect(stripe.cancellations).toHaveLength(1)
    expect(stripe.refunds.map((body) => body.get('amount'))).toEqual([unusedTwentyDays])
    expect(await pendingCancellations(scene, channelId)).toEqual([])
  })

  test('a cancellation pending with no Stripe key fails, keeps its pending row, and raises the alarm', async ({
    web,
    worker,
    clock,
    stripe,
    findJobs,
    reporter,
  }) => {
    const retention = createRetention({ deletionLogKey: 'a deletion log key', reporter })
    const scene = { web, worker, clock, stripe, retention, findJobs }
    const { channelId } = await paidChannel(scene, 'cancel-owner')
    const { requestId } = await worker.forChannel(channelId, (tx) =>
      requestDeletion(tx, channelId, 'in_app_revocation'),
    )
    const data = { requestId, channelId }
    await worker.forChannel(channelId, (tx) => retention.deleteChannel(tx, data))

    const running = worker.forChannel(channelId, (tx) => retention.cancelSubscription(tx, data))

    await expect(running).rejects.toThrow('Stripe is not configured')
    expect(await pendingCancellations(scene, channelId)).toHaveLength(1)
    await worker.forChannel(channelId, (tx) => retention.deletionAlarm(tx, data))
    expect(reporter.reports.map(({ message }) => message)).toEqual([
      'A subscription cancellation is still pending 12 hours after its deletion request',
    ])
  })

  test("only the deletion's own channel scope reads its pending cancellation", async ({
    web,
    worker,
    clock,
    stripe,
    retention,
    findJobs,
  }) => {
    const scene = { web, worker, clock, stripe, retention, findJobs }
    const { channelId } = await paidChannel(scene, 'cancel-owner')
    stripe.failAll(503)
    await deleted(scene, channelId)
    const read = (scope: Scoped<ScopeKind>) => scope.sql.select().from(subscriptionCancellations)

    expect(await worker.forChannel(channelId, read)).toHaveLength(1)
    expect(await worker.forChannel(randomUUID(), read)).toEqual([])
    expect(await worker.asSystem(read)).toEqual([])
    expect(await web.asUser('cancel-owner', read)).toEqual([])
    expect(await web.asAnonymous(read)).toEqual([])
  })
})

describe('the Stripe canceller', () => {
  test('a second run for one cancellation refunds nothing more, though Stripe has forgotten its idempotency key', async ({
    stripe,
    canceller,
  }) => {
    stripe.addSubscription({
      id: 'sub_twice',
      customer: 'cus_twice',
      periodStart,
      periodEnd,
      amountPaid: 700,
    })
    stripe.setNow(tenDaysIn)
    const cancellation = { cancellationId: randomUUID(), channelId: randomUUID() }

    await canceller.cancelAndRefund('sub_twice', cancellation)
    await canceller.cancelAndRefund('sub_twice', cancellation)

    expect(stripe.cancellations).toHaveLength(1)
    expect(stripe.refunds).toHaveLength(1)
  })

  test('a subscription Stripe already ended at its period end is not canceled again, and nothing is refunded', async ({
    stripe,
    canceller,
  }) => {
    // The owner canceled at period end on day 5, and the channel is deleted after the period ended:
    // Stripe's `canceled_at` is day 5, but the period was used in full.
    stripe.addSubscription({
      id: 'sub_ended',
      customer: 'cus_ended',
      status: 'canceled',
      periodStart,
      periodEnd,
      amountPaid: 700,
      canceledAt: new Date(periodStart.getTime() + 5 * dayMs),
      endedAt: periodEnd,
    })

    await canceller.cancelAndRefund('sub_ended', {
      cancellationId: randomUUID(),
      channelId: randomUUID(),
    })

    expect(stripe.cancellations).toEqual([])
    expect(stripe.refunds).toEqual([])
  })

  test('a subscription whose latest invoice is unpaid is canceled and nothing is refunded, though the invoice took a partial payment', async ({
    stripe,
    canceller,
  }) => {
    stripe.addSubscription({
      id: 'sub_unpaid',
      customer: 'cus_unpaid',
      status: 'past_due',
      periodStart,
      periodEnd,
      amountPaid: 300,
      invoicePaid: false,
    })
    stripe.setNow(tenDaysIn)

    await canceller.cancelAndRefund('sub_unpaid', {
      cancellationId: randomUUID(),
      channelId: randomUUID(),
    })

    expect(stripe.cancellations).toHaveLength(1)
    expect(stripe.refunds).toEqual([])
  })
})

describe("the worker's Stripe key", () => {
  test('is undefined when unset, and a secret or restricted key when set', () => {
    expect(stripeSecretKeyOf({})).toBeUndefined()
    expect(stripeSecretKeyOf({ STRIPE_SECRET_KEY: 'sk_live_a' })).toBe('sk_live_a')
    expect(stripeSecretKeyOf({ STRIPE_SECRET_KEY: 'rk_live_a' })).toBe('rk_live_a')
  })

  test('throws for a key that is neither a secret nor a restricted key', () => {
    expect(() => stripeSecretKeyOf({ STRIPE_SECRET_KEY: 'pk_live_a' })).toThrow()
  })
})
