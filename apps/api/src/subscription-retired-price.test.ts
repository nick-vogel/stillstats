// Limits: every delivery here is built and signed in the test with Stripe's own test helper, in the
// shape docs.stripe.com gives the Subscription and Invoice objects at API version
// 2026-10-28.endive, so no test reaches a real delivery for a subscription on an archived price.
// The staging sandbox's subscription on the archived annual price (creator-analytics#813) is that
// case on a real Stripe account.
import { randomUUID } from 'node:crypto'
import {
  proEnds,
  subscriptionPayments,
  subscriptions,
  type WebDatabase,
} from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import { entitlementOf } from '@creator-analytics/entitlements'
import { type FakeOpenPanel, startFakeOpenPanel } from '@creator-analytics/event-relay/testing'
import { eq } from 'drizzle-orm'
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

const owner = { sub: '984729', email: 'retired-price@example.com', name: 'A Subscriber' }

// The prices Checkout sold before a change of price, which the test API's settings no longer name:
// the annual one is the staging sandbox's archived annual price.
const retired = {
  monthly: 'price_test_retired_monthly',
  annual: 'price_1UdBTIPZKOZvFgcb7YQfgoRq',
} as const
const now = new Date('2026-11-18T12:00:00.000Z')
const subscribedAt = new Date('2026-11-01T12:00:00.000Z')
const periodEnd = new Date('2026-12-01T12:00:00.000Z')
const day = 24 * 60 * 60 * 1000

async function ownedChannel(web: WebDatabase, openPanel?: FakeOpenPanel) {
  const api = await startApi(web, { billing: testBilling, ...(openPanel && { openPanel }) })
  const browser = await signIn(api, owner)
  api.google.pickChannel('UC-retired-price')
  await connect(browser)
  const [channel] = (await channelsOf(browser)).channels
  if (!channel) throw new Error('The connect flow connected no channel')
  return { api, channelId: channel.id, ownerId: await userIdOf(web, owner.email) }
}

async function deliver(api: StartedApi, body: string): Promise<void> {
  const response = await deliverStripeEvent(api, body)
  expect(response.status).toBe(200)
}

/** A channel paid for through Checkout at the retired monthly price, before the change of price. */
async function paidChannel(web: WebDatabase, openPanel?: FakeOpenPanel) {
  const channel = await ownedChannel(web, openPanel)
  await deliver(
    channel.api,
    subscriptionCheckoutEvent({ channelId: channel.channelId, created: subscribedAt }),
  )
  await deliver(
    channel.api,
    subscriptionCreatedEvent({
      channelId: channel.channelId,
      price: retired.monthly,
      periodEnd,
      created: subscribedAt,
    }),
  )
  return channel
}

function storedSubscription(web: WebDatabase, ownerId: string) {
  return web.asUser(ownerId, (scope) =>
    scope.sql
      .select({
        subscription: subscriptions.stripeSubscriptionId,
        plan: subscriptions.plan,
        status: subscriptions.status,
        periodEnd: subscriptions.currentPeriodEnd,
        purgeAfter: proEnds.purgeAfter,
      })
      .from(subscriptions)
      .leftJoin(proEnds, eq(proEnds.channelId, subscriptions.channelId)),
  )
}

function storedPayments(web: WebDatabase, ownerId: string) {
  return web.asUser(ownerId, (scope) =>
    scope.sql.select({ invoice: subscriptionPayments.stripeInvoiceId }).from(subscriptionPayments),
  )
}

const entitlementIn = (web: WebDatabase, ownerId: string, channelId: string) =>
  web.asUser(ownerId, (scope) => entitlementOf(scope, channelId))

const revenueOf = (amount: number) => ({
  method: 'POST',
  path: '/track',
  headers: expect.any(Object),
  body: {
    type: 'track',
    payload: { name: 'revenue', properties: { __revenue: amount, currency: 'usd' } },
  },
})

describe('seam 1: a subscription at a price Checkout no longer sells keeps its events recorded', () => {
  test.for([
    ['monthly', 'month', retired.monthly],
    ['annual', 'year', retired.annual],
  ] as const)(
    'a created subscription at the retired %s price records its plan from its billing interval',
    async ([plan, interval, price], { web, clock }) => {
      clock.set(now)
      const { api, channelId, ownerId } = await ownedChannel(web)
      const end = new Date('2027-11-18T12:00:00.000Z')

      await deliver(api, subscriptionCheckoutEvent({ channelId, plan }))
      await deliver(api, subscriptionCreatedEvent({ channelId, interval, price, periodEnd: end }))

      expect(await storedSubscription(web, ownerId)).toMatchObject([
        { subscription: 'sub_test_stillstats', plan, status: 'active', periodEnd: end },
      ])
      expect(await entitlementIn(web, ownerId, channelId)).toMatchObject({ tier: 'paid' })
      expect(api.reporter.reports).toEqual([])
    },
  )

  test('a plan switch between retired prices records the annual plan and its period end', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    const annualEnd = new Date('2027-11-18T12:00:00.000Z')

    await deliver(
      api,
      subscriptionUpdatedEvent({
        channelId,
        interval: 'year',
        price: retired.annual,
        periodEnd: annualEnd,
      }),
    )

    expect(await storedSubscription(web, ownerId)).toMatchObject([
      { plan: 'annual', status: 'active', periodEnd: annualEnd },
    ])
  })

  test('a past due update at the retired price records its status and keeps the channel paid', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)

    await deliver(
      api,
      subscriptionUpdatedEvent({ channelId, price: retired.monthly, status: 'past_due' }),
    )

    expect(await storedSubscription(web, ownerId)).toMatchObject([
      { plan: 'monthly', status: 'past_due' },
    ])
    expect(await entitlementIn(web, ownerId, channelId)).toEqual({ tier: 'paid', purgeDate: null })
  })

  test('the deletion of a subscription at the retired price ends the channel, with its purge date', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    const endedAt = new Date('2026-11-18T10:00:00.000Z')

    await deliver(api, subscriptionDeletedEvent({ channelId, price: retired.monthly, endedAt }))

    expect(await storedSubscription(web, ownerId)).toMatchObject([{ status: 'canceled' }])
    expect(await entitlementIn(web, ownerId, channelId)).toEqual({
      tier: 'free',
      purgeDate: new Date(endedAt.getTime() + 30 * day),
    })
  })

  test('a paid invoice at the retired price records the payment and sends its revenue once', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const openPanel = await startFakeOpenPanel()
    const { api, channelId, ownerId } = await paidChannel(web, openPanel)
    const body = invoiceEvent('invoice.paid', {
      channelId,
      id: 'in_test_retired',
      price: retired.monthly,
      billingReason: 'subscription_cycle',
      totalExcludingTax: 700,
    })

    await deliver(api, body)
    await deliver(api, body)

    expect(await storedPayments(web, ownerId)).toEqual([{ invoice: 'in_test_retired' }])
    expect(openPanel.received).toEqual([revenueOf(700)])
    expect(api.reporter.reports).toEqual([])
  })

  test.for([
    ['week', { interval: 'week' }],
    ['three months', { interval: 'month', intervalCount: 3 }],
  ] as const)(
    'a Stillstats subscription billed every %s still records its status and purge date, keeps its stored plan, and reports its ID to GlitchTip',
    async ([, billing], { web, clock }) => {
      clock.set(now)
      const { api, channelId, ownerId } = await paidChannel(web)
      const created = new Date('2026-11-18T11:00:00.000Z')

      await deliver(
        api,
        subscriptionUpdatedEvent({ channelId, status: 'unpaid', created, ...billing }),
      )

      expect(await storedSubscription(web, ownerId)).toMatchObject([
        { plan: 'monthly', status: 'unpaid' },
      ])
      expect(await entitlementIn(web, ownerId, channelId)).toEqual({
        tier: 'free',
        purgeDate: new Date(created.getTime() + 30 * day),
      })
      expect(api.reporter.reports).toEqual([
        {
          message: 'A Stillstats Stripe subscription bills neither monthly nor annually',
          context: { stripeObject: 'sub_test_stillstats' },
        },
      ])
    },
  )

  test('the deletion of a Stillstats subscription billed every week ends the channel, with its purge date', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    const endedAt = new Date('2026-11-18T10:00:00.000Z')

    await deliver(api, subscriptionDeletedEvent({ channelId, interval: 'week', endedAt }))

    expect(await storedSubscription(web, ownerId)).toMatchObject([
      { plan: 'monthly', status: 'canceled' },
    ])
    expect(await entitlementIn(web, ownerId, channelId)).toEqual({
      tier: 'free',
      purgeDate: new Date(endedAt.getTime() + 30 * day),
    })
  })

  test('the deletion of a subscription billed every week, for a channel that no longer exists, reports nothing', async ({
    web,
  }) => {
    const { api } = await ownedChannel(web)

    await deliver(
      api,
      subscriptionDeletedEvent({ channelId: randomUUID(), interval: 'week', endedAt: now }),
    )

    expect(api.reporter.reports).toEqual([])
  })

  test('a Stillstats subscription with no item records nothing and reports its ID to GlitchTip', async ({
    web,
    clock,
  }) => {
    clock.set(now)
    const { api, channelId, ownerId } = await paidChannel(web)
    const before = await storedSubscription(web, ownerId)

    await deliver(
      api,
      subscriptionUpdatedEvent({ channelId, status: 'unpaid', withoutItems: true }),
    )

    expect(await storedSubscription(web, ownerId)).toEqual(before)
    expect(api.reporter.reports).toEqual([
      {
        message: 'A Stillstats Stripe subscription carries no item',
        context: { stripeObject: 'sub_test_stillstats' },
      },
    ])
  })
})
