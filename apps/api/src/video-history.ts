import {
  addDays,
  daysFrom,
  type NewestTrafficSourceAverage,
  type NewestVideoHistoryAverage,
  newestAverageSize,
  type PartialWindow,
  type ReachTrafficSourceType,
  type TrafficSource,
  type VideoFormatFilter,
  type VideoRow,
  videoWindowDays,
  type WindowAfterPublish,
} from '@creator-analytics/api-types'
import { reachHistory, reachHistoryDays, type Scoped } from '@creator-analytics/database'
import { entitlementOf, historyReadable } from '@creator-analytics/entitlements'
import type { DateRange } from '@creator-analytics/youtube-gateway'
import { and, between, eq, max, min, sql } from 'drizzle-orm'
import { newestFirst } from './uploads.ts'
import { isOfFormat } from './video-format.ts'

// The Reporting API's numeric `traffic_source_type` codes, by the Analytics API's
// `insightTrafficSourceType` the video screen already names, from the two APIs' dimension pages
// (developers.google.com/youtube/reporting/v1/reports/dimensions and
// developers.google.com/youtube/analytics/dimensions, read 2026-11-17). The pages give no mapping,
// so this is the product's own, by the names. A code with no counterpart is `REPORTING_<code>`.
const analyticsTypeOfCode = new Map<number, string>([
  [0, 'NO_LINK_OTHER'],
  [1, 'ADVERTISING'],
  [3, 'SUBSCRIBER'],
  [4, 'YT_CHANNEL'],
  [5, 'YT_SEARCH'],
  [7, 'RELATED_VIDEO'],
  [8, 'YT_OTHER_PAGE'],
  [9, 'EXT_URL'],
  [11, 'ANNOTATION'],
  [14, 'PLAYLIST'],
  [17, 'NOTIFICATION'],
  [19, 'CAMPAIGN_CARD'],
  [20, 'END_SCREEN'],
  [24, 'SHORTS'],
  [25, 'PRODUCT_PAGE'],
  [26, 'HASHTAGS'],
  [27, 'SOUND_PAGE'],
  [28, 'LIVE_REDIRECT'],
  [30, 'VIDEO_REMIXES'],
])

/** The Analytics API's traffic source type for a Reporting API code, or `REPORTING_<code>`. */
export function trafficSourceTypeOf(code: number): string {
  return analyticsTypeOfCode.get(code) ?? `REPORTING_${code}`
}

/** One traffic source type's impressions, and the clicks their CTRs stand for. */
export interface SourceReach {
  /** The Analytics API's name for it (`trafficSourceTypeOf`). */
  type: string
  impressions: number
  clicks: number
}

/** The CTR of ADR 0013: clicks over impressions, null with no impressions. */
export function ctrOf({ impressions, clicks }: Omit<SourceReach, 'type'>): number | null {
  return impressions === 0 ? null : clicks / impressions
}

/** The sources' impressions added, and their CTR: their clicks over those impressions. */
export function reachOfSources(sources: SourceReach[]): {
  impressions: number
  ctr: number | null
} {
  const impressions = sources.reduce((sum, source) => sum + source.impressions, 0)
  const clicks = sources.reduce((sum, source) => sum + source.clicks, 0)
  return { impressions, ctr: ctrOf({ impressions, clicks }) }
}

/** How many days the range holds: none when it runs backwards. */
function dayCountOf({ startDate, endDate }: DateRange): number {
  return Math.max(0, daysFrom(startDate, endDate) + 1)
}

/** How many of the range's days the history holds. */
function heldCountOf(range: DateRange, held: ReadonlySet<string>): number {
  let count = 0
  for (let day = range.startDate; day <= range.endDate; day = addDays(day, 1)) {
    if (held.has(day)) count += 1
  }
  return count
}

/**
 * The history's "N of M days" for a video's counted days: the days of them it holds, of them all,
 * when it does not hold every one of them up to its newest day, as when they start before the
 * history start (CONTEXT.md's History start) or a day inside the history is missing, or when they
 * all fall after its newest day, so it holds none of them. Days after the newest day beside days
 * it holds are not partial, as the newest day note covers them.
 */
export function historyPartialOf(
  counted: DateRange,
  newestDay: string,
  held: ReadonlySet<string>,
): PartialWindow | undefined {
  const partial = { days: heldCountOf(counted, held), of: dayCountOf(counted) }
  if (partial.of > 0 && counted.startDate > newestDay) return partial
  const upToNewest = {
    startDate: counted.startDate,
    endDate: counted.endDate < newestDay ? counted.endDate : newestDay,
  }
  if (heldCountOf(upToNewest, held) === dayCountOf(upToNewest)) return undefined
  return partial
}

/** The whole window after publish of a video published on the day, today or not. */
export function wholeWindowOf(window: WindowAfterPublish, publishDay: string): DateRange {
  return { startDate: publishDay, endDate: addDays(publishDay, videoWindowDays[window] - 1) }
}

/** An upload as the newest average reads it: the video, its publish day and its reach by source. */
export interface UploadReach {
  video: Pick<VideoRow, 'id' | 'publishedAt' | 'privacy' | 'scheduled' | 'format'>
  publishDay: string | null
  /** Its impressions and clicks over its window after publish, by traffic source type. */
  sources: SourceReach[]
}

/**
 * Whether the newest average counts the upload: public and not scheduled (the glossary's Latest
 * upload), of the format, and with its whole window after publish held.
 */
export function qualifiesForNewestAverage(
  { video, publishDay }: Pick<UploadReach, 'video' | 'publishDay'>,
  formatFilter: VideoFormatFilter,
  window: WindowAfterPublish,
  held: ReadonlySet<string>,
): boolean {
  return (
    video.privacy === 'public' &&
    !video.scheduled &&
    isOfFormat(video.format, formatFilter) &&
    publishDay !== null &&
    heldCountOf(wholeWindowOf(window, publishDay), held) === videoWindowDays[window]
  )
}

/**
 * The average impressions and CTR of the `newestAverageSize` newest uploads that qualify
 * (`qualifiesForNewestAverage`), or undefined when fewer than 2 do: the impressions added and
 * divided by the count, and the CTR over their clicks and impressions (ADR 0013). Per traffic source
 * type, the same uploads, each with none of a type counting 0 for it.
 */
export function newestHistoryAverageOf(
  uploads: UploadReach[],
  formatFilter: VideoFormatFilter,
  window: WindowAfterPublish,
  held: ReadonlySet<string>,
): NewestVideoHistoryAverage | undefined {
  const newest = uploads
    .filter((upload) => qualifiesForNewestAverage(upload, formatFilter, window, held))
    .toSorted((a, b) => newestFirst(a.video, b.video))
    .slice(0, newestAverageSize)
  const count = newest.length
  if (count < 2) return undefined
  const byType = new Map<string, SourceReach>()
  for (const source of newest.flatMap(({ sources }) => sources)) {
    const sum = byType.get(source.type) ?? { type: source.type, impressions: 0, clicks: 0 }
    sum.impressions += source.impressions
    sum.clicks += source.clicks
    byType.set(source.type, sum)
  }
  const total = reachOfSources([...byType.values()])
  return {
    format: formatFilter,
    count,
    impressions: total.impressions / count,
    ctr: total.ctr,
    trafficSources: [...byType.values()]
      .toSorted((a, b) => b.impressions - a.impressions || a.type.localeCompare(b.type))
      .map(
        (source): NewestTrafficSourceAverage => ({
          type: source.type,
          impressions: source.impressions / count,
          ctr: ctrOf(source),
        }),
      ),
  }
}

/** A paid channel's history as the video list and the video screen read it. */
export interface VideoHistoryRead {
  /** YYYY-MM-DD, the first day the history holds. */
  firstDay: string
  /** YYYY-MM-DD, the newest day the history holds (ADR 0017). */
  newestDay: string
  /** The days the history holds from the first day of the windows to the last. */
  held: ReadonlySet<string>
  /** Each video's reach over its own window, by traffic source type. A video with none is absent. */
  sourcesByVideo: ReadonlyMap<string, SourceReach[]>
}

/**
 * A paid or ended channel's history for each video over its own window, read in one query of the
 * stored rows, summed by video and traffic source type with each video's window applied in SQL, and
 * one of the held days over the windows' span. Undefined for a free channel, an ended one past its
 * purge date, or one whose history holds no day yet.
 */
export async function readVideoHistory(
  tx: Scoped<'user'>,
  channelId: string,
  windows: ReadonlyMap<string, DateRange>,
): Promise<VideoHistoryRead | undefined> {
  if (!historyReadable(await entitlementOf(tx, channelId))) return undefined
  const [ends] = await tx.sql
    .select({ firstDay: min(reachHistoryDays.day), newestDay: max(reachHistoryDays.day) })
    .from(reachHistoryDays)
    .where(eq(reachHistoryDays.channelId, channelId))
  const firstDay = ends?.firstDay
  const newestDay = ends?.newestDay
  if (!firstDay || !newestDay) return undefined

  const counted = [...windows].filter(([, range]) => range.startDate <= range.endDate)
  const spanStart = counted.map(([, range]) => range.startDate).toSorted()[0]
  const spanEnd = counted.map(([, range]) => range.endDate).toSorted()[counted.length - 1]
  if (!spanStart || !spanEnd) {
    return { firstDay, newestDay, held: new Set(), sourcesByVideo: new Map() }
  }

  const heldDays = await tx.sql
    .select({ day: reachHistoryDays.day })
    .from(reachHistoryDays)
    .where(
      and(
        eq(reachHistoryDays.channelId, channelId),
        between(reachHistoryDays.day, spanStart, spanEnd),
      ),
    )
  const videoIds = counted.map(([videoId]) => videoId)
  const startDays = counted.map(([, range]) => range.startDate)
  const endDays = counted.map(([, range]) => range.endDate)
  const rows = await tx.sql
    .select({
      videoId: reachHistory.videoId,
      trafficSourceType: reachHistory.trafficSourceType,
      impressions: sql<number>`sum(${reachHistory.impressions})::integer`,
      clicks: sql<number>`sum(${reachHistory.impressions} * ${reachHistory.ctr})::float8`,
    })
    .from(reachHistory)
    .where(
      and(
        eq(reachHistory.channelId, channelId),
        between(reachHistory.day, spanStart, spanEnd),
        sql`exists (
          select 1
          from unnest(
            ${sql.param(videoIds)}::text[],
            ${sql.param(startDays)}::date[],
            ${sql.param(endDays)}::date[]
          ) as counted(video_id, start_day, end_day)
          where counted.video_id = ${reachHistory.videoId}
            and ${reachHistory.day} between counted.start_day and counted.end_day
        )`,
      ),
    )
    .groupBy(reachHistory.videoId, reachHistory.trafficSourceType)

  const sourcesByVideo = new Map<string, SourceReach[]>()
  for (const row of rows) {
    const type = trafficSourceTypeOf(row.trafficSourceType)
    const sources = sourcesByVideo.get(row.videoId) ?? []
    const same = sources.find((source) => source.type === type)
    if (same) {
      same.impressions += row.impressions
      same.clicks += row.clicks
    } else {
      sources.push({ type, impressions: row.impressions, clicks: row.clicks })
    }
    sourcesByVideo.set(row.videoId, sources)
  }
  return { firstDay, newestDay, held: new Set(heldDays.map(({ day }) => day)), sourcesByVideo }
}

/**
 * The days a video's history numbers count: its whole window after publish, none with no publish
 * day, or in a calendar window or lifetime the range's days from the later of its first day and the
 * publish day, as the video screen counts them.
 */
export function countedDaysOf(
  span: { afterPublish: WindowAfterPublish } | { calendar: DateRange },
  publishDay: string | null,
): DateRange | null {
  if ('afterPublish' in span)
    return publishDay ? wholeWindowOf(span.afterPublish, publishDay) : null
  const { startDate, endDate } = span.calendar
  return { startDate: publishDay && publishDay > startDate ? publishDay : startDate, endDate }
}

/**
 * A video's history fields over its counted days, as a list row and the video screen carry them:
 * every traffic source's reach added, or with a `source`, that type's alone. The held days are not
 * per source, so `historyPartial` is the same either way.
 */
export function videoReachOf(
  history: VideoHistoryRead,
  videoId: string,
  counted: DateRange | null,
  source: ReachTrafficSourceType | null = null,
): { impressions: number; ctr: number | null; historyPartial?: PartialWindow } {
  const sources = history.sourcesByVideo.get(videoId) ?? []
  const reach = reachOfSources(
    source === null ? sources : sources.filter(({ type }) => type === source),
  )
  const historyPartial = counted && historyPartialOf(counted, history.newestDay, history.held)
  return historyPartial ? { ...reach, historyPartial } : reach
}

/**
 * The video screen's traffic sources with each type's impressions and CTR from the history, 0 and
 * null for a type it holds none of. A type with impressions and no Analytics row joins with no
 * engaged views and no views, so after every source with views, most impressions first, then by
 * type, as the sources with views tie.
 */
export function withSourceReach(
  sources: TrafficSource[],
  reach: SourceReach[] | undefined,
): TrafficSource[] {
  const reachOf = new Map((reach ?? []).map((source) => [source.type, source]))
  const joined = [...reachOf.keys()]
    .filter((type) => !sources.some((source) => source.type === type))
    .map((type) => ({ type, engagedViews: 0, views: 0 }))
  return [...sources, ...joined]
    .map((source) => {
      const own = reachOf.get(source.type) ?? { impressions: 0, clicks: 0 }
      return { ...source, impressions: own.impressions, ctr: ctrOf(own) }
    })
    .sort(
      (a, b) =>
        b.engagedViews - a.engagedViews ||
        b.views - a.views ||
        b.impressions - a.impressions ||
        a.type.localeCompare(b.type),
    )
}
