// Limits: every delivery here is built and signed in the test with Stripe's own test helper, in the
// shape docs.stripe.com gives each event, so no test reaches a real delivery, the order Stripe
// sends them in, or what the Customer Portal and link.com change on a Managed Payments
// subscription. Nick's walk of Pro on production (creator-analytics#791) covers those.
import { randomUUID } from 'node:crypto'
import { subscriptions, type WebDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import { entitlementOf } from '@creator-analytics/entitlements'
import { describe, expect } from 'vitest'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'
import {
  deliverStripeEvent,
  invoiceEvent,
  subscriptionCheckoutEvent,
  subscriptionCreatedEvent,
  subscriptionDeletedEvent,
  subscriptionUpdatedEvent,
  testBilling,
} from '../test/stripe.ts'

const owner = { sub: '964729', email: 'subscription-changes@example.com', name: 'A Subscriber' }

// The scope's clock, which the purge date is read against.
const now = new Date('2026-11-17T12:00:00.000Z')
// The paid period's end, which a cancellation at period end waits for.
const periodEnd = new Date('2026-12-01T12:00:00.000Z')
// When Stripe created the paid channel's Checkout and subscription events, before every later one.
const subscribedAt = new Date('2026-11-01T12:00:00.000Z')
const day = 24 * 60 * 60 * 1000

async function ownedChannel(web: WebDatabase, api: StartedApi) {
  const browser = await signIn(api, owner)
  api.google.pickChannel('UC-subscription-changes')
  await connect(browser)
  const [channel] = (await channelsOf(browser)).channels
  if (!channel) throw new Error('The connect flow connected no channel')
  return { channelId: channel.id, ownerId: await userIdOf(web, owner.email) }
}

async function deliver(api: StartedApi, body: string): Promise<void> {
  const response = await deliverStripeEvent(api, body)
  expect(response.status).toBe(200)
}

/** A channel paid for through a completed Checkout and its created subscription. */
async function paidChannel(web: WebDatabase) {
  const api = await startApi(web, { billing: testBilling })
  const channel = await ownedChannel(web, api)
  await deliver(
    api,
    subscriptionCheckoutEvent({ channelId: channel.channelId, created: subscribedAt }),
  )
  await deliver(
    api,
    subscriptionCreatedEvent({ channelId: channel.channelId, periodEnd, created: subscribedAt }),
  )
  return { api, ...channel }
}

/** The channel's Entitlement, as its owner's scope reads it at the pinned clock. */
const entitlementIn = (web: WebDatabase, ownerId: string, channelId: string) =>
  web.asUser(ownerId, (scope) => entitlementOf(scope, channelId))

/** The channel's subscription row, as its owner's scope reads it. */
function storedSubscription(web: WebDatabase, ownerId: string) {
  return web.asUser(ownerId, (scope) =>
    scope.sql
      .select({
        subscription: subscriptions.stripeSubscriptionId,
        plan: subscriptions.plan,
        status: subscriptions.status,
        periodEnd: subscriptions.currentPeriodEnd,
        purgeAfter: subscriptions.purgeAfter,
        updatedAt: subscriptions.updatedAt,
      })
      .from(subscriptions),
  )
}

const paid = { tier: 'paid', purgeDate: null }

describe('seam 1: the webhook reads the changes to a subscription', () => {
  test('a cancellation at the end of the paid period keeps the channel paid, with no purge date', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)

    await deliver(
      api,
      subscriptionUpdatedEvent({ channelId, status: 'active', cancelAtPeriodEnd: true, periodEnd }),
    )

    expect(await entitlementIn(web, ownerId, channelId)).toEqual(paid)
    expect(api.reporter.reports).toEqual([])
  })

  test('the deletion ends it: the channel is free, with its purge date 30 days after the subscription ended', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    const endedAt = new Date('2026-11-17T10:00:00.000Z')

    await deliver(
      api,
      subscriptionDeletedEvent({
        channelId,
        endedAt,
        // The press of Cancel, which starts nothing: the 30 days run from the end (ADR 0022).
        canceledAt: new Date('2026-11-01T09:00:00.000Z'),
      }),
    )

    expect(await entitlementIn(web, ownerId, channelId)).toEqual({
      tier: 'free',
      purgeDate: new Date('2026-12-17T10:00:00.000Z'),
    })
    expect(await storedSubscription(web, ownerId)).toMatchObject([{ status: 'canceled' }])
  })

  test("a deletion that carries no ended_at starts the 30 days at the event's own time", async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    const created = new Date('2026-11-17T11:00:00.000Z')

    await deliver(api, subscriptionDeletedEvent({ channelId, endedAt: null, created }))

    expect((await entitlementIn(web, ownerId, channelId)).purgeDate).toEqual(
      new Date(created.getTime() + 30 * day),
    )
  })

  test('a subscription Stripe marks unpaid after its retries ends the channel, with its purge date', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    const created = new Date('2026-11-17T11:00:00.000Z')

    await deliver(api, subscriptionUpdatedEvent({ channelId, status: 'unpaid', created }))

    expect(await entitlementIn(web, ownerId, channelId)).toEqual({
      tier: 'free',
      purgeDate: new Date(created.getTime() + 30 * day),
    })
  })

  test('a failed invoice changes nothing, and the past due subscription of its retries keeps the channel paid', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    const before = await storedSubscription(web, ownerId)
    clock.advance(60_000)

    await deliver(api, invoiceEvent('invoice.payment_failed', { channelId }))

    expect(await storedSubscription(web, ownerId)).toEqual(before)
    expect(await entitlementIn(web, ownerId, channelId)).toEqual(paid)

    await deliver(api, subscriptionUpdatedEvent({ channelId, status: 'past_due', periodEnd }))

    expect(await entitlementIn(web, ownerId, channelId)).toEqual(paid)
    expect(api.reporter.reports).toEqual([])
  })

  test('a paid invoice changes nothing', async ({ web, clock }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    const before = await storedSubscription(web, ownerId)
    clock.advance(60_000)

    await deliver(api, invoiceEvent('invoice.paid', { channelId }))

    expect(await storedSubscription(web, ownerId)).toEqual(before)
  })

  test('a switch to the annual plan keeps the channel paid, with the annual plan and its period end', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    const annualEnd = new Date('2027-11-17T12:00:00.000Z')

    await deliver(
      api,
      subscriptionUpdatedEvent({
        channelId,
        interval: 'year',
        periodEnd: annualEnd,
      }),
    )

    expect(await entitlementIn(web, ownerId, channelId)).toEqual(paid)
    expect(await storedSubscription(web, ownerId)).toMatchObject([
      { plan: 'annual', status: 'active', periodEnd: annualEnd },
    ])
  })

  test.for([
    [
      'a cancellation at period end',
      (channelId: string) =>
        subscriptionUpdatedEvent({ channelId, cancelAtPeriodEnd: true, periodEnd }),
    ],
    [
      'a deletion',
      (channelId: string) =>
        subscriptionDeletedEvent({ channelId, endedAt: new Date('2026-11-17T10:00:00.000Z') }),
    ],
    [
      'a failed invoice',
      (channelId: string) => invoiceEvent('invoice.payment_failed', { channelId }),
    ],
    [
      'a plan switch',
      (channelId: string) => subscriptionUpdatedEvent({ channelId, interval: 'year' }),
    ],
  ] as const)(
    '%s delivered twice answers 200 both times and changes nothing the second time',
    async ([, bodyOf], { web, clock }) => {
      clock.set(now)
      const { api, channelId, ownerId } = await paidChannel(web)
      const body = bodyOf(channelId)
      await deliver(api, body)
      const first = await storedSubscription(web, ownerId)
      clock.advance(60_000)

      await deliver(api, body)

      expect(await storedSubscription(web, ownerId)).toEqual(first)
    },
  )

  test('an update delivered after the deletion leaves the channel ended', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    await deliver(
      api,
      subscriptionDeletedEvent({ channelId, endedAt: new Date('2026-11-17T10:00:00.000Z') }),
    )
    const ended = await entitlementIn(web, ownerId, channelId)

    await deliver(api, subscriptionUpdatedEvent({ channelId, status: 'active', periodEnd }))

    expect(await entitlementIn(web, ownerId, channelId)).toEqual(ended)
    expect(ended.tier).toBe('free')
  })

  test('an unpaid update Stripe delivers again after a later active one leaves the channel paid, with no purge date', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    // The unpaid update's first delivery failed, the owner then paid, and Stripe retries it.
    const unpaid = subscriptionUpdatedEvent({
      channelId,
      status: 'unpaid',
      created: new Date('2026-11-10T12:00:00.000Z'),
    })
    await deliver(
      api,
      subscriptionUpdatedEvent({
        channelId,
        status: 'active',
        periodEnd,
        created: new Date('2026-11-12T12:00:00.000Z'),
      }),
    )

    await deliver(api, unpaid)

    expect(await entitlementIn(web, ownerId, channelId)).toEqual(paid)
    expect(await storedSubscription(web, ownerId)).toMatchObject([
      { status: 'active', purgeAfter: null },
    ])
  })

  test('a monthly update Stripe delivers again after the switch to annual keeps the annual plan and its period end', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    const annualEnd = new Date('2027-11-12T12:00:00.000Z')
    const monthly = subscriptionUpdatedEvent({
      channelId,
      periodEnd,
      created: new Date('2026-11-10T12:00:00.000Z'),
    })
    await deliver(
      api,
      subscriptionUpdatedEvent({
        channelId,
        interval: 'year',
        periodEnd: annualEnd,
        created: new Date('2026-11-12T12:00:00.000Z'),
      }),
    )

    await deliver(api, monthly)

    expect(await storedSubscription(web, ownerId)).toMatchObject([
      { plan: 'annual', status: 'active', periodEnd: annualEnd },
    ])
  })

  test('a new Checkout for an ended channel makes it paid again and clears its purge date', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    await deliver(
      api,
      subscriptionDeletedEvent({ channelId, endedAt: new Date('2026-11-17T10:00:00.000Z') }),
    )

    await deliver(
      api,
      subscriptionCheckoutEvent({ channelId, id: 'cs_test_again', subscription: 'sub_test_again' }),
    )

    expect(await entitlementIn(web, ownerId, channelId)).toEqual(paid)
    expect(await storedSubscription(web, ownerId)).toMatchObject([
      { subscription: 'sub_test_again', status: 'active', purgeAfter: null },
    ])
  })

  test("an old subscription's update Stripe delivers again never takes back a channel whose new subscription is not paid yet", async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    // The update's first delivery failed before the deletion, and Stripe retries it after the
    // owner has subscribed again.
    const late = subscriptionUpdatedEvent({
      channelId,
      status: 'active',
      periodEnd,
      created: new Date('2026-11-05T12:00:00.000Z'),
    })
    await deliver(
      api,
      subscriptionDeletedEvent({
        channelId,
        endedAt: new Date('2026-11-10T12:00:00.000Z'),
        created: new Date('2026-11-10T12:00:00.000Z'),
      }),
    )
    const again = { subscription: 'sub_test_again', created: new Date('2026-11-12T12:00:00.000Z') }
    await deliver(api, subscriptionCreatedEvent({ channelId, status: 'incomplete', ...again }))

    await deliver(api, late)
    await deliver(api, subscriptionCheckoutEvent({ channelId, id: 'cs_test_again', ...again }))

    expect(await entitlementIn(web, ownerId, channelId)).toEqual(paid)
    expect(await storedSubscription(web, ownerId)).toMatchObject([
      { subscription: 'sub_test_again', status: 'active', purgeAfter: null },
    ])
  })

  test('a deletion for a channel that no longer exists reports nothing, as a channel deletion cancels its subscription', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })

    await deliver(api, subscriptionDeletedEvent({ channelId: randomUUID(), endedAt: new Date() }))

    expect(api.reporter.reports).toEqual([])
  })

  test('an update for a channel that no longer exists still reports its subscription ID', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })

    await deliver(
      api,
      subscriptionUpdatedEvent({ channelId: randomUUID(), subscription: 'sub_test_gone' }),
    )

    expect(api.reporter.reports).toEqual([
      {
        message: 'A paid Stripe subscription names no channel',
        context: { stripeObject: 'sub_test_gone' },
      },
    ])
  })

  test('a second paid Checkout for a paid channel records nothing and reports its session ID to GlitchTip', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    const before = await storedSubscription(web, ownerId)

    await deliver(
      api,
      subscriptionCheckoutEvent({
        channelId,
        id: 'cs_test_second',
        subscription: 'sub_test_second',
        created: now,
      }),
    )

    expect(await storedSubscription(web, ownerId)).toEqual(before)
    expect(api.reporter.reports).toEqual([
      {
        message: 'A second Stripe subscription names a paid channel',
        context: { stripeObject: 'cs_test_second' },
      },
    ])
  })

  test("another subscription's deletion for a paid channel records and reports nothing", async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    const before = await storedSubscription(web, ownerId)

    await deliver(
      api,
      subscriptionDeletedEvent({
        channelId,
        subscription: 'sub_test_second',
        endedAt: now,
        created: now,
      }),
    )

    expect(await storedSubscription(web, ownerId)).toEqual(before)
    expect(api.reporter.reports).toEqual([])
  })

  test.for([
    [
      'an update with no Stillstats channel in its metadata',
      () => subscriptionUpdatedEvent({ channelId: null, status: 'unpaid' }),
    ],
    [
      'a deletion with no Stillstats channel in its metadata',
      () => subscriptionDeletedEvent({ channelId: null, endedAt: new Date() }),
    ],
  ] as const)('%s records and reports nothing', async ([, bodyOf], { web, clock }) => {
    clock.set(now)
    const { api, ownerId } = await paidChannel(web)
    const before = await storedSubscription(web, ownerId)
    clock.advance(60_000)

    await deliver(api, bodyOf())

    expect(await storedSubscription(web, ownerId)).toEqual(before)
    expect(api.reporter.reports).toEqual([])
  })
})
