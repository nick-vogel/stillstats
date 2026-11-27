import Stripe from 'stripe'
import type { BillingSettings } from '../src/billing.ts'
import type { StartedApi } from './start-api.ts'

/**
 * The Stripe settings a test API starts with. Each delivery is signed with this secret, and each
 * session comes from this Payment Link unless a test says otherwise.
 */
export const testStripe = {
  paymentLinkUrl: 'https://buy.stripe.com/test_00g3cd',
  webhookSecret: 'whsec_test_webhook_secret',
  paymentLinkId: 'plink_test_stillstats',
}

/**
 * The Pro settings a test API starts with, sharing the tip's webhook secret, as the one
 * endpoint does.
 */
export const testBilling: BillingSettings = {
  secretKey: 'sk_test_stillstats',
  prices: { monthly: 'price_test_monthly', annual: 'price_test_annual' },
  webhookSecret: testStripe.webhookSecret,
}

export interface CheckoutSessionFields {
  /** The Checkout Session's ID, `cs_test_tip` unless given. */
  id?: string
  clientReferenceId: string | null
  paymentStatus?: 'paid' | 'unpaid' | 'no_payment_required'
  /** The event type, `checkout.session.completed` unless given. */
  type?: string
  /** In the currency's smallest unit, `500` unless given. */
  amountTotal?: number | null
  /** Stripe's lowercase currency code, `usd` unless given. */
  currency?: string | null
  /**
   * The Payment Link that created the session: its ID, or the expanded object. The test API's
   * Stillstats link unless given; `null` is a session no Payment Link created.
   */
  paymentLink?: string | { id: string; object: 'payment_link' } | null
}

/** The JSON body Stripe sends for a Checkout Session event, with the fields a tip reads. */
export function checkoutSessionEvent({
  id = 'cs_test_tip',
  clientReferenceId,
  paymentStatus = 'paid',
  type = 'checkout.session.completed',
  amountTotal = 500,
  currency = 'usd',
  paymentLink = testStripe.paymentLinkId,
}: CheckoutSessionFields): string {
  return JSON.stringify({
    id: `evt_test_${id}`,
    object: 'event',
    type,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: {
      object: {
        id,
        object: 'checkout.session',
        client_reference_id: clientReferenceId,
        payment_status: paymentStatus,
        status: 'complete',
        mode: 'payment',
        amount_total: amountTotal,
        currency,
        payment_link: paymentLink,
      },
    },
  })
}

const secondsOf = (date: Date) => Math.floor(date.getTime() / 1000)

/** An event's JSON body, created now unless given. */
function eventOf(
  type: string,
  object: Record<string, unknown>,
  created: Date = new Date(),
): string {
  return JSON.stringify({
    id: `evt_test_${type}_${String(object.id)}`,
    object: 'event',
    type,
    created: secondsOf(created),
    livemode: false,
    data: { object },
  })
}

export interface SubscriptionCheckoutFields {
  /** The channel the session's metadata names; `null` is a session with no Stillstats metadata. */
  channelId: string | null
  /** The Checkout Session's ID, `cs_test_subscription` unless given. */
  id?: string
  plan?: 'monthly' | 'annual'
  paymentStatus?: 'paid' | 'unpaid' | 'no_payment_required'
  /** The session's mode, `subscription` unless given. */
  mode?: 'payment' | 'subscription' | 'setup'
  customer?: string
  subscription?: string
  /** When Stripe created the event, now unless given. */
  created?: Date
}

/**
 * The JSON body of `checkout.session.completed` for a Pro Checkout, as the Checkout route
 * opens it: in subscription mode, from no Payment Link, with the channel in its metadata.
 */
export function subscriptionCheckoutEvent({
  channelId,
  id = 'cs_test_subscription',
  plan = 'monthly',
  paymentStatus = 'paid',
  mode = 'subscription',
  customer = 'cus_test_stillstats',
  subscription = 'sub_test_stillstats',
  created,
}: SubscriptionCheckoutFields): string {
  return eventOf(
    'checkout.session.completed',
    {
      id,
      object: 'checkout.session',
      client_reference_id: channelId,
      payment_status: paymentStatus,
      status: 'complete',
      mode,
      amount_total: plan === 'monthly' ? 700 : 7000,
      currency: 'usd',
      payment_link: null,
      customer,
      subscription,
      metadata: channelId === null ? {} : { stillstats_channel_id: channelId, plan },
    },
    created,
  )
}

export interface SubscriptionCreatedFields {
  /** The channel the subscription's metadata names; `null` is one with no Stillstats metadata. */
  channelId: string | null
  /**
   * How often its one item's price bills, Stripe's `recurring.interval`: `month` unless given. The
   * webhook reads the plan from it (#813).
   */
  interval?: Stripe.Price.Recurring.Interval
  /** The intervals between its item's billings, `recurring.interval_count`: 1 unless given. */
  intervalCount?: number
  /**
   * The ID of its one item's price: the test API's price for the interval unless given. Another ID
   * is a price Checkout no longer sells, such as one before a change of price.
   */
  price?: string
  /** Whether it carries no item at all, which no Stillstats Checkout makes: false unless given. */
  withoutItems?: boolean
  /** Stripe's status of the subscription, `active` unless given. */
  status?: string
  /** The end of the item's paid period. */
  periodEnd?: Date
  customer?: string
  subscription?: string
  /** When Stripe created the event, now unless given. */
  created?: Date
}

/**
 * A subscription object as Stripe sends it in an event. Since API version 2025-03-31.basil the end
 * of the paid period is on each item, not on the subscription. Each item carries its whole Price
 * object, with its billing interval under `recurring` (docs.stripe.com/api/subscriptions/object).
 */
function subscriptionObjectOf(
  {
    channelId,
    interval = 'month',
    intervalCount = 1,
    price = interval === 'year' ? testBilling.prices.annual : testBilling.prices.monthly,
    status = 'active',
    periodEnd = new Date('2026-12-17T12:00:00.000Z'),
    customer = 'cus_test_stillstats',
    subscription = 'sub_test_stillstats',
    withoutItems = false,
  }: SubscriptionCreatedFields,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const item = {
    id: `si_${subscription}`,
    object: 'subscription_item',
    price: {
      id: price,
      object: 'price',
      active: true,
      billing_scheme: 'per_unit',
      currency: 'usd',
      livemode: false,
      product: 'prod_test_stillstats',
      recurring: {
        interval,
        interval_count: intervalCount,
        meter: null,
        trial_period_days: null,
        usage_type: 'licensed',
      },
      type: 'recurring',
      unit_amount: interval === 'year' ? 7000 : 700,
    },
    quantity: 1,
    current_period_end: secondsOf(periodEnd),
  }
  return {
    id: subscription,
    object: 'subscription',
    customer,
    status,
    metadata: channelId === null ? {} : { stillstats_channel_id: channelId },
    ...extra,
    items: {
      object: 'list',
      data: withoutItems ? [] : [item],
    },
  }
}

/** The JSON body of `customer.subscription.created`. */
export function subscriptionCreatedEvent(fields: SubscriptionCreatedFields): string {
  return eventOf('customer.subscription.created', subscriptionObjectOf(fields), fields.created)
}

export interface SubscriptionUpdatedFields extends SubscriptionCreatedFields {
  /** Whether it cancels at the end of its paid period, false unless given. */
  cancelAtPeriodEnd?: boolean
}

/**
 * The JSON body of `customer.subscription.updated`, which Stripe sends for a change made in the
 * Customer Portal, on link.com, or by its own retries of a failed payment.
 */
export function subscriptionUpdatedEvent({
  cancelAtPeriodEnd = false,
  ...fields
}: SubscriptionUpdatedFields): string {
  return eventOf(
    'customer.subscription.updated',
    subscriptionObjectOf(fields, { cancel_at_period_end: cancelAtPeriodEnd }),
    fields.created,
  )
}

export interface SubscriptionDeletedFields extends Omit<SubscriptionCreatedFields, 'status'> {
  /** When the subscription ended; `null` is a body that carries no `ended_at`. */
  endedAt: Date | null
  /**
   * When its cancellation was asked for, `endedAt` unless given: for a cancellation at the end of
   * the paid period, the press of Cancel, before it ended.
   */
  canceledAt?: Date | null
}

/** The JSON body of `customer.subscription.deleted`: the subscription has ended, `canceled`. */
export function subscriptionDeletedEvent({
  endedAt,
  canceledAt = endedAt,
  ...fields
}: SubscriptionDeletedFields): string {
  return eventOf(
    'customer.subscription.deleted',
    subscriptionObjectOf(
      { ...fields, status: 'canceled' },
      {
        ended_at: endedAt && secondsOf(endedAt),
        canceled_at: canceledAt && secondsOf(canceledAt),
      },
    ),
    fields.created,
  )
}

export interface InvoiceFields {
  /** The channel the subscription's metadata names; `null` is one with no Stillstats metadata. */
  channelId: string | null
  /** The invoice's ID, `in_test_` and the subscription's ID unless given. */
  id?: string
  customer?: string
  subscription?: string
  /**
   * The ID of the price of its one line, the monthly test price unless given. A line names its
   * price by ID alone, with no billing interval, as Stripe sends it in an event.
   */
  price?: string
  /** Why Stripe made it, `subscription_create` for the first payment unless given. */
  billingReason?: 'subscription_create' | 'subscription_cycle' | 'subscription_update'
  /**
   * In the currency's smallest unit, `700` unless given: the total after discounts and before
   * tax. `null` is a body that carries none.
   */
  totalExcludingTax?: number | null
  /** The tax Stripe adds as the merchant of record, `0` unless given. */
  tax?: number
  /** Stripe's lowercase currency code, `usd` unless given. */
  currency?: string
}

/**
 * The JSON body of an invoice event of the subscription, such as `invoice.paid`. A subscription's
 * invoice carries a snapshot of the subscription's metadata, so it names the channel as the
 * subscription does, and since API version 2025-03-31.basil each line names its price under
 * `pricing.price_details`. Its `total` and `amount_paid` include the tax; `total_excluding_tax`
 * does not.
 */
export function invoiceEvent(
  type: 'invoice.paid' | 'invoice.payment_failed',
  {
    channelId,
    customer = 'cus_test_stillstats',
    subscription = 'sub_test_stillstats',
    id = `in_test_${subscription}`,
    price = testBilling.prices.monthly,
    billingReason = 'subscription_create',
    totalExcludingTax = 700,
    tax = 0,
    currency = 'usd',
  }: InvoiceFields,
): string {
  const total = (totalExcludingTax ?? 0) + tax
  return eventOf(type, {
    id,
    object: 'invoice',
    customer,
    status: type === 'invoice.paid' ? 'paid' : 'open',
    billing_reason: billingReason,
    amount_due: total,
    amount_paid: type === 'invoice.paid' ? total : 0,
    subtotal: totalExcludingTax,
    total,
    total_excluding_tax: totalExcludingTax,
    total_taxes: tax === 0 ? [] : [{ amount: tax, tax_behavior: 'exclusive' }],
    currency,
    parent: {
      type: 'subscription_details',
      subscription_details: {
        subscription,
        metadata: channelId === null ? {} : { stillstats_channel_id: channelId },
      },
    },
    lines: {
      object: 'list',
      has_more: false,
      data: [
        {
          id: `il_${id}`,
          object: 'line_item',
          amount: totalExcludingTax,
          currency,
          pricing: {
            type: 'price_details',
            price_details: { price, product: 'prod_test_stillstats' },
          },
        },
      ],
    },
  })
}

/** A `Stripe-Signature` header for the body, from Stripe's own test helper. */
export function stripeSignatureOf(
  payload: string,
  { secret = testStripe.webhookSecret, timestamp }: { secret?: string; timestamp?: number } = {},
): string {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    ...(timestamp !== undefined && { timestamp }),
  })
}

/**
 * Posts the body to the webhook route, as Stripe delivers it. The header is the body's signature
 * with the test API's secret unless given; `null` sends no header. `extraHeaders` adds to the
 * request, such as the user agent and the Cloudflare headers a real delivery carries.
 */
export function deliverStripeEvent(
  api: Pick<StartedApi, 'origin'>,
  body: string,
  signature: string | null = stripeSignatureOf(body),
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const headers = new Headers({
    ...extraHeaders,
    'content-type': 'application/json; charset=utf-8',
  })
  if (signature !== null) headers.set('stripe-signature', signature)
  return fetch(new URL('/api/stripe/events', api.origin), { method: 'POST', headers, body })
}
