import type {
  ChannelRevenue,
  ChannelSummaryAnswer,
  SummaryRequest,
  SummaryUpload,
  VideoFormat,
  VideoFormatFilter,
  Visibility,
} from '@creator-analytics/api-types'
import type { Scoped } from '@creator-analytics/database'
import {
  type ChannelDayRevenue,
  type ChannelRangeRequest,
  type FilterContentType,
  type ReadRefusal,
  reportingDayOf,
  type YouTubeGateway,
} from '@creator-analytics/youtube-gateway'
import { channelRangeOf, rangeOf } from './calendar-range.ts'
import { withHistoryOf } from './channel-history.ts'
import { everyDayOf, withRevenueOf } from './daily-series.ts'
import { freshnessTracker } from './freshness.ts'
import { readCurrency } from './preferences.ts'
import { refusedRevenue } from './revenue-part.ts'
import { publishDayOf, publishTimeOf, readEveryUpload } from './uploads.ts'
import { formatOf, isOfFormat } from './video-format.ts'
import { newestFirst } from './video-list.ts'

/** The content type Google filters a format by. `all` reads every format, with no filter. */
export const contentTypeOfFormat: Record<VideoFormatFilter, FilterContentType | undefined> = {
  all: undefined,
  video: 'videoOnDemand',
  short: 'shorts',
  live: 'liveStream',
}

type Read = ReturnType<typeof freshnessTracker>['read']

type RevenuePart =
  | { ok: true; revenue: ChannelRevenue; days: ChannelDayRevenue[] }
  | ReturnType<typeof refusedRevenue>

/**
 * The channel's revenue over the range, of the format or of every one, its revenue by day, and,
 * over the range whatever the format, the revenue tied to no format and the channel's revenue in
 * every format, which decides whether a one-format summary shows revenue. The first read refused
 * for want of consent or for a channel outside the YouTube Partner Program ends the part with no
 * further revenue read, and the summary answers without revenue. Every revenue read asks Google for
 * the creator's saved currency, and the answered revenue names it.
 */
async function revenuePartOf(
  read: Read,
  tx: Scoped<'user'>,
  channelId: string,
  request: ChannelRangeRequest,
): Promise<RevenuePart> {
  const { startDate, endDate } = request
  const currency = await readCurrency(tx)
  const inCurrency = { ...request, currency }
  const totals = await read(tx, channelId, 'channelRevenue', inCurrency)
  if (!totals.ok) return refusedRevenue(totals.refusal)
  const days = await read(tx, channelId, 'channelDailyRevenue', inCurrency)
  if (!days.ok) return refusedRevenue(days.refusal)
  const byFormat = await read(tx, channelId, 'channelRevenueByFormat', {
    startDate,
    endDate,
    currency,
  })
  if (!byFormat.ok) return refusedRevenue(byFormat.refusal)
  return {
    ok: true,
    revenue: {
      ...totals.value,
      noFormatRevenue: byFormat.value.noFormat,
      everyFormatRevenue: byFormat.value.everyFormat,
      currency,
    },
    days: days.value,
  }
}

/**
 * The uploads published on a day the daily series holds (`everyDayOf`), of the format and the
 * visibility asked for, newest first, and the lifetime format of every upload. A scheduled upload
 * is never among the first. Each upload's format is its lifetime one, read as the video list reads
 * it: the uploads read, then the content types of every upload over lifetime in the list's
 * batches, so the summary shares the list's cache entries. Either read refused refuses the part.
 */
async function uploadsPartOf(
  read: Read,
  tx: Scoped<'user'>,
  channelId: string,
  dailyDays: ReadonlySet<string>,
  processedThrough: string,
  { format, visibility }: { format: VideoFormatFilter; visibility: Visibility },
): Promise<
  | { ok: true; uploads: SummaryUpload[]; formatByVideo: Map<string, VideoFormat | null> }
  | { ok: false; refusal: ReadRefusal }
> {
  const channel = await read(tx, channelId, 'uploads', {})
  if (!channel.ok) return channel
  const { createdAt, uploads } = channel.value
  const lifetime = rangeOf('lifetime', reportingDayOf(tx.now), createdAt, processedThrough)
  const contentTypes = await readEveryUpload(uploads, (videoIds) =>
    read(tx, channelId, 'videoContentTypes', { ...lifetime, videoIds }),
  )
  if (!contentTypes.ok) return contentTypes
  const formatByVideo = new Map(
    uploads.map(({ videoId }) => [videoId, formatOf(contentTypes.byVideo.get(videoId))]),
  )
  const shown = uploads.flatMap((upload) => {
    const publishDay = publishDayOf(upload)
    const uploadFormat = formatByVideo.get(upload.videoId) ?? null
    const isShown =
      upload.scheduledFor === null &&
      publishDay !== null &&
      dailyDays.has(publishDay) &&
      (visibility === 'all' || upload.privacy === 'public') &&
      isOfFormat(uploadFormat, format)
    if (!isShown) return []
    const summaryUpload: SummaryUpload = {
      id: upload.videoId,
      title: upload.title,
      publishDay,
      format: uploadFormat,
    }
    return [{ id: upload.videoId, publishedAt: publishTimeOf(upload), summaryUpload }]
  })
  return {
    ok: true,
    uploads: shown.toSorted(newestFirst).map(({ summaryUpload }) => summaryUpload),
    formatByVideo,
  }
}

/**
 * The whole channel, or one format of it, over a calendar window or lifetime, with the uploads
 * published in it (`uploadsPartOf`) and, for a paid channel, its impressions and CTR history
 * (`withHistoryOf`). One format's history counts the videos of that lifetime format; a video
 * outside the uploads counts only in every format. A custom range outside its bounds (`customRangeOf`) is refused
 * with `invalid_range` before any metric read.
 */
export async function summariseChannel(
  gateway: YouTubeGateway,
  tx: Scoped<'user'>,
  channelId: string,
  summary: SummaryRequest,
): Promise<
  | { ok: true; answer: ChannelSummaryAnswer }
  | { ok: false; refusal: ReadRefusal }
  | { ok: false; error: 'invalid_range' }
> {
  const { read, freshness } = freshnessTracker(gateway)

  const channelRange = await channelRangeOf(read, tx, channelId, summary)
  if (!channelRange.ok) return channelRange
  const { range, processedThrough, creationDay } = channelRange
  const { window, format, visibility } = summary

  const creatorContentType = contentTypeOfFormat[format]
  const request = creatorContentType ? { ...range, creatorContentType } : range
  const totals = await read(tx, channelId, 'channelTotals', request)
  if (!totals.ok) return totals
  const series = await read(tx, channelId, 'channelDailySeries', request)
  if (!series.ok) return series
  // The gateway refuses a read whose scope the connection lacks before its cache or Google, so a
  // channel without revenue consent costs no revenue call and its summary carries no revenue.
  const revenue = await revenuePartOf(read, tx, channelId, request)
  if (!revenue.ok) return revenue
  const daily = everyDayOf(range, processedThrough, series.value)
  const dailyDays = new Set(daily.map(({ day }) => day))
  const uploads = await uploadsPartOf(read, tx, channelId, dailyDays, processedThrough, {
    format,
    visibility,
  })
  if (!uploads.ok) return uploads
  const withRevenue = 'days' in revenue ? withRevenueOf(daily, revenue.days) : daily
  const history = await withHistoryOf(tx, channelId, withRevenue, (videoId) => {
    const videoFormat = uploads.formatByVideo.get(videoId)
    return format === 'all' || (videoFormat !== undefined && isOfFormat(videoFormat, format))
  })

  return {
    ok: true,
    answer: {
      window,
      format,
      ...totals.value,
      revenue: revenue.revenue,
      daily: history.daily,
      uploads: uploads.uploads,
      ...(history.history ? { history: history.history } : {}),
      lastProcessedDay: processedThrough,
      creationDay,
      ...freshness(),
    },
  }
}
