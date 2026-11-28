import { once } from 'node:events'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * Stripe's API at the HTTP level, for every test that would otherwise call Stripe, as the real
 * stripe-node client calls it: point the client's `host`, `port` and `protocol` here. It answers
 * `POST /v1/checkout/sessions` with a Checkout Session whose URL is on this server;
 * `POST /v1/billing_portal/sessions` with a Customer Portal session whose URL is on this server;
 * the Customer Portal configurations' list, creation and update; a seeded subscription's reads,
 * its quantity update, the preview of its next invoice, its immediate cancellation, and refunds of
 * its latest invoice's payment; a seeded price's read; and 400 to any route it does not serve. A
 * change made in the Portal reaches the API only through Stripe's webhook, so a test builds that
 * event itself; the update it serves is the one a block of Pro sends (stillstats#22).
 *
 * It checks none of Stripe's own rules for a session, a configuration, an update or a
 * cancellation, prorates nothing of its own (a preview answers the proration a test seeds, and an
 * accepted change of quantity leaves that amount pending for the next preview, as Stripe leaves a
 * pending proration invoice item), and refuses a
 * refund only over its payment's unrefunded remainder, so it cannot prove Stripe accepts what the
 * client sends, or that Managed Payments takes it. The walk of Pro on production
 * (creator-analytics#791) covers those.
 */
export interface FakeStripe {
  readonly origin: string
  readonly host: string
  readonly port: number
  readonly protocol: 'http'
  /** Every request it answered, in the order they arrived, an outage's included. */
  readonly requests: FakeStripeRequest[]
  /** The form body of every Checkout Session request, in the order they arrived. */
  readonly checkoutSessions: URLSearchParams[]
  /** The form body of every Customer Portal session request, in the order they arrived. */
  readonly portalSessions: URLSearchParams[]
  /**
   * The form body of every Customer Portal configuration it created or updated, in the order they
   * arrived, with the ID of the one updated, or null for a creation.
   */
  readonly portalConfigurations: { configuration: string | null; params: URLSearchParams }[]
  /** The parameters and idempotency key of every subscription update it accepted. */
  readonly subscriptionUpdates: {
    subscription: string
    params: URLSearchParams
    idempotencyKey: string | null
  }[]
  /** The form body of every invoice preview request it answered. */
  readonly invoicePreviews: URLSearchParams[]
  /** The parameters of every cancellation it accepted. */
  readonly cancellations: { subscription: string; params: URLSearchParams }[]
  /** The form body of every refund it accepted. */
  readonly refunds: URLSearchParams[]
  /**
   * Seeds a subscription with its latest invoice and, when that took a payment, its PaymentIntent,
   * whose id it answers, or null for an invoice that took nothing.
   */
  addSubscription(subscription: FakeSubscription): { paymentIntent: string | null }
  /** Seeds a price, which `GET /v1/prices/:id` reads back; a price it does not hold answers 404. */
  addPrice(price: FakePrice): void
  /**
   * The amount, in the currency's smallest unit, of the proration line a preview of the
   * subscription's next invoice answers for the change it previews, and of the proration an
   * accepted change of quantity leaves pending: 0 until a test sets it.
   */
  setProration(subscriptionId: string, amount: number): void
  /** Seeds a Customer Portal configuration, active unless given, and answers its ID. */
  addPortalConfiguration(configuration: {
    metadata: Record<string, string>
    active?: boolean
  }): string
  /** The clock a cancellation is stamped with: system time until a test sets it. */
  setNow(now: Date): void
  /** Every later Checkout Session request answers this HTTP status with a Stripe error. */
  failCheckout(status: number): void
  /** Every later refund request answers this HTTP status with a Stripe error; null ends it. */
  failRefunds(status: number | null): void
  /** Every later subscription update answers this HTTP status with a Stripe error; null ends it. */
  failUpdates(status: number | null): void
  /**
   * Every later Customer Portal configuration request, a list, a creation or an update, answers
   * this HTTP status with a Stripe error; null ends it.
   */
  failPortalConfigurations(status: number | null): void
  /** Every later request answers this HTTP status with a Stripe error, an outage; null ends it. */
  failAll(status: number | null): void
  /**
   * Every later request waits this many milliseconds before it is answered, a slow or hanging
   * Stripe; null ends it.
   */
  delay(ms: number | null): void
  close(): Promise<void>
}

export interface FakeStripeRequest {
  method: string
  path: string
  idempotencyKey: string | null
}

export interface FakeSubscription {
  id: string
  customer: string
  /** Stripe's status of it, `active` unless given. */
  status?: string
  periodStart: Date
  periodEnd: Date
  /**
   * What its latest invoice's payment took, in the currency's smallest unit: for an unpaid invoice,
   * a partial payment, or 0 for none.
   */
  amountPaid: number
  /** `usd` unless given. */
  currency?: string
  /** Whether its latest invoice is paid in full, true unless given; an unpaid one is open. */
  invoicePaid?: boolean
  /** When Stripe canceled it, for one seeded as already canceled; null unless given. */
  canceledAt?: Date
  /** When it ended, for one seeded as already ended; null unless given. */
  endedAt?: Date
  /** Its metadata, none unless given. */
  metadata?: Record<string, string>
  /** Its one item's ID, `si_` and its own ID unless given. */
  itemId?: string
  /**
   * The ID of its one item's price, which the test seeded with `addPrice` and the item reads back
   * whole; none unless given, an item with no price.
   */
  price?: string
  /** Its one item's quantity, the number of blocks: 1 unless given. */
  quantity?: number
}

export interface FakePrice {
  id: string
  /**
   * In the currency's smallest unit; null reads back as a tiered price, which Stripe gives no
   * `unit_amount`.
   */
  unitAmount: number | null
  /** `usd` unless given. */
  currency?: string
  /** `month` unless given. */
  interval?: 'month' | 'year'
  /** The product it prices, `prod_fake_stillstats` unless given. */
  product?: string
}

interface HeldSubscription {
  id: string
  customer: string
  status: string
  canceledAt: number | null
  endedAt: number | null
  periodStart: number
  periodEnd: number
  invoiceId: string
  metadata: Record<string, string>
  itemId: string
  price: string | null
  quantity: number
}

interface HeldPortalConfiguration {
  id: string
  active: boolean
  metadata: Record<string, string>
  created: number
}

interface HeldInvoice {
  id: string
  status: 'paid' | 'open'
  amountPaid: number
  currency: string
  paymentIntent: string | null
}

interface HeldRefund {
  id: string
  paymentIntent: string
  amount: number
  currency: string
  metadata: Record<string, string>
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body))
}

async function formBody(req: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return new URLSearchParams(Buffer.concat(chunks).toString())
}

/** Stripe's error body, which stripe-node reads into a `StripeError` with the status. */
function stripeError(res: ServerResponse, status: number, message: string): void {
  json(res, status, { error: { type: 'invalid_request_error', message } })
}

/** The `metadata[key]` fields of a form body, as Stripe reads them into its metadata hash. */
function metadataOf(params: URLSearchParams): Record<string, string> {
  const metadata: Record<string, string> = {}
  for (const [key, value] of params) {
    const field = /^metadata\[(.+)\]$/.exec(key)?.[1]
    if (field) metadata[field] = value
  }
  return metadata
}

/** Whether the request's `expand` names the field; stripe-node sends `expand[0]`, `expand[1]`. */
function expands(params: URLSearchParams, field: string): boolean {
  return [...params].some(([key, value]) => key.startsWith('expand[') && value === field)
}

const seconds = (date: Date) => Math.floor(date.getTime() / 1000)

export async function startFakeStripe(): Promise<FakeStripe> {
  const requests: FakeStripeRequest[] = []
  const checkoutSessions: URLSearchParams[] = []
  const portalSessions: URLSearchParams[] = []
  const cancellations: { subscription: string; params: URLSearchParams }[] = []
  const portalConfigurations: { configuration: string | null; params: URLSearchParams }[] = []
  const subscriptionUpdates: {
    subscription: string
    params: URLSearchParams
    idempotencyKey: string | null
  }[] = []
  const invoicePreviews: URLSearchParams[] = []
  const prorations = new Map<string, number>()
  // The proration invoice items each accepted change of quantity left pending, by subscription:
  // their amount and the start of the period they prorate, the update's `proration_date` or now.
  const pendingProrations = new Map<string, { amount: number; start: number }[]>()
  const heldConfigurations: HeldPortalConfiguration[] = []
  const refunds: URLSearchParams[] = []
  const subscriptions = new Map<string, HeldSubscription>()
  const invoices = new Map<string, HeldInvoice>()
  const heldRefunds: HeldRefund[] = []
  const prices = new Map<string, Required<FakePrice>>()
  let checkoutFailure: number | null = null
  let refundFailure: number | null = null
  let updateFailure: number | null = null
  let configurationFailure: number | null = null
  let outage: number | null = null
  let latency: number | null = null
  let now: Date | null = null
  let sessionCount = 0
  let objectCount = 0
  let origin = ''
  const nextId = (prefix: string) => `${prefix}_fake_${++objectCount}`

  async function createCheckoutSession(req: IncomingMessage, res: ServerResponse) {
    const body = await formBody(req)
    checkoutSessions.push(body)
    if (checkoutFailure !== null) {
      return stripeError(res, checkoutFailure, 'The fake Stripe server failed this Checkout')
    }
    sessionCount += 1
    const id = `cs_test_fake_${sessionCount}`
    json(res, 200, {
      id,
      object: 'checkout.session',
      mode: body.get('mode'),
      client_reference_id: body.get('client_reference_id'),
      customer: body.get('customer'),
      status: 'open',
      payment_status: 'unpaid',
      url: `${origin}/c/pay/${id}`,
    })
  }

  async function createPortalSession(req: IncomingMessage, res: ServerResponse) {
    const body = await formBody(req)
    portalSessions.push(body)
    const id = nextId('bps')
    json(res, 200, {
      id,
      object: 'billing_portal.session',
      customer: body.get('customer'),
      return_url: body.get('return_url'),
      url: `${origin}/p/session/${id}`,
    })
  }

  function subscriptionObject(subscription: HeldSubscription) {
    const price = subscription.price === null ? undefined : prices.get(subscription.price)
    return {
      id: subscription.id,
      object: 'subscription',
      customer: subscription.customer,
      status: subscription.status,
      canceled_at: subscription.canceledAt,
      ended_at: subscription.endedAt,
      latest_invoice: subscription.invoiceId,
      metadata: subscription.metadata,
      items: {
        object: 'list',
        data: [
          {
            id: subscription.itemId,
            object: 'subscription_item',
            quantity: subscription.quantity,
            current_period_start: subscription.periodStart,
            current_period_end: subscription.periodEnd,
            ...(price && { price: priceObject(price) }),
          },
        ],
      },
    }
  }

  // The update a block of Pro sends: `items[0][id]` and `items[0][quantity]`, with whatever
  // `proration_behavior` it names, which it records. A change of quantity under any behaviour but
  // `none` leaves the seeded proration pending from its `proration_date`, or now.
  async function updateSubscription(
    subscription: HeldSubscription,
    req: IncomingMessage,
    res: ServerResponse,
    idempotencyKey: string | null,
  ) {
    const body = await formBody(req)
    if (updateFailure !== null) {
      return stripeError(res, updateFailure, 'The fake Stripe server failed this update')
    }
    const itemId = body.get('items[0][id]')
    const quantity = body.get('items[0][quantity]')
    if (itemId !== null && itemId !== subscription.itemId) {
      return stripeError(res, 400, `No such subscription item: '${itemId}'`)
    }
    if (quantity !== null && Number(quantity) !== subscription.quantity) {
      if (body.get('proration_behavior') !== 'none') {
        const start = Number(body.get('proration_date') ?? seconds(now ?? new Date()))
        const amount = prorations.get(subscription.id) ?? 0
        pendingProrations.set(subscription.id, [
          ...(pendingProrations.get(subscription.id) ?? []),
          { amount, start },
        ])
      }
      subscription.quantity = Number(quantity)
    }
    subscriptionUpdates.push({ subscription: subscription.id, params: body, idempotencyKey })
    json(res, 200, subscriptionObject(subscription))
  }

  // docs.stripe.com/api/invoices/create_preview and the invoice line item object, read 2026-11-27
  // at 2026-10-28.endive: a line is a proration when `parent.subscription_item_details.proration`
  // is true, which Stripe names the way to find the prorations a preview shows; a preview also
  // shows every pending invoice item. It answers a proration line for each pending proration,
  // from its own start, one proration line of the seeded amount from the preview's
  // `subscription_details[proration_date]`, or now, and one line for the next period at the
  // previewed quantity times the item's price. A proration line runs to the period's end.
  async function previewInvoice(req: IncomingMessage, res: ServerResponse) {
    const body = await formBody(req)
    const subscriptionId = body.get('subscription') ?? ''
    const subscription = subscriptions.get(subscriptionId)
    if (!subscription) return stripeError(res, 404, `No such subscription: '${subscriptionId}'`)
    invoicePreviews.push(body)
    const price = subscription.price === null ? undefined : prices.get(subscription.price)
    const quantity = Number(
      body.get('subscription_details[items][0][quantity]') ?? subscription.quantity,
    )
    const currency = price?.currency ?? 'usd'
    const line = (
      id: string,
      amount: number,
      proration: boolean,
      period: { start: number; end: number },
    ) => ({
      id,
      object: 'line_item',
      amount,
      currency,
      quantity,
      period,
      parent: {
        type: 'subscription_item_details',
        invoice_item_details: null,
        subscription_item_details: {
          invoice_item: null,
          proration,
          proration_details: null,
          subscription: subscription.id,
          subscription_item: subscription.itemId,
        },
      },
      pricing: {
        type: 'price_details',
        price_details: { price: price?.id ?? null, product: price?.product ?? null },
      },
    })
    const proration = prorations.get(subscription.id) ?? 0
    const next = quantity * (price?.unitAmount ?? 0)
    const end = subscription.periodEnd
    const pending = (pendingProrations.get(subscription.id) ?? []).map(({ amount, start }) =>
      line(nextId('il'), amount, true, { start, end }),
    )
    const previewedStart = Number(
      body.get('subscription_details[proration_date]') ?? seconds(now ?? new Date()),
    )
    const lines = [
      ...pending,
      line(nextId('il'), proration, true, { start: previewedStart, end }),
      line(nextId('il'), next, false, { start: end, end: end + (end - subscription.periodStart) }),
    ]
    json(res, 200, {
      id: `upcoming_${nextId('in')}`,
      object: 'invoice',
      currency,
      customer: subscription.customer,
      status: 'draft',
      total: lines.reduce((sum, { amount }) => sum + amount, 0),
      lines: {
        object: 'list',
        data: lines,
        has_more: false,
        url: '/v1/invoices/upcoming/lines',
      },
    })
  }

  function portalConfigurationObject(configuration: HeldPortalConfiguration) {
    return {
      id: configuration.id,
      object: 'billing_portal.configuration',
      active: configuration.active,
      is_default: false,
      livemode: false,
      created: configuration.created,
      metadata: configuration.metadata,
    }
  }

  async function portalConfigurationRoute(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    configurationId: string | null,
  ) {
    const body = req.method === 'POST' ? await formBody(req) : new URLSearchParams()
    if (configurationFailure !== null) {
      return stripeError(res, configurationFailure, 'The fake Stripe server failed this call')
    }
    if (req.method === 'GET' && configurationId === null) {
      const active = url.searchParams.get('active')
      const data = heldConfigurations.filter(
        (held) => active === null || String(held.active) === active,
      )
      return json(res, 200, {
        object: 'list',
        data: data.map(portalConfigurationObject),
        has_more: false,
        url: '/v1/billing_portal/configurations',
      })
    }
    if (req.method !== 'POST') {
      return stripeError(res, 400, `The fake Stripe server does not serve ${req.method} here`)
    }
    let configuration: HeldPortalConfiguration
    if (configurationId === null) {
      configuration = {
        id: nextId('bpc'),
        active: true,
        metadata: {},
        created: seconds(now ?? new Date()),
      }
      heldConfigurations.push(configuration)
    } else {
      const held = heldConfigurations.find(({ id }) => id === configurationId)
      if (!held) return stripeError(res, 404, `No such configuration: '${configurationId}'`)
      configuration = held
    }
    configuration.metadata = { ...configuration.metadata, ...metadataOf(body) }
    if (body.has('active')) configuration.active = body.get('active') === 'true'
    portalConfigurations.push({ configuration: configurationId, params: body })
    json(res, 200, portalConfigurationObject(configuration))
  }

  function invoiceObject(invoice: HeldInvoice, withPayments: boolean) {
    return {
      id: invoice.id,
      object: 'invoice',
      status: invoice.status,
      amount_paid: invoice.amountPaid,
      currency: invoice.currency,
      ...(withPayments && {
        payments: {
          object: 'list',
          data: invoice.paymentIntent
            ? [
                {
                  object: 'invoice_payment',
                  status: 'paid',
                  amount_paid: invoice.amountPaid,
                  currency: invoice.currency,
                  payment: { type: 'payment_intent', payment_intent: invoice.paymentIntent },
                },
              ]
            : [],
        },
      }),
    }
  }

  // The fields of docs.stripe.com/api/prices/object that a Stillstats read touches, checked
  // 2026-11-19: `unit_amount` and `unit_amount_decimal` are set only for `billing_scheme=per_unit`.
  function priceObject(price: Required<FakePrice>) {
    const perUnit = price.unitAmount !== null
    return {
      id: price.id,
      object: 'price',
      active: true,
      billing_scheme: perUnit ? 'per_unit' : 'tiered',
      currency: price.currency,
      custom_unit_amount: null,
      livemode: false,
      product: price.product,
      recurring: {
        interval: price.interval,
        interval_count: 1,
        trial_period_days: null,
        usage_type: 'licensed',
      },
      tiers_mode: perUnit ? null : 'graduated',
      type: 'recurring',
      unit_amount: price.unitAmount,
      unit_amount_decimal: perUnit ? String(price.unitAmount) : null,
    }
  }

  function refundObject(refund: HeldRefund) {
    return {
      id: refund.id,
      object: 'refund',
      payment_intent: refund.paymentIntent,
      amount: refund.amount,
      currency: refund.currency,
      metadata: refund.metadata,
      status: 'succeeded',
    }
  }

  function cancelSubscription(subscription: HeldSubscription, url: URL, res: ServerResponse) {
    if (subscription.status === 'canceled') {
      return stripeError(res, 400, `The subscription ${subscription.id} is already canceled`)
    }
    subscription.status = 'canceled'
    subscription.canceledAt = seconds(now ?? new Date())
    subscription.endedAt = subscription.canceledAt
    cancellations.push({ subscription: subscription.id, params: url.searchParams })
    json(res, 200, subscriptionObject(subscription))
  }

  async function createRefund(req: IncomingMessage, res: ServerResponse) {
    const body = await formBody(req)
    if (refundFailure !== null) {
      return stripeError(res, refundFailure, 'The fake Stripe server failed this refund')
    }
    const paymentIntent = body.get('payment_intent') ?? ''
    const invoice = [...invoices.values()].find((held) => held.paymentIntent === paymentIntent)
    if (!invoice) return stripeError(res, 404, `No such payment_intent: '${paymentIntent}'`)
    const refunded = heldRefunds
      .filter((refund) => refund.paymentIntent === paymentIntent)
      .reduce((sum, refund) => sum + refund.amount, 0)
    const remainder = invoice.amountPaid - refunded
    const amount = body.has('amount') ? Number(body.get('amount')) : remainder
    if (amount > remainder) {
      return stripeError(
        res,
        400,
        `Refund amount ${amount} is greater than unrefunded ${remainder}`,
      )
    }
    const refund: HeldRefund = {
      id: nextId('re'),
      paymentIntent,
      amount,
      currency: invoice.currency,
      metadata: metadataOf(body),
    }
    heldRefunds.push(refund)
    refunds.push(body)
    json(res, 200, refundObject(refund))
  }

  async function route(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    idempotencyKey: string | null,
  ) {
    const route = `${req.method} ${url.pathname}`
    if (route === 'POST /v1/checkout/sessions') return createCheckoutSession(req, res)
    if (route === 'POST /v1/billing_portal/sessions') return createPortalSession(req, res)
    if (route === 'POST /v1/invoices/create_preview') return previewInvoice(req, res)
    const configurationPath = /^\/v1\/billing_portal\/configurations(?:\/([^/]+))?$/.exec(
      url.pathname,
    )
    if (configurationPath) {
      return portalConfigurationRoute(req, res, url, configurationPath[1] ?? null)
    }
    if (route === 'POST /v1/refunds') return createRefund(req, res)
    if (route === 'GET /v1/refunds') {
      const paymentIntent = url.searchParams.get('payment_intent')
      const data = heldRefunds.filter((refund) => refund.paymentIntent === paymentIntent)
      return json(res, 200, {
        object: 'list',
        data: data.map(refundObject),
        has_more: false,
        url: '/v1/refunds',
      })
    }
    const subscriptionId = /^\/v1\/subscriptions\/([^/]+)$/.exec(url.pathname)?.[1]
    if (subscriptionId && ['GET', 'POST', 'DELETE'].includes(req.method ?? '')) {
      const subscription = subscriptions.get(subscriptionId)
      if (!subscription) return stripeError(res, 404, `No such subscription: '${subscriptionId}'`)
      if (req.method === 'DELETE') return cancelSubscription(subscription, url, res)
      if (req.method === 'POST') {
        return updateSubscription(subscription, req, res, idempotencyKey)
      }
      return json(res, 200, subscriptionObject(subscription))
    }
    const priceId = /^\/v1\/prices\/([^/]+)$/.exec(url.pathname)?.[1]
    if (priceId && req.method === 'GET') {
      const price = prices.get(priceId)
      if (!price) return stripeError(res, 404, `No such price: '${priceId}'`)
      return json(res, 200, priceObject(price))
    }
    const invoiceId = /^\/v1\/invoices\/([^/]+)$/.exec(url.pathname)?.[1]
    if (invoiceId && req.method === 'GET') {
      const invoice = invoices.get(invoiceId)
      if (!invoice) return stripeError(res, 404, `No such invoice: '${invoiceId}'`)
      return json(res, 200, invoiceObject(invoice, expands(url.searchParams, 'payments')))
    }
    stripeError(res, 400, `The fake Stripe server does not serve ${route}`)
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://fake')
    const header = req.headers['idempotency-key']
    const idempotencyKey = typeof header === 'string' ? header : null
    requests.push({ method: req.method ?? '', path: url.pathname, idempotencyKey })
    const handled = (async () => {
      if (latency !== null) {
        // Unref'd, so a test that ends while an answer is held never waits on it.
        await new Promise((resolve) => setTimeout(resolve, latency ?? 0).unref())
        if (res.destroyed) return
      }
      if (outage !== null) return stripeError(res, outage, 'The fake Stripe server is down')
      return route(req, res, url, idempotencyKey)
    })()
    handled.catch((error: unknown) => {
      json(res, 500, { error: { type: 'api_error', message: String(error) } })
    })
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  origin = `http://127.0.0.1:${port}`

  return {
    origin,
    host: '127.0.0.1',
    port,
    protocol: 'http',
    requests,
    checkoutSessions,
    portalSessions,
    portalConfigurations,
    subscriptionUpdates,
    invoicePreviews,
    cancellations,
    refunds,
    addSubscription({
      id,
      customer,
      status = 'active',
      periodStart,
      periodEnd,
      amountPaid,
      currency = 'usd',
      invoicePaid = true,
      canceledAt,
      endedAt,
      metadata = {},
      itemId = `si_${id}`,
      price,
      quantity = 1,
    }) {
      const invoiceId = nextId('in')
      const paymentIntent = amountPaid > 0 ? nextId('pi') : null
      invoices.set(invoiceId, {
        id: invoiceId,
        status: invoicePaid ? 'paid' : 'open',
        amountPaid,
        currency,
        paymentIntent,
      })
      subscriptions.set(id, {
        id,
        customer,
        status,
        canceledAt: canceledAt ? seconds(canceledAt) : null,
        endedAt: endedAt ? seconds(endedAt) : null,
        periodStart: seconds(periodStart),
        periodEnd: seconds(periodEnd),
        invoiceId,
        metadata,
        itemId,
        price: price ?? null,
        quantity,
      })
      return { paymentIntent }
    },
    addPrice({
      id,
      unitAmount,
      currency = 'usd',
      interval = 'month',
      product = 'prod_fake_stillstats',
    }) {
      prices.set(id, { id, unitAmount, currency, interval, product })
    },
    setProration(subscriptionId, amount) {
      prorations.set(subscriptionId, amount)
    },
    addPortalConfiguration({ metadata, active = true }) {
      const id = nextId('bpc')
      heldConfigurations.push({ id, active, metadata, created: seconds(now ?? new Date()) })
      return id
    },
    setNow(date) {
      now = date
    },
    failCheckout(status) {
      checkoutFailure = status
    },
    failRefunds(status) {
      refundFailure = status
    },
    failUpdates(status) {
      updateFailure = status
    },
    failPortalConfigurations(status) {
      configurationFailure = status
    },
    failAll(status) {
      outage = status
    },
    delay(ms) {
      latency = ms
    },
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections()
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}
