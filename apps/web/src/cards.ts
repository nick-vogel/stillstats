import {
  type ChannelDay,
  type ChannelHistory,
  type ChartCard,
  type RevenueAmounts,
  type RevenueRefusal,
  rpmRevenueOf,
  type VideoRevenue,
} from '@creator-analytics/api-types'
import type { Figure } from './Figures.tsx'
import { ctrTextOf, historyText } from './history.ts'
import { revenueText, rpmLineOf, rpmOf, wrappableMoneyTextOf } from './revenue.ts'
import { watchHoursTextOf } from './watch-hours.ts'

/**
 * A headline number in its box: the label, the number, and an optional smaller line under it. Or,
 * with `message`, a sentence in place of the number, which can end in a button that gives revenue
 * consent.
 */
export interface Card extends Figure {
  detail?: string
  /**
   * A second smaller line under `detail`: the text it shows, and the words a screen reader reads in
   * its place, with "times" for the "×" sign. `null` keeps the line's place, empty, at zero engaged
   * views.
   */
  ratio?: RatioLine | null
  /** The text is a sentence, not a number. */
  message?: true
  /** The text of a button under the message, which opens the revenue consent screen. */
  consentButton?: string
  /**
   * The chart the card chooses on a screen too small to stack the charts. A card with a message has
   * none, so it never chooses a chart.
   */
  chart?: ChartCard
  /**
   * The chart the `detail` line chooses there, apart from the card's own: the revenue card's RPM
   * line chooses the RPM chart (creator-analytics#356). Absent with no `detail`.
   */
  detailChart?: ChartCard
}

/** A card that never carries a consent button, so the cards show it with no consent handler. */
export type NoConsentCard = Card & { consentButton?: never }

// The card text is approved word for word in creator-analytics#76. Change it only with Nick.
// The revenue label is approved word for word in creator-analytics#54.
const labels = {
  engagedViews: 'Engaged views',
  watchHours: 'Watch hours',
  estimatedRevenue: 'Estimated revenue',
}

/** The smaller line under engaged views, such as "1,234 views". */
export function viewsLineOf(views: number, locale?: string): string {
  return `${views.toLocaleString(locale)} ${views === 1 ? 'view' : 'views'}`
}

/** A line that shows `text`, which a screen reader reads as `spoken`. */
export interface RatioLine {
  text: string
  spoken: string
}

/**
 * The line under the views line, such as "Views are 1.6× engaged views": views over engaged views,
 * with one decimal place in the locale's digits. None at zero engaged views.
 */
export function ratioLineOf(
  views: number,
  engagedViews: number,
  locale?: string,
): RatioLine | null {
  if (engagedViews === 0) return null
  const multiple = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(views / engagedViews)
  // The line is approved word for word on 2026-10-19, in creator-analytics#242. Change it only with
  // Nick.
  return {
    text: `Views are ${multiple}× engaged views`,
    spoken: `Views are ${multiple} times engaged views`,
  }
}

/**
 * Engaged views, with the views as the smaller line under them, and how many times engaged views
 * the views are as a second smaller line, whose place stays empty at zero engaged views.
 */
export function engagedViewsCardOf(
  { engagedViews, views }: Pick<ChannelDay, 'engagedViews' | 'views'>,
  locale?: string,
): Card {
  return {
    label: labels.engagedViews,
    text: engagedViews.toLocaleString(locale),
    detail: viewsLineOf(views, locale),
    ratio: ratioLineOf(views, engagedViews, locale),
    chart: 'engagedViews',
  }
}

/** YouTube's minutes watched, as watch hours. */
export function watchHoursCardOf(minutes: number, locale?: string): Card {
  return { label: labels.watchHours, text: watchHoursTextOf(minutes, locale), chart: 'watchTime' }
}

export function revenueReportedIn(days: Pick<ChannelDay, 'estimatedRevenue'>[]): boolean {
  return days.some(({ estimatedRevenue }) => !!estimatedRevenue)
}

export function withoutRevenue<Day extends Partial<RevenueAmounts>>({
  estimatedRevenue: _,
  estimatedAdRevenue: __,
  estimatedRedPartnerRevenue: ___,
  ...day
}: Day): Omit<Day, keyof RevenueAmounts> {
  return day
}

/**
 * Which revenue an RPM counts: the whole estimated revenue, or with `adsAndPremiumOnly`, the RPM
 * switch on, ads and YouTube Premium only. Off by default.
 */
export interface RpmOptions {
  adsAndPremiumOnly?: boolean
}

/**
 * Estimated revenue in the answer's currency, the channel's or one video's, with RPM as the smaller
 * line when there are engaged views. Without revenue consent, a message and a button that gives it;
 * for a channel outside the YouTube Partner Program, a message saying YouTube reports no revenue for
 * it. When YouTube reports no revenue over the answer's date range, a message saying so in place of
 * "$0.00": Google answers a channel outside the program with zeros as often as with a 403 (Nick's
 * walk of 2026-10-10), and no YouTube API says whether a channel is in it. With the RPM switch on
 * (`adsAndPremiumOnly`), the RPM line counts only ads and YouTube Premium; off by default.
 */
export function revenueCardOf(
  // A channel's revenue fits too: a video's, with the no-format and every-format amounts added.
  revenue: VideoRevenue | RevenueRefusal,
  engagedViews: number,
  revenueReported: boolean,
  locale?: string,
  { adsAndPremiumOnly = false }: RpmOptions = {},
): Card {
  const label = labels.estimatedRevenue
  if (revenue.refusal) {
    return revenue.refusal === 'consent_missing'
      ? {
          label,
          text: revenueText.consentMissing,
          message: true,
          consentButton: revenueText.consentButton,
        }
      : { label, text: revenueText.notMonetized, message: true }
  }
  if (!revenueReported) {
    return { label, text: revenueText.noRevenue, message: true }
  }
  const rpm = rpmOf(rpmRevenueOf(revenue, adsAndPremiumOnly), engagedViews)
  return {
    label,
    text: wrappableMoneyTextOf(revenue.estimatedRevenue, revenue.currency, locale),
    ...(rpm === null
      ? {}
      : { detail: rpmLineOf(rpm, revenue.currency, locale), detailChart: 'rpm' as const }),
    chart: 'revenue',
  }
}

/**
 * The impressions and CTR cards of a range the history holds no day of, before its start or after
 * its newest day: a sentence saying so on each in place of a number, which would read as none.
 */
export function unheldHistoryCardsOf(): Card[] {
  return [historyText.impressions, historyText.ctr].map((label) => ({
    label,
    text: historyText.noStoredHistory,
    message: true,
  }))
}

/**
 * The stored history's impressions over the range, the channel's or one video's, with the partial
 * label, "N of M days", as its smaller line when the history holds only some of the range's days.
 */
export function impressionsCardOf(
  history: Pick<ChannelHistory, 'impressions'>,
  partial: string | null,
  locale?: string,
): NoConsentCard {
  return {
    label: historyText.impressions,
    text: history.impressions.toLocaleString(locale),
    ...(partial === null ? {} : { detail: partial }),
    chart: 'impressions',
  }
}

/**
 * The channel's or one video's CTR over the range (ADR 0013), with the partial label as its smaller
 * line as the impressions card has it; with no impressions, a sentence saying so in place of a rate.
 */
export function ctrCardOf(
  history: Pick<ChannelHistory, 'ctr'>,
  partial: string | null,
  locale?: string,
): NoConsentCard {
  const label = historyText.ctr
  const detail = partial === null ? {} : { detail: partial }
  if (history.ctr === null)
    return { label, text: historyText.noImpressions, ...detail, message: true }
  return { label, text: ctrTextOf(history.ctr, locale), ...detail, chart: 'ctr' }
}
