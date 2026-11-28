import { recordSubscription } from '@creator-analytics/entitlements'
import type { Hono } from 'hono'
import type Stripe from 'stripe'
import type { ApiDependencies } from '../app.ts'
import {
  paidTipOf,
  readStripeEvent,
  subscriptionEventOf,
  subscriptionPaymentOf,
} from '../stripe-events.ts'
import { recordSubscriptionPayment } from '../subscription-payments.ts'
import type { SupportSettings } from '../support.ts'
import { recordTip } from '../tips.ts'

type EventDependencies = Pick<ApiDependencies, 'database' | 'reporter' | 'eventRelay'>

export const stripeEventsPath = '/api/stripe/events'

/**
 * A session from any Payment Link but the Stillstats one, such as a Pro Checkout, is no tip,
 * which records and reports nothing. A paid Stillstats session the app cannot tie to a creator
 * reports to GlitchTip with the session's ID, which finds the payment in Stripe's dashboard, and
 * never the reference it carries. One whose reference names no user still records the tip, with no
 * user, so its revenue counts once. A newly recorded tip, and never a repeat, sends OpenPanel
 * `revenue` with the amount as `__revenue` and the currency, and no user ID, user agent or IP; an
 * OpenPanel failure is the relay's report and never changes the answer.
 */
async function receiveTip(
  event: Stripe.Event,
  support: SupportSettings,
  { database, reporter, eventRelay }: EventDependencies,
): Promise<void> {
  const tip = paidTipOf(event, support.paymentLinkId)
  if (tip.kind === 'no_reference') {
    reporter.report({
      message: 'A paid Stripe Checkout Session carries no client_reference_id',
      context: { checkoutSession: tip.checkoutSessionId },
    })
  }
  if (tip.kind !== 'tip') return
  const { checkoutSessionId, userId } = tip
  const recorded = await database.asAnonymous((tx) => recordTip(tx, { userId, checkoutSessionId }))
  if (!recorded.namesUser) {
    reporter.report({
      message: 'A paid Stripe Checkout Session names no user',
      context: { checkoutSession: checkoutSessionId },
    })
  }
  // After the transaction has returned, so no event goes out for a write that rolls back and an
  // OpenPanel delay never holds a transaction open.
  if (recorded.outcome !== 'recorded') return
  const { amountTotal, currency } = tip
  if (amountTotal === null || currency === null) {
    reporter.report({
      message: 'A paid Stripe Checkout Session carries no amount',
      context: { checkoutSession: checkoutSessionId },
    })
    return
  }
  await eventRelay.sendServerEvent({ name: 'revenue', __revenue: amountTotal, currency })
}

/**
 * A Stillstats subscription's event records what it carries for its user, once, at whatever
 * price: its plan is its billing interval and its quantity the number of blocks. A session or
 * subscription that names no Stillstats user, nor a Stillstats channel as one made before blocks
 * does, came from no Stillstats Checkout, and records and reports nothing. One whose item bills
 * neither monthly nor annually says no plan: it records with none, which keeps the plan the row
 * holds for the same subscription (a new or replacing one records no plan until its Checkout
 * lands), so its status, period end and purge date still land, and reports to GlitchTip with the
 * subscription's ID only, since Stillstats sells no such price, once the write shows its user is
 * there. One with no item records nothing and reports to GlitchTip with the subscription's ID on
 * every event, whether or not its user exists. One that names a user that no longer exists, or a
 * channel with no owner, such as one deleted while its owner was on Stripe's page, reports to
 * GlitchTip with the session's or the subscription's ID only; but not a deleted subscription's,
 * since an account deletion cancels its subscription and Stripe then tells of it for a user
 * already gone. A live subscription other than a paid user's own, such as a second Checkout paid
 * in another tab, records nothing and reports the same way, since Stripe charges for it. An event
 * whose write turns the user's subscription paid sends the history download of each channel it
 * turned Pro in the same transaction (`recordSubscription`), so Pro's impressions and CTR do not
 * wait for the next daily run.
 */
async function receiveSubscription(
  event: Stripe.Event,
  { database, reporter }: EventDependencies,
): Promise<void> {
  const subscribed = subscriptionEventOf(event)
  if (subscribed.kind === 'no_item') {
    reporter.report({
      message: 'A Stillstats Stripe subscription carries no item',
      context: { stripeObject: subscribed.subscription },
    })
  }
  if (subscribed.kind !== 'subscription') return
  const outcome = await database.asAnonymous((tx) => recordSubscription(tx, subscribed.fields))
  if (subscribed.unexpectedInterval && outcome !== 'no_user') {
    reporter.report({
      message: 'A Stillstats Stripe subscription bills neither monthly nor annually',
      context: { stripeObject: subscribed.stripeObject },
    })
  }
  if (outcome === 'no_user' && event.type !== 'customer.subscription.deleted') {
    reporter.report({
      message: 'A paid Stripe subscription names no user',
      context: { stripeObject: subscribed.stripeObject },
    })
  }
  if (outcome === 'other_subscription') {
    reporter.report({
      message: 'A second Stripe subscription names a paid user',
      context: { stripeObject: subscribed.stripeObject },
    })
  }
}

/**
 * A paid invoice of a Stillstats subscription, the first payment and each renewal alike, records
 * once per invoice, and a newly recorded one, never a repeat, sends OpenPanel `revenue` with its
 * amount before tax as `__revenue` and its currency, and no user, channel, customer or
 * subscription ID, user agent or IP, as a tip does. An invoice whose subscription names no
 * Stillstats user or channel, or one of a user that no longer exists, records and sends nothing:
 * an account deletion cancels its subscription and refunds the unused part of its latest invoice.
 * An OpenPanel failure is the relay's report and never changes the answer.
 */
async function receiveSubscriptionPayment(
  event: Stripe.Event,
  { database, reporter, eventRelay }: EventDependencies,
): Promise<void> {
  const payment = subscriptionPaymentOf(event)
  if (payment.kind !== 'payment') return
  const recorded = await database.asAnonymous((tx) => recordSubscriptionPayment(tx, payment))
  // After the transaction has returned, as for a tip.
  if (!recorded) return
  const { amountExcludingTax, currency } = payment
  if (amountExcludingTax === null) {
    reporter.report({
      message: 'A paid Stripe invoice carries no amount before tax',
      context: { invoice: payment.invoiceId },
    })
    return
  }
  await eventRelay.sendServerEvent({ name: 'revenue', __revenue: amountExcludingTax, currency })
}

/**
 * POST /api/stripe/events: Stripe's webhook, with no session; Stripe's signature stands in for
 * one. With neither the tip's nor Pro's settings the route does not exist; both read the
 * one `STRIPE_WEBHOOK_SECRET`. A delivery that fails verification answers 400 and is never read
 * further. A verified one answers 200, a tip, a subscription, a subscription's payment or none of
 * them, since Stripe reads only the status, unless a write throws: that answers 500, so Stripe delivers again.
 */
export function stripeEventsRoute(
  app: Hono,
  {
    support,
    billing,
    ...dependencies
  }: Pick<ApiDependencies, 'support' | 'billing'> & EventDependencies,
): void {
  const webhookSecret = support?.webhookSecret ?? billing?.settings.webhookSecret
  if (!webhookSecret) return
  app.post(stripeEventsPath, async (c) => {
    // The raw body, read once and never parsed before the signature check: Stripe signs the exact
    // string it sends.
    const read = readStripeEvent(
      await c.req.text(),
      c.req.header('stripe-signature'),
      webhookSecret,
    )
    if (!read.ok) return c.body(null, 400)
    if (support) await receiveTip(read.event, support, dependencies)
    if (billing) {
      await receiveSubscription(read.event, dependencies)
      await receiveSubscriptionPayment(read.event, dependencies)
    }
    return c.body(null, 200)
  })
}
