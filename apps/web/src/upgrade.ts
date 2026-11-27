import {
  type BillingPlan,
  type PlanPrice,
  type UpgradeComparison,
  videoWindowDays,
} from '@creator-analytics/api-types'
import { longDateOf } from './processing.ts'

// Drafted for creator-analytics#788, and the upgrade screen's own strings replaced by the copy
// approved word for word in creator-analytics#913. Each string says which it is; change an approved
// one only with Nick.
export const upgradeText = {
  /** The line above the upgrade screen's heading: the product's name. */
  eyebrow: 'Stillstats Pro', // approved in creator-analytics#913
  /** The upgrade screen's heading. */
  heading: 'Upgrade to Pro', // approved in creator-analytics#913
  /** The upgrade screen's line under the heading. */
  pitch: 'Everything in the free tier, plus deeper analytics for this channel.', // approved in creator-analytics#913
  /** The channel's own count under the Upload comparisons card, the larger comparison's, from 2. */
  readyLine: (count: number) => `Ready today: ${count} of your uploads are ready for review.`, // approved in creator-analytics#913
  /** The line under the pricing cards. */
  pricesNote:
    'Prices are for this one channel*. Checkout opens on Stripe, and tax may apply. Manage or cancel your subscription in Settings.', // approved in creator-analytics#913, with the asterisk Nick added on 2026-11-19
  /** The note the asterisk in the line under the pricing cards points to. */
  pricesChangeNote:
    '* This is changing soon: $7 a month or $70 a year will cover up to 4 channels for one person.', // approved by Nick on 2026-11-20, in a /copy-review of the pricing copy
  /** A comparison's count today, its window's days and its count of uploads. */
  countLine: (days: number, count: number) =>
    count === 1
      ? `First ${days} days: 1 of your uploads would count if you subscribed today.` // approved by Nick word for word on 2026-11-19
      : `First ${days} days: ${count} of your uploads would count if you subscribed today.`, // approved by Nick word for word on 2026-11-19
  /** A comparison with fewer than 2 uploads, and the day a second one counts. */
  dateLine: (date: string) => `It needs 2, so it starts on ${date}.`, // approved by Nick word for word on 2026-11-19
  /** A comparison with fewer than 2 uploads, whose uploads so far cannot reach 2. */
  noDateLine: 'It needs 2, so it starts once 2 of your public uploads have had those days.', // approved by Nick word for word on 2026-11-19
}

/** One of the upgrade screen's feature cards: its heading and its lines. */
export interface UpgradeFeature {
  key: 'reach' | 'comparisons' | 'repackaging' | 'retention' | 'history' | 'next'
  title: string
  lines: readonly string[]
}

// Approved word for word in creator-analytics#913, and the Retention comparison card in
// creator-analytics#936 (#952), but the Repackaging view card, drafted for creator-analytics#945.
// Each string says which it is. The Upload comparisons card adds the channel's own count under its
// line, and More on the way has the dashed border.
export const upgradeFeatures: readonly UpgradeFeature[] = [
  {
    key: 'reach',
    title: 'Reach', // approved in creator-analytics#913
    lines: [
      'Impressions and click-through rate beside engaged views, in your summary, charts, video list and traffic sources.', // approved in creator-analytics#913
      "A video's sponsor report can include them too.", // approved in creator-analytics#938
    ],
  },
  {
    key: 'comparisons',
    title: 'Upload comparisons', // approved in creator-analytics#913
    lines: [
      'Each new upload beside the average of your own newest uploads at the same age, over its first 7 and first 28 days.', // approved in creator-analytics#913
    ],
  },
  {
    key: 'repackaging',
    title: 'Repackaging view', // drafted for creator-analytics#945, for Nick's word for word approval on the epic's PR
    lines: [
      'Sort your video list by click-through rate or impressions, for all traffic sources or just one, and hide videos under a minimum number of impressions.', // drafted for creator-analytics#945, for Nick's word for word approval on the epic's PR
    ],
  },
  {
    key: 'retention',
    title: 'Retention comparison', // approved in creator-analytics#936 (#952)
    lines: [
      'The audience retention curves of up to 5 of your videos on one chart, each read daily for its first 28 days and monthly after.', // approved in creator-analytics#936 (#952)
    ],
  },
  {
    key: 'history',
    title: 'Your history', // approved in creator-analytics#913
    lines: [
      "Stillstats keeps your channel's history while you subscribe, and for 30 days after you stop, so it is still there if you change your mind in that time.", // approved in creator-analytics#913
      'Deleting your channel still removes all of its data within 6 hours.', // approved in creator-analytics#913
    ],
  },
  {
    key: 'next',
    title: 'More on the way', // approved in creator-analytics#913
    lines: ['New Pro features arrive in your subscription.'], // approved in creator-analytics#913
  },
]

/** A pricing card's words: its name, the period after its amount, and the line under that. */
export const planTexts = {
  monthly: {
    name: 'Monthly', // approved in creator-analytics#913
    period: 'a month', // approved in creator-analytics#913
    detail: 'Billed every month. Cancel any time.', // approved in creator-analytics#913
  },
  annual: {
    name: 'Yearly', // approved in creator-analytics#913
    period: 'a year', // approved in creator-analytics#913
    /** The badge on the recommended card: 12 months at the monthly price less the annual one. */
    badge: (saving: string) => `Save ${saving}`, // approved in creator-analytics#913
    /** The annual price over 12, under its amount. */
    detail: (perMonth: string) => `${perMonth} a month, billed annually.`, // approved in creator-analytics#913
  },
} as const

/**
 * An amount in the currency's smallest unit, such as Stripe's `unit_amount`, as money in that
 * currency: with no decimals when it is a whole amount ($7, $70), and with the currency's own
 * decimals otherwise ($5.83).
 */
export function moneyOf(amount: number, currency: string, locale?: string): string {
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency })
  const digits = money.resolvedOptions().maximumFractionDigits ?? 2
  const value = amount / 10 ** digits
  if (!Number.isInteger(value)) return money.format(value)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/** The pricing cards' amounts as money, each null with no prices. */
export interface Pricing {
  monthly: string | null
  annual: string | null
  /** 12 months at the monthly price less the annual price, only when that is above 0. */
  saving: string | null
  /** The annual price over 12, rounded to the currency's smallest unit. */
  annualPerMonth: string | null
}

/**
 * The pricing cards' amounts from the configured Stripe prices: none at all with no prices, and
 * no saving across two currencies, which cannot be compared.
 */
export function pricingOf(prices: Record<BillingPlan, PlanPrice> | null, locale?: string): Pricing {
  if (prices === null) return { monthly: null, annual: null, saving: null, annualPerMonth: null }
  const { monthly, annual } = prices
  const saving = 12 * monthly.amount - annual.amount
  return {
    monthly: moneyOf(monthly.amount, monthly.currency, locale),
    annual: moneyOf(annual.amount, annual.currency, locale),
    saving:
      monthly.currency === annual.currency && saving > 0
        ? moneyOf(saving, annual.currency, locale)
        : null,
    annualPerMonth: moneyOf(Math.round(annual.amount / 12), annual.currency, locale),
  }
}

/**
 * The Upload comparisons card's count: the larger of the comparisons' counts, shown when it is at
 * least 2, the most uploads any comparison counts today.
 */
export function readyLineOf(comparisons: readonly UpgradeComparison[]): string | null {
  const count = Math.max(0, ...comparisons.map((comparison) => comparison.count))
  return count >= 2 ? upgradeText.readyLine(count) : null
}

/** Today's line, with its start date, for each comparison that counts fewer than 2 uploads. */
export function startLinesOf(comparisons: readonly UpgradeComparison[], locale?: string): string[] {
  return comparisons
    .filter((comparison) => comparison.count < 2)
    .map((comparison) => comparisonLineOf(comparison, locale))
}

/**
 * The event the upgrade screen sends each time it opens: no property, so no channel number. Typed
 * by its literal, not `ProductEvent`, so the browser walk can read this module's strings without
 * the web app's screens.
 */
export const upgradeViewedEvent = { name: 'upgrade_screen_viewed' } as const

/**
 * A comparison's line on the upgrade screen: its count today, and with fewer than 2 uploads the day
 * it starts, or that it starts once 2 public uploads have had its days.
 */
export function comparisonLineOf(comparison: UpgradeComparison, locale?: string): string {
  const days = videoWindowDays[comparison.window]
  const count = upgradeText.countLine(days, comparison.count)
  if (comparison.count >= 2) return count
  const starts =
    comparison.availableOn === null
      ? upgradeText.noDateLine
      : upgradeText.dateLine(longDateOf(comparison.availableOn, locale))
  return `${count} ${starts}`
}
