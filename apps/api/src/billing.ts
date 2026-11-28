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
   * Opens a Checkout Session for the user's subscription to the plan, one block, and answers its
   * URL on Stripe. The customer is the user's earlier one, or null for a user who never subscribed.
   */
  startCheckout(checkout: {
    userId: string
    plan: Plan
    customerId: string | null
  }): Promise<string>
  /**
   * Opens a Customer Portal session for the user's Stripe customer, on Stillstats' own Portal
   * configuration, in which they change the card, read their invoices, switch between the monthly
   * and the annual plan, or cancel at period end, and never change the number of blocks; answers
   * its URL on Stripe. The configuration is made or brought up to date once for the process, and a
   * failure to do so throws, with no session on the account's default configuration.
   */
  openPortal(portal: { customerId: string }): Promise<string>
  /**
   * What one more block of the subscription costs, read from Stripe: the price of its item, which
   * it keeps on a rise (ADR 0022), and the preview of its next invoice at one block more, whose
   * proration lines are the charge for the rest of the paid period.
   */
  previewBlock(block: { subscriptionId: string }): Promise<BlockPreview>
  /**
   * Raises the subscription's quantity to `blocks`, its proration on the next invoice and no
   * invoice now, under an idempotency key that names this add, and answers Stripe's subscription.
   * A `blocks` other than one more than Stripe holds answers `blocks_changed` and updates nothing,
   * so a second click or a stale tab never buys a block nobody previewed.
   */
  addBlock(block: {
    subscriptionId: string
    blocks: number
  }): Promise<{ kind: 'added'; subscription: Stripe.Subscription } | { kind: 'blocks_changed' }>
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
 * since only Stillstats Checkout writes it, and names the user they belong to (stillstats#20).
 */
export const userMetadataKey = 'stillstats_user_id'

/**
 * The metadata a session and its subscription made before blocks carry, which names the channel
 * they paid for. The webhook still reads it, and records such a subscription onto the channel's
 * owner, while one is live.
 */
export const channelMetadataKey = 'stillstats_channel_id'

/**
 * The metadata that marks Stillstats' own Customer Portal configuration among the account's, so a
 * process that starts finds and updates it rather than creating another (stillstats#22).
 */
export const portalMetadataKey = 'stillstats_portal'

/** What one more block costs, as `Billing.previewBlock` reads it from Stripe. */
export interface BlockPreview {
  /** The number of blocks after the add. */
  blocks: number
  /** The plan the item's price bills at. */
  plan: Plan
  /** The item's own price of one block for each period. */
  price: PlanPrice
  /** The sum of the preview's proration lines of this add, on the next invoice. */
  prorated: PlanPrice
  /** The end of the current paid period. */
  periodEnd: Date
}

/**
 * The plan a price bills at, from its `recurring.interval`: a price billed every month is the
 * monthly plan, and every year the annual one, whatever its ID (ADR 0022). Null for an interval
 * Stillstats sells no plan at: a day, a week, or more than one month or year between billings
 * (docs.stripe.com/api/prices/object).
 */
export function planOfPrice(price: Stripe.Price): Plan | null {
  if (price.recurring?.interval_count !== 1) return null
  if (price.recurring.interval === 'month') return 'monthly'
  if (price.recurring.interval === 'year') return 'annual'
  return null
}

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
  /**
   * The clock a failed price read's window and a block preview's proration date run on. Unset,
   * system time.
   */
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
  let portalConfiguration: Promise<string> | null = null

  /**
   * The subscription's one item as Stripe holds it: its ID, its quantity, its own price and plan,
   * and the end of its paid period, on the item since API version 2025-03-31.basil
   * (docs.stripe.com/api/subscription_items/object, read 2026-11-27).
   */
  async function blockOf(subscriptionId: string) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const [item] = subscription.items.data
    if (!item) throw new Error(`Stripe's subscription ${subscriptionId} carries no item`)
    const { price } = item
    if (price.unit_amount === null) {
      throw new Error(`The price of subscription ${subscriptionId} has no unit_amount`)
    }
    const plan = planOfPrice(price)
    if (plan === null) {
      throw new Error(
        `The price of subscription ${subscriptionId} bills neither monthly nor yearly`,
      )
    }
    return {
      itemId: item.id,
      quantity: item.quantity ?? 1,
      plan,
      price: { amount: price.unit_amount, currency: price.currency },
      periodEnd: new Date(item.current_period_end * 1000),
    }
  }

  /**
   * Stillstats' own Customer Portal configuration, made through the API since the dashboard cannot
   * set `billing_cycle_anchor` (#18): the active one whose metadata carries the marker, updated to
   * these settings, or a new one. Answers its ID.
   */
  async function ensurePortalConfiguration(): Promise<string> {
    const [monthly, annual] = await Promise.all([
      stripe.prices.retrieve(settings.prices.monthly),
      stripe.prices.retrieve(settings.prices.annual),
    ])
    const productOf = (price: Stripe.Price) =>
      typeof price.product === 'string' ? price.product : price.product.id
    const product = productOf(monthly)
    if (productOf(annual) !== product) {
      throw new Error("Stripe's monthly and annual prices are not of one product")
    }
    // docs.stripe.com/api/customer_portal/configurations/create and /update, read 2026-11-27,
    // with stripe-node 23.1.0's types at 2026-10-28.endive, and the #18 spike (comments 3 and 4):
    //   - The card, the invoices and a cancellation at period end stay the owner's.
    //   - A plan switch is a change of price alone: `default_allowed_updates` leaves out
    //     `quantity`, and the product's `adjustable_quantity` is off, without which the product
    //     still lets the quantity change. The number of blocks changes only in Stillstats.
    //   - `always_invoice` with `billing_cycle_anchor=now` is the one pair that charged a monthly
    //     to annual switch at once and for a full year.
    const features = {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        products: [
          {
            product,
            prices: [settings.prices.monthly, settings.prices.annual],
            adjustable_quantity: { enabled: false },
          },
        ],
        proration_behavior: 'always_invoice',
        billing_cycle_anchor: 'now',
      },
    } satisfies Stripe.BillingPortal.ConfigurationCreateParams.Features
    const metadata = { [portalMetadataKey]: 'true' }
    const listed = await stripe.billingPortal.configurations.list({ active: true, limit: 100 })
    const own = listed.data.find((each) => each.metadata?.[portalMetadataKey] === 'true')
    const configuration = own
      ? await stripe.billingPortal.configurations.update(own.id, { features })
      : await stripe.billingPortal.configurations.create({ features, metadata })
    return configuration.id
  }

  return {
    settings,
    async startCheckout({ userId, plan, customerId }) {
      const metadata = { [userMetadataKey]: userId, plan }
      // Managed Payments' parameters, from docs.stripe.com/payments/managed-payments/set-up and
      // /update-checkout, checked 2026-11-17. It refuses a session that also sets automatic_tax,
      // tax_id_collection, payment_method_types, payment_method_options,
      // payment_method_configuration, subscription_data.default_tax_rates or invoice_settings,
      // invoice_creation, shipping or any Connect parameter, so none of them is set here. No email
      // or name: Stripe's page asks for them.
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        // One block: a user buys their first block here, and changes the count in the app.
        line_items: [{ price: settings.prices[plan], quantity: 1 }],
        managed_payments: { enabled: true },
        client_reference_id: userId,
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
      // docs.stripe.com/api/customer_portal/sessions/create, checked 2026-11-17, and `configuration`
      // 2026-11-27: the session opens on Stillstats' own configuration, never the account's
      // default, whose quantity control the dashboard cannot be trusted to keep off. Under
      // Managed Payments the Portal is where the card changes, since the API may not update a
      // subscription's payment method.
      portalConfiguration ??= ensurePortalConfiguration().catch((error: unknown) => {
        portalConfiguration = null
        throw error
      })
      const configuration = await portalConfiguration
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: settingsPage,
        configuration,
      })
      if (!session.url) throw new Error('Stripe answered a Customer Portal session with no URL')
      return session.url
    },
    async previewBlock({ subscriptionId }) {
      const block = await blockOf(subscriptionId)
      const blocks = block.quantity + 1
      // docs.stripe.com/api/invoices/create_preview, read 2026-11-27, and the #18 spike: the
      // preview of the next invoice with the item at one block more and `create_prorations`
      // carries the proration lines the raise would make, which Stripe names as the lines whose
      // `parent.subscription_item_details.proration` is true. `GET /v1/invoices/upcoming` is gone
      // at 2026-10-28.endive. The preview also shows every pending invoice item, an earlier add's
      // proration in this period among them, so only the lines whose period starts at the
      // preview's own `proration_date` are this add's (docs.stripe.com/billing/subscriptions/
      // prorations, "Preview a proration", read 2026-11-27).
      const prorationDate = Math.floor(now().getTime() / 1000)
      const preview = await stripe.invoices.createPreview({
        subscription: subscriptionId,
        subscription_details: {
          items: [{ id: block.itemId, quantity: blocks }],
          proration_behavior: 'create_prorations',
          proration_date: prorationDate,
        },
      })
      const prorated = preview.lines.data
        .filter(
          (line) =>
            line.parent?.subscription_item_details?.proration === true &&
            line.period.start === prorationDate,
        )
        .reduce((sum, line) => sum + line.amount, 0)
      return {
        blocks,
        plan: block.plan,
        price: block.price,
        prorated: { amount: prorated, currency: preview.currency },
        periodEnd: block.periodEnd,
      }
    },
    async addBlock({ subscriptionId, blocks }) {
      const block = await blockOf(subscriptionId)
      if (blocks !== block.quantity + 1) return { kind: 'blocks_changed' }
      // docs.stripe.com/api/subscriptions/update, read 2026-11-27, and the #18 spike: the item's
      // quantity with `create_prorations` makes no invoice and puts the proration on the next one.
      // Managed Payments allowed an immediate charge in the sandbox; no charge now is Stillstats'
      // choice for a block. Inside one paid period the quantity rises only through Stillstats, so
      // the subscription, the period's end and the count name one add, and a retry of it, a
      // network retry of stripe-node's included, is answered from Stripe's first.
      const subscription = await stripe.subscriptions.update(
        subscriptionId,
        {
          items: [{ id: block.itemId, quantity: blocks }],
          proration_behavior: 'create_prorations',
        },
        {
          idempotencyKey: `add-block-${subscriptionId}-${block.periodEnd.getTime() / 1000}-${blocks}`,
        },
      )
      return { kind: 'added', subscription }
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
