import {
  addDays,
  daysProcessedSince,
  type PartialWindow,
  type SponsorFigure,
  type SponsorReportAnswer,
  type SponsorReportFigure,
  type SponsorWindow,
  type SponsorWindowDays,
  sponsorFigures,
  sponsorHistoryFigures,
  sponsorWindowDays,
  sponsorWindowEndOf,
} from '@creator-analytics/api-types'
import type { Scoped } from '@creator-analytics/database'
import {
  type DateRange,
  type ReadRefusal,
  reportingDayOf,
  type VideoSponsorFigures,
  type YouTubeGateway,
} from '@creator-analytics/youtube-gateway'
import {
  isAwaitingProcessing,
  lastProcessedDaySearch,
  processedThroughOf,
} from './calendar-range.ts'
import { freshnessTracker, type ReadChannel } from './freshness.ts'
import { publishDayOf, videoOf } from './uploads.ts'
import { reachOfSources, readVideoHistory, type VideoHistoryRead } from './video-history.ts'

/** Why a sponsor report is refused: the gateway's refusals, or a video the channel does not hold. */
export type SponsorReportRefusal = ReadRefusal | 'video_not_found'

/**
 * The days of a sponsor report's window: from the publish day, as day 1, to the earlier of day
 * `days` and the last processed day. These windows belong to the sponsor report alone, so they are
 * counted here rather than as windows after publish.
 */
function sponsorRangeOf(
  days: SponsorWindowDays,
  publishDay: string,
  processedThrough: string,
): DateRange {
  return { startDate: publishDay, endDate: sponsorWindowEndOf(days, publishDay, processedThrough) }
}

/** The days Google has processed of the window, when it has not processed them all. */
function sponsorPartialOf(
  days: SponsorWindowDays,
  publishDay: string | null,
  processedThrough: string,
): { partial?: PartialWindow } {
  const processed = daysProcessedSince(publishDay, processedThrough)
  return processed < days ? { partial: { days: processed, of: days } } : {}
}

const isAnalyticsFigure = (figure: SponsorReportFigure): figure is SponsorFigure =>
  (sponsorFigures as readonly string[]).includes(figure)

const isHistoryFigure = (figure: SponsorReportFigure): boolean =>
  (sponsorHistoryFigures as readonly string[]).includes(figure)

/** Only the chosen Analytics figures, each 0 when Google has no row. */
function chosenOf(
  figures: readonly SponsorReportFigure[],
  numbers: VideoSponsorFigures | null,
): SponsorWindow['numbers'] {
  return Object.fromEntries(
    figures.filter(isAnalyticsFigure).map((figure) => [figure, numbers?.[figure] ?? 0]),
  )
}

/** How many of the range's days the history holds, and how many the range has. */
function historyDaysOf(range: DateRange, held: ReadonlySet<string>): PartialWindow {
  let days = 0
  let of = 0
  for (let day = range.startDate; day <= range.endDate; day = addDays(day, 1)) {
    of += 1
    if (held.has(day)) days += 1
  }
  return { days, of }
}

/**
 * The window's chosen impressions and CTR from the stored history, when it holds every day of the
 * window's range; otherwise none of them, and the days it holds.
 */
function historyNumbersOf(
  figures: readonly SponsorReportFigure[],
  history: VideoHistoryRead,
  videoId: string,
  range: DateRange,
): Pick<SponsorWindow, 'numbers' | 'historyPartial'> {
  const held = historyDaysOf(range, history.held)
  if (held.days < held.of) return { numbers: {}, historyPartial: held }
  const reach = reachOfSources(history.sourcesByVideo.get(videoId) ?? [])
  return {
    numbers: {
      ...(figures.includes('impressions') ? { impressions: reach.impressions } : {}),
      ...(figures.includes('ctr') ? { ctr: reach.ctr } : {}),
    },
  }
}

/**
 * One video's sponsor report: its first 7, 14 and 30 days, each Google's own totals over its
 * range, with only the chosen figures. The uploads read comes first, so a video the channel does
 * not hold is refused before any Analytics query. A video with no publish day, or one Google has
 * processed no day of, makes no query of its numbers. Windows with the same range share one query.
 * Impressions and CTR come from the channel's stored history, never from Google: only when the
 * history is readable and holds a day, and in each window only when it holds every day of the
 * window's range. A choice left with no figure once they are dropped answers the nine.
 */
export async function sponsorReport(
  gateway: YouTubeGateway,
  tx: Scoped<'user'>,
  channelId: string,
  videoId: string,
  chosen: readonly SponsorReportFigure[],
): Promise<
  { ok: true; answer: SponsorReportAnswer } | { ok: false; refusal: SponsorReportRefusal }
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

  const byRange = new Map<string, VideoSponsorFigures | null>()
  const historyByRange = new Map<string, VideoHistoryRead | undefined>()
  const historyChosen = chosen.some(isHistoryFigure)
  const history = await readVideoHistory(tx, channelId, new Map())
  const analytics = chosen.filter((figure) => !isHistoryFigure(figure))
  const figures = history ? [...chosen] : analytics.length > 0 ? analytics : [...sponsorFigures]
  const windows: SponsorWindow[] = []
  for (const days of sponsorWindowDays) {
    let numbers: VideoSponsorFigures | null = null
    let fromHistory: Pick<SponsorWindow, 'numbers' | 'historyPartial'> = { numbers: {} }
    if (publishDay && !awaiting) {
      const range = sponsorRangeOf(days, publishDay, processedThrough)
      const key = `${range.startDate}:${range.endDate}`
      if (!byRange.has(key)) {
        const figuresRead = await readChannel('videoSponsorFigures', { ...range, videoId })
        if (!figuresRead.ok) return figuresRead
        byRange.set(key, figuresRead.value)
      }
      numbers = byRange.get(key) ?? null
      if (history && historyChosen) {
        if (!historyByRange.has(key)) {
          historyByRange.set(
            key,
            await readVideoHistory(tx, channelId, new Map([[videoId, range]])),
          )
        }
        const ranged = historyByRange.get(key)
        if (ranged) fromHistory = historyNumbersOf(figures, ranged, videoId, range)
      }
    }
    windows.push({
      days,
      numbers: { ...chosenOf(figures, numbers), ...fromHistory.numbers },
      ...sponsorPartialOf(days, awaiting ? null : publishDay, processedThrough),
      ...(fromHistory.historyPartial ? { historyPartial: fromHistory.historyPartial } : {}),
    })
  }

  const { id, title, thumbnailUrl, thumbnails, publishedAt, scheduled } = videoOf(upload)
  return {
    ok: true,
    answer: {
      video: { id, title, thumbnailUrl, thumbnails, publishedAt, scheduled },
      figures: [...figures],
      windows,
      lastProcessedDay: processedThrough,
      awaitingProcessing: awaiting,
      ...(history ? { history: { firstDay: history.firstDay, newestDay: history.newestDay } } : {}),
      ...freshness(),
    },
  }
}
