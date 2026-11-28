// Limits: the Customer Portal opens on the fake Stripe server, which checks none of Stripe's rules,
// so these tests show what the API asks Stripe for, not that Stripe opens it for a Managed Payments
// subscription, nor that the configuration it sends keeps the quantity fixed in Stripe's own page:
// the spike (stillstats#18) showed that in the sandbox, and Nick's walk of Pro on production
// (stillstats#26) covers it there.
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
  subscriptionUpdatedEvent,
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

function openPortal(browser: Browser): Promise<Response> {
  return browser.postJson('/api/me/portal', {})
}

/** The route of the release before blocks, kept for a tab opened before the deploy. */
function openChannelPortal(browser: Browser, channelId: string): Promise<Response> {
  return browser.postJson(`/api/channels/${channelId}/portal`, {})
}

async function entitlementsOf(browser: Browser): Promise<EntitlementsAnswer> {
  const response = await browser.fetch('/api/me/entitlements')
  expect(response.status).toBe(200)
  return (await response.json()) as EntitlementsAnswer
}

describe('seam 1: a subscribed user opens their Customer Portal', () => {
  test("a paid user is sent to Stripe's Customer Portal for their customer, which returns to Settings", async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser } = await paidChannel(api)
    const stripe = fakeStripeOf(api)

    const response = await openPortal(browser)

    expect(response.status).toBe(200)
    const { url } = (await response.json()) as PortalStartAnswer
    expect(url).toMatch(new RegExp(`^${stripe.origin}/p/session/`))
    expect(stripe.portalSessions.map((body) => Object.fromEntries(body))).toEqual([
      {
        customer: 'cus_test_portal',
        return_url: `${api.origin}/app/settings`,
        configuration: expect.stringMatching(/^bpc_/),
      },
    ])
  })

  test('a user whose subscription is unpaid still opens the Portal, to change the card', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await paidChannel(api)
    await deliverStripeEvent(
      api,
      subscriptionUpdatedEvent({ channelId, customer: 'cus_test_portal', status: 'unpaid' }),
    )

    const response = await openPortal(browser)

    expect(response.status).toBe(200)
    expect(fakeStripeOf(api).portalSessions.map((body) => body.get('customer'))).toEqual([
      'cus_test_portal',
    ])
  })

  test('a member of a paid channel, who holds no subscription, is refused with not_subscribed', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { channelId } = await paidChannel(api)
    const browser = await signIn(api, member)
    await addMember(web, worker, channelId)

    const response = await openPortal(browser)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ refusal: 'not_subscribed' } satisfies RefusalAnswer)
    expect(fakeStripeOf(api).portalSessions).toEqual([])
  })

  test('a user who never subscribed is refused with not_subscribed, and no Portal opens', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser } = await ownedChannel(api)

    const response = await openPortal(browser)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ refusal: 'not_subscribed' } satisfies RefusalAnswer)
    expect(fakeStripeOf(api).portalSessions).toEqual([])
  })

  test('a user whose subscription ended is refused with not_subscribed, as they subscribe again through Checkout', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await paidChannel(api)
    await deliverStripeEvent(api, subscriptionDeletedEvent({ channelId, endedAt: new Date() }))

    const response = await openPortal(browser)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ refusal: 'not_subscribed' } satisfies RefusalAnswer)
    expect(fakeStripeOf(api).portalSessions).toEqual([])
  })
})

// The channel's Portal route of the release before blocks, kept for a tab opened before the
// deploy: its tests keep their names, and open the user's Customer Portal.
describe("seam 1: the owner opens the channel's Customer Portal", () => {
  test("the owner of a paid channel is sent to Stripe's Customer Portal for its customer, which returns to Settings", async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await paidChannel(api)

    const response = await openChannelPortal(browser, channelId)

    expect(response.status).toBe(200)
    expect(fakeStripeOf(api).portalSessions.map((body) => Object.fromEntries(body))).toEqual([
      {
        customer: 'cus_test_portal',
        return_url: `${api.origin}/app/settings`,
        configuration: expect.stringMatching(/^bpc_/),
      },
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

    const response = await openChannelPortal(browser, channelId)

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

    const response = await openChannelPortal(browser, channelId)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ refusal: 'not_connected' } satisfies RefusalAnswer)
  })

  test('with Pro unset, the Portal route answers 404 as an unknown route does', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await ownedChannel(api)

    const response = await openChannelPortal(browser, channelId)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not_found' })
  })
})

describe('seam 1: whether the web app offers the Customer Portal', () => {
  test('a paid user may manage, and a member of their channel may not', async ({ web, worker }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await paidChannel(api)
    const memberBrowser = await signIn(api, member)
    await addMember(web, worker, channelId)

    expect(await entitlementsOf(browser)).toMatchObject({
      canManage: true,
      channels: [{ channelId, tier: 'paid', canManage: true }],
    })
    expect(await entitlementsOf(memberBrowser)).toMatchObject({
      canManage: false,
      channels: [{ channelId, tier: 'paid', canManage: false }],
    })
  })

  test('a user who never subscribed may not manage', async ({ web }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api)

    expect(await entitlementsOf(browser)).toMatchObject({
      canManage: false,
      channels: [{ channelId, tier: 'free', canManage: false }],
    })
  })
})

describe("seam 1: the Customer Portal opens on Stillstats' own configuration (stillstats#22)", () => {
  // What the configuration sends Stripe, as stripe-node encodes it, beside the metadata a creation
  // adds: the card, the invoices and a cancellation at period end on; a plan switch of price
  // alone, charged at once from now; and the quantity off in both places the spike found (#18).
  const features = {
    'features[payment_method_update][enabled]': 'true',
    'features[invoice_history][enabled]': 'true',
    'features[subscription_cancel][enabled]': 'true',
    'features[subscription_cancel][mode]': 'at_period_end',
    'features[subscription_update][enabled]': 'true',
    'features[subscription_update][default_allowed_updates][0]': 'price',
    'features[subscription_update][products][0][product]': 'prod_fake_stillstats',
    'features[subscription_update][products][0][prices][0]': testBilling.prices.monthly,
    'features[subscription_update][products][0][prices][1]': testBilling.prices.annual,
    'features[subscription_update][products][0][adjustable_quantity][enabled]': 'false',
    'features[subscription_update][proration_behavior]': 'always_invoice',
    'features[subscription_update][billing_cycle_anchor]': 'now',
  }

  function configurationsOf(stripe: FakeStripe) {
    return stripe.portalConfigurations.map(({ configuration, params }) => ({
      configuration,
      params: Object.fromEntries(params),
    }))
  }

  test('the first open creates the configuration, with the quantity off and the plan switch charged at once, and the session names it', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser } = await paidChannel(api)
    const stripe = fakeStripeOf(api)

    const response = await openPortal(browser)

    expect(response.status).toBe(200)
    expect(configurationsOf(stripe)).toEqual([
      { configuration: null, params: { ...features, 'metadata[stillstats_portal]': 'true' } },
    ])
    const [created] = (await listConfigurations(stripe)).data
    expect(stripe.portalSessions.map((body) => body.get('configuration'))).toEqual([created?.id])
  })

  test('a second open reuses the configuration and sends it nothing again', async ({ web }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser } = await paidChannel(api)
    const stripe = fakeStripeOf(api)

    await openPortal(browser)
    await openPortal(browser)

    expect(stripe.portalConfigurations).toHaveLength(1)
    const [first, second] = stripe.portalSessions.map((body) => body.get('configuration'))
    expect(second).toBe(first)
  })

  test('a process that finds the marked configuration updates it rather than creating another, and passes over one without the mark', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser } = await paidChannel(api)
    const stripe = fakeStripeOf(api)
    stripe.addPortalConfiguration({ metadata: {} })
    const marked = stripe.addPortalConfiguration({ metadata: { stillstats_portal: 'true' } })

    const response = await openPortal(browser)

    expect(response.status).toBe(200)
    expect(configurationsOf(stripe)).toEqual([{ configuration: marked, params: features }])
    expect(stripe.portalSessions.map((body) => body.get('configuration'))).toEqual([marked])
  })

  test('a failed configuration call answers 500 and opens no session, and the next open tries again', async ({
    web,
  }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser } = await paidChannel(api)
    const stripe = fakeStripeOf(api)
    stripe.failPortalConfigurations(500)

    const failed = await openPortal(browser)
    stripe.failPortalConfigurations(null)
    const opened = await openPortal(browser)

    expect([failed.status, opened.status]).toEqual([500, 200])
    expect(stripe.portalSessions).toHaveLength(1)
    expect(stripe.portalConfigurations).toHaveLength(1)
  })
})

/** The fake's configurations, read as the API reads them. */
async function listConfigurations(stripe: FakeStripe) {
  const response = await fetch(`${stripe.origin}/v1/billing_portal/configurations`)
  return (await response.json()) as { data: { id: string }[] }
}
