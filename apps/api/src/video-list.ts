import {
  consentSortKeys,
  currencyOf,
  historySortKeys,
  type NewestAverage,
  newestAverageSize,
  otherSourcesOf,
  type PublishDayVideo,
  publishDayTopSize,
  type ReachTrafficSourceType,
  type RevenueCurrency,
  rpmRevenueOf,
  type VideoFormatFilter,
  type VideoListAnswer,
  type VideoRow,
  type VideoRowNumbers,
  type VideoSortKey,
  type Visibility,
  type WindowAfterPublish,
  type WindowChoice,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import type { Scoped } from '@creator-analytics/database'
import { entitlementOf, historyReadable } from '@creator-analytics/entitlements'
import {
  type DateRange,
  type ReadRefusal,
  type ReadResult,
  type Revenue,
  reportingDayOf,
  type Upload,
  type VideoRangeRequest,
  type YouTubeGateway,
} from '@creator-analytics/youtube-gateway'
import {
  creationDayOf,
  isAwaitingProcessing,
  lastProcessedDaySearch,
  processedThroughOf,
  rangeOf,
  spanOf,
} from './calendar-range.ts'
import { noRevenue } from './daily-series.ts'
import { freshnessTracker, type ReadChannel } from './freshness.ts'
import { isOneOf } from './one-of.ts'
import { readPreferences } from './preferences.ts'
import { drawableVideoIdsOf } from './retention-curves.ts'
import { refusedRevenue } from './revenue-part.ts'
import {
  byPublishTime,
  newestFirst,
  noAddedMetrics,
  noMetrics,
  publishDayOf,
  readEveryUpload,
  videoOf,
} from './uploads.ts'
import { formatOf, isOfFormat } from './video-format.ts'
import {
  countedDaysOf,
  newestHistoryAverageOf,
  readVideoHistory,
  videoReachOf,
} from './video-history.ts'
import {
  dailyRowsQueriesOf,
  engagedViewsByDayOf,
  partialOf,
  rangeAfterPublish,
} from './window-after-publish.ts'

export const maxPageSize = 50

export interface VideoListSort {
  key: VideoSortKey
  direction: 'ascending' | 'descending'
}

export type VideoListRequest = WindowChoice & {
  /** From 1. */
  page: number
  /** From 1 to `maxPageSize`. */
  pageSize: number
  includeScheduled: boolean
  sort: VideoListSort
  format: VideoFormatFilter
  visibility: Visibility
  /**
   * Null lists every upload. A set lists only those of its ids among the uploads, in any visibility
   * and scheduled ones included, whatever `visibility` and `includeScheduled` say.
   */
  ids: ReadonlySet<string> | null
  /** Null counts every traffic source in each row's impressions and CTR; a type counts it alone. */
  trafficSource: ReachTrafficSourceType | null
  /** From 1: a video with fewer impressions leaves the list before the sort and paging. */
  minImpressions: number | null
  /** Lists only the videos with a stored retention curve that has points, before the sort and paging. */
  withRetentionCurve: boolean
}

// A scheduled video is private to Google, but `includeScheduled` alone decides whether it lists.
function isOfVisibility(video: VideoRow, visibility: Visibility): boolean {
  return video.scheduled || visibility === 'all' || video.privacy === 'public'
}

// The metrics `noAddedMetrics` holds, which its type makes every video metric but the percentage.
const addedMetricNames = Object.keys(noAddedMetrics) as (keyof typeof noAddedMetrics)[]

/**
 * Each published video's publish day, by video id: one entry a video, so a video the uploads list
 * repeats is read once.
 */
function publishDaysOf(uploads: Upload[], today: string): Map<string, string> {
  return new Map(
    uploads.flatMap((upload): [string, string][] => {
      const publishDay = publishDayOf(upload)
      return publishDay && publishDay <= today ? [[upload.videoId, publishDay]] : []
    }),
  )
}

/**
 * Each published video's own days of the window after publish, by video id, read over the daily
 * rows queries that cover every video's window. A video Google answers no day for is absent.
 */
async function daysAfterPublish<Day extends { day: string }>(
  uploads: Upload[],
  window: WindowAfterPublish,
  today: string,
  readSlice: (query: VideoRangeRequest) => Promise<ReadResult<Record<string, Day[]>>>,
): Promise<{ ok: true; byVideo: Map<string, Day[]> } | { ok: false; refusal: ReadRefusal }> {
  const publishDays = publishDaysOf(uploads, today)
  const published = [...publishDays].map(([videoId, publishDay]) => ({ videoId, publishDay }))
  const byVideo = new Map<string, Day[]>()
  for (const query of dailyRowsQueriesOf(published, window, today)) {
    const batch = await readSlice(query)
    if (!batch.ok) return batch
    for (const [videoId, days] of Object.entries(batch.value)) {
      const publishDay = publishDays.get(videoId)
      if (!publishDay) continue
      // The query's days run past the video's own window when another video's window shares them,
      // and a window that runs over several queries answers some of its days in each.
      const { startDate, endDate } = rangeAfterPublish(window, publishDay, today)
      const inWindow = days.filter(({ day }) => day >= startDate && day <= endDate)
      byVideo.set(videoId, [...(byVideo.get(videoId) ?? []), ...inWindow])
    }
  }
  return { ok: true, byVideo }
}

/** Each video's days added up with `add`, by video id. */
function addedUp<Day, Sum>(
  days: { ok: true; byVideo: Map<string, Day[]> } | { ok: false; refusal: ReadRefusal },
  add: (days: Day[]) => Sum,
): { ok: true; byVideo: Map<string, Sum> } | { ok: false; refusal: ReadRefusal } {
  if (!days.ok) return days
  return {
    ok: true,
    byVideo: new Map([...days.byVideo].map(([videoId, rows]) => [videoId, add(rows)])),
  }
}

/**
 * Each published video's own days of the window after publish added up, by video id, and the days
 * themselves in `daysByVideo`, which the launch chart draws. A percentage does not add, so there is
 * no average percentage viewed. A video Google answers no day for is absent from both.
 */
async function metricsAfterPublish(
  readChannel: ReadChannel,
  uploads: Upload[],
  window: WindowAfterPublish,
  today: string,
): Promise<
  | {
      ok: true
      byVideo: Map<string, VideoRowNumbers>
      daysByVideo: Map<string, { day: string; engagedViews: number }[]>
    }
  | { ok: false; refusal: ReadRefusal }
> {
  const days = await daysAfterPublish(uploads, window, today, (query) =>
    readChannel('videoDailyRows', query),
  )
  if (!days.ok) return days
  const added = addedUp(days, (rows) => {
    const metrics: VideoRowNumbers = { ...noAddedMetrics }
    for (const row of rows) for (const name of addedMetricNames) metrics[name] += row[name]
    return metrics
  })
  return added.ok ? { ...added, daysByVideo: days.byVideo } : added
}

/** The revenue's amounts, each added up on its own. */
const revenueNames = Object.keys(noRevenue) as (keyof Revenue)[]

/**
 * The list's revenue by video id, a video Google answers no row for absent, and `reported`: whether
 * Google answered a revenue row, even one of 0, for any upload, which it does not for a channel it
 * answers with no rows in place of a 403 (#119, W21).
 */
type RevenueRead =
  | { ok: true; byVideo: Map<string, Revenue>; reported: boolean }
  | { ok: false; refusal: ReadRefusal }

/** A calendar window's revenue read, reported when Google answered any video a row. */
function reportedOf(
  read: { ok: true; byVideo: Map<string, Revenue> } | { ok: false; refusal: ReadRefusal },
): RevenueRead {
  return read.ok ? { ...read, reported: read.byVideo.size > 0 } : read
}

/**
 * Each published video's own revenue days of the window after publish added up, its sources too,
 * by video id, over the same queries as its other numbers. A video Google answers no day for is
 * absent. Google leaves each day with no revenue out of those rows, so when no video answers a day,
 * `reported` comes from each video's revenue over the days every window covers, which answers a
 * row of 0 for a video that earned nothing.
 */
async function revenueAfterPublish(
  readChannel: ReadChannel,
  uploads: Upload[],
  window: WindowAfterPublish,
  today: string,
  currency: RevenueCurrency,
): Promise<RevenueRead> {
  const days = await daysAfterPublish(uploads, window, today, (query) =>
    readChannel('videoDailyRevenueRows', { ...query, currency }),
  )
  const revenue = addedUp(days, (rows) => {
    const sum = { ...noRevenue }
    for (const row of rows) for (const name of revenueNames) sum[name] += row[name]
    return sum
  })
  if (!revenue.ok) return revenue
  if (revenue.byVideo.size > 0) return { ...revenue, reported: true }
  const publishDays = publishDaysOf(uploads, today)
  const ranges = [...publishDays.values()].map((publishDay) =>
    rangeAfterPublish(window, publishDay, today),
  )
  const startDate = ranges.map((range) => range.startDate).toSorted()[0]
  const endDate = ranges.map((range) => range.endDate).toSorted()[ranges.length - 1]
  if (!startDate || !endDate) return { ...revenue, reported: false }
  const totals = await readEveryUpload(
    uploads.filter(({ videoId }) => publishDays.has(videoId)),
    (videoIds) => readChannel('videoRevenue', { startDate, endDate, videoIds, currency }),
  )
  if (!totals.ok) return totals
  return { ...revenue, reported: totals.byVideo.size > 0 }
}

type RevenuePart =
  | {
      ok: true
      revenue: { currency: RevenueCurrency; byVideo: Map<string, Revenue>; reported: boolean }
    }
  | ReturnType<typeof refusedRevenue>

/**
 * The list's revenue from the read of each video's own estimated revenue and its sources over the
 * window, in the creator's saved currency: by video id, a video Google answers no row for absent. A
 * read refused for want of consent or for a channel outside the YouTube Partner Program, which ends
 * at its first refused query, leaves the list answering without revenue; any other refusal refuses
 * the list.
 */
function revenuePartOf(currency: RevenueCurrency, revenue: RevenueRead): RevenuePart {
  if (!revenue.ok) return refusedRevenue(revenue.refusal)
  return { ok: true, revenue: { currency, byVideo: revenue.byVideo, reported: revenue.reported } }
}

/** Whether the key sorts by revenue, one of its sources or RPM, which need revenue consent. */
function isRevenueSortKey(key: VideoSortKey): boolean {
  return isOneOf(consentSortKeys, key)
}

type VideoOrder = (a: VideoRow, b: VideoRow) => number

// The list's default order, which the channel summary's uploads reuse.
export { newestFirst }

/**
 * A video's value for a metric sort. Its RPM is the revenue `rpmRevenueOf` counts per 1,000
 * engaged views, 0 with no revenue: the whole estimated revenue, or ads plus YouTube Premium with
 * the RPM switch on. A video with zero engaged views has none, and `orderOf` puts it last. Its
 * impressions and CTR are its row's, from the history; a video with no impressions has no CTR, and
 * `orderOf` puts it last too.
 */
function sortValueOf(
  video: VideoRow,
  key: Exclude<VideoSortKey, 'publishedAt'>,
  adsAndPremiumOnly: boolean,
): number {
  const { estimatedRevenue = 0, estimatedAdRevenue = 0, estimatedRedPartnerRevenue = 0 } = video
  const amounts = { estimatedRevenue, estimatedAdRevenue, estimatedRedPartnerRevenue }
  if (key === 'rpm')
    return video.engagedViews > 0
      ? (rpmRevenueOf(amounts, adsAndPremiumOnly) / video.engagedViews) * 1000
      : 0
  if (key !== 'otherSources') return video[key] ?? 0
  return otherSourcesOf(amounts)
}

/**
 * Whether a video has no value for the sort's key: zero engaged views earn no RPM, and no
 * impressions give no CTR.
 */
function hasNoValue(video: VideoRow, key: VideoSortKey): boolean {
  if (key === 'ctr') return video.ctr == null
  return key === 'rpm' && !(video.engagedViews > 0)
}

/**
 * Whether a video's number for the sort's key covers fewer days than the window's: a window after
 * publish Google has not processed whole, or for impressions and CTR, counted days the history does
 * not hold whole.
 */
function isPartialFor(video: VideoRow, key: VideoSortKey): boolean {
  return !!video.partial || (isOneOf(historySortKeys, key) && !!video.historyPartial)
}

/**
 * The order a sort asks for. In a metric sort, partial videos follow every complete one, as their
 * numbers cover fewer days (`isPartialFor`), and in an RPM sort, videos with zero engaged views,
 * or in a CTR sort videos with no impressions, follow the others of each, in either direction.
 * Videos that tie on a metric run newest first.
 */
function orderOf({ key, direction }: VideoListSort, adsAndPremiumOnly: boolean): VideoOrder {
  const sign = direction === 'ascending' ? 1 : -1
  if (key === 'publishedAt') return byPublishTime(sign)
  return (a, b) =>
    Number(isPartialFor(a, key)) - Number(isPartialFor(b, key)) ||
    Number(hasNoValue(a, key)) - Number(hasNoValue(b, key)) ||
    sign * (sortValueOf(a, key, adsAndPremiumOnly) - sortValueOf(b, key, adsAndPremiumOnly)) ||
    newestFirst(a, b)
}

/**
 * The `publishDayTopSize` videos with the most engaged views on their publish day, most first, ties
 * newest first. A video with no processed day has no publish day number, and is left out.
 */
function publishDayTopOf(listed: VideoRow[]): PublishDayVideo[] {
  const publishDayViewsOf = (video: VideoRow) => video.engagedViewsByDay?.[0]
  return listed
    .filter((video) => publishDayViewsOf(video) !== undefined)
    .toSorted(
      (a, b) => (publishDayViewsOf(b) ?? 0) - (publishDayViewsOf(a) ?? 0) || newestFirst(a, b),
    )
    .slice(0, publishDayTopSize)
    .map((video) => ({
      id: video.id,
      title: video.title,
      publishedAt: video.publishedAt,
      engagedViews: publishDayViewsOf(video) ?? 0,
    }))
}

/**
 * The average engaged views of the `newestAverageSize` newest uploads of the format, over the
 * window's rows of every upload, or undefined when fewer than 2 qualify.
 */
function newestAverageOf(
  rows: VideoRow[],
  formatFilter: VideoFormatFilter,
): NewestAverage | undefined {
  const newest = rows
    .filter(
      (video) =>
        video.privacy === 'public' &&
        !video.scheduled &&
        !video.partial &&
        isOfFormat(video.format, formatFilter),
    )
    .toSorted(newestFirst)
    .slice(0, newestAverageSize)
  const count = newest.length
  if (count < 2) return undefined
  const sum = newest.reduce((total, video) => total + video.engagedViews, 0)
  return { format: formatFilter, count, engagedViews: sum / count }
}

/**
 * A paid or ended channel's history on the list: each row's impressions, CTR and "N of M days"
 * over its counted days (`countedDaysOf`), of the traffic source alone when one is set, the
 * history's two ends, and in a window after publish the newest uploads' average impressions and CTR
 * over every upload's row and every source, as `newestAverage` is.
 * The rows as they are, and no answer field, for a free channel, an ended one past its purge date,
 * or one whose history holds no day.
 */
async function historyPartOf(
  tx: Scoped<'user'>,
  channelId: string,
  uploads: Upload[],
  rows: VideoRow[],
  span: { afterPublish: WindowAfterPublish } | { calendar: DateRange },
  formatFilter: VideoFormatFilter,
  trafficSource: ReachTrafficSourceType | null,
): Promise<{
  rows: VideoRow[]
  answer: Pick<VideoListAnswer, 'history' | 'newestHistoryAverage'>
}> {
  const publishDays = new Map(uploads.map((upload) => [upload.videoId, publishDayOf(upload)]))
  const countedByVideo = new Map(
    uploads.map((upload) => [upload.videoId, countedDaysOf(span, publishDayOf(upload))]),
  )
  const windows = new Map(
    [...countedByVideo].flatMap(([videoId, range]): [string, DateRange][] =>
      range ? [[videoId, range]] : [],
    ),
  )
  const history = await readVideoHistory(tx, channelId, windows)
  if (!history) return { rows, answer: {} }
  const average =
    'afterPublish' in span
      ? newestHistoryAverageOf(
          rows.map((video) => ({
            video,
            publishDay: publishDays.get(video.id) ?? null,
            sources: history.sourcesByVideo.get(video.id) ?? [],
          })),
          formatFilter,
          span.afterPublish,
          history.held,
        )
      : undefined
  return {
    rows: rows.map((video) => ({
      ...video,
      ...videoReachOf(history, video.id, countedByVideo.get(video.id) ?? null, trafficSource),
    })),
    answer: {
      history: { firstDay: history.firstDay, newestDay: history.newestDay },
      ...(average
        ? {
            newestHistoryAverage: {
              format: average.format,
              count: average.count,
              impressions: average.impressions,
              ctr: average.ctr,
            },
          }
        : {}),
    },
  }
}

/**
 * One page of the channel's uploads of the format and visibility asked for, or of the format among
 * a set of ids in any visibility, each with its metrics over the window, its revenue with revenue
 * consent, and its format, in the sort's order over every listed upload. Every upload's metrics,
 * revenue and format are read, so each page, sort, format, visibility, the scheduled toggle and any
 * set of ids read from the same cached queries, and each window's metrics and revenue from their
 * own. In a window after publish, the answer carries the average engaged views of the newest public
 * uploads of the format (`newestAverage`), from the same rows of every upload, before the list's
 * visibility, scheduled toggle and ids pick its videos, and at no read past the list's own. A
 * revenue sort without revenue consent is refused with `consent_missing`, and an impressions or CTR
 * sort for a channel whose history is not readable with `sort_without_history`. A custom range
 * outside its bounds (`customRangeOf`) is refused with `invalid_range` before any metric or revenue
 * read. The RPM sort follows the saved RPM switch: with it on, it counts only ads and YouTube
 * Premium (`rpmRevenueOf`). A traffic source counts only its own reach in each row's impressions
 * and CTR, and a minimum of impressions hides the rows under it before the sort and paging, though
 * not from `publishDayTop` or the newest averages. In the same way, `withRetentionCurve` hides the
 * videos with no stored curve points. A channel whose history is not readable is refused any of
 * these filters with `filter_without_history`.
 */
export async function listVideos(
  gateway: YouTubeGateway,
  tx: Scoped<'user'>,
  channelId: string,
  listRequest: VideoListRequest,
): Promise<
  | { ok: true; answer: VideoListAnswer }
  | { ok: false; refusal: ReadRefusal }
  | { ok: false; error: 'invalid_range' }
  | { ok: false; error: 'sort_without_history' }
  | { ok: false; error: 'filter_without_history' }
> {
  const {
    page,
    pageSize,
    includeScheduled,
    window,
    sort,
    format: formatFilter,
    visibility,
    ids,
    trafficSource,
    minImpressions,
    withRetentionCurve,
  } = listRequest
  const { read, freshness } = freshnessTracker(gateway)
  const readChannel: ReadChannel = (name, request) => read(tx, channelId, name, request)

  const channel = await readChannel('uploads', {})
  if (!channel.ok) return channel
  const { createdAt, uploads } = channel.value

  const today = reportingDayOf(tx.now)
  const isAfterPublish = isOneOf(windowsAfterPublish, window)
  // A list sorted by revenue cannot run in that order without it, and a creator who has not given
  // revenue consent is asked to. The connection is checked before any Analytics query, so the
  // refusal spends none. A channel outside the program has no revenue to sort by, so every video
  // ties and the list runs newest first.
  if (
    isRevenueSortKey(sort.key) &&
    (await gateway.connectionRefusal(tx, channelId, 'videoRevenue')) === 'consent_missing'
  ) {
    return { ok: false, refusal: 'consent_missing' }
  }
  // Impressions and CTR come from the stored history alone, which a free channel, or an ended one
  // past its purge date, cannot read, so it can neither sort nor filter by them. Checked before any
  // Analytics query, as the consent is.
  const historySort = isOneOf(historySortKeys, sort.key)
  const historyFilter = trafficSource !== null || minImpressions !== null || withRetentionCurve
  if ((historySort || historyFilter) && !historyReadable(await entitlementOf(tx, channelId))) {
    return { ok: false, error: historySort ? 'sort_without_history' : 'filter_without_history' }
  }

  const lastProcessed = await readChannel('lastProcessedDay', lastProcessedDaySearch(today))
  if (!lastProcessed.ok) return lastProcessed
  const processedThrough = processedThroughOf(lastProcessed.value, today)
  const span = spanOf(listRequest, today, createdAt, processedThrough)
  if (!span) return { ok: false, error: 'invalid_range' }
  // The gateway refuses a read whose scope the connection lacks before its cache or Google, so a
  // channel without revenue consent costs no revenue call and its rows carry no revenue.
  const saved = await readPreferences(tx)
  const currency = currencyOf(saved)
  const revenuePart = revenuePartOf(
    currency,
    'afterPublish' in span
      ? await revenueAfterPublish(readChannel, uploads, span.afterPublish, today, currency)
      : reportedOf(
          await readEveryUpload(uploads, (videoIds) =>
            readChannel('videoRevenue', { ...span.calendar, videoIds, currency }),
          ),
        ),
  )
  if (!revenuePart.ok) return revenuePart
  const { revenue } = revenuePart
  const { rowRevenueOf, listRevenue } =
    'refusal' in revenue
      ? { rowRevenueOf: () => ({}), listRevenue: { refusal: revenue.refusal } }
      : {
          rowRevenueOf: (videoId: string) => revenue.byVideo.get(videoId) ?? noRevenue,
          listRevenue: { currency: revenue.currency, reported: revenue.reported },
        }

  const metrics =
    'afterPublish' in span
      ? await metricsAfterPublish(readChannel, uploads, span.afterPublish, today)
      : await readEveryUpload(uploads, (videoIds) =>
          readChannel('videoMetrics', { ...span.calendar, videoIds }),
        )
  if (!metrics.ok) return metrics
  // A video's format is its lifetime one, whatever the window: one cached read serves them all.
  const lifetime = rangeOf('lifetime', today, createdAt, processedThrough)
  const contentTypes = await readEveryUpload(uploads, (videoIds) =>
    readChannel('videoContentTypes', { ...lifetime, videoIds }),
  )
  if (!contentTypes.ok) return contentTypes

  const none = isAfterPublish ? noAddedMetrics : noMetrics
  const rows = uploads.map(
    (upload): VideoRow => ({
      ...videoOf(upload),
      privacy: upload.privacy,
      format: formatOf(contentTypes.byVideo.get(upload.videoId)),
      ...(metrics.byVideo.get(upload.videoId) ?? none),
      ...rowRevenueOf(upload.videoId),
      ...(isAfterPublish ? partialOf(window, publishDayOf(upload), processedThrough) : {}),
      ...('daysByVideo' in metrics && isAfterPublish
        ? {
            engagedViewsByDay: engagedViewsByDayOf(
              window,
              publishDayOf(upload),
              processedThrough,
              metrics.daysByVideo.get(upload.videoId) ?? [],
            ),
          }
        : {}),
      awaitingProcessing: isAwaitingProcessing(publishDayOf(upload), processedThrough),
    }),
  )
  const historyPart = await historyPartOf(
    tx,
    channelId,
    uploads,
    rows,
    span,
    formatFilter,
    trafficSource,
  )
  const listed = historyPart.rows.filter(
    (video) =>
      (ids
        ? ids.has(video.id)
        : (includeScheduled || !video.scheduled) && isOfVisibility(video, visibility)) &&
      isOfFormat(video.format, formatFilter),
  )
  // The minimum guards the sort the creator sees, so it counts the row's own impressions, of the
  // traffic source when one is set. A row without impressions, as with no `history`, is kept.
  const drawable = withRetentionCurve ? await drawableVideoIdsOf(tx, channelId) : null
  const shown = listed.filter(
    (video) =>
      (minImpressions === null ||
        video.impressions === undefined ||
        video.impressions >= minImpressions) &&
      (drawable === null || drawable.has(video.id)),
  )
  const videos = shown
    .toSorted(orderOf(sort, !!saved.rpmAdsAndPremiumOnly))
    .slice((page - 1) * pageSize, page * pageSize)
  const newestAverage = isAfterPublish ? newestAverageOf(rows, formatFilter) : undefined

  return {
    ok: true,
    answer: {
      videos,
      window,
      page,
      pageSize,
      pageCount: Math.ceil(shown.length / pageSize),
      revenue: listRevenue,
      lastProcessedDay: processedThrough,
      creationDay: creationDayOf(createdAt),
      ...(isAfterPublish ? { publishDayTop: publishDayTopOf(listed) } : {}),
      ...(newestAverage ? { newestAverage } : {}),
      ...historyPart.answer,
      ...freshness(),
    },
  }
}
