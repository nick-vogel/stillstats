import type { RevenueCurrency } from './currencies.ts'
import type { Freshness } from './freshness.ts'
import type { Visibility } from './preferences.ts'
import type {
  CustomRangeQuery,
  RangeBounds,
  VideoFormat,
  VideoFormatFilter,
  VideoWindow,
  WindowChoice,
} from './videos.ts'

/**
 * The windows that run from each video's own publish day, day 1: `first7` is the publish day and
 * the 6 days after it. `first1` is the publish day alone, the nearest answer YouTube's days give to
 * a first 24 hours. A channel has no publish day, so the channel summary refuses them with
 * `window_after_publish`.
 */
export const windowsAfterPublish = ['first1', 'first7', 'first28', 'first90', 'first365'] as const
export type WindowAfterPublish = (typeof windowsAfterPublish)[number]

/** The windows the channel summary covers: the calendar windows and lifetime. */
export type SummaryWindow = Exclude<VideoWindow, WindowAfterPublish>

/** The query of GET /api/channels/:channelId/summary, as text, the way a URL carries it. */
export interface ChannelSummaryQuery extends CustomRangeQuery {
  /** A calendar window or lifetime. Defaults to `defaultVideoWindow`, the last 28 days. */
  window?: SummaryWindow
  /**
   * Narrows the totals, the daily series and the revenue to one format, but not the revenue tied to
   * no format. Defaults to `all`, which reads every format.
   */
  format?: VideoFormatFilter
  /**
   * Which uploads `uploads` carries: `public` ones only, or `all`, unlisted and private ones too, as
   * the video list's visibility. The numbers are the channel's whatever it says. Defaults to
   * `public`.
   */
  visibility?: Visibility
}

/**
 * What a summary covers, parsed from its query: a window with its custom range, a format, and the
 * visibility of its uploads.
 */
export type SummaryRequest = WindowChoice<Exclude<SummaryWindow, 'custom'>> & {
  format: VideoFormatFilter
  visibility: Visibility
}

/** An upload published on a day of the summary's daily series, which an upload marker shows. */
export interface SummaryUpload {
  /** The YouTube video id. */
  id: string
  title: string
  /** YYYY-MM-DD, the reporting day in Pacific Time the upload was published on. */
  publishDay: string
  /** Its lifetime format, or null when Google gives it none. */
  format: VideoFormat | null
}

/**
 * Revenue in the answer's currency, which Google converts at its daily exchange rate: the total from
 * every source, and its ad and YouTube Premium parts. The rest of the total, other sources, is
 * `otherSourcesOf`.
 */
export interface RevenueAmounts {
  estimatedRevenue: number
  estimatedAdRevenue: number
  /** YouTube Premium revenue, as Google names its metric. */
  estimatedRedPartnerRevenue: number
}

/**
 * Other sources: the estimated revenue less its ad and YouTube Premium parts, such as channel
 * memberships and Supers. Simple arithmetic under ADR 0013, which the web app shows and the video
 * list's sort orders by.
 */
export function otherSourcesOf({
  estimatedRevenue,
  estimatedAdRevenue,
  estimatedRedPartnerRevenue,
}: RevenueAmounts): number {
  return estimatedRevenue - estimatedAdRevenue - estimatedRedPartnerRevenue
}

/**
 * The revenue an RPM counts: the whole estimated revenue with the RPM switch off, or, with it on,
 * ads plus YouTube Premium, which is the estimated revenue less other sources. Simple arithmetic
 * under ADR 0013. The API's RPM sort and every RPM in the web app read it, so they agree.
 */
export function rpmRevenueOf(amounts: RevenueAmounts, adsAndPremiumOnly: boolean): number {
  if (!adsAndPremiumOnly) return amounts.estimatedRevenue
  return amounts.estimatedAdRevenue + amounts.estimatedRedPartnerRevenue
}

/** The channel's revenue over the window, YouTube's own totals, never a sum of `daily`. */
export interface ChannelRevenue extends RevenueAmounts {
  /**
   * The creator's saved currency, which every amount here and every day's revenue in `daily` is in.
   */
  currency: RevenueCurrency
  /**
   * The channel's revenue YouTube ties to no video or format over the window, whatever the format
   * filter, since no format holds it. 0 when YouTube ties none.
   */
  noFormatRevenue: number
  /**
   * The channel's revenue over the window in every format, the revenue tied to no format included,
   * whatever the format filter: the rows of one report by format added up. 0 when YouTube reports
   * none, as for a channel outside the YouTube Partner Program, so one format's summary can say so.
   */
  everyFormatRevenue: number
  /**
   * Never present, so `refusal` tells this from a `RevenueRefusal`: a plain union lets an answer
   * carry a refusal and a currency together, as TypeScript checks a literal's extra properties
   * against every member of a union with no discriminant.
   */
  refusal?: never
}

/**
 * Why the summary carries no revenue: the channel has no revenue consent, or it is outside the
 * YouTube Partner Program, for which Google reports no revenue.
 */
export interface RevenueRefusal {
  refusal: 'consent_missing' | 'not_monetized'
}

/**
 * The channel's numbers on one day. The revenue fields are on every day exactly when the summary's
 * `revenue` answered, a zero on a day YouTube reports no revenue for. The history fields are on
 * exactly the days a paid channel's stored history holds.
 */
export interface ChannelDay extends Partial<RevenueAmounts> {
  /** YYYY-MM-DD, a reporting day in Pacific Time. */
  day: string
  engagedViews: number
  views: number
  estimatedMinutesWatched: number
  /** Thumbnail impressions on the day, from the stored history. */
  impressions?: number
  /** The day's impressions click-through rate, from 0 to 1; null on a day with no impressions. */
  ctr?: number | null
}

/**
 * A paid or an ended channel's impressions and click-through rate history over the summary's days,
 * of the format asked for: the history holds only the days since its first report.
 */
export interface ChannelHistory {
  /** The impressions of every day the history holds in the range. */
  impressions: number
  /**
   * The channel CTR over those days, from 0 to 1: every video's impressions times its CTR, over
   * the impressions (ADR 0013). Null with no impressions.
   */
  ctr: number | null
  /** YYYY-MM-DD, the first day the history holds, in the range or before it. */
  firstDay: string
  /** YYYY-MM-DD, the newest day the history holds (ADR 0017). */
  newestDay: string
  /**
   * YYYY-MM-DD, the UTC day the history is deleted on, present only for an ended channel: its
   * subscription has ended, and its history stays readable until then.
   */
  purgeDate?: string
}

/**
 * GET /api/channels/:channelId/summary: the whole channel over the window. Freshness is that of
 * the oldest read.
 */
export interface ChannelSummaryAnswer extends Freshness, RangeBounds {
  window: SummaryWindow
  format: VideoFormatFilter
  /** YouTube's own total for the channel over the window, never a sum of `daily`. */
  engagedViews: number
  /** YouTube's own total for the channel over the window, never a sum of `daily`. */
  views: number
  /** YouTube's own total for the channel over the window, never a sum of `daily`. */
  estimatedMinutesWatched: number
  /** The channel's revenue, or why it carries none. */
  revenue: ChannelRevenue | RevenueRefusal
  /**
   * Every day from the window's first day to the last processed day, oldest first. A day YouTube
   * reports no numbers for has zeros.
   */
  daily: ChannelDay[]
  /**
   * Each upload published on a day of `daily`, of the format and the visibility asked for, newest
   * first by publish time, ties by id, as the video list's newest first. A scheduled upload is
   * never among them.
   */
  uploads: SummaryUpload[]
  /**
   * The channel's impressions and CTR history, present only for a paid or an ended channel whose
   * history holds at least one day.
   */
  history?: ChannelHistory
}
