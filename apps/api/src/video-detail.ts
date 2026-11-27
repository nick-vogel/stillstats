import {
  addDays,
  type RevenueCurrency,
  type TrafficSource,
  type VideoDetailAnswer,
  type VideoFormat,
  type VideoFormatFilter,
  type VideoHistory,
  type VideoRevenue,
  type WindowAfterPublish,
  type WindowChoice,
} from '@creator-analytics/api-types'
import type { Scoped } from '@creator-analytics/database'
import {
  type DateRange,
  type OneVideoRequest,
  type ReadRefusal,
  reportingDayOf,
  type Upload,
  type VideoDayRevenue,
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
import { everyDayOf, withRevenueOf } from './daily-series.ts'
import { freshnessTracker, type ReadChannel } from './freshness.ts'
import { readCurrency } from './preferences.ts'
import { isRevenueRefusal, refusedRevenue } from './revenue-part.ts'
import { readSincePublish } from './since-publish.ts'
import { noMetrics, publishDayOf, readEveryUpload, videoOf } from './uploads.ts'
import { formatOf, readVideoFormat } from './video-format.ts'
import {
  countedDaysOf,
  newestHistoryAverageOf,
  readVideoHistory,
  videoReachOf,
  wholeWindowOf,
  withSourceReach,
} from './video-history.ts'
import { dayAfterPublishOf, partialOf, rangeAfterPublish } from './window-after-publish.ts'

/** Why a detail read is refused: the gateway's refusals, or a video the channel does not hold. */
export type VideoDetailRefusal = ReadRefusal | 'video_not_found'

/**
 * The days of the window the video can have numbers for: from the later of the window's first day
 * and the video's publish day. A video not yet published has none, so the range runs backwards.
 */
function videoRangeOf(range: DateRange, publishDay: string | null): DateRange {
  const startDate = publishDay && publishDay > range.startDate ? publishDay : range.startDate
  return { startDate, endDate: range.endDate }
}

type VideoDetailNumbers = Pick<
  VideoDetailAnswer,
  'totals' | 'days' | 'audienceRetention' | 'trafficSources' | 'subscriberSplit'
>

/** The numbers of a video with no day to count in the window, or one awaiting processing. */
const noNumbers: VideoDetailNumbers = {
  totals: noMetrics,
  days: [],
  audienceRetention: [],
  trafficSources: [],
  subscriberSplit: {
    subscribed: { engagedViews: 0, views: 0 },
    unsubscribed: { engagedViews: 0, views: 0 },
  },
}

/** The video's numbers over its range, one Analytics query a part. */
async function numbersOf(
  readChannel: ReadChannel,
  request: OneVideoRequest,
  processedThrough: string,
): Promise<{ ok: true; numbers: VideoDetailNumbers } | { ok: false; refusal: ReadRefusal }> {
  // Google refuses a range that ends before it starts.
  if (request.startDate > request.endDate) return { ok: true, numbers: noNumbers }

  const summary = await readChannel('videoWindowSummary', request)
  if (!summary.ok) return summary
  const daily = await readChannel('videoDailySeries', request)
  if (!daily.ok) return daily
  const retention = await readChannel('audienceRetention', request)
  if (!retention.ok) return retention
  const traffic = await readChannel('trafficSources', request)
  if (!traffic.ok) return traffic
  const subscribers = await readChannel('subscriberSplit', request)
  if (!subscribers.ok) return subscribers

  return {
    ok: true,
    numbers: {
      totals: summary.value ?? noMetrics,
      days: everyDayOf(request, processedThrough, daily.value),
      audienceRetention: retention.value.toSorted(
        (a, b) => a.elapsedVideoTimeRatio - b.elapsedVideoTimeRatio,
      ),
      trafficSources: Object.entries(traffic.value)
        .map(([type, numbers]): TrafficSource => ({ type, ...numbers }))
        .sort(
          (a, b) =>
            b.engagedViews - a.engagedViews || b.views - a.views || a.type.localeCompare(b.type),
        ),
      // A status Google has no row for had no views.
      subscriberSplit: {
        subscribed: subscribers.value.SUBSCRIBED ?? noNumbers.subscriberSplit.subscribed,
        unsubscribed: subscribers.value.UNSUBSCRIBED ?? noNumbers.subscriberSplit.unsubscribed,
      },
    },
  }
}

type RevenuePart =
  | { ok: true; revenue: VideoRevenue; days: VideoDayRevenue[] }
  | ReturnType<typeof refusedRevenue>

/**
 * The video's revenue over its range, in the currency given, and its revenue by day. The first
 * read refused for want of consent or for a channel outside the YouTube Partner Program ends the
 * part with no further revenue read, and the detail answers without revenue.
 */
async function revenuePartOf(
  readChannel: ReadChannel,
  request: OneVideoRequest,
  currency: RevenueCurrency,
): Promise<RevenuePart> {
  const inCurrency = { ...request, currency }
  const totals = await readChannel('videoWindowRevenue', inCurrency)
  if (!totals.ok) return refusedRevenue(totals.refusal)
  const days = await readChannel('videoDailyRevenue', inCurrency)
  if (!days.ok) return refusedRevenue(days.refusal)
  return { ok: true, revenue: { ...totals.value, currency }, days: days.value }
}

async function lifetimeRevenueCurrencyOf(
  readChannel: ReadChannel,
  lifetimeRequest: OneVideoRequest,
  currency: RevenueCurrency,
): Promise<{ ok: true; currency: RevenueCurrency | null } | { ok: false; refusal: ReadRefusal }> {
  const read = await readChannel('videoWindowRevenue', { ...lifetimeRequest, currency })
  if (read.ok) return { ok: true, currency }
  return isRevenueRefusal(read.refusal) ? { ok: true, currency: null } : read
}

/**
 * A paid or ended channel's history for the video: its traffic sources with their impressions and
 * CTR, and its totals, its "N of M days" and, in a window after publish, the newest uploads'
 * average of its own format (`all` with none), overall and per traffic source type. The newest
 * average reads every upload's window and, for a format, every upload's lifetime format from the
 * video list's own cached read. The sources as they are, and no history, for a free channel, an
 * ended one past its purge date, or one whose history holds no day.
 */
async function videoHistoryPartOf(
  readChannel: ReadChannel,
  tx: Scoped<'user'>,
  channelId: string,
  uploads: Upload[],
  {
    upload,
    format,
    span,
    today,
  }: {
    upload: Upload
    format: VideoFormat | null
    span: { afterPublish: WindowAfterPublish } | { calendar: DateRange }
    today: string
  },
  sources: TrafficSource[],
  lifetime: DateRange,
): Promise<
  | { ok: true; trafficSources: TrafficSource[]; history?: VideoHistory }
  | { ok: false; refusal: ReadRefusal }
> {
  const counted = countedDaysOf(span, publishDayOf(upload))
  const afterPublish = 'afterPublish' in span ? span.afterPublish : null
  const windows = new Map<string, DateRange>(
    afterPublish
      ? uploads.flatMap((each): [string, DateRange][] => {
          const publishDay = publishDayOf(each)
          return publishDay && publishDay <= today
            ? [[each.videoId, wholeWindowOf(afterPublish, publishDay)]]
            : []
        })
      : [],
  )
  if (counted) windows.set(upload.videoId, counted)
  const history = await readVideoHistory(tx, channelId, windows)
  if (!history) return { ok: true, trafficSources: sources }

  const formatFilter: VideoFormatFilter = format ?? 'all'
  let newestAverage: VideoHistory['newestAverage']
  if (afterPublish) {
    const contentTypes =
      formatFilter === 'all'
        ? null
        : await readEveryUpload(uploads, (videoIds) =>
            readChannel('videoContentTypes', { ...lifetime, videoIds }),
          )
    if (contentTypes && !contentTypes.ok) return contentTypes
    newestAverage = newestHistoryAverageOf(
      uploads.map((each) => ({
        video: {
          ...videoOf(each),
          privacy: each.privacy,
          format: contentTypes ? formatOf(contentTypes.byVideo.get(each.videoId)) : null,
        },
        publishDay: publishDayOf(each),
        sources: history.sourcesByVideo.get(each.videoId) ?? [],
      })),
      formatFilter,
      afterPublish,
      history.held,
    )
  }
  const reach = videoReachOf(history, upload.videoId, counted)
  return {
    ok: true,
    trafficSources: withSourceReach(sources, history.sourcesByVideo.get(upload.videoId)),
    history: {
      impressions: reach.impressions,
      ctr: reach.ctr,
      firstDay: history.firstDay,
      newestDay: history.newestDay,
      ...(reach.historyPartial ? { partial: reach.historyPartial } : {}),
      ...(newestAverage ? { newestAverage } : {}),
    },
  }
}

/**
 * One video's detail over a window, its revenue with revenue consent. The uploads read comes first,
 * so a video the channel does not hold is refused before any Analytics query. A custom range outside
 * its bounds (`customRangeOf`) is refused with `invalid_range` before any metric read.
 */
export async function videoDetail(
  gateway: YouTubeGateway,
  tx: Scoped<'user'>,
  channelId: string,
  videoId: string,
  choice: WindowChoice,
): Promise<
  | { ok: true; answer: VideoDetailAnswer }
  | { ok: false; refusal: VideoDetailRefusal }
  | { ok: false; error: 'invalid_range' }
> {
  const { read, freshness } = freshnessTracker(gateway)
  const readChannel: ReadChannel = (name, request) => read(tx, channelId, name, request)

  const channel = await readChannel('uploads', {})
  if (!channel.ok) return channel
  const upload = channel.value.uploads.find((candidate) => candidate.videoId === videoId)
  if (!upload) return { ok: false, refusal: 'video_not_found' }

  const today = reportingDayOf(tx.now)
  const publishDay = publishDayOf(upload)
  const lastProcessed = await readChannel('lastProcessedDay', lastProcessedDaySearch(today))
  if (!lastProcessed.ok) return lastProcessed
  const processedThrough = processedThroughOf(lastProcessed.value, today)
  const awaiting = isAwaitingProcessing(publishDay, processedThrough)
  const unprocessed = !publishDay || awaiting
  const { createdAt } = channel.value
  // The range the lifetime window reads, which the since publish lifetime row reads too.
  const lifetimeRange = videoRangeOf(
    rangeOf('lifetime', today, createdAt, processedThrough),
    publishDay,
  )
  const span = spanOf(choice, today, createdAt, processedThrough)
  if (!span) return { ok: false, error: 'invalid_range' }
  const afterPublish = 'afterPublish' in span ? span.afterPublish : null
  const range =
    'afterPublish' in span
      ? rangeAfterPublish(span.afterPublish, publishDay ?? addDays(today, 1), today)
      : videoRangeOf(span.calendar, publishDay)
  const request = { ...range, videoId }
  // A video awaiting processing has no numbers to read in any window, and the web app shows only
  // that it is not processed yet. A calendar or custom window's range already runs backwards for it.
  const counted = awaiting
    ? { ok: true as const, numbers: noNumbers }
    : await numbersOf(readChannel, request, processedThrough)
  if (!counted.ok) return counted
  // The video's lifetime format, from the video list's own read, so a detail opened from the list
  // costs no query. Google has no lifetime row yet for a video awaiting processing.
  const format = awaiting
    ? { ok: true as const, format: null }
    : await readVideoFormat(
        readChannel,
        channel.value.uploads,
        videoId,
        rangeOf('lifetime', today, createdAt, processedThrough),
      )
  if (!format.ok) return format
  // A window with no day of the video's to count has no revenue to read either, and neither has a
  // video Google has processed no day of since publish, one with no publish day included, in any
  // window (#167, #189). The gateway refuses a read whose scope the connection lacks before its
  // cache or Google, so a channel without revenue consent costs no revenue call.
  const currency = await readCurrency(tx)
  const revenue =
    range.startDate > range.endDate || unprocessed
      ? null
      : await revenuePartOf(readChannel, request, currency)
  if (revenue && !revenue.ok) return revenue
  // The since publish rows carry revenue when the channel's revenue reads answer: the detail's own
  // revenue says so, or, when the window has no day and Google has processed one of the video's,
  // the revenue read over the lifetime range that the since publish lifetime row makes anyway. A
  // video Google has processed no day of since publish has no revenue to read in any window.
  const sincePublishCurrency = revenue
    ? {
        ok: true as const,
        currency: 'currency' in revenue.revenue ? revenue.revenue.currency : null,
      }
    : !unprocessed
      ? await lifetimeRevenueCurrencyOf(readChannel, { ...lifetimeRange, videoId }, currency)
      : { ok: true as const, currency: null }
  if (!sincePublishCurrency.ok) return sincePublishCurrency
  const sincePublish = await readSincePublish(
    readChannel,
    videoId,
    publishDay,
    lifetimeRange,
    processedThrough,
    today,
    sincePublishCurrency.currency,
  )
  if (!sincePublish.ok) return sincePublish

  const historyPart = await videoHistoryPartOf(
    readChannel,
    tx,
    channelId,
    channel.value.uploads,
    { upload, format: format.format, span, today },
    counted.numbers.trafficSources,
    rangeOf('lifetime', today, createdAt, processedThrough),
  )
  if (!historyPart.ok) return historyPart

  const counts =
    revenue && 'days' in revenue
      ? withRevenueOf(counted.numbers.days, revenue.days)
      : counted.numbers.days
  const days = afterPublish
    ? counts.map((day) => ({
        ...day,
        dayAfterPublish: dayAfterPublishOf(range.startDate, day.day),
      }))
    : counts

  return {
    ok: true,
    answer: {
      video: {
        ...videoOf(upload),
        privacy: upload.privacy,
        embeddable: upload.embeddable,
        madeForKids: upload.madeForKids,
        format: format.format,
      },
      window: choice.window,
      ...counted.numbers,
      trafficSources: historyPart.trafficSources,
      ...(historyPart.history ? { history: historyPart.history } : {}),
      days,
      ...(revenue ? { revenue: revenue.revenue } : {}),
      sincePublish: sincePublish.value,
      ...(afterPublish ? partialOf(afterPublish, publishDay, processedThrough) : {}),
      awaitingProcessing: awaiting,
      lastProcessedDay: processedThrough,
      creationDay: creationDayOf(createdAt),
      ...freshness(),
    },
  }
}
