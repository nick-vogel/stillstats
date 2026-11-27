// Limits: the Customer Portal opens on the fake Stripe server, which checks none of Stripe's rules,
// so these tests show what the API asks Stripe for, not that Stripe opens it for a Managed Payments
// subscription, nor what its default configuration lets the owner change. Nick's walk of Pro
// on production (creator-analytics#791) covers both.
import type {
  EntitlementsAnswer,
  PortalStartAnswer,
  RefusalAnswer,
} from '@creator-analytics/api-types'
import { memberships, type WebDatabase, type WorkerDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import type { FakeStripe } from '@creator-analytics/fake-stripe'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'
import {
  deliverStripeEvent,
  subscriptionCheckoutEvent,
  subscriptionDeletedEvent,
  testBilling,
} from '../test/stripe.ts'

const owner = { sub: '974729', email: 'portal-owner@example.com', name: 'An Owner' }
const member = { sub: '984729', email: 'portal-member@example.com', name: 'A Member' }

function fakeStripeOf(api: StartedApi): FakeStripe {
  if (!api.fakeStripe) throw new Error('The test API started with Pro unset')
  return api.fakeStripe
}

async function ownedChannel(api: StartedApi): Promise<{ browser: Browser; channelId: string }> {
  const browser = await signIn(api, owner)
  api.google.pickChannel('UC-portal')
  await connect(browser)
  const [channel] = (await channelsOf(browser)).channels
  if (!channel) throw new Error('The connect flow connected no channel')
  return { browser, channelId: channel.id }
}

/** A channel its owner pays for as the customer `cus_test_portal`. */
async function paidChannel(api: StartedApi) {
  const owned = await ownedChannel(api)
  const response = await deliverStripeEvent(
    api,
    subscriptionCheckoutEvent({ channelId: owned.channelId, customer: 'cus_test_portal' }),
  )
  expect(response.status).toBe(200)
  return owned
}

/** A membership with a role other than owner, inserted as checkout.test.ts explains. */
async function addMember(web: WebDatabase, worker: WorkerDatabase, channelId: string) {
  const userId = await userIdOf(web, member.email)
  await worker.forChannel(channelId, (scope) =>
    scope.sql.insert(memberships).values({ channelId, userId, role: 'member' as 'owner' }),
  )
}

function openPortal(browser: Browser, channelId: string): Promise<Response> {
  return browser.postJson(`/api/channels/${channelId}/portal`, {})
}

async function entitlementsOf(browser: Browser): Promise<EntitlementsAnswer> {
  const response = await browser.fetch('/api/me/entitlements')
  expect(response.status).toBe(200)
  return (await response.json()) as EntitlementsAnswer
}

describe("seam 1: the owner opens the channel's Customer Portal", () => {
  test("the owner of a paid channel is sent to Stripe's Customer Portal for its customer, which returns to Settings", async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await paidChannel(api)
    const stripe = fakeStripeOf(api)

    const response = await openPortal(browser, channelId)

    expect(response.status).toBe(200)
    const { url } = (await response.json()) as PortalStartAnswer
    expect(url).toMatch(new RegExp(`^${stripe.origin}/p/session/`))
    expect(stripe.portalSessions.map((body) => Object.fromEntries(body))).toEqual([
      { customer: 'cus_test_portal', return_url: `${api.origin}/app/settings` },
    ])
  })

  test('a member who does not own the channel is refused with not_owner, and no Portal opens', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId } = await paidChannel(api)
    const browser = await signIn(api, member)
    await addMember(web, worker, channelId)

    const response = await openPortal(browser, channelId)

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ refusal: 'not_owner' } satisfies RefusalAnswer)
    expect(fakeStripeOf(api).portalSessions).toEqual([])
  })

  test('a signed-in user who holds no membership to the channel is refused with not_connected', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId } = await paidChannel(api)
    const browser = await signIn(api, member)

    const response = await openPortal(browser, channelId)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ refusal: 'not_connected' } satisfies RefusalAnswer)
    expect(fakeStripeOf(api).portalSessions).toEqual([])
  })

  test('the owner of a free channel is refused with not_subscribed, and no Portal opens', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)

    const response = await openPortal(browser, channelId)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ refusal: 'not_subscribed' } satisfies RefusalAnswer)
    expect(fakeStripeOf(api).portalSessions).toEqual([])
  })

  test('the owner of an ended channel is refused with not_subscribed, as it subscribes again through Checkout', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await paidChannel(api)
    await deliverStripeEvent(api, subscriptionDeletedEvent({ channelId, endedAt: new Date() }))

    const response = await openPortal(browser, channelId)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ refusal: 'not_subscribed' } satisfies RefusalAnswer)
    expect(fakeStripeOf(api).portalSessions).toEqual([])
  })

  test('with Pro unset, the Portal route answers 404 as an unknown route does', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await ownedChannel(api)

    const response = await openPortal(browser, channelId)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not_found' })
  })
})

describe('seam 1: whether the web app offers the Customer Portal', () => {
  test('the owner of a paid channel may manage it, and a member who does not own it may not', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await paidChannel(api)
    const memberBrowser = await signIn(api, member)
    await addMember(web, worker, channelId)

    expect(await entitlementsOf(browser)).toEqual({
      paidTierOffered: true,
      channels: [{ channelId, tier: 'paid', canSubscribe: false, canManage: true }],
    })
    expect(await entitlementsOf(memberBrowser)).toEqual({
      paidTierOffered: true,
      channels: [{ channelId, tier: 'paid', canSubscribe: false, canManage: false }],
    })
  })

  test('the owner of a free channel may not manage it', async ({ web }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)

    expect((await entitlementsOf(browser)).channels).toEqual([
      { channelId, tier: 'free', canSubscribe: true, canManage: false },
    ])
  })
})
