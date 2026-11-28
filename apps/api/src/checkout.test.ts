// Limits: Checkout opens on the fake Stripe server, which checks none of Stripe's rules, so these
// tests show what the API asks Stripe for, not that Stripe or Managed Payments accepts it, and no
// test reaches Stripe's page. Nick's walk of Pro on production (creator-analytics#791)
// covers both.
import type {
  CheckoutStartAnswer,
  EntitlementsAnswer,
  RefusalAnswer,
} from '@creator-analytics/api-types'
import { memberships, type WebDatabase, type WorkerDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import type { FakeStripe } from '@creator-analytics/fake-stripe'
import { describe, expect } from 'vitest'
import { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'
import {
  deliverStripeEvent,
  subscriptionCheckoutEvent,
  subscriptionCreatedEvent,
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

function checkout(browser: Browser, plan: unknown): Promise<Response> {
  return browser.postJson('/api/me/checkout', { plan })
}

/** The route of the release before blocks, kept for a tab opened before the deploy. */
function channelCheckout(browser: Browser, channelId: string, plan: unknown): Promise<Response> {
  return browser.postJson(`/api/channels/${channelId}/checkout`, { plan })
}

async function entitlementsOf(browser: Browser): Promise<EntitlementsAnswer> {
  const response = await browser.fetch('/api/me/entitlements')
  expect(response.status).toBe(200)
  return (await response.json()) as EntitlementsAnswer
}

describe('seam 1: a user who owns a channel starts a Pro Checkout', () => {
  test.for(['monthly', 'annual'] as const)(
    "the owner starts the %s plan and is sent to Stripe's Checkout for one block, opened for the user with Managed Payments",
    async (plan, { web }) => {
      const api = await startApi(web, { billing: testBilling })
      const { browser } = await ownedChannel(api)
      const userId = await userIdOf(web, owner.email)
      const stripe = fakeStripeOf(api)

      const response = await checkout(browser, plan)

      expect(response.status).toBe(200)
      const { url } = (await response.json()) as CheckoutStartAnswer
      expect(url).toMatch(new RegExp(`^${stripe.origin}/c/pay/`))
      const [session] = stripe.checkoutSessions.map((body) => Object.fromEntries(body))
      expect(session).toMatchObject({
        mode: 'subscription',
        'managed_payments[enabled]': 'true',
        'line_items[0][price]': testBilling.prices[plan],
        'line_items[0][quantity]': '1',
        client_reference_id: userId,
        'metadata[stillstats_user_id]': userId,
        'metadata[plan]': plan,
        'subscription_data[metadata][stillstats_user_id]': userId,
        'subscription_data[metadata][plan]': plan,
      })
      expect(Object.keys(session ?? {}).filter((key) => key.includes('adjustable'))).toEqual([])
      expect(stripe.checkoutSessions).toHaveLength(1)
    },
  )

  test("Stripe's page returns to Settings, whether the owner pays or cancels", async ({ web }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser } = await ownedChannel(api)

    await checkout(browser, 'monthly')

    const [session] = fakeStripeOf(api).checkoutSessions
    const settings = `${api.origin}/app/settings`
    expect([session?.get('success_url'), session?.get('cancel_url')]).toEqual([settings, settings])
  })

  test('a member who owns no channel is refused with not_owner, and no Checkout opens', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId } = await ownedChannel(api)
    const browser = await signIn(api, member)
    await addMember(web, worker, channelId, member.email)

    const response = await checkout(browser, 'monthly')

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ refusal: 'not_owner' } satisfies RefusalAnswer)
    expect(fakeStripeOf(api).checkoutSessions).toEqual([])
  })

  test('a signed-in user who holds no channel is refused with not_owner', async ({ web }) => {
    const api = await startApi(web, { billing: testBilling })
    const browser = await signIn(api, member)

    const response = await checkout(browser, 'monthly')

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ refusal: 'not_owner' } satisfies RefusalAnswer)
    expect(fakeStripeOf(api).checkoutSessions).toEqual([])
  })

  test.for([
    ['paid', 'active'],
    ['not yet paid', 'incomplete'],
    ['unpaid', 'unpaid'],
  ] as const)(
    'a user with a live %s subscription is refused with already_subscribed, so they are not charged twice',
    async ([, status], { web }) => {
      const api = await startApi(web, { billing: testBilling })
      const { browser, channelId } = await ownedChannel(api)
      await deliverStripeEvent(api, subscriptionCreatedEvent({ channelId, status }))

      const response = await checkout(browser, 'monthly')

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        refusal: 'already_subscribed',
      } satisfies RefusalAnswer)
      expect(fakeStripeOf(api).checkoutSessions).toEqual([])
    },
  )

  test.for([['weekly'], [undefined], [7]])(
    'a plan of %o is refused with invalid_plan',
    async ([plan], { web }) => {
      const api = await startApi(web, { billing: testBilling })
      const { browser } = await ownedChannel(api)

      const response = await checkout(browser, plan)

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'invalid_plan' })
    },
  )

  test('a user who subscribed before buys again as the same Stripe customer', async ({ web }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)
    await deliverStripeEvent(
      api,
      subscriptionCheckoutEvent({ channelId, customer: 'cus_test_back' }),
    )
    await deliverStripeEvent(
      api,
      subscriptionDeletedEvent({ channelId, customer: 'cus_test_back', endedAt: new Date() }),
    )

    await checkout(browser, 'annual')

    expect(fakeStripeOf(api).checkoutSessions[0]?.get('customer')).toBe('cus_test_back')
  })
})

// The channel's Checkout route of the release before blocks, kept for a tab opened before the
// deploy: its tests keep their names, and open the user's Checkout.
describe('seam 1: the owner starts a Pro Checkout', () => {
  test("the owner of a free channel is sent to the user's Checkout, as the user route opens it", async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)
    const userId = await userIdOf(web, owner.email)

    const response = await channelCheckout(browser, channelId, 'monthly')

    expect(response.status).toBe(200)
    const [session] = fakeStripeOf(api).checkoutSessions.map((body) => Object.fromEntries(body))
    expect(session).toMatchObject({
      'line_items[0][quantity]': '1',
      'metadata[stillstats_user_id]': userId,
    })
  })

  test('a member who does not own the channel is refused with not_owner, and no Checkout opens', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId } = await ownedChannel(api)
    const browser = await signIn(api, member)
    await addMember(web, worker, channelId, member.email)

    const response = await channelCheckout(browser, channelId, 'monthly')

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

    const response = await channelCheckout(browser, channelId, 'monthly')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ refusal: 'not_connected' } satisfies RefusalAnswer)
    expect(fakeStripeOf(api).checkoutSessions).toEqual([])
  })

  test('a signed-out visitor is refused with 401, and no Checkout opens', async ({ web }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId } = await ownedChannel(api)

    const response = await channelCheckout(new Browser(api.origin), channelId, 'monthly')

    expect(response.status).toBe(401)
    expect(fakeStripeOf(api).checkoutSessions).toEqual([])
  })

  test('with Pro unset, the Checkout route answers 404 as an unknown route does', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await ownedChannel(api)

    const response = await channelCheckout(browser, channelId, 'monthly')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not_found' })
  })

  test('a paid channel is refused with already_subscribed, so its owner is not charged twice', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)
    await deliverStripeEvent(api, subscriptionCheckoutEvent({ channelId }))

    const response = await channelCheckout(browser, channelId, 'monthly')

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ refusal: 'already_subscribed' } satisfies RefusalAnswer)
  })
})

const freeAnswer = { blocks: 0, slotsInUse: 0 }

describe("seam 1: what the web app reads of the user's Pro and each channel", () => {
  test('the owner of a free channel may subscribe, and a member who does not own it may not', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)
    const memberBrowser = await signIn(api, member)
    await addMember(web, worker, channelId, member.email)
    const free = { channelId, tier: 'free', purgeDate: null, canManage: false } as const

    expect(await entitlementsOf(browser)).toEqual({
      paidTierOffered: true,
      canSubscribe: true,
      canManage: false,
      canAddBlock: false,
      ...freeAnswer,
      channels: [{ ...free, owner: true, picked: false, canSubscribe: true }],
    })
    expect(await entitlementsOf(memberBrowser)).toEqual({
      paidTierOffered: true,
      canSubscribe: false,
      canManage: false,
      canAddBlock: false,
      ...freeAnswer,
      channels: [{ ...free, owner: false, picked: false, canSubscribe: false }],
    })
  })

  test('a paid channel reads as paid and picked, the user may not subscribe again and may manage and add a block, with one block and one slot in use', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)
    await deliverStripeEvent(api, subscriptionCheckoutEvent({ channelId }))

    expect(await entitlementsOf(browser)).toEqual({
      paidTierOffered: true,
      canSubscribe: false,
      canManage: true,
      canAddBlock: true,
      blocks: 1,
      slotsInUse: 1,
      channels: [
        {
          channelId,
          tier: 'paid',
          owner: true,
          picked: true,
          purgeDate: null,
          canSubscribe: false,
          canManage: true,
        },
      ],
    })
  })

  test('the owner of an ended channel may subscribe again, and reads its purge date', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)
    await deliverStripeEvent(api, subscriptionCheckoutEvent({ channelId }))
    const endedAt = new Date()
    await deliverStripeEvent(api, subscriptionDeletedEvent({ channelId, endedAt }))
    const purgeDate = new Date(
      Math.floor(endedAt.getTime() / 1000) * 1000 + 30 * 24 * 60 * 60 * 1000,
    )

    expect(await entitlementsOf(browser)).toEqual({
      paidTierOffered: true,
      canSubscribe: true,
      canManage: false,
      canAddBlock: false,
      ...freeAnswer,
      channels: [
        {
          channelId,
          tier: 'free',
          owner: true,
          picked: true,
          purgeDate: purgeDate.toISOString(),
          canSubscribe: true,
          canManage: false,
        },
      ],
    })
  })

  test('with Pro unset, it is not offered and no one may subscribe', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await ownedChannel(api)

    expect(await entitlementsOf(browser)).toEqual({
      paidTierOffered: false,
      canSubscribe: false,
      canManage: false,
      canAddBlock: false,
      ...freeAnswer,
      channels: [
        {
          channelId,
          tier: 'free',
          owner: true,
          picked: false,
          purgeDate: null,
          canSubscribe: false,
          canManage: false,
        },
      ],
    })
  })
})
