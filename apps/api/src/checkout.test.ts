// Limits: Checkout opens on the fake Stripe server, which checks none of Stripe's rules, so these
// tests show what the API asks Stripe for, not that Stripe or Managed Payments accepts it, and no
// test reaches Stripe's page. Nick's walk of Pro on production (creator-analytics#791)
// covers both.
import type {
  CheckoutStartAnswer,
  EntitlementsAnswer,
  RefusalAnswer,
} from '@creator-analytics/api-types'
import {
  memberships,
  subscriptions,
  type WebDatabase,
  type WorkerDatabase,
} from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import type { FakeStripe } from '@creator-analytics/fake-stripe'
import { describe, expect } from 'vitest'
import { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'
import {
  deliverStripeEvent,
  subscriptionCheckoutEvent,
  subscriptionDeletedEvent,
  testBilling,
} from '../test/stripe.ts'

const owner = { sub: '934729', email: 'checkout-owner@example.com', name: 'An Owner' }
const member = { sub: '944729', email: 'checkout-member@example.com', name: 'A Member' }

function fakeStripeOf(api: StartedApi): FakeStripe {
  if (!api.fakeStripe) throw new Error('The test API started with Pro unset')
  return api.fakeStripe
}

async function ownedChannel(api: StartedApi): Promise<{ browser: Browser; channelId: string }> {
  const browser = await signIn(api, owner)
  api.google.pickChannel('UC-checkout')
  await connect(browser)
  const [channel] = (await channelsOf(browser)).channels
  if (!channel) throw new Error('The connect flow connected no channel')
  return { browser, channelId: channel.id }
}

/**
 * A membership with a role other than owner. The role column has no database check, and the roles
 * an agency gives (#7) are not named yet, so the test inserts one as the worker would.
 */
async function addMember(
  web: WebDatabase,
  worker: WorkerDatabase,
  channelId: string,
  email: string,
): Promise<void> {
  const userId = await userIdOf(web, email)
  await worker.forChannel(channelId, (scope) =>
    scope.sql.insert(memberships).values({ channelId, userId, role: 'member' as 'owner' }),
  )
}

function checkout(browser: Browser, channelId: string, plan: unknown): Promise<Response> {
  return browser.postJson(`/api/channels/${channelId}/checkout`, { plan })
}

async function entitlementsOf(browser: Browser): Promise<EntitlementsAnswer> {
  const response = await browser.fetch('/api/me/entitlements')
  expect(response.status).toBe(200)
  return (await response.json()) as EntitlementsAnswer
}

describe('seam 1: the owner starts a Pro Checkout', () => {
  test.for(['monthly', 'annual'] as const)(
    "the owner starts the %s plan and is sent to Stripe's Checkout, opened for the channel with Managed Payments",
    async (plan, { web }) => {
      const api = await startApi(web, { billing: testBilling })
      const { browser, channelId } = await ownedChannel(api)
      const stripe = fakeStripeOf(api)

      const response = await checkout(browser, channelId, plan)

      expect(response.status).toBe(200)
      const { url } = (await response.json()) as CheckoutStartAnswer
      expect(url).toMatch(new RegExp(`^${stripe.origin}/c/pay/`))
      const [session] = stripe.checkoutSessions.map((body) => Object.fromEntries(body))
      expect(session).toMatchObject({
        mode: 'subscription',
        'managed_payments[enabled]': 'true',
        'line_items[0][price]': testBilling.prices[plan],
        'line_items[0][quantity]': '1',
        client_reference_id: channelId,
        'metadata[stillstats_channel_id]': channelId,
        'subscription_data[metadata][stillstats_channel_id]': channelId,
      })
      expect(stripe.checkoutSessions).toHaveLength(1)
    },
  )

  test("Stripe's page returns to Settings, whether the owner pays or cancels", async ({ web }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)

    await checkout(browser, channelId, 'monthly')

    const [session] = fakeStripeOf(api).checkoutSessions
    const settings = `${api.origin}/app/settings`
    expect([session?.get('success_url'), session?.get('cancel_url')]).toEqual([settings, settings])
  })

  test('a member who does not own the channel is refused with not_owner, and no Checkout opens', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId } = await ownedChannel(api)
    const browser = await signIn(api, member)
    await addMember(web, worker, channelId, member.email)

    const response = await checkout(browser, channelId, 'monthly')

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ refusal: 'not_owner' } satisfies RefusalAnswer)
    expect(fakeStripeOf(api).checkoutSessions).toEqual([])
  })

  test('a signed-in user who holds no membership to the channel is refused with not_connected', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId } = await ownedChannel(api)
    const browser = await signIn(api, member)

    const response = await checkout(browser, channelId, 'monthly')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ refusal: 'not_connected' } satisfies RefusalAnswer)
    expect(fakeStripeOf(api).checkoutSessions).toEqual([])
  })

  test('a signed-out visitor is refused with 401, and no Checkout opens', async ({ web }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId } = await ownedChannel(api)

    const response = await checkout(new Browser(api.origin), channelId, 'monthly')

    expect(response.status).toBe(401)
    expect(fakeStripeOf(api).checkoutSessions).toEqual([])
  })

  test('a paid channel is refused with already_subscribed, so its owner is not charged twice', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)
    await deliverStripeEvent(api, subscriptionCheckoutEvent({ channelId }))

    const response = await checkout(browser, channelId, 'monthly')

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ refusal: 'already_subscribed' } satisfies RefusalAnswer)
    expect(fakeStripeOf(api).checkoutSessions).toEqual([])
  })

  test.for([['weekly'], [undefined], [7]])(
    'a plan of %o is refused with invalid_plan',
    async ([plan], { web }) => {
      const api = await startApi(web, { billing: testBilling })
      const { browser, channelId } = await ownedChannel(api)

      const response = await checkout(browser, channelId, plan)

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'invalid_plan' })
    },
  )

  test('with Pro unset, the Checkout route answers 404 as an unknown route does', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await ownedChannel(api)

    const response = await checkout(browser, channelId, 'monthly')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not_found' })
  })

  test('a channel that subscribed before buys again as the same Stripe customer', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)
    await deliverStripeEvent(
      api,
      subscriptionCheckoutEvent({ channelId, customer: 'cus_test_back' }),
    )
    // The subscription ended, as #787 records it.
    await worker.forChannel(channelId, (scope) =>
      scope.sql.update(subscriptions).set({ status: 'canceled' }),
    )

    await checkout(browser, channelId, 'annual')

    expect(fakeStripeOf(api).checkoutSessions[0]?.get('customer')).toBe('cus_test_back')
  })
})

describe('seam 1: what the web app reads of each channel', () => {
  test('the owner of a free channel may subscribe, and a member who does not own it may not', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)
    const memberBrowser = await signIn(api, member)
    await addMember(web, worker, channelId, member.email)

    expect(await entitlementsOf(browser)).toEqual({
      paidTierOffered: true,
      channels: [{ channelId, tier: 'free', canSubscribe: true, canManage: false }],
    })
    expect(await entitlementsOf(memberBrowser)).toEqual({
      paidTierOffered: true,
      channels: [{ channelId, tier: 'free', canSubscribe: false, canManage: false }],
    })
  })

  test('a paid channel reads as paid, no one may subscribe it again, and its owner may manage it', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)
    await deliverStripeEvent(api, subscriptionCheckoutEvent({ channelId }))

    expect(await entitlementsOf(browser)).toEqual({
      paidTierOffered: true,
      channels: [{ channelId, tier: 'paid', canSubscribe: false, canManage: true }],
    })
  })

  test('the owner of an ended channel may subscribe it again', async ({ web }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)
    await deliverStripeEvent(api, subscriptionCheckoutEvent({ channelId }))
    await deliverStripeEvent(api, subscriptionDeletedEvent({ channelId, endedAt: new Date() }))

    expect(await entitlementsOf(browser)).toEqual({
      paidTierOffered: true,
      channels: [{ channelId, tier: 'free', canSubscribe: true, canManage: false }],
    })
  })

  test('with Pro unset, it is not offered and no one may subscribe', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await ownedChannel(api)

    expect(await entitlementsOf(browser)).toEqual({
      paidTierOffered: false,
      channels: [{ channelId, tier: 'free', canSubscribe: false, canManage: false }],
    })
  })
})
