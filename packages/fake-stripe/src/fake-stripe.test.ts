// Limits: these tests drive the fake with the real stripe-node client, so they show that the client
// reaches it and reads its answers. They cannot prove Stripe's own validation of a Checkout
// Session, the parameters Managed Payments accepts, its eligibility review, how Stripe stamps a
// cancellation or prorates one, or the refund rules of Managed Payments. Nick's walk of Pro
// on production (creator-analytics#791) covers those.
import Stripe from 'stripe'
import { describe, expect, onTestFinished, test } from 'vitest'
import { type FakeStripe, startFakeStripe } from './index.ts'

async function started(): Promise<{ stripe: FakeStripe; client: Stripe }> {
  const stripe = await startFakeStripe()
  onTestFinished(() => stripe.close())
  const { host, port, protocol } = stripe
  return {
    stripe,
    client: new Stripe('sk_test_fake', { host, port, protocol, maxNetworkRetries: 0 }),
  }
}

describe('the fake Stripe server', () => {
  test("creates a Checkout Session whose URL is the fake's own, and records the body it was sent", async () => {
    const { stripe, client } = await started()

    const session = await client.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: 'price_test_monthly', quantity: 1 }],
      success_url: 'http://localhost/app/settings',
    })

    expect(session.url).toBe(`${stripe.origin}/c/pay/${session.id}`)
    expect(stripe.checkoutSessions.map((body) => Object.fromEntries(body))).toEqual([
      {
        mode: 'subscription',
        'line_items[0][price]': 'price_test_monthly',
        'line_items[0][quantity]': '1',
        success_url: 'http://localhost/app/settings',
      },
    ])
  })

  test('two sessions get two IDs', async () => {
    const { client } = await started()
    const create = () =>
      client.checkout.sessions.create({ mode: 'subscription', success_url: 'http://localhost/' })

    const [first, second] = [await create(), await create()]

    expect(first.id).not.toBe(second.id)
  })

  test('a failed Checkout answers its status as a Stripe error, and records the body', async () => {
    const { stripe, client } = await started()
    stripe.failCheckout(402)

    const creating = client.checkout.sessions.create({
      mode: 'subscription',
      success_url: 'http://localhost/',
    })

    await expect(creating).rejects.toMatchObject({ statusCode: 402 })
    expect(stripe.checkoutSessions).toHaveLength(1)
  })

  test('records the method, path and idempotency key of every request it answers', async () => {
    const { stripe, client } = await started()

    await client.checkout.sessions.create(
      { mode: 'subscription', success_url: 'http://localhost/' },
      { idempotencyKey: 'checkout-1' },
    )
    await client.customers.create({}).catch(() => undefined)

    expect(stripe.requests).toEqual([
      { method: 'POST', path: '/v1/checkout/sessions', idempotencyKey: 'checkout-1' },
      { method: 'POST', path: '/v1/customers', idempotencyKey: expect.any(String) },
    ])
  })

  test("opens a Customer Portal session for the customer whose URL is the fake's own, and records the body it was sent", async () => {
    const { stripe, client } = await started()

    const session = await client.billingPortal.sessions.create({
      customer: 'cus_test_portal',
      return_url: 'http://localhost/app/settings',
    })

    expect(session).toMatchObject({
      object: 'billing_portal.session',
      customer: 'cus_test_portal',
      return_url: 'http://localhost/app/settings',
      url: `${stripe.origin}/p/session/${session.id}`,
    })
    expect(stripe.portalSessions.map((body) => Object.fromEntries(body))).toEqual([
      { customer: 'cus_test_portal', return_url: 'http://localhost/app/settings' },
    ])
  })

  test('a route it does not serve answers 400', async () => {
    const { client } = await started()

    await expect(client.customers.create({})).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('a seeded price in the fake Stripe server', () => {
  test('reads back as a per-unit recurring price with its amount and currency', async () => {
    const { stripe, client } = await started()
    stripe.addPrice({ id: 'price_test_annual', unitAmount: 7000, interval: 'year' })

    const price = await client.prices.retrieve('price_test_annual')

    expect(price).toMatchObject({
      id: 'price_test_annual',
      object: 'price',
      active: true,
      billing_scheme: 'per_unit',
      currency: 'usd',
      type: 'recurring',
      recurring: { interval: 'year', interval_count: 1 },
      unit_amount: 7000,
    })
  })

  test('a price seeded with no amount reads back with a null unit_amount, as a tiered one does', async () => {
    const { stripe, client } = await started()
    stripe.addPrice({ id: 'price_test_tiered', unitAmount: null, currency: 'eur' })

    const price = await client.prices.retrieve('price_test_tiered')

    expect(price).toMatchObject({
      billing_scheme: 'tiered',
      currency: 'eur',
      unit_amount: null,
      unit_amount_decimal: null,
    })
  })

  test('a delay holds every later answer that long, until it ends', async () => {
    const { stripe, client } = await started()
    stripe.addPrice({ id: 'price_test_monthly', unitAmount: 700 })
    stripe.delay(300)

    const delayedFrom = Date.now()
    await client.prices.retrieve('price_test_monthly')
    const delayed = Date.now() - delayedFrom
    stripe.delay(null)
    const promptFrom = Date.now()
    await client.prices.retrieve('price_test_monthly')
    const prompt = Date.now() - promptFrom

    expect(delayed).toBeGreaterThanOrEqual(300)
    expect(prompt).toBeLessThan(300)
  })

  test('a price it does not hold answers 404', async () => {
    const { client } = await started()

    await expect(client.prices.retrieve('price_test_missing')).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

const day = 24 * 60 * 60 * 1000
const periodStart = new Date('2026-11-01T00:00:00Z')
const periodEnd = new Date(periodStart.getTime() + 30 * day)

describe('a seeded subscription in the fake Stripe server', () => {
  async function seeded(overrides: Partial<Parameters<FakeStripe['addSubscription']>[0]> = {}) {
    const { stripe, client } = await started()
    const { paymentIntent } = stripe.addSubscription({
      id: 'sub_fake',
      customer: 'cus_fake',
      periodStart,
      periodEnd,
      amountPaid: 700,
      ...overrides,
    })
    return { stripe, client, paymentIntent: String(paymentIntent) }
  }

  test('reads back with its period on its item and its latest invoice, active and paid', async () => {
    const { client, paymentIntent } = await seeded()

    const subscription = await client.subscriptions.retrieve('sub_fake')
    const invoice = await client.invoices.retrieve(String(subscription.latest_invoice), {
      expand: ['payments'],
    })

    expect(subscription).toMatchObject({
      status: 'active',
      customer: 'cus_fake',
      canceled_at: null,
      ended_at: null,
    })
    expect(
      subscription.items.data.map((item) => [item.current_period_start, item.current_period_end]),
    ).toEqual([[periodStart.getTime() / 1000, periodEnd.getTime() / 1000]])
    expect(invoice).toMatchObject({ status: 'paid', amount_paid: 700, currency: 'usd' })
    expect(invoice.payments?.data.map(({ payment }) => payment)).toEqual([
      { type: 'payment_intent', payment_intent: paymentIntent },
    ])
  })

  test('an invoice read without expanding its payments carries none', async () => {
    const { client } = await seeded()
    const subscription = await client.subscriptions.retrieve('sub_fake')

    const invoice = await client.invoices.retrieve(String(subscription.latest_invoice))

    expect(invoice.payments).toBeUndefined()
  })

  test("a cancellation sets it canceled at the fake's clock, and records the parameters it was sent", async () => {
    const { stripe, client } = await seeded()
    const now = new Date('2026-11-11T00:00:00Z')
    stripe.setNow(now)

    const canceled = await client.subscriptions.cancel('sub_fake', {
      prorate: false,
      invoice_now: false,
    })

    expect(canceled).toMatchObject({
      status: 'canceled',
      canceled_at: now.getTime() / 1000,
      ended_at: now.getTime() / 1000,
    })
    expect((await client.subscriptions.retrieve('sub_fake')).status).toBe('canceled')
    expect(
      stripe.cancellations.map(({ subscription, params }) => [
        subscription,
        Object.fromEntries(params),
      ]),
    ).toEqual([['sub_fake', { prorate: 'false', invoice_now: 'false' }]])
  })

  test('a subscription seeded as ended at its period end reads back canceled then, and ended at the end', async () => {
    const canceledAt = new Date(periodStart.getTime() + 5 * day)
    const { client } = await seeded({ status: 'canceled', canceledAt, endedAt: periodEnd })

    const subscription = await client.subscriptions.retrieve('sub_fake')

    expect(subscription).toMatchObject({
      status: 'canceled',
      canceled_at: canceledAt.getTime() / 1000,
      ended_at: periodEnd.getTime() / 1000,
    })
  })

  test('a second cancellation of a canceled subscription is refused', async () => {
    const { stripe, client } = await seeded()
    await client.subscriptions.cancel('sub_fake')

    await expect(client.subscriptions.cancel('sub_fake')).rejects.toMatchObject({ statusCode: 400 })
    expect(stripe.cancellations).toHaveLength(1)
  })

  test('a subscription it does not hold answers 404', async () => {
    const { client } = await started()

    await expect(client.subscriptions.retrieve('sub_missing')).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  test('a refund against its PaymentIntent is recorded with its body, and listed by the PaymentIntent', async () => {
    const { stripe, client, paymentIntent } = await seeded()

    await client.refunds.create({
      payment_intent: paymentIntent,
      amount: 300,
      metadata: { note: 'first' },
    })
    const listed = await client.refunds.list({ payment_intent: paymentIntent })

    expect(stripe.refunds.map((body) => Object.fromEntries(body))).toEqual([
      { payment_intent: paymentIntent, amount: '300', 'metadata[note]': 'first' },
    ])
    expect(listed.data.map(({ amount, metadata }) => ({ amount, metadata }))).toEqual([
      { amount: 300, metadata: { note: 'first' } },
    ])
  })

  test("a refund over the payment's unrefunded remainder is refused", async () => {
    const { stripe, client, paymentIntent } = await seeded()
    await client.refunds.create({ payment_intent: paymentIntent, amount: 500 })

    const over = client.refunds.create({ payment_intent: paymentIntent, amount: 201 })

    await expect(over).rejects.toMatchObject({ statusCode: 400 })
    expect(stripe.refunds).toHaveLength(1)
  })

  test('an unpaid invoice that took nothing has no payment', async () => {
    const { client } = await seeded({ invoicePaid: false, amountPaid: 0 })
    const subscription = await client.subscriptions.retrieve('sub_fake')

    const invoice = await client.invoices.retrieve(String(subscription.latest_invoice), {
      expand: ['payments'],
    })

    expect(invoice).toMatchObject({ status: 'open', amount_paid: 0 })
    expect(invoice.payments?.data).toEqual([])
  })

  test('an unpaid invoice that took a partial payment is open, with that payment', async () => {
    const { client, paymentIntent } = await seeded({ invoicePaid: false, amountPaid: 300 })
    const subscription = await client.subscriptions.retrieve('sub_fake')

    const invoice = await client.invoices.retrieve(String(subscription.latest_invoice), {
      expand: ['payments'],
    })

    expect(invoice).toMatchObject({ status: 'open', amount_paid: 300 })
    expect(invoice.payments?.data.map(({ payment }) => payment)).toEqual([
      { type: 'payment_intent', payment_intent: paymentIntent },
    ])
  })

  test('an outage answers every request its status as a Stripe error until it ends', async () => {
    const { stripe, client } = await seeded()
    stripe.failAll(503)

    await expect(client.subscriptions.retrieve('sub_fake')).rejects.toMatchObject({
      statusCode: 503,
    })
    await expect(client.subscriptions.cancel('sub_fake')).rejects.toMatchObject({
      statusCode: 503,
    })
    stripe.failAll(null)

    expect((await client.subscriptions.retrieve('sub_fake')).status).toBe('active')
    expect(stripe.cancellations).toEqual([])
  })

  test('failed refunds answer their status while the cancellation still succeeds', async () => {
    const { stripe, client, paymentIntent } = await seeded()
    stripe.failRefunds(503)

    await client.subscriptions.cancel('sub_fake')
    const refunding = client.refunds.create({ payment_intent: paymentIntent, amount: 100 })

    await expect(refunding).rejects.toMatchObject({ statusCode: 503 })
    expect(stripe.cancellations).toHaveLength(1)
    expect(stripe.refunds).toEqual([])
  })
})

describe('a block added to a seeded subscription in the fake Stripe server (stillstats#22)', () => {
  async function seededWithItem() {
    const { stripe, client } = await started()
    stripe.addPrice({ id: 'price_test_block', unitAmount: 900, product: 'prod_test_block' })
    stripe.addSubscription({
      id: 'sub_fake',
      customer: 'cus_fake',
      periodStart,
      periodEnd,
      amountPaid: 900,
      itemId: 'si_fake',
      price: 'price_test_block',
      metadata: { stillstats_user_id: 'fake-stripe-block-user' },
    })
    return { stripe, client }
  }

  test('reads back with its metadata, and one item with its ID, price, quantity and period end', async () => {
    const { client } = await seededWithItem()

    const subscription = await client.subscriptions.retrieve('sub_fake')

    expect(subscription.metadata).toEqual({ stillstats_user_id: 'fake-stripe-block-user' })
    expect(subscription.items.data).toMatchObject([
      {
        id: 'si_fake',
        quantity: 1,
        current_period_end: periodEnd.getTime() / 1000,
        price: {
          id: 'price_test_block',
          unit_amount: 900,
          currency: 'usd',
          product: 'prod_test_block',
          recurring: { interval: 'month', interval_count: 1 },
        },
      },
    ])
  })

  test('an update applies the quantity to the item it names, records its parameters and idempotency key, and answers the subscription', async () => {
    const { stripe, client } = await seededWithItem()

    const updated = await client.subscriptions.update(
      'sub_fake',
      { items: [{ id: 'si_fake', quantity: 2 }], proration_behavior: 'create_prorations' },
      { idempotencyKey: 'add-block-1' },
    )

    expect(updated.items.data.map(({ quantity }) => quantity)).toEqual([2])
    expect(
      (await client.subscriptions.retrieve('sub_fake')).items.data.map(({ quantity }) => quantity),
    ).toEqual([2])
    expect(
      stripe.subscriptionUpdates.map(({ subscription, params, idempotencyKey }) => [
        subscription,
        Object.fromEntries(params),
        idempotencyKey,
      ]),
    ).toEqual([
      [
        'sub_fake',
        {
          'items[0][id]': 'si_fake',
          'items[0][quantity]': '2',
          proration_behavior: 'create_prorations',
        },
        'add-block-1',
      ],
    ])
  })

  test('an update that names another item is refused and changes nothing', async () => {
    const { client } = await seededWithItem()

    const updating = client.subscriptions.update('sub_fake', {
      items: [{ id: 'si_other', quantity: 2 }],
    })

    await expect(updating).rejects.toMatchObject({ statusCode: 400 })
    expect(
      (await client.subscriptions.retrieve('sub_fake')).items.data.map(({ quantity }) => quantity),
    ).toEqual([1])
  })

  test('failed updates answer their status and change nothing, until they end', async () => {
    const { stripe, client } = await seededWithItem()
    stripe.failUpdates(402)

    const updating = client.subscriptions.update('sub_fake', {
      items: [{ id: 'si_fake', quantity: 2 }],
    })

    await expect(updating).rejects.toMatchObject({ statusCode: 402 })
    expect(stripe.subscriptionUpdates).toEqual([])
    stripe.failUpdates(null)
    await client.subscriptions.update('sub_fake', { items: [{ id: 'si_fake', quantity: 2 }] })
    expect(stripe.subscriptionUpdates).toHaveLength(1)
  })

  test('a preview answers the seeded proration as a proration line and the next period at the new quantity, and records the body', async () => {
    const { stripe, client } = await seededWithItem()
    stripe.setProration('sub_fake', 450)

    const preview = await client.invoices.createPreview({
      subscription: 'sub_fake',
      subscription_details: {
        items: [{ id: 'si_fake', quantity: 2 }],
        proration_behavior: 'create_prorations',
      },
    })

    expect(
      preview.lines.data.map((line) => ({
        amount: line.amount,
        proration: line.parent?.subscription_item_details?.proration,
      })),
    ).toEqual([
      { amount: 450, proration: true },
      { amount: 1800, proration: false },
    ])
    expect(preview.currency).toBe('usd')
    expect(stripe.invoicePreviews.map((body) => Object.fromEntries(body))).toEqual([
      {
        subscription: 'sub_fake',
        'subscription_details[items][0][id]': 'si_fake',
        'subscription_details[items][0][quantity]': '2',
        'subscription_details[proration_behavior]': 'create_prorations',
      },
    ])
  })

  test('a preview of a subscription it does not hold answers 404', async () => {
    const { client } = await started()

    await expect(
      client.invoices.createPreview({ subscription: 'sub_missing' }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('Customer Portal configurations in the fake Stripe server (stillstats#22)', () => {
  test('a configuration created is listed with its metadata, updated in place, and each body recorded', async () => {
    const { stripe, client } = await started()

    const created = await client.billingPortal.configurations.create({
      features: { invoice_history: { enabled: true } },
      metadata: { stillstats: 'portal' },
    })
    const listed = await client.billingPortal.configurations.list({ active: true })
    const updated = await client.billingPortal.configurations.update(created.id, {
      features: { invoice_history: { enabled: false } },
    })

    expect(created).toMatchObject({
      object: 'billing_portal.configuration',
      active: true,
      is_default: false,
      metadata: { stillstats: 'portal' },
    })
    expect(listed.data.map(({ id, metadata }) => ({ id, metadata }))).toEqual([
      { id: created.id, metadata: { stillstats: 'portal' } },
    ])
    expect(updated.id).toBe(created.id)
    expect(
      stripe.portalConfigurations.map(({ configuration, params }) => [
        configuration,
        Object.fromEntries(params),
      ]),
    ).toEqual([
      [
        null,
        {
          'features[invoice_history][enabled]': 'true',
          'metadata[stillstats]': 'portal',
        },
      ],
      [created.id, { 'features[invoice_history][enabled]': 'false' }],
    ])
  })

  test('a seeded configuration is listed, an inactive one only without the active filter', async () => {
    const { stripe, client } = await started()
    const active = stripe.addPortalConfiguration({ metadata: { stillstats: 'portal' } })
    const inactive = stripe.addPortalConfiguration({ metadata: {}, active: false })

    const listedActive = await client.billingPortal.configurations.list({ active: true })
    const listedAll = await client.billingPortal.configurations.list()

    expect(listedActive.data.map(({ id }) => id)).toEqual([active])
    expect(listedAll.data.map(({ id }) => id)).toEqual([active, inactive])
  })

  test('a Portal session records the configuration it names', async () => {
    const { stripe, client } = await started()

    await client.billingPortal.sessions.create({
      customer: 'cus_test_portal',
      configuration: 'bpc_test',
    })

    expect(stripe.portalSessions.map((body) => body.get('configuration'))).toEqual(['bpc_test'])
  })

  test('failed configuration calls answer their status and record nothing, until they end', async () => {
    const { stripe, client } = await started()
    stripe.failPortalConfigurations(500)

    await expect(client.billingPortal.configurations.list()).rejects.toMatchObject({
      statusCode: 500,
    })
    await expect(
      client.billingPortal.configurations.create({ features: {} }),
    ).rejects.toMatchObject({ statusCode: 500 })
    expect(stripe.portalConfigurations).toEqual([])
    stripe.failPortalConfigurations(null)
    expect((await client.billingPortal.configurations.list()).data).toEqual([])
  })
})
