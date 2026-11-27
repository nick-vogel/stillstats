// Limits: every delivery here is built and signed in the test with Stripe's own test helper, in the
// shape docs.stripe.com gives the Invoice object at API version 2026-10-28.endive, so no test
// reaches a real Managed Payments invoice, the tax Stripe adds to it, or a proration on a plan
// switch made in the Customer Portal. The event goes to a fake OpenPanel, so no test shows that the
// self-hosted OpenPanel counts it as revenue. Nick's walk of Pro on production
// (creator-analytics#791) covers both.
import { randomUUID } from 'node:crypto'
import type { WebDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import { type FakeOpenPanel, startFakeOpenPanel } from '@creator-analytics/event-relay/testing'
import { describe, expect } from 'vitest'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'
import {
  deliverStripeEvent,
  invoiceEvent,
  stripeSignatureOf,
  subscriptionCheckoutEvent,
  subscriptionCreatedEvent,
  testBilling,
} from '../test/stripe.ts'

const owner = { sub: '974729', email: 'subscription-revenue@example.com', name: 'A Subscriber' }

async function subscribedChannel(web: WebDatabase, openPanel: FakeOpenPanel) {
  const api = await startApi(web, { billing: testBilling, openPanel })
  const browser = await signIn(api, owner)
  api.google.pickChannel('UC-subscription-revenue')
  await connect(browser)
  const [channel] = (await channelsOf(browser)).channels
  if (!channel) throw new Error('The connect flow connected no channel')
  return { api, channelId: channel.id, ownerId: await userIdOf(web, owner.email) }
}

async function deliver(api: StartedApi, body: string): Promise<void> {
  const response = await deliverStripeEvent(api, body)
  expect(response.status).toBe(200)
}

const revenueOf = (amount: number, currency = 'usd') => ({
  method: 'POST',
  path: '/track',
  headers: expect.any(Object),
  body: {
    type: 'track',
    payload: { name: 'revenue', properties: { __revenue: amount, currency } },
  },
})

describe('seam 1: a Pro payment reaches OpenPanel', () => {
  test('a paid invoice of a Stillstats subscription sends one revenue event with its amount before tax and its currency', async ({
    web,
  }) => {
    const openPanel = await startFakeOpenPanel()
    const { api, channelId } = await subscribedChannel(web, openPanel)

    // 700 cents and the 140 Stripe adds as merchant of record: 840 paid, 700 of it Stillstats'.
    await deliver(
      api,
      invoiceEvent('invoice.paid', {
        channelId,
        totalExcludingTax: 700,
        tax: 140,
        currency: 'eur',
      }),
    )

    expect(openPanel.received).toEqual([revenueOf(700, 'eur')])
    expect(api.reporter.reports).toEqual([])
  })

  test("the event carries no user, channel, customer or subscription ID, and forwards neither Stripe's user agent nor its IP", async ({
    web,
  }) => {
    const openPanel = await startFakeOpenPanel()
    const { api, channelId, ownerId } = await subscribedChannel(web, openPanel)
    const stripeUserAgent = 'Stripe/1.0 (+https://stripe.com/docs/webhooks)'
    const body = invoiceEvent('invoice.paid', { channelId })

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
    const sentBody = JSON.stringify(sent?.body)
    const identifiers = [
      channelId,
      ownerId,
      'cus_test_stillstats',
      'sub_test_stillstats',
      'in_test',
    ]
    expect(identifiers.filter((identifier) => sentBody.includes(identifier))).toEqual([])
    expect(sent?.body).not.toHaveProperty('payload.profileId')
  })

  test("the same invoice delivered again sends no second event, and a renewal's invoice sends its own", async ({
    web,
  }) => {
    const openPanel = await startFakeOpenPanel()
    const { api, channelId } = await subscribedChannel(web, openPanel)
    const first = invoiceEvent('invoice.paid', { channelId })
    await deliver(api, first)

    // The send is awaited, so the count is final once the answer arrives.
    await deliver(api, first)
    expect(openPanel.received).toHaveLength(1)

    await deliver(
      api,
      invoiceEvent('invoice.paid', {
        channelId,
        id: 'in_test_renewal',
        billingReason: 'subscription_cycle',
        price: testBilling.prices.annual,
        totalExcludingTax: 7000,
      }),
    )
    expect(openPanel.received).toEqual([revenueOf(700), revenueOf(7000)])
  })

  // A switch to the cheaper plan credits the unused time of the dearer one on its invoice, and a
  // credit larger than the charge goes to the customer's balance, which pays later invoices.
  test("a plan switch's invoice whose proration credit is larger than its charge sends its negative amount", async ({
    web,
  }) => {
    const openPanel = await startFakeOpenPanel()
    const { api, channelId } = await subscribedChannel(web, openPanel)

    await deliver(
      api,
      invoiceEvent('invoice.paid', {
        channelId,
        id: 'in_test_switch',
        billingReason: 'subscription_update',
        totalExcludingTax: -4300,
      }),
    )

    expect(openPanel.received).toEqual([revenueOf(-4300)])
  })

  test('a subscription Checkout sends no revenue, so its first payment counts once, from its invoice', async ({
    web,
  }) => {
    const openPanel = await startFakeOpenPanel()
    const { api, channelId } = await subscribedChannel(web, openPanel)

    await deliver(api, subscriptionCheckoutEvent({ channelId }))
    await deliver(api, subscriptionCreatedEvent({ channelId }))
    expect(openPanel.received).toEqual([])

    await deliver(api, invoiceEvent('invoice.paid', { channelId }))
    expect(openPanel.received).toEqual([revenueOf(700)])
  })

  test.for<[string, (channelId: string) => string]>([
    [
      'an invoice with no Stillstats channel in its metadata',
      () => invoiceEvent('invoice.paid', { channelId: null, id: 'in_test_other' }),
    ],
    ['a failed payment', (channelId) => invoiceEvent('invoice.payment_failed', { channelId })],
    [
      'a paid invoice for a channel that no longer exists',
      () => invoiceEvent('invoice.paid', { channelId: randomUUID(), id: 'in_test_gone' }),
    ],
  ])('%s sends nothing and reports nothing', async ([, bodyOf], { web }) => {
    const openPanel = await startFakeOpenPanel()
    const { api, channelId } = await subscribedChannel(web, openPanel)

    await deliver(api, bodyOf(channelId))

    expect(openPanel.received).toEqual([])
    expect(api.reporter.reports).toEqual([])
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
    'when OpenPanel %s, the webhook still answers 200 and records the payment, and the failure is reported',
    async ([, fail, report], { web }) => {
      const openPanel = await startFakeOpenPanel()
      fail(openPanel)
      const { api, channelId } = await subscribedChannel(web, openPanel)
      const body = invoiceEvent('invoice.paid', { channelId })

      await deliver(api, body)
      expect(openPanel.received).toHaveLength(1)
      expect(api.reporter.reports).toEqual([report])

      // The payment is recorded, so a repeated delivery tries no second send.
      await deliver(api, body)
      expect(openPanel.received).toHaveLength(1)
    },
  )

  test('a paid invoice with no amount before tax sends nothing and reports the invoice', async ({
    web,
  }) => {
    const openPanel = await startFakeOpenPanel()
    const { api, channelId } = await subscribedChannel(web, openPanel)

    await deliver(
      api,
      invoiceEvent('invoice.paid', { channelId, id: 'in_test_no_amount', totalExcludingTax: null }),
    )

    expect(openPanel.received).toEqual([])
    expect(api.reporter.reports).toEqual([
      {
        message: 'A paid Stripe invoice carries no amount before tax',
        context: { invoice: 'in_test_no_amount' },
      },
    ])
  })
})
