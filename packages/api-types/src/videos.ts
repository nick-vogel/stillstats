import { type RevenueRefusal, windowsAfterPublish } from './channel-summary.ts'
import type { RevenueCurrency } from './currencies.ts'
import type { Freshness } from './freshness.ts'
import type { Visibility } from './preferences.ts'

/**
 * The days a video list counts each video's numbers over. A calendar window ends at the last
 * processed day (`RangeBounds`) and starts the window's length before it: `last7` is that day and
 * the 6 days before it, so it holds 7 days of numbers. Lifetime runs from the channel's creation day
 * to today, and no calendar window starts before that day. `custom` is a calendar window over the
 * days the query's `from` and `to` name (`CustomRange`). A window after publish runs from each
 * video's publish day.
 */
export const videoWindows = [
  'lifetime',
  'last7',
  'last28',
  'last90',
  'last365',
  'custom',
  ...windowsAfterPublish,
] as const
export type VideoWindow = (typeof videoWindows)[number]

/**
 * How many days each window but lifetime and a custom range covers, a calendar window's or a window
 * after publish's.
 */
export const videoWindowDays: Record<Exclude<VideoWindow, 'lifetime' | 'custom'>, number> = {
  last7: 7,
  last28: 28,
  last90: 90,
  last365: 365,
  first1: 1,
  first7: 7,
  first28: 28,
  first90: 90,
  first365: 365,
}

/**
 * The days of a custom range, as YYYY-MM-DD reporting days in Pacific Time, both inclusive: `from`
 * equal to `to` is one day. The API refuses a range outside its `RangeBounds` with `invalid_range`.
 */
export interface CustomRange {
  from: string
  to: string
}

/**
 * A window and its custom range, which `custom` carries and no other window does. `W` is the
 * windows besides `custom` it can be.
 */
export type WindowChoice<
  W extends Exclude<VideoWindow, 'custom'> = Exclude<VideoWindow, 'custom'>,
> = { window: W; range?: undefined } | { window: 'custom'; range: CustomRange }

/**
 * A custom range's days in a query, as text. Only with `window=custom`, which needs both `from` and
 * `to`; the API refuses either otherwise with `invalid_range`.
 */
export interface CustomRangeQuery {
  /** YYYY-MM-DD, the custom range's first day. */
  from?: CustomRange['from']
  /** YYYY-MM-DD, the custom range's last day. */
  to?: CustomRange['to']
}

/**
 * The days every answer that reads a window carries, which bound a custom range: from the channel's
 * creation day to the last processed day.
 */
export interface RangeBounds {
  /**
   * YYYY-MM-DD: the last day whose numbers Google has processed: the last day Google answers a row
   * for, or four days before today when that is later, the last day surely past Google's 72-hour
   * delay. A day with no activity is taken to have no row, which no live check has covered.
   */
  lastProcessedDay: string
  /**
   * YYYY-MM-DD: the channel's creation day in Pacific Time, the earliest day a custom range can
   * start on. Null when Google gives the channel no creation time.
   */
  creationDay: string | null
}

/** The window the video list, the channel summary and a video's detail show when none is asked. */
export const defaultVideoWindow = 'last28' satisfies VideoWindow

/**
 * The days of a window after publish Google has processed for a video, when it has not processed
 * them all: `days` of `of`, for example 10 of 28. A video not yet published has 0.
 */
export interface PartialWindow {
  days: number
  of: number
}

/**
 * The sort keys of the estimated revenue's sources: ads, YouTube Premium, and `otherSources`, the
 * estimated revenue less the two.
 */
export const revenueSourceSortKeys = [
  'estimatedAdRevenue',
  'estimatedRedPartnerRevenue',
  'otherSources',
] as const

/** The sort keys of the estimated revenue and its sources, which need revenue consent. */
export const revenueSortKeys = ['estimatedRevenue', ...revenueSourceSortKeys] as const

/**
 * The sort keys that need revenue consent: the estimated revenue, its sources, and RPM, the
 * estimated revenue per 1,000 engaged views, or ads plus YouTube Premium with the saved RPM switch
 * on (`rpmRevenueOf`).
 */
export const consentSortKeys = [...revenueSortKeys, 'rpm'] as const

/**
 * The sort keys that need a readable stored history, a paid channel's or an ended one's before its
 * purge date: the impressions and CTR over each video's counted days.
 */
export const historySortKeys = ['impressions', 'ctr'] as const

/**
 * What a video list can be ordered by: the publish date, one of the five metrics, revenue, one of
 * its sources, RPM, impressions or CTR. A video with zero engaged views has no RPM, and an RPM sort
 * puts it last in either direction; a video with no impressions has no CTR, and a CTR sort puts it
 * last in either direction.
 */
export const videoSortKeys = [
  'publishedAt',
  'engagedViews',
  'views',
  'averageViewPercentage',
  'subscribersGained',
  'estimatedMinutesWatched',
  ...consentSortKeys,
  ...historySortKeys,
] as const
export type VideoSortKey = (typeof videoSortKeys)[number]

/** A sort key orders ascending; with a leading `-`, descending. */
export type VideoSort = VideoSortKey | `-${VideoSortKey}`

/**
 * What kind of upload a video is, from Google's content type for it. A video Google gives no format,
 * one with no lifetime views or one of a type outside these, has none.
 */
export type VideoFormat = 'video' | 'short' | 'live'

/** The format filters of the video list. `all` lists every video, those with no format too. */
export const videoFormatFilters = ['all', 'video', 'short', 'live'] as const satisfies readonly (
  | VideoFormat
  | 'all'
)[]

export type VideoFormatFilter = (typeof videoFormatFilters)[number]

/** Google's privacy status for a video. */
export type VideoPrivacy = 'public' | 'unlisted' | 'private'

/**
 * The traffic source types the video list filters impressions and CTR by: the Analytics API's
 * `insightTrafficSourceType` for each Reporting API code the stored history maps onto one, and
 * `REPORTING_<code>` for the codes with no counterpart that the web app names. A code YouTube adds
 * later is not here until it is named.
 */
export const reachTrafficSourceTypes = [
  'NO_LINK_OTHER',
  'ADVERTISING',
  'SUBSCRIBER',
  'YT_CHANNEL',
  'YT_SEARCH',
  'RELATED_VIDEO',
  'YT_OTHER_PAGE',
  'EXT_URL',
  'ANNOTATION',
  'PLAYLIST',
  'NOTIFICATION',
  'CAMPAIGN_CARD',
  'END_SCREEN',
  'SHORTS',
  'PRODUCT_PAGE',
  'HASHTAGS',
  'SOUND_PAGE',
  'LIVE_REDIRECT',
  'VIDEO_REMIXES',
  'REPORTING_18',
  'REPORTING_23',
  'REPORTING_29',
  'REPORTING_31',
  'REPORTING_32',
] as const
export type ReachTrafficSourceType = (typeof reachTrafficSourceTypes)[number]

/** The query of GET /api/channels/:channelId/videos, as text, the way a URL carries it. */
export interface VideoListQuery extends CustomRangeQuery {
  /** A whole number from 1. Defaults to 1. */
  page?: string
  /** A whole number from 1 to 50. Defaults to 50. */
  pageSize?: string
  /**
   * `true` lists scheduled videos too, which the list leaves out by default. With `ids` it is still
   * checked, and has no effect.
   */
  includeScheduled?: 'true' | 'false'
  /** Defaults to `defaultVideoWindow`, the last 28 days. */
  window?: VideoWindow
  /**
   * Defaults to `-publishedAt`, newest first. Videos that tie on the key run newest first, then by
   * id. In a metric sort over a window after publish, a partial video follows every complete one.
   * A window after publish has no `averageViewPercentage` to sort by, and the API refuses that sort
   * with `sort_after_publish`. A sort by revenue, one of its sources or RPM runs in every window,
   * and the API refuses it with `consent_missing` for a channel without revenue consent. An RPM
   * sort puts a video with zero engaged views last in either direction, after the partial videos
   * rule. An impressions or CTR sort runs in every window, calendar and after publish, and only for
   * a channel whose stored history is readable (paid, or ended before its purge date); the API
   * refuses it with `sort_without_history` for any other channel. In it, a video whose counted days
   * the history does not hold whole (`historyPartial`) is partial too, and a video with no
   * impressions, so no CTR, follows the others in a CTR sort in either direction, after the partial
   * videos rule.
   */
  sort?: VideoSort
  /** Lists only videos of this format. Defaults to `all`. */
  format?: VideoFormatFilter
  /**
   * `public` lists public videos only, `all` adds unlisted and private ones. Defaults to `public`.
   * Applied before sorting and paging. Scheduled videos stay governed by `includeScheduled`. It
   * applies to the full list only: with `ids` it is still checked, and has no effect.
   */
  visibility?: Visibility
  /**
   * Comma-separated YouTube video ids, 1 to `maxVideoIds`. With it, the answer holds only those of
   * the channel's uploads, in any visibility and scheduled ones included, whatever `visibility` and
   * `includeScheduled` say. An id not among the uploads is left out, not refused. `window`, `format`
   * and `sort` apply as usual, `publishDayTop` ranks the listed ids only, and `pageSize` is capped
   * at the number of distinct ids. An empty or malformed list, one of more than `maxVideoIds`
   * entries (duplicates counted), or `ids` sent more than once, is refused with `invalid_ids`.
   */
  ids?: string
  /**
   * Counts only this traffic source's reach rows in each video's `impressions` and `ctr`, and so in
   * the impressions and CTR sorts and in `minImpressions`; every other number is untouched. Absent
   * counts every source. Only for a channel whose stored history is readable (paid, or ended before
   * its purge date); the API refuses it with `filter_without_history` for any other channel, and a
   * type outside `reachTrafficSourceTypes` with `invalid_traffic_source`.
   */
  trafficSource?: ReachTrafficSourceType
  /**
   * A whole number from 1: a video with fewer impressions over its counted days, of the
   * `trafficSource` when one is set, leaves the list before the sort and paging, so `pageCount`
   * counts only the videos that stay. `publishDayTop` and the two newest averages ignore it. Only
   * for a channel whose stored history is readable; the API refuses it with
   * `filter_without_history` for any other channel, and any other value with
   * `invalid_min_impressions`. A list without `history` hides no video for it.
   */
  minImpressions?: string
  /**
   * `true` lists only the videos with a stored audience retention curve that has points, the ones
   * the retention comparison can draw, before the sort and paging, so `pageCount` counts only
   * those. Defaults to `false`. Only for a channel whose stored history is readable; the API
   * refuses it with `filter_without_history` for any other channel, and any other value with
   * `invalid_query`.
   */
  withRetentionCurve?: 'true' | 'false'
}

/** One size of a video's thumbnail. */
export interface ThumbnailSize {
  url: string
  /** In pixels. */
  width: number
}

/**
 * The cap creator-analytics#90 sets on one query's ids. The ids never reach Google, so it is not a
 * Google limit. The Studio extension (#95) splits a Content list page into queries of this many.
 */
export const maxVideoIds = 50

/** One upload, with its numbers over the list's window. */
export interface VideoRow {
  id: string
  title: string
  /** 320 by 180 pixels, on YouTube's image host. */
  thumbnailUrl: string | null
  /**
   * Every size of the thumbnail Google returns, narrowest first, each on a `*.ytimg.com` host. Empty
   * when Google returns none.
   */
  thumbnails: ThumbnailSize[]
  /** The video's length in whole seconds, from the Data API. Null when Google gives none or zero. */
  durationSeconds: number | null
  /** ISO 8601: when the video was published, or when a scheduled video will be. */
  publishedAt: string | null
  scheduled: boolean
  /**
   * Google's privacy status for the video. A scheduled video is `private`, and so is one whose
   * status Google does not answer.
   */
  privacy: VideoPrivacy
  format: VideoFormat | null
  engagedViews: number
  views: number
  /**
   * A percentage from 0 to 100, as Google reports it. Never added or averaged, so absent in a
   * window after publish, where each video's numbers are its days added.
   */
  averageViewPercentage?: number
  subscribersGained: number
  estimatedMinutesWatched: number
  /**
   * The video's own estimated revenue over the window, in the list's `revenue.currency`. On every
   * row exactly when the list's revenue answered, 0 for a video YouTube reports none for. The
   * videos' revenue does not add up to the channel's, as YouTube ties some revenue to no video.
   */
  estimatedRevenue?: number
  /** The ad part of `estimatedRevenue`, on every row exactly when it is. */
  estimatedAdRevenue?: number
  /** The YouTube Premium part of `estimatedRevenue`, on every row exactly when it is. */
  estimatedRedPartnerRevenue?: number
  /**
   * True when Google has processed no day since the video was published, a scheduled video
   * included. Its numbers are not in yet, so the screen says so instead of showing zeros.
   */
  awaitingProcessing: boolean
  /** In a window after publish, on a video Google has not processed the whole window for. */
  partial?: PartialWindow
  /**
   * In a window after publish only: the video's engaged views on each day of its window Google has
   * processed, the first the publish day (day 1). As long as the processed days: `partial.days` for
   * a partial video, the window's length for a complete one, and none for a video with no publish
   * day or no processed day. A day Google answers no row for is 0.
   */
  engagedViewsByDay?: number[]
  /**
   * The video's thumbnail impressions over its counted days, from a paid channel's stored history:
   * its window after publish, or in a calendar window the window's days from its publish day. On
   * every row exactly when the list carries `history`, 0 for a video the history holds none for.
   * With the query's `trafficSource`, that source's impressions alone.
   */
  impressions?: number
  /**
   * The video's impressions click-through rate over its counted days, from 0 to 1: the sum of each
   * day and traffic source's impressions times its CTR, over the impressions (ADR 0013). Null with
   * no impressions. On every row exactly when `impressions` is. With the query's `trafficSource`,
   * that source's CTR alone.
   */
  ctr?: number | null
  /**
   * The days of the video's counted days the history holds, when it does not hold them all, as when
   * they start before the history start. Only on a row that carries `impressions`.
   */
  historyPartial?: PartialWindow
}

/** A video in the list's top by engaged views on its publish day. */
export interface PublishDayVideo {
  id: string
  title: string
  /** ISO 8601: when the video was published, the video row's own `publishedAt`. */
  publishedAt: string | null
  /** The video's engaged views on its publish day. */
  engagedViews: number
}

/** A video's numbers, as a video list row carries them. */
export type VideoRowNumbers = Pick<
  VideoRow,
  | 'engagedViews'
  | 'views'
  | 'averageViewPercentage'
  | 'subscribersGained'
  | 'estimatedMinutesWatched'
>

/** The video list's revenue, when it answered. */
export interface VideoListRevenue {
  /** The creator's saved currency, which every row's revenue and its sources are in. */
  currency: RevenueCurrency
  /**
   * Whether Google answered a revenue row, even one of 0, for any of the channel's uploads over the
   * window (in a window after publish, over the days from the first video's window to the last's),
   * before the format, visibility and scheduled filters and paging. False when it answered none:
   * Google answers a channel outside the YouTube Partner Program with no rows as often as with a
   * 403 (#119, W21). The rows still carry their revenue, 0 for each.
   */
  reported: boolean
  /**
   * Never present, so `refusal` tells this from a `RevenueRefusal`: a plain union lets an answer
   * carry a refusal and a currency together, as TypeScript checks a literal's extra properties
   * against every member of a union with no discriminant.
   */
  refusal?: never
}

/**
 * GET /api/channels/:channelId/videos, in the query's sort over every listed upload, then paged.
 * Freshness is that of the oldest read.
 */
export interface VideoListAnswer extends Freshness, RangeBounds {
  videos: VideoRow[]
  window: VideoWindow
  page: number
  pageSize: number
  /**
   * A channel with no listed uploads has 0 pages. A video the query's `minImpressions` hides is not
   * listed.
   */
  pageCount: number
  /**
   * The list's revenue, or why its rows carry none: the channel has no revenue consent, or it is
   * outside the YouTube Partner Program. Always present.
   */
  revenue: VideoListRevenue | RevenueRefusal
  /**
   * In a window after publish only: the up to `publishDayTopSize` videos with the most engaged views
   * on their publish day, across every upload of the list's format, visibility and scheduled filters,
   * not just the page's; most first, ties newest first. A video Google has not processed its publish
   * day for is left out.
   */
  publishDayTop?: PublishDayVideo[]
  /**
   * In a window after publish only: the average engaged views of the channel's newest uploads over
   * the same days since publish. It counts the newest uploads whose privacy status is public and that
   * are not scheduled (the glossary's Latest upload), of the list's format (under `all`, of any
   * format, those Google gives none too), that Google has processed the whole window for (no
   * `partial`), at most `newestAverageSize`. It counts them whatever the list's visibility,
   * scheduled toggle, `ids`, sort and page say. Absent when fewer than 2 uploads qualify.
   */
  newestAverage?: NewestAverage
  /**
   * A paid or ended channel's impressions and CTR history: the day it starts and the newest day it
   * holds (ADR 0017). Present only for a paid channel, or an ended one before its purge date, whose
   * history holds a day, and then every row carries `impressions` and `ctr`.
   */
  history?: VideoListHistory
  /**
   * In a window after publish, with `history` only: the average impressions and CTR of the
   * channel's newest uploads over the same days since publish. It counts the newest uploads whose
   * privacy status is public and that are not scheduled, of the list's format (under `all`, of any
   * format, those Google gives none too), whose whole window the history holds, at most
   * `newestAverageSize`. It counts them whatever the list's visibility, scheduled toggle, `ids`,
   * sort and page say, so its count can differ from `newestAverage`'s. Absent when fewer than 2
   * uploads qualify.
   */
  newestHistoryAverage?: NewestHistoryAverage
}

/** The two ends of a paid channel's stored impressions and CTR history. */
export interface VideoListHistory {
  /** YYYY-MM-DD, the first day the history holds. */
  firstDay: string
  /** YYYY-MM-DD, the newest day the history holds (ADR 0017). */
  newestDay: string
}

/** How many videos `publishDayTop` holds at most. */
export const publishDayTopSize = 10

/** How many of the newest uploads `newestAverage` counts at most. */
export const newestAverageSize = 10

/** The average engaged views of the newest uploads over a window after publish. */
export interface NewestAverage {
  /** The format filter the uploads were picked by, the list's own. */
  format: VideoFormatFilter
  /** How many uploads it counts: 2 to `newestAverageSize`. */
  count: number
  /** Their engaged views over the window, added and divided by `count`, not rounded. */
  engagedViews: number
}

/** The average impressions and CTR of the newest uploads over a window after publish. */
export interface NewestHistoryAverage {
  /** The format filter the uploads were picked by. */
  format: VideoFormatFilter
  /** How many uploads it counts: 2 to `newestAverageSize`. */
  count: number
  /** Their impressions over the window, added and divided by `count`, not rounded. */
  impressions: number
  /**
   * Their CTR over the window, from 0 to 1: every counted upload's impressions times its CTR, over
   * their impressions (ADR 0013), not a mean of their CTRs. Null with no impressions.
   */
  ctr: number | null
}
