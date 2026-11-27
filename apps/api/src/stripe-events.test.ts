// Limits: every delivery here is built and signed in the test with Stripe's own test helper, so no
// test reaches a real Stripe delivery, Stripe's real signing keys or the exact body Stripe sends.
// Nick checks one in Stripe test mode in creator-analytics#416. The tip's event goes to a fake
// OpenPanel, so no test shows that the self-hosted OpenPanel accepts it, files it as a server event
// with no session, or counts `__revenue` as revenue; Nick sees it in OpenPanel's revenue view in
// creator-analytics#588.
import type { SupportAnswer } from '@creator-analytics/api-types'
import type { WebDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import { type FakeOpenPanel, startFakeOpenPanel } from '@creator-analytics/event-relay/testing'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'
import {
  checkoutSessionEvent,
  deliverStripeEvent,
  stripeSignatureOf,
  testStripe,
} from '../test/stripe.ts'
import { hasTip } from './tips.ts'

const creator = { sub: '914729', email: 'tip@example.com', name: 'A Creator' }
const otherCreator = { sub: '924729', email: 'tip-other@example.com', name: 'Another' }

async function promptOf(browser: Browser): Promise<boolean> {
  const response = await browser.fetch('/api/me/support')
  expect(response.status).toBe(200)
  return ((await response.json()) as SupportAnswer).prompt
}

/** A signed-in creator whose prompt shows, since a hidden prompt proves nothing unless it showed. */
async function signedInCreator(
  web: WebDatabase,
  api: StartedApi,
  user = creator,
): Promise<{ browser: Browser; userId: string }> {
  const browser = await signIn(api, user)
  expect(await promptOf(browser)).toBe(true)
  return { browser, userId: await userIdOf(web, user.email) }
}

async function tip(api: StartedApi, userId: string, id = 'cs_test_tip'): Promise<void> {
  const response = await deliverStripeEvent(
    api,
    checkoutSessionEvent({ id, clientReferenceId: userId }),
  )
  expect(response.status).toBe(200)
}

function signed(body: string): { body: string; signature: string } {
  return { body, signature: stripeSignatureOf(body) }
}

describe('seam 1: the Stripe webhook', () => {
  test("a signed paid Checkout Session for a creator answers 200, and the creator's prompt no longer shows", async ({
    web,
  }) => {
    const api = await startApi(web, { stripe: testStripe })
    const { browser, userId } = await signedInCreator(web, api)

    const response = await deliverStripeEvent(
      api,
      checkoutSessionEvent({ clientReferenceId: userId }),
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
    expect(await promptOf(browser)).toBe(false)
    expect(api.reporter.reports).toEqual([])
  })

  test('the same delivery again answers 200 and changes nothing, and a second session answers 200 too', async ({
    web,
  }) => {
    const api = await startApi(web, { stripe: testStripe })
    const { browser, userId } = await signedInCreator(web, api)
    const body = checkoutSessionEvent({ clientReferenceId: userId })
    const signature = stripeSignatureOf(body)
    expect((await deliverStripeEvent(api, body, signature)).status).toBe(200)

    const repeated = await deliverStripeEvent(api, body, signature)
    const second = await deliverStripeEvent(
      api,
      checkoutSessionEvent({ id: 'cs_test_second', clientReferenceId: userId }),
    )

    expect(repeated.status).toBe(200)
    expect(second.status).toBe(200)
    expect(await promptOf(browser)).toBe(false)
    expect(api.reporter.reports).toEqual([])
  })

  const anHourAgo = () => Math.floor(Date.now() / 1000) - 60 * 60
  test.for<[string, (body: string) => string | null]>([
    ['a missing signature', () => null],
    [
      'a signature made with another secret',
      (body: string) => stripeSignatureOf(body, { secret: 'whsec_another_secret' }),
    ],
    ['a stale timestamp', (body: string) => stripeSignatureOf(body, { timestamp: anHourAgo() })],
  ])(
    'a delivery with %s answers 400, and the prompt still shows',
    async ([, signatureOf], { web }) => {
      const api = await startApi(web, { stripe: testStripe })
      const { browser, userId } = await signedInCreator(web, api)
      const body = checkoutSessionEvent({ clientReferenceId: userId })

      const response = await deliverStripeEvent(api, body, signatureOf(body))

      expect(response.status).toBe(400)
      expect(await promptOf(browser)).toBe(true)
    },
  )

  test('a body changed after signing answers 400, and the prompt still shows', async ({ web }) => {
    const api = await startApi(web, { stripe: testStripe })
    const { browser, userId } = await signedInCreator(web, api)
    // Signed for another creator, delivered naming this one: a forged tip.
    const signed = checkoutSessionEvent({ clientReferenceId: 'someone-else' })
    const changed = checkoutSessionEvent({ clientReferenceId: userId })

    const response = await deliverStripeEvent(api, changed, stripeSignatureOf(signed))

    expect(response.status).toBe(400)
    expect(await promptOf(browser)).toBe(true)
  })

  test.for([
    ['an unpaid session', { paymentStatus: 'unpaid' }],
    ['an event of another type', { type: 'payment_intent.succeeded' }],
  ] as const)(
    '%s answers 200, records nothing and reports nothing',
    async ([, fields], { web }) => {
      const api = await startApi(web, { stripe: testStripe })
      const { browser, userId } = await signedInCreator(web, api)

      const response = await deliverStripeEvent(
        api,
        checkoutSessionEvent({ clientReferenceId: userId, ...fields }),
      )

      expect(response.status).toBe(200)
      expect(await promptOf(browser)).toBe(true)
      expect(api.reporter.reports).toEqual([])
    },
  )

  test.for([
    [
      'no client_reference_id',
      null,
      'A paid Stripe Checkout Session carries no client_reference_id',
    ],
    [
      'an empty client_reference_id',
      '',
      'A paid Stripe Checkout Session carries no client_reference_id',
    ],
  ] as const)(
    'a paid session with %s answers 200, records nothing and reports the session',
    async ([, clientReferenceId, message], { web }) => {
      const api = await startApi(web, { stripe: testStripe })
      const { browser } = await signedInCreator(web, api)

      const response = await deliverStripeEvent(
        api,
        checkoutSessionEvent({ id: 'cs_test_orphan', clientReferenceId }),
      )

      expect(response.status).toBe(200)
      expect(await promptOf(browser)).toBe(true)
      // The session ID finds the payment in Stripe's dashboard; the reference stays out.
      expect(api.reporter.reports).toEqual([
        { message, context: { checkoutSession: 'cs_test_orphan' } },
      ])
    },
  )

  // Stripe sends checkout.session.completed for every Checkout Session on the account, such as a
  // Pro Checkout or one from another Payment Link, so each reaches this route too.
  const anotherLink = 'plink_test_another_link'
  test.for([
    {
      link: 'another Payment Link',
      paymentLink: anotherLink,
      reference: 'no client_reference_id',
      clientReferenceIdOf: (_userId: string): string | null => null,
    },
    {
      link: 'no Payment Link',
      paymentLink: null,
      reference: 'no client_reference_id',
      clientReferenceIdOf: (_userId: string): string | null => null,
    },
    {
      link: 'another Payment Link',
      paymentLink: anotherLink,
      reference: "another system's client_reference_id",
      clientReferenceIdOf: (_userId: string): string | null => 'another-systems-order-17',
    },
    {
      link: 'another Payment Link',
      paymentLink: anotherLink,
      reference: "a creator's user ID",
      clientReferenceIdOf: (userId: string): string | null => userId,
    },
    {
      link: 'no Payment Link',
      paymentLink: null,
      reference: "a creator's user ID",
      clientReferenceIdOf: (userId: string): string | null => userId,
    },
  ])(
    'a paid session from $link with $reference answers 200, records nothing, reports nothing and sends no event',
    async ({ paymentLink, clientReferenceIdOf }, { web }) => {
      const openPanel = await startFakeOpenPanel()
      const api = await startApi(web, { stripe: testStripe, openPanel })
      const { browser, userId } = await signedInCreator(web, api)

      const response = await deliverStripeEvent(
        api,
        checkoutSessionEvent({
          id: 'cs_test_another_product',
          clientReferenceId: clientReferenceIdOf(userId),
          paymentLink,
        }),
      )

      expect(response.status).toBe(200)
      expect(await promptOf(browser)).toBe(true)
      expect(api.reporter.reports).toEqual([])
      expect(openPanel.received).toEqual([])
    },
  )

  test("a paid session whose Payment Link arrives expanded is a tip when it is the Stillstats link's", async ({
    web,
  }) => {
    const api = await startApi(web, { stripe: testStripe })
    const { browser, userId } = await signedInCreator(web, api)

    const response = await deliverStripeEvent(
      api,
      checkoutSessionEvent({
        clientReferenceId: userId,
        paymentLink: { id: testStripe.paymentLinkId, object: 'payment_link' },
      }),
    )

    expect(response.status).toBe(200)
    expect(await promptOf(browser)).toBe(false)
    expect(api.reporter.reports).toEqual([])
  })

  test('without the Stripe settings, the route does not exist, and a signed delivery is refused as any signed-out request', async ({
    web,
  }) => {
    const api = await startApi(web)

    const response = await deliverStripeEvent(
      api,
      checkoutSessionEvent({ clientReferenceId: 'a-user-id' }),
    )

    expect(api.app.routes.map((route) => `${route.method} ${route.path}`)).not.toContain(
      'POST /api/stripe/events',
    )
    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 401,
      body: { error: 'unauthenticated' },
    })
  })
})

describe('seam 1: the tip event reaches OpenPanel', () => {
  test('a signed paid session sends OpenPanel one revenue event with its amount and currency', async ({
    web,
  }) => {
    const openPanel = await startFakeOpenPanel()
    const api = await startApi(web, { stripe: testStripe, openPanel })
    const { userId } = await signedInCreator(web, api)

    const response = await deliverStripeEvent(
      api,
      checkoutSessionEvent({ clientReferenceId: userId, amountTotal: 1250, currency: 'usd' }),
    )

    expect(response.status).toBe(200)
    // The exact body is the proof of no user ID: OpenPanel reads a profile only from profileId.
    expect(openPanel.received).toEqual([
      {
        method: 'POST',
        path: '/track',
        headers: expect.objectContaining({
          'openpanel-client-id': openPanel.clientId,
          'openpanel-client-secret': openPanel.clientSecret,
        }),
        body: {
          type: 'track',
          payload: {
            name: 'revenue',
            properties: { __revenue: 1250, currency: 'usd' },
          },
        },
      },
    ])
    expect(api.reporter.reports).toEqual([])
  })

  test("the event carries no user ID, and forwards neither Stripe's user agent nor its IP", async ({
    web,
  }) => {
    const openPanel = await startFakeOpenPanel()
    const api = await startApi(web, { stripe: testStripe, openPanel })
    const { userId } = await signedInCreator(web, api)
    const stripeUserAgent = 'Stripe/1.0 (+https://stripe.com/docs/webhooks)'
    const body = checkoutSessionEvent({ clientReferenceId: userId })

    const response = await deliverStripeEvent(api, body, stripeSignatureOf(body), {
      'user-agent': stripeUserAgent,
      'cf-connecting-ip': '203.0.113.7',
      'x-forwarded-for': '203.0.113.7, 198.51.100.2',
    })

    expect(response.status).toBe(200)
    expect(openPanel.received).toHaveLength(1)
    const [sent] = openPanel.received
    // Node's fetch sends a user agent of its own, which OpenPanel files as a server event.
    expect(sent?.headers['user-agent']).not.toBe(stripeUserAgent)
    expect(sent?.headers['openpanel-client-ip']).toBeUndefined()
    expect(sent?.headers['x-client-ip']).toBeUndefined()
    expect(sent?.body).toHaveProperty('payload')
    expect(sent?.body).not.toHaveProperty('payload.profileId')
  })

  test('the same delivery again sends no second event, and a second session sends a second', async ({
    web,
  }) => {
    const openPanel = await startFakeOpenPanel()
    const api = await startApi(web, { stripe: testStripe, openPanel })
    const { userId } = await signedInCreator(web, api)
    const body = checkoutSessionEvent({ clientReferenceId: userId })
    const signature = stripeSignatureOf(body)
    expect((await deliverStripeEvent(api, body, signature)).status).toBe(200)

    // The send is awaited, so the count is final once the answer arrives.
    expect((await deliverStripeEvent(api, body, signature)).status).toBe(200)
    expect(openPanel.received).toHaveLength(1)

    await tip(api, userId, 'cs_test_second')
    expect(openPanel.received).toHaveLength(2)
  })

  test('a signed paid session naming no user records an ownerless tip once, sends one revenue event and reports the session', async ({
    web,
  }) => {
    const openPanel = await startFakeOpenPanel()
    const api = await startApi(web, { stripe: testStripe, openPanel })
    const body = checkoutSessionEvent({
      id: 'cs_test_ownerless',
      clientReferenceId: 'no-such-user',
      amountTotal: 1000,
      currency: 'usd',
    })
    const signature = stripeSignatureOf(body)

    expect((await deliverStripeEvent(api, body, signature)).status).toBe(200)
    expect(openPanel.received).toEqual([
      {
        method: 'POST',
        path: '/track',
        headers: expect.objectContaining({
          'openpanel-client-id': openPanel.clientId,
          'openpanel-client-secret': openPanel.clientSecret,
        }),
        body: {
          type: 'track',
          payload: { name: 'revenue', properties: { __revenue: 1000, currency: 'usd' } },
        },
      },
    ])

    // The second delivery finds the ownerless row by its Checkout Session ID, so it sends nothing.
    expect((await deliverStripeEvent(api, body, signature)).status).toBe(200)
    expect(openPanel.received).toHaveLength(1)
    // The session ID finds the payment in Stripe's dashboard; the reference stays out.
    const report = {
      message: 'A paid Stripe Checkout Session names no user',
      context: { checkoutSession: 'cs_test_ownerless' },
    }
    expect(api.reporter.reports).toEqual([report, report])
  })

  test.for<[string, (userId: string) => { body: string; signature: string | null }]>([
    [
      'an unpaid session',
      (userId) =>
        signed(checkoutSessionEvent({ clientReferenceId: userId, paymentStatus: 'unpaid' })),
    ],
    [
      'an event of another type',
      (userId) =>
        signed(
          checkoutSessionEvent({ clientReferenceId: userId, type: 'payment_intent.succeeded' }),
        ),
    ],
    [
      'a session with no client_reference_id',
      () => signed(checkoutSessionEvent({ clientReferenceId: null })),
    ],
    [
      'a missing signature',
      (userId) => ({ body: checkoutSessionEvent({ clientReferenceId: userId }), signature: null }),
    ],
    [
      'a signature made with another secret',
      (userId) => {
        const body = checkoutSessionEvent({ clientReferenceId: userId })
        return { body, signature: stripeSignatureOf(body, { secret: 'whsec_another_secret' }) }
      },
    ],
  ])('%s sends no event', async ([, delivery], { web }) => {
    const openPanel = await startFakeOpenPanel()
    const api = await startApi(web, { stripe: testStripe, openPanel })
    const { userId } = await signedInCreator(web, api)
    const { body, signature } = delivery(userId)

    // The status and the reports are the webhook tests' above.
    await deliverStripeEvent(api, body, signature)

    expect(openPanel.received).toEqual([])
  })

  test.for([
    [
      'refuses it',
      (openPanel: FakeOpenPanel) => openPanel.answerWith(500),
      { message: 'OpenPanel refused a relayed event', context: { status: '500' } },
    ],
    [
      'drops the connection',
      (openPanel: FakeOpenPanel) => openPanel.dropEveryRequest(),
      { message: 'The event relay could not reach OpenPanel', error: expect.any(Error) },
    ],
  ] as const)(
    'when OpenPanel %s, the webhook still answers 200 and records the tip, and the failure is reported',
    async ([, fail, report], { web }) => {
      const openPanel = await startFakeOpenPanel()
      fail(openPanel)
      const api = await startApi(web, { stripe: testStripe, openPanel })
      const { browser, userId } = await signedInCreator(web, api)

      const response = await deliverStripeEvent(
        api,
        checkoutSessionEvent({ clientReferenceId: userId }),
      )

      expect(response.status).toBe(200)
      expect(openPanel.received).toHaveLength(1)
      expect(await promptOf(browser)).toBe(false)
      expect(api.reporter.reports).toEqual([report])
    },
  )

  test.for([
    ['no amount', { amountTotal: null }],
    ['no currency', { currency: null }],
  ] as const)(
    'a paid session with %s records the tip, sends no event and reports the session',
    async ([, fields], { web }) => {
      const openPanel = await startFakeOpenPanel()
      const api = await startApi(web, { stripe: testStripe, openPanel })
      const { browser, userId } = await signedInCreator(web, api)

      const response = await deliverStripeEvent(
        api,
        checkoutSessionEvent({ id: 'cs_test_no_amount', clientReferenceId: userId, ...fields }),
      )

      expect(response.status).toBe(200)
      expect(await promptOf(browser)).toBe(false)
      expect(openPanel.received).toEqual([])
      expect(api.reporter.reports).toEqual([
        {
          message: 'A paid Stripe Checkout Session carries no amount',
          context: { checkoutSession: 'cs_test_no_amount' },
        },
      ])
    },
  )
})

describe('the prompt after a tip', () => {
  test('"Reset preferences" leaves the prompt hidden', async ({ web }) => {
    const api = await startApi(web, { stripe: testStripe })
    const { browser, userId } = await signedInCreator(web, api)
    await tip(api, userId)
    expect(await promptOf(browser)).toBe(false)

    const reset = await browser.fetch('/api/me/preferences', { method: 'DELETE' })

    expect(reset.status).toBe(200)
    expect(await promptOf(browser)).toBe(false)
  })

  test('"Delete me" removes the tip, so a new account with the same Google subject sees the prompt', async ({
    web,
  }) => {
    const api = await startApi(web, { stripe: testStripe })
    const { browser, userId } = await signedInCreator(web, api)
    await tip(api, userId)
    // The new account's prompt reads only its own tips, so it shows even when the old tip
    // survives. The support answer's own read, in the deleted user's scope, sees a survivor.
    const oldAccountTipped = () => web.asUser(userId, hasTip)
    expect(await promptOf(browser)).toBe(false)
    expect(await oldAccountTipped()).toBe(true)

    const deleted = await browser.fetch('/api/me', { method: 'DELETE' })
    expect(deleted.status).toBe(200)
    const again = await signIn(api, creator)

    expect(await oldAccountTipped()).toBe(false)
    // A new account, not the old one signed in again.
    expect(await userIdOf(web, creator.email)).not.toBe(userId)
    expect(await promptOf(again)).toBe(true)
  })

  test("one creator's tip never hides another creator's prompt", async ({ web }) => {
    const api = await startApi(web, { stripe: testStripe })
    const first = await signedInCreator(web, api)
    const other = await signedInCreator(web, api, otherCreator)

    await tip(api, first.userId)

    expect(await promptOf(first.browser)).toBe(false)
    expect(await promptOf(other.browser)).toBe(true)
  })
})
