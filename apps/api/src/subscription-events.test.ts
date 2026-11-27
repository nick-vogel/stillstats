// Limits: every delivery here is built and signed in the test with Stripe's own test helper, so no
// test reaches a real Stripe delivery or the exact body Stripe sends for a Managed Payments
// subscription. Nick's walk of Pro on production (creator-analytics#791) covers both.
import { randomUUID } from 'node:crypto'
import { subscriptions, type WebDatabase, type WorkerDatabase } from '@creator-analytics/database'
import { type FindJobs, test } from '@creator-analytics/database/testing'
import { entitlementOf } from '@creator-analytics/entitlements'
import { describe, expect } from 'vitest'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'
import {
  checkoutSessionEvent,
  deliverStripeEvent,
  type SubscriptionCheckoutFields,
  stripeSignatureOf,
  subscriptionCheckoutEvent,
  subscriptionCreatedEvent,
  subscriptionDeletedEvent,
  subscriptionUpdatedEvent,
  testBilling,
  testStripe,
} from '../test/stripe.ts'

const owner = { sub: '954729', email: 'subscriber@example.com', name: 'A Subscriber' }

async function ownedChannel(web: WebDatabase, api: StartedApi) {
  const browser = await signIn(api, owner)
  api.google.pickChannel('UC-subscriber')
  await connect(browser)
  const [channel] = (await channelsOf(browser)).channels
  if (!channel) throw new Error('The connect flow connected no channel')
  return { channelId: channel.id, ownerId: await userIdOf(web, owner.email) }
}

async function deliver(api: StartedApi, body: string): Promise<void> {
  const response = await deliverStripeEvent(api, body)
  expect(response.status).toBe(200)
}

/** The channel's subscription row, as its owner's scope reads it. */
function storedSubscription(web: WebDatabase, ownerId: string) {
  return web.asUser(ownerId, (scope) =>
    scope.sql
      .select({
        customer: subscriptions.stripeCustomerId,
        subscription: subscriptions.stripeSubscriptionId,
        plan: subscriptions.plan,
        status: subscriptions.status,
        periodEnd: subscriptions.currentPeriodEnd,
        updatedAt: subscriptions.updatedAt,
      })
      .from(subscriptions),
  )
}

const tierOf = (web: WebDatabase, ownerId: string, channelId: string) =>
  web.asUser(ownerId, async (scope) => (await entitlementOf(scope, channelId)).tier)

describe('seam 1: the Stripe webhook records a subscription', () => {
  test('a completed Checkout makes the channel paid', async ({ web }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId, ownerId } = await ownedChannel(web, api)
    expect(await tierOf(web, ownerId, channelId)).toBe('free')

    await deliver(api, subscriptionCheckoutEvent({ channelId }))

    expect(await tierOf(web, ownerId, channelId)).toBe('paid')
    expect(api.reporter.reports).toEqual([])
  })

  test('a repeated delivery changes nothing', async ({ web, clock }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId, ownerId } = await ownedChannel(web, api)
    const body = subscriptionCheckoutEvent({ channelId })
    await deliver(api, body)
    const first = await storedSubscription(web, ownerId)
    clock.advance(60_000)

    await deliver(api, body)

    expect(await storedSubscription(web, ownerId)).toEqual(first)
  })

  test('a delivery with a bad signature answers 400 and records nothing', async ({ web }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId, ownerId } = await ownedChannel(web, api)
    const body = subscriptionCheckoutEvent({ channelId })

    const response = await deliverStripeEvent(
      api,
      body,
      stripeSignatureOf(body, { secret: 'whsec_someone_else' }),
    )

    expect(response.status).toBe(400)
    expect(await storedSubscription(web, ownerId)).toEqual([])
  })

  test.for([
    ['the completed Checkout first', ['checkout', 'created']],
    ['the created subscription first', ['created', 'checkout']],
  ] as const)(
    'with %s, the channel ends paid with its plan and the end of its paid period',
    async ([, order], { web }) => {
      const api = await startApi(web, { billing: testBilling })
      const { channelId, ownerId } = await ownedChannel(web, api)
      const periodEnd = new Date('2027-11-17T12:00:00.000Z')
      // Stripe creates the subscription before its Checkout completes, so the created event is the
      // older one, whichever order they arrive in.
      const created = new Date('2026-11-17T12:00:00.000Z')
      const completed = new Date('2026-11-17T12:00:02.000Z')
      const bodies = {
        checkout: subscriptionCheckoutEvent({ channelId, plan: 'annual', created: completed }),
        // Stripe can send the created subscription before its first payment has succeeded.
        created: subscriptionCreatedEvent({
          channelId,
          interval: 'year',
          status: 'incomplete',
          periodEnd,
          created,
        }),
      }

      for (const event of order) await deliver(api, bodies[event])

      expect(await storedSubscription(web, ownerId)).toMatchObject([
        {
          customer: 'cus_test_stillstats',
          subscription: 'sub_test_stillstats',
          plan: 'annual',
          status: 'active',
          periodEnd,
        },
      ])
    },
  )

  test('an incomplete subscription with no completed Checkout leaves the channel free', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId, ownerId } = await ownedChannel(web, api)

    await deliver(api, subscriptionCreatedEvent({ channelId, status: 'incomplete' }))

    expect(await storedSubscription(web, ownerId)).toMatchObject([{ status: 'incomplete' }])
    expect(await tierOf(web, ownerId, channelId)).toBe('free')
  })

  test.for<[string, Partial<SubscriptionCheckoutFields>]>([
    ['an unpaid Checkout', { paymentStatus: 'unpaid' }],
    ['a Checkout in payment mode', { mode: 'payment' }],
  ])('%s records nothing', async ([, change], { web }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId, ownerId } = await ownedChannel(web, api)

    await deliver(api, subscriptionCheckoutEvent({ channelId, ...change }))

    expect(await storedSubscription(web, ownerId)).toEqual([])
  })

  test.for([
    [
      'a Checkout with no Stillstats channel in its metadata',
      () => subscriptionCheckoutEvent({ channelId: null }),
    ],
    [
      'a subscription with no Stillstats channel in its metadata',
      () => subscriptionCreatedEvent({ channelId: null }),
    ],
  ] as const)(
    "%s is no Stillstats Checkout's, which records and reports nothing",
    async ([, bodyOf], { web }) => {
      const api = await startApi(web, { billing: testBilling })
      const { ownerId } = await ownedChannel(web, api)

      await deliver(api, bodyOf())

      expect(await storedSubscription(web, ownerId)).toEqual([])
      expect(api.reporter.reports).toEqual([])
    },
  )

  test('a paid Checkout for a channel that no longer exists reports its session ID to GlitchTip', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })

    await deliver(api, subscriptionCheckoutEvent({ channelId: randomUUID(), id: 'cs_test_gone' }))

    expect(api.reporter.reports).toEqual([
      {
        message: 'A paid Stripe subscription names no channel',
        context: { stripeObject: 'cs_test_gone' },
      },
    ])
  })

  test('with the tip set too, a tip and a subscription each record through the one endpoint', async ({
    web,
  }) => {
    const api = await startApi(web, { stripe: testStripe, billing: testBilling })
    const { channelId, ownerId } = await ownedChannel(web, api)

    await deliver(api, checkoutSessionEvent({ clientReferenceId: ownerId }))
    await deliver(api, subscriptionCheckoutEvent({ channelId }))

    expect(await tierOf(web, ownerId, channelId)).toBe('paid')
    const support = await signIn(api, owner).then((browser) => browser.fetch('/api/me/support'))
    expect(await support.json()).toMatchObject({ prompt: false })
  })
})

/**
 * The channel's reporting jobs that `act` leaves queued, as the worker reads them: the connect's
 * own job is queued before it.
 */
async function downloadsSentBy(findJobs: FindJobs, channelId: string, act: () => Promise<void>) {
  const reportingJobs = async () =>
    (await findJobs('ensureReportingJob')).filter((job) => job.data.channelId === channelId)
  const before = await reportingJobs()
  await act()
  return (await reportingJobs()).filter((job) => !before.some((earlier) => earlier.id === job.id))
}

/** The channel is paid already, as an earlier Checkout left it, a month before the events here. */
function seedPaid(
  worker: WorkerDatabase,
  channelId: string,
  {
    status = 'active',
    periodEnd = new Date('2026-12-17T12:00:00.000Z'),
  }: { status?: string; periodEnd?: Date | null } = {},
) {
  return worker.forChannel(channelId, (tx) =>
    tx.sql.insert(subscriptions).values({
      channelId,
      stripeCustomerId: 'cus_test_stillstats',
      stripeSubscriptionId: 'sub_test_stillstats',
      plan: 'monthly',
      status,
      currentPeriodEnd: periodEnd,
      updatedAt: new Date('2026-11-17T12:00:00.000Z'),
    }),
  )
}

// Limits: the test's one transaction holds every job the webhook sends here, so none of them runs.
// The worker's tests run the job, after the day's roster has run too.
describe("seam 1: a subscription that turns its channel paid queues the channel's history download", () => {
  test('the webhook for a paid Checkout leaves the download job queued for the channel', async ({
    web,
    findJobs,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId } = await ownedChannel(web, api)

    const sent = await downloadsSentBy(findJobs, channelId, () =>
      deliver(api, subscriptionCheckoutEvent({ channelId })),
    )

    expect(sent.map((job) => ({ state: job.state, data: job.data }))).toEqual([
      { state: 'created', data: { channelId } },
    ])
  })

  test.for<[string, (channelId: string) => string[]]>([
    [
      'a subscription created active',
      (channelId) => [subscriptionCreatedEvent({ channelId, status: 'active' })],
    ],
    [
      'an incomplete subscription updated to active',
      (channelId) => [
        subscriptionCreatedEvent({
          channelId,
          status: 'incomplete',
          created: new Date('2026-11-17T12:00:00.000Z'),
        }),
        subscriptionUpdatedEvent({
          channelId,
          status: 'active',
          created: new Date('2026-11-17T12:00:05.000Z'),
        }),
      ],
    ],
  ])('%s queues one download', async ([, bodiesOf], { web, findJobs }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId } = await ownedChannel(web, api)

    const sent = await downloadsSentBy(findJobs, channelId, async () => {
      for (const body of bodiesOf(channelId)) await deliver(api, body)
    })

    expect(sent).toHaveLength(1)
  })

  // Stripe does not guarantee the delivery of events in the order they are generated
  // (docs.stripe.com/webhooks, "Event ordering", read 2026-11-22). Here the subscription is created
  // incomplete, its Checkout completes, it is updated to active, and a later update follows, which
  // lands first. It stores the row active, so the row turns paid on it. Each older event then finds
  // a row newer than itself with no plan or period end left to fill, so the row does not change.
  test('the newest event landing first queues the one download, and the older events that made the subscription paid queue none', async ({
    web,
    findJobs,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId, ownerId } = await ownedChannel(web, api)

    const sentByNewest = await downloadsSentBy(findJobs, channelId, () =>
      deliver(
        api,
        subscriptionUpdatedEvent({
          channelId,
          status: 'active',
          created: new Date('2026-11-17T12:00:10.000Z'),
        }),
      ),
    )
    const sentByOlder = await downloadsSentBy(findJobs, channelId, async () => {
      await deliver(
        api,
        subscriptionUpdatedEvent({
          channelId,
          status: 'active',
          created: new Date('2026-11-17T12:00:05.000Z'),
        }),
      )
      await deliver(
        api,
        subscriptionCheckoutEvent({ channelId, created: new Date('2026-11-17T12:00:02.000Z') }),
      )
      await deliver(
        api,
        subscriptionCreatedEvent({
          channelId,
          status: 'incomplete',
          created: new Date('2026-11-17T12:00:00.000Z'),
        }),
      )
    })

    expect(await tierOf(web, ownerId, channelId)).toBe('paid')
    expect(sentByNewest).toHaveLength(1)
    expect(sentByOlder).toEqual([])
  })

  test('a channel that subscribes again after its subscription ended queues one download', async ({
    web,
    worker,
    findJobs,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId, ownerId } = await ownedChannel(web, api)
    await seedPaid(worker, channelId)
    await deliver(
      api,
      subscriptionDeletedEvent({ channelId, endedAt: new Date('2026-11-18T12:00:00.000Z') }),
    )

    const sent = await downloadsSentBy(findJobs, channelId, () =>
      deliver(api, subscriptionCheckoutEvent({ channelId, subscription: 'sub_test_return' })),
    )

    expect(await tierOf(web, ownerId, channelId)).toBe('paid')
    expect(sent).toHaveLength(1)
  })

  // An `unpaid` subscription stays in place, and paying its most recent invoice moves it to `active`
  // (docs.stripe.com/billing/subscriptions/overview, "Subscription statuses", read 2026-11-22).
  test('an ended subscription made active again queues one download', async ({
    web,
    worker,
    findJobs,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId, ownerId } = await ownedChannel(web, api)
    await seedPaid(worker, channelId, { status: 'past_due' })
    await deliver(
      api,
      subscriptionUpdatedEvent({
        channelId,
        status: 'unpaid',
        created: new Date('2026-11-18T12:00:00.000Z'),
      }),
    )
    expect(await tierOf(web, ownerId, channelId)).toBe('free')

    const sent = await downloadsSentBy(findJobs, channelId, () =>
      deliver(
        api,
        subscriptionUpdatedEvent({
          channelId,
          status: 'active',
          created: new Date('2026-11-19T12:00:00.000Z'),
        }),
      ),
    )

    expect(await tierOf(web, ownerId, channelId)).toBe('paid')
    expect(sent).toHaveLength(1)
  })

  // Webhook endpoints can receive the same event more than once (docs.stripe.com/webhooks, "Handle
  // duplicate events", read 2026-11-22), and Stripe creates the subscription before its Checkout
  // completes, so the created event is the older one.
  test('a Checkout, its created subscription and the Checkout delivered again queue one download between them', async ({
    web,
    findJobs,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId } = await ownedChannel(web, api)
    const checkout = subscriptionCheckoutEvent({
      channelId,
      created: new Date('2026-11-17T12:00:02.000Z'),
    })

    const sent = await downloadsSentBy(findJobs, channelId, async () => {
      await deliver(api, checkout)
      await deliver(
        api,
        subscriptionCreatedEvent({
          channelId,
          status: 'active',
          created: new Date('2026-11-17T12:00:00.000Z'),
        }),
      )
      await deliver(api, checkout)
    })

    expect(sent).toHaveLength(1)
  })

  // A paid Checkout carries no period end, so the row it leaves holds none until the created
  // subscription lands. Stripe retries a failed delivery for up to three days in live mode
  // (docs.stripe.com/webhooks, "Automatic retries", read 2026-11-22), so the created event can land
  // long after the Checkout's download went out, in a later throttle slot; the seeded row stands in
  // for that Checkout, whose own job is not queued here.
  test('an older event that only fills the period end of a paid channel queues no download', async ({
    web,
    worker,
    findJobs,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId, ownerId } = await ownedChannel(web, api)
    await seedPaid(worker, channelId, { periodEnd: null })
    const periodEnd = new Date('2026-12-17T12:00:00.000Z')

    const sent = await downloadsSentBy(findJobs, channelId, () =>
      deliver(
        api,
        subscriptionCreatedEvent({
          channelId,
          status: 'active',
          periodEnd,
          created: new Date('2026-11-17T11:59:58.000Z'),
        }),
      ),
    )

    expect(await storedSubscription(web, ownerId)).toMatchObject([{ status: 'active', periodEnd }])
    expect(sent).toEqual([])
  })

  // Each event changes the stored subscription, so it is the event, not a repeat, that sends none.
  test.for<[string, string, (channelId: string) => string]>([
    [
      'a renewal',
      'active',
      (channelId) =>
        subscriptionUpdatedEvent({
          channelId,
          periodEnd: new Date('2027-01-17T12:00:00.000Z'),
        }),
    ],
    [
      'a switch to the annual plan',
      'active',
      (channelId) =>
        subscriptionUpdatedEvent({
          channelId,
          interval: 'year',
          periodEnd: new Date('2027-11-17T12:00:00.000Z'),
        }),
    ],
    [
      'a paid retry that makes a past due subscription active again',
      'past_due',
      (channelId) =>
        subscriptionUpdatedEvent({
          channelId,
          status: 'active',
        }),
    ],
    [
      'an end once retries are exhausted',
      'past_due',
      (channelId) =>
        subscriptionUpdatedEvent({
          channelId,
          status: 'unpaid',
        }),
    ],
    [
      'a cancel',
      'active',
      (channelId) =>
        subscriptionDeletedEvent({ channelId, endedAt: new Date('2026-11-18T12:00:00.000Z') }),
    ],
  ])(
    '%s of a channel already paid queues no download',
    async ([, status, bodyOf], { web, worker, findJobs }) => {
      const api = await startApi(web, { billing: testBilling })
      const { channelId, ownerId } = await ownedChannel(web, api)
      await seedPaid(worker, channelId, { status })
      const stored = await storedSubscription(web, ownerId)

      const sent = await downloadsSentBy(findJobs, channelId, () => deliver(api, bodyOf(channelId)))

      expect(await storedSubscription(web, ownerId)).not.toEqual(stored)
      expect(sent).toEqual([])
    },
  )
})
