import { billingPlans } from '@creator-analytics/api-types'
import { isInternalId } from '@creator-analytics/database'
import { type Plan, purgeDateOf, type SubscriptionFields } from '@creator-analytics/entitlements'
import Stripe from 'stripe'
import { channelMetadataKey } from './billing.ts'

export type ReadStripeEvent = { ok: true; event: Stripe.Event } | { ok: false }

/**
 * Verifies the `Stripe-Signature` header against the body, the exact string Stripe signed, before
 * it reads anything of the event. A missing header, a wrong signature, a changed body or a
 * timestamp outside Stripe's five-minute tolerance is the delivery's own fault, which answers
 * 400. Any other failure is the receiver's: it throws, and the 500 lets Stripe deliver again.
 */
export function readStripeEvent(
  body: string,
  signature: string | undefined,
  secret: string,
): ReadStripeEvent {
  try {
    return { ok: true, event: Stripe.webhooks.constructEvent(body, signature ?? '', secret) }
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) return { ok: false }
    throw error
  }
}

export type PaidTip =
  | { kind: 'ignored' }
  | { kind: 'no_reference'; checkoutSessionId: string }
  | {
      kind: 'tip'
      checkoutSessionId: string
      userId: string
      /** In the currency's smallest unit, as Stripe sends it. */
      amountTotal: number | null
      currency: string | null
    }

/**
 * What a verified event says of a tip. Only a completed Checkout Session that is paid and came
 * from the Stillstats Payment Link is one; the link carries the creator's user ID as
 * `client_reference_id`. Stripe sends `checkout.session.completed` for every Checkout Session on
 * the account, a Pro Checkout's included, so a session from any other link, or from none, is
 * ignored before its payment or its reference is read.
 */
export function paidTipOf(event: Stripe.Event, paymentLinkId: string): PaidTip {
  if (event.type !== 'checkout.session.completed') return { kind: 'ignored' }
  const session = event.data.object
  const link = session.payment_link
  if ((typeof link === 'string' ? link : link?.id) !== paymentLinkId) return { kind: 'ignored' }
  if (session.payment_status !== 'paid') return { kind: 'ignored' }
  const checkoutSessionId = session.id
  const userId = session.client_reference_id
  if (!userId) return { kind: 'no_reference', checkoutSessionId }
  return {
    kind: 'tip',
    checkoutSessionId,
    userId,
    amountTotal: session.amount_total,
    currency: session.currency,
  }
}

export type SubscriptionEvent =
  | { kind: 'ignored' }
  /** A Stillstats subscription with no item, which says neither its plan nor its paid period. */
  | { kind: 'no_item'; subscription: string }
  | {
      kind: 'subscription'
      /** The Checkout Session's or the subscription's ID, which finds it in Stripe's dashboard. */
      stripeObject: string
      fields: SubscriptionFields
      /**
       * Whether its item bills neither monthly nor annually, so it says no plan and its fields
       * carry none: the row keeps the plan it holds for the same subscription, and a new or
       * replacing one records no plan until its Checkout lands.
       */
      unexpectedInterval: boolean
    }

/** The ID of an object Stripe sends as its ID or expanded. */
function idOf(value: string | { id: string } | null): string | null {
  return typeof value === 'string' ? value : (value?.id ?? null)
}

/** The channel a Stillstats session or subscription names in its metadata, or null for none. */
function channelOf(metadata: Stripe.Metadata | null): string | null {
  const channelId = metadata?.[channelMetadataKey]
  return channelId && isInternalId(channelId) ? channelId : null
}

/** The event's time, which Stripe sends in seconds. */
function dateOf(seconds: number): Date {
  return new Date(seconds * 1000)
}

/**
 * The plan of each billing interval Stillstats sells: a price billed every month is the monthly
 * plan, and every year the annual one, whatever its price ID (ADR 0022).
 */
const planOfInterval: Partial<Record<Stripe.Price.Recurring.Interval, Plan>> = {
  month: 'monthly',
  year: 'annual',
}

/**
 * The plan a subscription item's price bills at, from its `recurring.interval`, or null for an
 * interval Stillstats sells no plan at: a day, a week, or more than one month or year between
 * billings (docs.stripe.com/api/prices/object).
 */
function planOf(item: Stripe.SubscriptionItem): Plan | null {
  const recurring = item.price.recurring
  if (recurring?.interval_count !== 1) return null
  return planOfInterval[recurring.interval] ?? null
}

type SubscriptionRead =
  | { kind: 'ignored' }
  | { kind: 'no_item' }
  | {
      kind: 'fields'
      fields: Omit<SubscriptionFields, 'eventCreated'>
      unexpectedInterval: boolean
    }

/**
 * What a subscription event says of a Stillstats channel's subscription. A subscription whose
 * metadata names a Stillstats channel is Stillstats', since only Stillstats Checkout writes it, at
 * any price, so one at a price Checkout no longer sells keeps its events recorded. The plan is its
 * first item's billing interval, so a switch of plan records the new one, and the end of the paid
 * period is the same item's, since API version 2025-03-31.basil. An item that bills neither monthly
 * nor annually says no plan, so the event records with none, which keeps the plan the row holds for
 * the same subscription (a new or replacing one records no plan until its Checkout lands), and its
 * status, period end and purge date still land: a missed `unpaid` or deletion would keep the
 * channel paid. A subscription with no item records nothing. A status of `incomplete` says nothing:
 * Stripe can send it before the first payment succeeds, and after the completed Checkout.
 */
function subscriptionFieldsOf(
  subscription: Stripe.Subscription,
  purgeAfter: Date | null,
): SubscriptionRead {
  const channelId = channelOf(subscription.metadata)
  const customer = idOf(subscription.customer)
  if (!channelId || !customer) return { kind: 'ignored' }
  const [item] = subscription.items.data
  if (!item) return { kind: 'no_item' }
  const plan = planOf(item)
  return {
    kind: 'fields',
    unexpectedInterval: plan === null,
    fields: {
      channelId,
      customer,
      subscription: subscription.id,
      plan,
      status: subscription.status === 'incomplete' ? null : subscription.status,
      periodEnd: dateOf(item.current_period_end),
      purgeAfter,
    },
  }
}

/**
 * The purge date an update sets: 30 days after the subscription ended, for one Stripe marks
 * `canceled`, or after the event, for one it marks `unpaid` once its retries are exhausted, which
 * ends the channel's Pro subscription as surely. Null for any other status, a cancellation at period end
 * included: the channel stays paid until Stripe ends it.
 */
function purgeOfUpdate(subscription: Stripe.Subscription, event: Stripe.Event): Date | null {
  if (subscription.status === 'canceled') {
    return purgeDateOf(dateOf(subscription.ended_at ?? event.created))
  }
  if (subscription.status === 'unpaid') return purgeDateOf(dateOf(event.created))
  return null
}

/**
 * What a verified event says of a Pro subscription. Only a Checkout Session or a subscription
 * that names a Stillstats channel in its metadata is read, at whatever price, and one whose item
 * bills neither monthly nor annually records with no plan. A paid subscription Checkout makes the
 * channel's subscription active. A created or an updated subscription carries its plan, its status
 * and the end of its paid period; a deleted one has ended, and sets the purge date 30 days after
 * its `ended_at` (ADR 0022), the event's own time when it carries none. Each carries the event's
 * time, which orders it against the others, since Stripe delivers them in no order and a failed
 * one again later. Invoice events, paid or failed, change no subscription: the subscription events
 * carry every change they cause (a failed renewal makes it `past_due`, still paid, and a paid retry
 * `active` again), so a failed payment changes nothing until Stripe's retries end the
 * subscription. A paid invoice is read for its revenue alone, by `subscriptionPaymentOf`.
 */
export function subscriptionEventOf(event: Stripe.Event): SubscriptionEvent {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const channelId = channelOf(session.metadata)
    if (session.mode !== 'subscription' || !channelId || session.payment_status !== 'paid')
      return { kind: 'ignored' }
    const customer = idOf(session.customer)
    const subscription = idOf(session.subscription)
    // Stripe sets both on every completed subscription Checkout. Throwing answers 500, so Stripe
    // delivers it again and the failure reports, rather than a payment that grants nothing.
    if (!customer || !subscription)
      throw new Error(
        `Paid subscription Checkout ${session.id} carries no customer or subscription`,
      )
    const plan = billingPlans.find((each) => each === session.metadata?.plan) ?? null
    return {
      kind: 'subscription',
      stripeObject: session.id,
      fields: {
        channelId,
        customer,
        subscription,
        plan,
        status: 'active',
        periodEnd: null,
        purgeAfter: null,
        eventCreated: dateOf(event.created),
      },
      unexpectedInterval: false,
    }
  }
  let subscription: Stripe.Subscription
  let read: SubscriptionRead
  if (event.type === 'customer.subscription.created') {
    subscription = event.data.object
    read = subscriptionFieldsOf(subscription, null)
  } else if (event.type === 'customer.subscription.updated') {
    subscription = event.data.object
    read = subscriptionFieldsOf(subscription, purgeOfUpdate(subscription, event))
  } else if (event.type === 'customer.subscription.deleted') {
    subscription = event.data.object
    const endedAt = dateOf(subscription.ended_at ?? event.created)
    read = subscriptionFieldsOf(subscription, purgeDateOf(endedAt))
    if (read.kind === 'fields') read.fields.status = 'canceled'
  } else {
    return { kind: 'ignored' }
  }
  if (read.kind === 'ignored') return { kind: 'ignored' }
  if (read.kind === 'no_item') return { kind: 'no_item', subscription: subscription.id }
  return {
    kind: 'subscription',
    stripeObject: read.fields.subscription,
    fields: { ...read.fields, eventCreated: dateOf(event.created) },
    unexpectedInterval: read.unexpectedInterval,
  }
}

export type SubscriptionPayment =
  | { kind: 'ignored' }
  | {
      kind: 'payment'
      invoiceId: string
      channelId: string
      /**
       * In the currency's smallest unit, as Stripe sends it: the invoice's total after discounts,
       * prorations included, and before tax. Null when Stripe sends none.
       */
      amountExcludingTax: number | null
      currency: string
    }

/**
 * What a verified event says of a paid invoice of a Stillstats subscription, by the rule the
 * subscription events use: the subscription's metadata, which the invoice carries as a snapshot
 * under `parent.subscription_details`, names a Stillstats channel, at whatever price. Its lines
 * are not read: since API version 2025-03-31.basil a line names its price by ID alone, under
 * `pricing.price_details.price`, with no billing interval (docs.stripe.com/api/invoice-line-item/
 * object), and a payment needs no plan. Every paid invoice counts, the first payment and each
 * renewal; a completed Checkout counts nothing, since its first payment is its first invoice.
 *
 * The amount is `total_excluding_tax`, "the total amount of the invoice including all discounts but
 * excluding all tax" (docs.stripe.com/api/invoices/object, checked 2026-11-18): under Managed
 * Payments Stripe adds the tax it collects as merchant of record to the amount paid. A proration on
 * a plan switch is a line of the invoice, so its credit lowers the amount, and a credit larger than
 * the charge makes it negative, which is sent as it is (docs.stripe.com/billing/subscriptions/
 * prorations shows such totals). A customer credit balance applies "after taxes" to the next
 * invoice's `amount_due` (docs.stripe.com/billing/customer/balance), so an invoice paid from it
 * counts its whole amount: a credit from a proration already counted against the amount of the
 * invoice that made it.
 */
export function subscriptionPaymentOf(event: Stripe.Event): SubscriptionPayment {
  if (event.type !== 'invoice.paid') return { kind: 'ignored' }
  const invoice = event.data.object
  const channelId = channelOf(invoice.parent?.subscription_details?.metadata ?? null)
  if (!channelId) return { kind: 'ignored' }
  return {
    kind: 'payment',
    invoiceId: invoice.id,
    channelId,
    amountExcludingTax: invoice.total_excluding_tax,
    currency: invoice.currency,
  }
}
