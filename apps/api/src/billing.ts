import type { PlanPrice } from '@creator-analytics/api-types'
import type { Plan } from '@creator-analytics/entitlements'
import Stripe from 'stripe'
import { webAppPath } from './auth.ts'

/** The Stripe settings Pro needs: the API's key, the two prices, the webhook's secret. */
export interface BillingSettings {
  /** A secret key, `sk_...`, or a restricted key, `rk_...`. */
  secretKey: string
  /**
   * The Stripe price ID Checkout sells each plan at, `price_...`: $7 a month and $70 a year
   * (ADR 0022). The webhook reads a subscription's plan from its billing interval, never from these,
   * so a subscription on an earlier price stays recorded.
   */
  prices: Record<Plan, string>
  /** The one webhook endpoint's signing secret, which a tip reads too. */
  webhookSecret: string
}

/**
 * Pro's settings from the API's env. None of the key and the two prices set means no
 * Pro. Some but not all, a price that is not a price ID, a key that is neither a secret nor
 * a restricted key, or no webhook secret throws, so the API refuses to start rather than fail on a
 * click or never hear of a payment.
 */
export function billingSettingsOf(
  env: Readonly<Record<string, string | undefined>>,
): BillingSettings | undefined {
  const secretKey = env.STRIPE_SECRET_KEY
  const monthly = env.STRIPE_PRICE_MONTHLY
  const annual = env.STRIPE_PRICE_ANNUAL
  if (!secretKey && !monthly && !annual) return undefined
  if (!secretKey || !monthly || !annual)
    throw new Error(
      'Set all three of STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY and STRIPE_PRICE_ANNUAL, or none',
    )
  if (!secretKey.startsWith('sk_') && !secretKey.startsWith('rk_'))
    throw new Error('STRIPE_SECRET_KEY is not a secret key, sk_, or a restricted key, rk_')
  for (const [name, price] of [
    ['STRIPE_PRICE_MONTHLY', monthly],
    ['STRIPE_PRICE_ANNUAL', annual],
  ]) {
    if (!price?.startsWith('price_'))
      throw new Error(`${name} is not a price's ID, which starts with price_`)
  }
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret)
    throw new Error('Set STRIPE_WEBHOOK_SECRET, which tells the API of each subscription')
  return { secretKey, prices: { monthly, annual }, webhookSecret }
}

/** The fake Stripe server's address, which a test points the client at in place of Stripe's. */
export interface StripeApi {
  host: string
  port: number
  protocol: 'http' | 'https'
}

export interface Billing {
  readonly settings: BillingSettings
  /**
   * Opens a Checkout Session for the channel's subscription to the plan, and answers its URL on
   * Stripe. The customer is the channel's earlier one, or null for a channel that never subscribed.
   */
  startCheckout(checkout: {
    channelId: string
    plan: Plan
    customerId: string | null
  }): Promise<string>
  /**
   * Opens a Customer Portal session for the channel's Stripe customer, in which its owner changes
   * the card, switches between the two plans or cancels at period end, and answers its URL on
   * Stripe.
   */
  openPortal(portal: { customerId: string }): Promise<string>
  /**
   * The amount and currency of the two prices Checkout sells, read from Stripe once for the
   * process and kept. Calls that arrive together share one read. It never rejects: a read that
   * fails, takes longer than its deadline, or finds a price with no single amount answers null and
   * calls `report` once, and every call for the next minute answers null with no read and no
   * report, after which the next call reads Stripe again.
   */
  readPrices(report: (error: unknown) => void): Promise<Record<Plan, PlanPrice> | null>
}

/**
 * The metadata a Stillstats session and its subscription carry, which marks them as Stillstats',
 * since only Stillstats Checkout writes it, and names the channel they pay for.
 */
export const channelMetadataKey = 'stillstats_channel_id'

// Long enough for Stripe on a normal day, short enough that a hanging Stripe never holds the
// upgrade answer near Cloudflare's 100-second limit. The read is not retried, since the next view
// of the screen reads again once the failure window ends.
const defaultPriceTimeoutMs = 3_000

// How long a failed price read is kept: a failure Stripe keeps answering, such as a restricted key
// with no read on Prices or a wrong price ID, is read and reported once in this window at most.
const priceFailureMs = 60_000

export function createBilling({
  settings,
  baseURL,
  stripeApi,
  now = () => new Date(),
  priceTimeoutMs = defaultPriceTimeoutMs,
}: {
  settings: BillingSettings
  /** The API's own origin, which Stripe's page returns to. */
  baseURL: string
  stripeApi?: StripeApi
  /** The clock a failed price read's window runs on. Unset, system time. */
  now?: () => Date
  /** The deadline of one price read, in milliseconds. Unset, 3 seconds. */
  priceTimeoutMs?: number
}): Billing {
  const stripe = new Stripe(
    settings.secretKey,
    stripeApi && { host: stripeApi.host, port: stripeApi.port, protocol: stripeApi.protocol },
  )
  const settingsPage = new URL(`${webAppPath}/settings`, baseURL).href

  // docs.stripe.com/api/prices/object and /api/prices/update, checked 2026-11-19: `unit_amount` is
  // the amount in the currency's smallest unit, null unless `billing_scheme` is `per_unit`, and
  // `currency` is the lowercase ISO code. Neither can be updated on a price, and a new price takes
  // a new ID, which a changed STRIPE_PRICE_* setting brings with a restart, so a read stays right
  // for the process.
  async function readPrice(plan: Plan): Promise<PlanPrice> {
    // A deadline of its own and no retry, so a slow Stripe costs one deadline and no more: the
    // per-request `timeout` and `maxNetworkRetries` of stripe-node 23.1.0's `RequestOptions`, which
    // otherwise default to 80 seconds and 2 retries.
    const price = await stripe.prices.retrieve(
      settings.prices[plan],
      {},
      { timeout: priceTimeoutMs, maxNetworkRetries: 0 },
    )
    if (price.unit_amount === null) {
      throw new Error(`Stripe's ${plan} price has no unit_amount, so no single amount`)
    }
    return { amount: price.unit_amount, currency: price.currency }
  }
  let prices: Promise<Record<Plan, PlanPrice> | null> | null = null
  let failedAt: number | null = null

  return {
    settings,
    async startCheckout({ channelId, plan, customerId }) {
      const metadata = { [channelMetadataKey]: channelId, plan }
      // Managed Payments' parameters, from docs.stripe.com/payments/managed-payments/set-up and
      // /update-checkout, checked 2026-11-17. It refuses a session that also sets automatic_tax,
      // tax_id_collection, payment_method_types, payment_method_options,
      // payment_method_configuration, subscription_data.default_tax_rates or invoice_settings,
      // invoice_creation, shipping or any Connect parameter, so none of them is set here. No email
      // or name: Stripe's page asks for them.
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: settings.prices[plan], quantity: 1 }],
        managed_payments: { enabled: true },
        client_reference_id: channelId,
        metadata,
        subscription_data: { metadata },
        ...(customerId !== null && { customer: customerId }),
        success_url: settingsPage,
        cancel_url: settingsPage,
      })
      if (!session.url) throw new Error('Stripe answered a Checkout Session with no URL')
      return session.url
    },
    async openPortal({ customerId }) {
      // docs.stripe.com/api/customer_portal/sessions/create, checked 2026-11-17. No
      // `configuration`: the session takes the account's default one, set in the dashboard, which
      // says what the owner may change. Under Managed Payments the Portal is where the card
      // changes, since the API may not update a subscription's payment method.
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: settingsPage,
      })
      if (!session.url) throw new Error('Stripe answered a Customer Portal session with no URL')
      return session.url
    },
    readPrices(report) {
      if (failedAt !== null && now().getTime() - failedAt < priceFailureMs) {
        return Promise.resolve(null)
      }
      // One read for calls that arrive together, so a failure reports once. A success stays for
      // the process; a failure clears the read and starts its window.
      prices ??= Promise.all([readPrice('monthly'), readPrice('annual')]).then(
        ([monthly, annual]) => {
          failedAt = null
          return { monthly, annual }
        },
        (error: unknown) => {
          failedAt = now().getTime()
          prices = null
          report(error)
          return null
        },
      )
      return prices
    },
  }
}
