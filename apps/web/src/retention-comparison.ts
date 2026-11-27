/**
 * The retention comparison (creator-analytics#951): up to `maxComparedCurves` stored audience
 * retention curves on one chart, each labelled with its video and the date its curve was read
 * (ADR 0017), and one hover card that reads every drawn curve at the same share of the video. Its
 * scale, labels, card, view of the API's answer, pick rule and product event, as pure functions.
 * Google's relative retention performance stays off it (ADR 0004).
 */
import {
  type ErrorAnswer,
  maxComparedCurves,
  type RefusalAnswer,
  type RetentionCurvesAnswer,
  type StoredRetentionPoint,
  type VideoSort,
} from '@creator-analytics/api-types'
import type { HoverCard } from './chart-slider.ts'
import type { ProductEvent } from './landing.ts'
import { refusalMessageOf } from './refusals.ts'
import { type RetentionCharts, retentionChartsOf, watchingShareOf } from './retention.ts'
import type { ComparedLine } from './retention-plot.ts'
import type { Route } from './route.ts'

// Approved word for word in creator-analytics#936 (#951). Change it only with Nick.
export const comparisonText = {
  heading: 'Compare retention curves',
  intro: 'Pick up to 5 videos to see their audience retention curves on one chart.',
  chart: 'Retention comparison',
  legend: 'Compared videos',
  explanation:
    'The share of viewers still watching at each point of each video, across its whole length.',
  limit: 'You can compare up to 5 videos. Clear a pick to choose another.',
  empty: 'Pick a video below to see its retention curve here.',
  noCurve: 'YouTube has no retention curve for this video yet.',
  notRead: 'Stillstats has not read this video yet.',
  notReadEnded: 'Stillstats did not read this video before your subscription ended.',
  refused: 'Comparing retention curves needs Stillstats Pro.',
  sort: 'Sort',
  pick: 'Videos to compare',
}

// Approved word for word by Nick on 2026-11-23, in creator-analytics#1044. Change it only with Nick.
export const pickerText = {
  clear: 'Clear all picks',
  noDrawable: 'Stillstats has not read a retention curve for any of these videos yet.',
}

/**
 * The note while the daily refresh fills the channel's stored curves, with how many published
 * uploads it has not read, in the locale's digits. Approved word for word in creator-analytics#936
 * (#951).
 */
export function backfillNoteOf(unread: number, locale?: string): string {
  const count = unread.toLocaleString(locale)
  const videos = unread === 1 ? `${count} video` : `${count} videos`
  return `Stillstats is still reading your videos' retention curves, a batch each day. ${videos} to go.`
}

/** The sorts the picker offers: publish date and average viewed, in either direction. */
export const comparisonSorts = [
  '-publishedAt',
  'publishedAt',
  '-averageViewPercentage',
  'averageViewPercentage',
] as const satisfies readonly VideoSort[]

export type ComparisonSort = (typeof comparisonSorts)[number]

// Approved word for word in creator-analytics#936 (#951). Change it only with Nick.
export const comparisonSortOptions: { value: ComparisonSort; label: string }[] = [
  { value: '-publishedAt', label: 'Newest first' },
  { value: 'publishedAt', label: 'Oldest first' },
  { value: '-averageViewPercentage', label: 'Highest average viewed' },
  { value: 'averageViewPercentage', label: 'Lowest average viewed' },
]

/** The picker's sort: the route's, when the picker offers it, else newest first. */
export function comparisonSortOf({ sort }: Pick<Route, 'sort'>): ComparisonSort {
  return comparisonSorts.find((each) => each === sort) ?? '-publishedAt'
}

/** The chart's scale over every drawn curve, by the video page's rule, or null with none. */
export function comparisonChartsOf(lines: readonly ComparedLine[]): RetentionCharts | null {
  return retentionChartsOf(lines.flatMap(({ points }) => points))
}

/** One picked video in the chart's legend, in pick order. */
export interface LegendEntry {
  videoId: string
  title: string
  /** 1 to 5, the pick's place, and its line's colour. */
  position: number
  /** Whether the chart draws its curve: false with no point to draw. */
  drawn: boolean
  /** "Read" and the curve's read date in the locale, or why there is no curve. */
  detail: string
}

/** What the page shows for the curves read. */
export type ComparisonView =
  | {
      kind: 'compared'
      /** The curves with points, in pick order, each at its pick's position. */
      lines: ComparedLine[]
      legend: LegendEntry[]
      /** The note while the refresh has published uploads to read, else null. */
      note: string | null
    }
  | { kind: 'refused'; message: string }

/**
 * "Read" and the day a curve was read, as the locale writes a medium date (ADR 0017). Approved word
 * for word in creator-analytics#936 (#951).
 */
export function readLabelOf(readAt: string, locale?: string): string {
  return `Read ${new Date(readAt).toLocaleDateString(locale, { dateStyle: 'medium' })}`
}

/**
 * The page's view of the API's answer: each picked video's curve at its pick's position, those
 * with points drawn, each labelled with its title and its read date, or why it has none; and the
 * note while the backfill fills. An ended channel, which the refresh no longer reads, has no note,
 * and a video it never read promises no read. A free channel's refusal says the comparison needs Pro; any other
 * refusal is the shared text.
 */
export function comparisonViewOf(
  body: RetentionCurvesAnswer | RefusalAnswer | ErrorAnswer,
  locale?: string,
): ComparisonView {
  if (!('curves' in body)) {
    return {
      kind: 'refused',
      message: refusalMessageOf(body, 'the retention curves', {
        sort_without_history: comparisonText.refused,
      }),
    }
  }
  const legend = body.curves.map(
    ({ video, readAt, points }, index): LegendEntry => ({
      videoId: video.id,
      title: video.title,
      position: index + 1,
      drawn: points.length > 0,
      detail:
        readAt === null
          ? body.unread === null
            ? comparisonText.notReadEnded
            : comparisonText.notRead
          : points.length === 0
            ? comparisonText.noCurve
            : readLabelOf(readAt, locale),
    }),
  )
  const lines = body.curves.flatMap(({ video, points }, index): ComparedLine[] =>
    points.length > 0 ? [{ videoId: video.id, position: index + 1, points }] : [],
  )
  return {
    kind: 'compared',
    lines,
    legend,
    note: body.unread !== null && body.unread > 0 ? backfillNoteOf(body.unread, locale) : null,
  }
}

/** Every share of the video any drawn curve has a point at, in order: the cursor's stops. */
export function comparisonXsOf(lines: readonly ComparedLine[]): number[] {
  const xs = new Set(
    lines.flatMap(({ points }) => points.map(({ elapsedVideoTimeRatio }) => elapsedVideoTimeRatio)),
  )
  return [...xs].sort((a, b) => a - b)
}

/** A curve's point nearest `x` at or before it, or undefined when the curve starts after `x`. */
function pointAtOrBefore(
  points: readonly StoredRetentionPoint[],
  x: number,
): StoredRetentionPoint | undefined {
  return points.findLast(({ elapsedVideoTimeRatio }) => elapsedVideoTimeRatio <= x)
}

/**
 * The one hover card at a share of the video: that share as its title, since each video's length
 * differs, and a row per drawn curve, its title and its share still watching at its nearest point
 * at or before it. A curve that starts after it has no row.
 */
export function comparisonCardOf(
  x: number,
  lines: readonly (ComparedLine & { title: string })[],
  locale?: string,
): HoverCard {
  return {
    title: x.toLocaleString(locale, { style: 'percent' }),
    values: lines.flatMap(({ title, points }) => {
      const point = pointAtOrBefore(points, x)
      return point
        ? [{ label: title, value: watchingShareOf(point.audienceWatchRatio, locale) }]
        : []
    }),
  }
}

/**
 * The picks after the creator toggles a video: a picked one is cleared, the rest keeping their
 * order; another is added last, unless `maxComparedCurves` are picked, which refuses it.
 */
export function picksAfterToggleOf(picks: readonly string[], videoId: string): string[] {
  if (picks.includes(videoId)) return picks.filter((each) => each !== videoId)
  if (picks.length >= maxComparedCurves) return [...picks]
  return [...picks, videoId]
}

/** Whether a video's pick is refused: it is not picked, and `maxComparedCurves` are. */
export function isPickRefused(picks: readonly string[], videoId: string): boolean {
  return !picks.includes(videoId) && picks.length >= maxComparedCurves
}

/** The curves read's query for the picks: none for no pick, which still answers the backfill. */
export function curvesQueryOf(picks: readonly string[]): string {
  return picks.length > 0 ? `ids=${picks.join(',')}` : ''
}

type CurvesBody = RetentionCurvesAnswer | RefusalAnswer | ErrorAnswer

/** Whether the curves read refused a pick the channel does not hold, such as one since deleted. */
export function isPickNotHeld(body: CurvesBody): boolean {
  return 'refusal' in body && body.refusal === 'video_not_found'
}

/**
 * The picks the channel still holds, given each pick's read alone in the same order, so the page
 * drops the rest from the address; null when every pick's own read found its video.
 */
export function heldPicksOf(
  picks: readonly string[],
  alone: readonly CurvesBody[],
): string[] | null {
  const held = picks.filter((_, index) => {
    const body = alone[index]
    return !body || !isPickNotHeld(body)
  })
  return held.length < picks.length ? held : null
}

/** The event a pick change sends once its answer lands: with 2 or more curves drawn, the count. */
export function comparedEventOf(view: ComparisonView): ProductEvent | null {
  if (view.kind !== 'compared' || view.lines.length < 2) return null
  return { name: 'retention_curves_compared', count: view.lines.length }
}
