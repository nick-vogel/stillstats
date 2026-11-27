// Limits: no test here reaches Stripe's page, and none shows that Stripe keeps the
// client_reference_id the link carries. Nick checks both with a real tip in creator-analytics#416.
import type { ErrorAnswer, SupportAnswer } from '@creator-analytics/api-types'
import { test } from '@creator-analytics/database/testing'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { savePreferences, signIn, userIdOf } from '../test/flows.ts'
import { startApi } from '../test/start-api.ts'
import { fitsClientReferenceId, supportSettingsOf } from './support.ts'

const paymentLinkUrl = 'https://buy.stripe.com/test_00g3cd'
const webhookSecret = 'whsec_test_secret'
const paymentLinkId = 'plink_test_00g3cd'
const allThree = {
  STRIPE_PAYMENT_LINK_URL: paymentLinkUrl,
  STRIPE_WEBHOOK_SECRET: webhookSecret,
  STRIPE_PAYMENT_LINK_ID: paymentLinkId,
}
const namesAllThree = /STRIPE_PAYMENT_LINK_URL.*STRIPE_WEBHOOK_SECRET.*STRIPE_PAYMENT_LINK_ID/

describe('the Stripe settings', () => {
  test('with no setting, Stripe is not configured', () => {
    expect(supportSettingsOf({})).toBeUndefined()
  })

  test('with all three settings, Stripe is configured with them', () => {
    expect(supportSettingsOf(allThree)).toEqual({ paymentLinkUrl, webhookSecret, paymentLinkId })
  })

  test.for([
    ['the Payment Link URL', { STRIPE_PAYMENT_LINK_URL: paymentLinkUrl }],
    ['the webhook signing secret', { STRIPE_WEBHOOK_SECRET: webhookSecret }],
    ['the Payment Link ID', { STRIPE_PAYMENT_LINK_ID: paymentLinkId }],
  ] as const)('the API refuses to start with only %s set', ([, env]) => {
    expect(() => supportSettingsOf(env)).toThrow(namesAllThree)
  })

  test.for([
    ['the Payment Link ID', 'STRIPE_PAYMENT_LINK_ID'],
    ['the webhook signing secret', 'STRIPE_WEBHOOK_SECRET'],
    ['the Payment Link URL', 'STRIPE_PAYMENT_LINK_URL'],
  ] as const)('the API refuses to start with all but %s set', ([, unset]) => {
    expect(() => supportSettingsOf({ ...allThree, [unset]: undefined })).toThrow(namesAllThree)
  })

  test('the API refuses to start with a Payment Link URL that is not a URL', () => {
    expect(() =>
      supportSettingsOf({ ...allThree, STRIPE_PAYMENT_LINK_URL: 'buy.stripe.com/test_00g3cd' }),
    ).toThrow(/STRIPE_PAYMENT_LINK_URL/)
  })

  test.for([
    ['the Payment Link URL', 'https://buy.stripe.com/test_00g3cd'],
    ['the Payment Link page ID', 'test_00g3cd'],
    ['a Checkout Session ID', 'cs_test_a1b2c3'],
  ] as const)(
    'the API refuses to start with a Payment Link ID that is %s, not a plink_ ID',
    ([, id]) => {
      expect(() => supportSettingsOf({ ...allThree, STRIPE_PAYMENT_LINK_ID: id })).toThrow(
        /STRIPE_PAYMENT_LINK_ID.*plink_/,
      )
    },
  )
})

describe("Stripe's client_reference_id rule", () => {
  test.for([
    { name: '200 characters', id: 'a'.repeat(200), fits: true },
    { name: 'letters, digits, a dash and an underscore', id: 'aZ09-_', fits: true },
    { name: '201 characters', id: 'a'.repeat(201), fits: false },
    { name: 'a dot', id: 'user.id', fits: false },
    { name: 'a space', id: 'user id', fits: false },
    { name: 'nothing', id: '', fits: false },
  ])('an ID of $name fits: $fits', ({ id, fits }) => {
    expect(fitsClientReferenceId(id)).toBe(fits)
  })
})

const creator = { sub: '708312', email: 'support@example.com', name: 'A Creator' }
// A Payment Link that carries a parameter of its own, which the creator's link keeps.
const stripe = { paymentLinkUrl: `${paymentLinkUrl}?locale=en`, webhookSecret, paymentLinkId }

async function supportOf(browser: Browser): Promise<{ status: number; body: unknown }> {
  const response = await browser.fetch('/api/me/support')
  return { status: response.status, body: await response.json() }
}

describe('the signed-in support answer', () => {
  test("a signed-in creator's link carries their user ID, and the prompt shows", async ({
    web,
  }) => {
    const browser = await signIn(await startApi(web, { stripe }), creator)
    const userId = await userIdOf(web, creator.email)

    const { status, body } = await supportOf(browser)

    expect(status).toBe(200)
    const { link, prompt } = body as SupportAnswer
    expect(prompt).toBe(true)
    const url = new URL(link ?? '')
    expect(`${url.origin}${url.pathname}`).toBe(paymentLinkUrl)
    expect([...url.searchParams]).toEqual([
      ['locale', 'en'],
      ['client_reference_id', userId],
    ])
  })

  test('a signed-out request is refused', async ({ web }) => {
    const api = await startApi(web, { stripe })

    const response = await fetch(`${api.origin}/api/me/support`)

    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 401,
      body: { error: 'unauthenticated' } satisfies ErrorAnswer,
    })
  })

  test('without the Stripe settings, the answer carries no link and no prompt', async ({ web }) => {
    const browser = await signIn(await startApi(web), creator)

    expect(await supportOf(browser)).toEqual({
      status: 200,
      body: { link: null, prompt: false } satisfies SupportAnswer,
    })
  })

  test("a Better Auth user ID fits Stripe's client_reference_id rule", async ({ web }) => {
    await signIn(await startApi(web, { stripe }), creator)

    // Stripe's rule, from docs.stripe.com/payment-links/url-parameters, written here rather than
    // imported so the test does not hold the code to its own rule.
    expect(await userIdOf(web, creator.email)).toMatch(/^[A-Za-z0-9_-]{1,200}$/)
  })
})

const otherCreator = { sub: '808312', email: 'support-other@example.com', name: 'Another' }

async function dismiss(browser: Browser): Promise<void> {
  const response = await savePreferences(browser, { supportPromptDismissed: true })
  expect(response.status).toBe(200)
}

describe('the support prompt and its dismissal', () => {
  test('a dismissal through the preferences update hides the prompt and keeps the link', async ({
    web,
  }) => {
    const browser = await signIn(await startApi(web, { stripe }), creator)
    const before = await supportOf(browser)
    // A hidden prompt proves nothing unless it showed first.
    expect(before).toEqual({
      status: 200,
      body: { link: expect.any(String), prompt: true },
    })

    await dismiss(browser)

    expect(await supportOf(browser)).toEqual({
      status: 200,
      body: { link: (before.body as SupportAnswer).link, prompt: false },
    })
  })

  test('"Reset preferences" shows the prompt again', async ({ web }) => {
    const browser = await signIn(await startApi(web, { stripe }), creator)
    await dismiss(browser)
    // A shown prompt proves nothing unless the dismissal hid it first.
    expect(((await supportOf(browser)).body as SupportAnswer).prompt).toBe(false)

    const reset = await browser.fetch('/api/me/preferences', { method: 'DELETE' })
    expect(reset.status).toBe(200)

    expect(((await supportOf(browser)).body as SupportAnswer).prompt).toBe(true)
  })

  test("one creator's dismissal never hides another creator's prompt", async ({ web }) => {
    const api = await startApi(web, { stripe })
    const browser = await signIn(api, creator)
    await dismiss(browser)
    // The other creator's prompt proves nothing unless the first creator's went.
    expect(((await supportOf(browser)).body as SupportAnswer).prompt).toBe(false)

    const other = await signIn(api, otherCreator)

    expect(((await supportOf(other)).body as SupportAnswer).prompt).toBe(true)
  })
})
