import { once } from 'node:events'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * Stripe's API at the HTTP level, for every test that would otherwise call Stripe, as the real
 * stripe-node client calls it: point the client's `host`, `port` and `protocol` here. It answers
 * `POST /v1/checkout/sessions` with a Checkout Session whose URL is on this server;
 * `POST /v1/billing_portal/sessions` with a Customer Portal session whose URL is on this server; a
 * seeded subscription's reads, its immediate cancellation, and refunds of its latest invoice's
 * payment; a seeded price's read; and 400 to any route it does not serve. A change made in the Portal reaches the API only
 * through Stripe's webhook, so the fake serves no update of a subscription: a test builds that
 * event itself.
 *
 * It checks none of Stripe's own rules for a session or a cancellation, prorates nothing, and
 * refuses a refund only over its payment's unrefunded remainder, so it cannot prove Stripe accepts
 * what the client sends, or that Managed Payments takes it. The walk of Pro on
 * production (creator-analytics#791) covers those.
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
  /** The clock a cancellation is stamped with: system time until a test sets it. */
  setNow(now: Date): void
  /** Every later Checkout Session request answers this HTTP status with a Stripe error. */
  failCheckout(status: number): void
  /** Every later refund request answers this HTTP status with a Stripe error; null ends it. */
  failRefunds(status: number | null): void
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
  const refunds: URLSearchParams[] = []
  const subscriptions = new Map<string, HeldSubscription>()
  const invoices = new Map<string, HeldInvoice>()
  const heldRefunds: HeldRefund[] = []
  const prices = new Map<string, Required<FakePrice>>()
  let checkoutFailure: number | null = null
  let refundFailure: number | null = null
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
    return {
      id: subscription.id,
      object: 'subscription',
      customer: subscription.customer,
      status: subscription.status,
      canceled_at: subscription.canceledAt,
      ended_at: subscription.endedAt,
      latest_invoice: subscription.invoiceId,
      items: {
        object: 'list',
        data: [
          {
            id: `si_${subscription.id}`,
            object: 'subscription_item',
            current_period_start: subscription.periodStart,
            current_period_end: subscription.periodEnd,
          },
        ],
      },
    }
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
      product: 'prod_fake_stillstats',
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

  async function route(req: IncomingMessage, res: ServerResponse, url: URL) {
    const route = `${req.method} ${url.pathname}`
    if (route === 'POST /v1/checkout/sessions') return createCheckoutSession(req, res)
    if (route === 'POST /v1/billing_portal/sessions') return createPortalSession(req, res)
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
    if (subscriptionId && (req.method === 'GET' || req.method === 'DELETE')) {
      const subscription = subscriptions.get(subscriptionId)
      if (!subscription) return stripeError(res, 404, `No such subscription: '${subscriptionId}'`)
      if (req.method === 'DELETE') return cancelSubscription(subscription, url, res)
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
    const idempotencyKey = req.headers['idempotency-key']
    requests.push({
      method: req.method ?? '',
      path: url.pathname,
      idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : null,
    })
    const handled = (async () => {
      if (latency !== null) {
        // Unref'd, so a test that ends while an answer is held never waits on it.
        await new Promise((resolve) => setTimeout(resolve, latency ?? 0).unref())
        if (res.destroyed) return
      }
      if (outage !== null) return stripeError(res, outage, 'The fake Stripe server is down')
      return route(req, res, url)
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
      })
      return { paymentIntent }
    },
    addPrice({ id, unitAmount, currency = 'usd', interval = 'month' }) {
      prices.set(id, { id, unitAmount, currency, interval })
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
