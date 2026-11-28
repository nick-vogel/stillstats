// Limits: these run the account deletion's cancellation job against the fake Stripe server, so they
// show which calls the canceller makes and what it does with Stripe's answers. They cannot prove
// that Stripe accepts the parameters, that Managed Payments lets Stillstats refund its customer,
// the exchange rate a refund of a payment in another currency takes, or that the customer is told:
// Nick's walk of Pro on production (creator-analytics#791) covers those. pg-boss
// spacing the retries an hour apart is the queue's options, which `jobs.test.ts` reads back; here
// each retry is a handler run on a clock the test moves.
import { randomUUID } from 'node:crypto'
import {
  accountCancellations,
  type DeletionReason,
  type Scoped,
  type ScopeKind,
  subscriptionCancellations,
  userSubscriptions,
  type WebDatabase,
  type WorkerDatabase,
} from '@creator-analytics/database'
import {
  test as databaseTest,
  type FindJobs,
  seedChannel,
  subscribeOwner,
  type TestClock,
} from '@creator-analytics/database/testing'
import { requestAccountCancellation } from '@creator-analytics/entitlements'
import { type FakeStripe, startFakeStripe } from '@creator-analytics/fake-stripe'
import { type RecordingReporter, recordingReporter } from '@creator-analytics/reporter'
import { describe, expect } from 'vitest'
import {
  accountCancellationJobData,
  createRetention,
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
 * An owner on Pro ten days into their 30-day period, paid $7.00, whose one channel is picked: the
 * owner's subscription is active, and the fake Stripe server holds it, its latest invoice and its
 * PaymentIntent. Both clocks read ten days in.
 */
async function paidOwner({ web, worker, clock, stripe }: Scene, owner: string) {
  const channelId = await seedChannel(web, worker, owner)
  clock.set(tenDaysIn)
  stripe.setNow(tenDaysIn)
  await subscribeOwner(web, worker, channelId)
  const { paymentIntent } = stripe.addSubscription({
    id: `sub_${channelId}`,
    customer: `cus_${owner}`,
    periodStart,
    periodEnd,
    amountPaid: 700,
  })
  return { channelId, paymentIntent }
}

/** What the account deletion pends, in the owner's scope, and the cancellation jobs it sends. */
async function accountDeleted({ web, findJobs }: Scene, owner: string) {
  const pended = await web.asUser(owner, (tx) => requestAccountCancellation(tx))
  const jobs = await findJobs('cancelAccountSubscription')
  return {
    cancellationId: pended?.cancellationId,
    cancellationJobs: jobs.map((job) =>
      accountCancellationJobData('cancelAccountSubscription', job.data),
    ),
  }
}

function runCancellation({ worker, retention }: Scene, data: { cancellationId: string }) {
  return worker.asSystem((tx) => retention.cancelAccountSubscription(tx, data))
}

function pendingCancellations({ worker }: Scene) {
  return worker.asSystem((tx) => tx.sql.select().from(accountCancellations))
}

/** A channel deletion, which cancels nothing, and the cancellation jobs it sends. */
async function channelDeleted(
  { worker, retention, findJobs }: Scene,
  channelId: string,
  reason: DeletionReason,
) {
  const { requestId } = await worker.forChannel(channelId, (tx) =>
    requestDeletion(tx, channelId, reason),
  )
  await worker.forChannel(channelId, (tx) => retention.deleteChannel(tx, { requestId, channelId }))
  return [
    ...(await findJobs('cancelSubscription')),
    ...(await findJobs('cancelAccountSubscription')),
  ]
}

// 700 x 20 of 30 days, 466.67 rounded to the cent.
const unusedTwentyDays = '467'

describe('seam 2: an account deletion cancels its subscription, and a channel deletion cancels nothing', () => {
  test('an account deletion cancels its subscription at once and refunds the unused part of the period', async ({
    web,
    worker,
    clock,
    stripe,
    retention,
    findJobs,
  }) => {
    const scene = { web, worker, clock, stripe, retention, findJobs }
    const { channelId, paymentIntent } = await paidOwner(scene, 'cancel-owner')

    const { cancellationId, cancellationJobs } = await accountDeleted(scene, 'cancel-owner')
    for (const data of cancellationJobs) await runCancellation(scene, data)

    expect(cancellationJobs).toEqual([{ cancellationId }])
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
    expect(await pendingCancellations(scene)).toEqual([])
  })

  for (const [reason, cause] of [
    ['google_revocation', 'a revocation'],
    ['in_app_revocation', 'a disconnect'],
  ] as const) {
    test(`${cause} of a paid channel cancels nothing, makes no Stripe call, and leaves the subscription running`, async ({
      web,
      worker,
      clock,
      stripe,
      retention,
      findJobs,
    }) => {
      const scene = { web, worker, clock, stripe, retention, findJobs }
      const { channelId } = await paidOwner(scene, 'cancel-owner')
      const requestsBefore = stripe.requests.length

      const jobs = await channelDeleted(scene, channelId, reason)

      expect(jobs).toEqual([])
      expect(stripe.requests).toHaveLength(requestsBefore)
      expect(
        await web.asUser('cancel-owner', (tx) =>
          tx.sql.select({ status: userSubscriptions.status }).from(userSubscriptions),
        ),
      ).toEqual([{ status: 'active' }])
    })
  }

  test('a user with no live subscription pends no cancellation, and its deletion makes no Stripe call', async ({
    web,
    worker,
    clock,
    stripe,
    retention,
    findJobs,
  }) => {
    const scene = { web, worker, clock, stripe, retention, findJobs }
    // The seeded owner's subscription is canceled, as every free user's that once paid is.
    await seedChannel(web, worker, 'cancel-owner')

    const { cancellationId, cancellationJobs } = await accountDeleted(scene, 'cancel-owner')

    expect(cancellationId).toBeUndefined()
    expect(cancellationJobs).toEqual([])
    expect(await pendingCancellations(scene)).toEqual([])
    expect(stripe.requests).toEqual([])
  })

  test('a Stripe outage retries the cancellation, and raises the alarm at 12 hours; the first run after it ends cancels and refunds once', async ({
    web,
    worker,
    clock,
    stripe,
    retention,
    findJobs,
    reporter,
  }) => {
    const scene = { web, worker, clock, stripe, retention, findJobs }
    await paidOwner(scene, 'cancel-owner')
    stripe.failAll(503)

    const { cancellationId = '', cancellationJobs } = await accountDeleted(scene, 'cancel-owner')
    const data = { cancellationId }
    expect(cancellationJobs).toEqual([data])
    for (let run = 0; run < 12; run += 1) {
      await expect(runCancellation(scene, data)).rejects.toThrow()
      clock.advance(hourMs)
    }
    expect(await pendingCancellations(scene)).toHaveLength(1)
    const [alarm] = await findJobs('accountCancellationAlarm')
    expect(alarm?.data).toEqual(data)
    expect(alarm?.startAfter).toEqual(new Date(tenDaysIn.getTime() + 12 * hourMs))
    clock.set(alarm?.startAfter ?? new Date(0))

    await worker.asSystem((tx) => retention.accountCancellationAlarm(tx, data))

    expect(reporter.reports).toEqual([
      {
        message: 'A subscription cancellation is still pending 12 hours after its account deletion',
        context: { cancellationId },
      },
    ])

    stripe.failAll(null)
    stripe.setNow(clock.now())
    await runCancellation(scene, data)
    await worker.asSystem((tx) => retention.accountCancellationAlarm(tx, data))

    expect(stripe.cancellations).toHaveLength(1)
    // 700 x 19.5 of 30 days, exactly 455: the subscription ended in Stripe 12 hours after the
    // deletion.
    expect(stripe.refunds.map((body) => body.get('amount'))).toEqual(['455'])
    expect(await pendingCancellations(scene)).toEqual([])
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
    await paidOwner(scene, 'cancel-owner')
    stripe.failRefunds(503)
    const { cancellationId = '' } = await accountDeleted(scene, 'cancel-owner')
    const data = { cancellationId }

    await expect(runCancellation(scene, data)).rejects.toThrow()
    stripe.failRefunds(null)
    await runCancellation(scene, data)

    expect(stripe.cancellations).toHaveLength(1)
    expect(stripe.refunds.map((body) => body.get('amount'))).toEqual([unusedTwentyDays])
    expect(await pendingCancellations(scene)).toEqual([])
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
    await paidOwner(scene, 'cancel-owner')
    const { cancellationId = '' } = await accountDeleted(scene, 'cancel-owner')
    const data = { cancellationId }

    const running = worker.asSystem((tx) => retention.cancelAccountSubscription(tx, data))

    await expect(running).rejects.toThrow('Stripe is not configured')
    expect(await pendingCancellations(scene)).toHaveLength(1)
    await worker.asSystem((tx) => retention.accountCancellationAlarm(tx, data))
    expect(reporter.reports.map(({ message }) => message)).toEqual([
      'A subscription cancellation is still pending 12 hours after its account deletion',
    ])
  })

  test('only the system scope reads a pending account cancellation, and a user pends only their own subscription', async ({
    web,
    worker,
    clock,
    stripe,
    retention,
    findJobs,
  }) => {
    const scene = { web, worker, clock, stripe, retention, findJobs }
    const { channelId } = await paidOwner(scene, 'cancel-owner')
    await seedChannel(web, worker, 'cancel-stranger')
    await accountDeleted(scene, 'cancel-owner')
    const read = (scope: Scoped<ScopeKind>) => scope.sql.select().from(accountCancellations)
    const pendOthers = (scope: Scoped<ScopeKind>) =>
      scope.sql
        .transaction((attempt) =>
          attempt.insert(accountCancellations).values({
            id: randomUUID(),
            stripeSubscriptionId: `sub_${channelId}`,
            createdAt: scope.now,
          }),
        )
        .then(
          () => undefined,
          (error: unknown) => error,
        )

    expect(await worker.asSystem(read)).toHaveLength(1)
    expect(await worker.forChannel(channelId, read)).toEqual([])
    expect(await web.asUser('cancel-owner', read)).toEqual([])
    expect(await web.asAnonymous(read)).toEqual([])
    expect(await web.asUser('cancel-stranger', pendOthers)).toMatchObject({
      cause: {
        message: 'new row violates row-level security policy for table "account_cancellations"',
      },
    })
  })

  test('a channel cancellation an old worker left pending is still cancelled and refunded, with its channel in the refund', async ({
    web,
    worker,
    clock,
    stripe,
    retention,
  }) => {
    const { channelId, paymentIntent } = await paidOwner(
      { web, worker, clock, stripe, retention, findJobs: async () => [] },
      'cancel-owner',
    )
    const requestId = randomUUID()
    await worker.forChannel(channelId, (tx) =>
      tx.sql.insert(subscriptionCancellations).values({
        channelId,
        deletionRequestId: requestId,
        stripeSubscriptionId: `sub_${channelId}`,
        createdAt: tx.now,
      }),
    )

    await worker.forChannel(channelId, (tx) =>
      retention.cancelSubscription(tx, { requestId, channelId }),
    )

    expect(stripe.cancellations).toHaveLength(1)
    expect(stripe.refunds.map((body) => Object.fromEntries(body))).toEqual([
      expect.objectContaining({
        payment_intent: paymentIntent,
        'metadata[stillstats_channel_id]': channelId,
      }),
    ])
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
