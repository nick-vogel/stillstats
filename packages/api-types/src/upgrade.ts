import type { BillingPlan } from './billing.ts'

/** The two comparisons the upgrade screen counts uploads for: the first 7 and first 28 days. */
export const upgradeWindows = ['first7', 'first28'] as const
export type UpgradeWindow = (typeof upgradeWindows)[number]

/** The query of GET /api/channels/:channelId/upgrade, as text, the way a URL carries it. */
export interface UpgradeQuery {
  /** The list's format filter, which the newest average counts by. Defaults to `all`. */
  format?: string
}

/** One comparison's count, if the channel subscribed today. */
export interface UpgradeComparison {
  window: UpgradeWindow
  /**
   * How many uploads the newest average would count today, at most `newestAverageSize`: public,
   * not scheduled, of the format, published on or after `historyStart`, and with their whole window
   * after publish on or before `newestDay`.
   */
  count: number
  /**
   * YYYY-MM-DD in YouTube's day, the first day a second upload of today's would qualify, by the
   * same rule with `newestDay` moving one day a day and `historyStart` staying. Null with a count of
   * 2 or more, and when today's uploads from `historyStart` cannot reach 2.
   */
  availableOn: string | null
}

/** A plan's price as Stripe holds it, the amount Checkout charges before any tax. */
export interface PlanPrice {
  /** In the currency's smallest unit, such as `700` for $7. */
  amount: number
  /** Stripe's lowercase ISO 4217 code, such as `usd`. */
  currency: string
}

/**
 * GET /api/channels/:channelId/upgrade: the comparisons a channel would have if it subscribed
 * today, counted from the upload dates the free tier already reads, and the price of each plan.
 */
export interface UpgradeAnswer {
  /**
   * YYYY-MM-DD, the oldest day YouTube would still hold for the channel at its first download, the
   * daily run after today: its reporting job's creation day less 30 while the job is under 30 days
   * old, then the later of that day and 60 days back. A channel with no job counts one made then.
   */
  historyStart: string
  /** YYYY-MM-DD, today less 4: the newest day surely past YouTube's 72-hour delay. */
  newestDay: string
  comparisons: UpgradeComparison[]
  /**
   * The price Checkout sells each plan at, read from the configured Stripe prices, so the upgrade
   * screen never disagrees with Checkout. Null when Stripe could not be read, or a price has no
   * single amount, and the screen shows the plans with no amount.
   */
  prices: Record<BillingPlan, PlanPrice> | null
}
