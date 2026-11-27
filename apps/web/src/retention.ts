import type { AudienceRetentionPoint } from '@creator-analytics/api-types'
import type { HoverCard } from './chart-slider.ts'

/** The plot's height in the labels' place, as a percentage of it from its top edge. */
const plotHeight = 100

/** A label's place, to two decimals. */
function rounded(value: number): number {
  return Math.round(value * 100) / 100
}

/** The audience retention chart's scale, which places its 100% and 50% labels. */
export interface RetentionCharts {
  /**
   * The share still watching at the chart's top edge: 1, or the highest point above 1 where a
   * rewatched part raises it. The 100% and 50% lines derive from it.
   */
  top: number
  /**
   * Where the 100% line sits, in percent of the plot's height from its top edge: the top edge,
   * unless a rewatched part raises the chart's top.
   */
  fullLineY: number
  /** Where the 50% line sits: half the height of the 100% line above the bottom edge. */
  halfLineY: number
}

/** The audience retention chart's scale, or null when Google has too few views to draw the curve. */
export function retentionChartsOf(
  points: readonly Pick<AudienceRetentionPoint, 'audienceWatchRatio'>[],
): RetentionCharts | null {
  if (points.length === 0) return null
  // audienceWatchRatio exceeds 1 where viewers rewatch a part, so the chart's top rises to meet it.
  const top = Math.max(1, ...points.map(({ audienceWatchRatio }) => audienceWatchRatio))
  return {
    top,
    fullLineY: rounded(plotHeight - plotHeight / top),
    halfLineY: rounded(plotHeight - plotHeight / top / 2),
  }
}

/** The labels on the audience retention chart's 100% and 50% lines. */
export interface RetentionScaleLabels {
  full: string
  half: string
}

/**
 * The 100% and 50% labels as the locale writes percentages, in its own digits. With no locale, Intl
 * takes the browser's language.
 */
export function retentionScaleLabelsOf(locale?: string): RetentionScaleLabels {
  const percent = new Intl.NumberFormat(locale, { style: 'percent' })
  return { full: percent.format(1), half: percent.format(0.5) }
}

interface PointText {
  point: string
  watching: string
  relative: string
}

/**
 * A time into the video, from whole seconds: "4:30" under an hour, "1:02:03" from an hour, in the
 * locale's own digits. With no locale, Intl takes the browser's language.
 */
export function timeLabelOf(seconds: number, locale?: string): string {
  const leading = new Intl.NumberFormat(locale, { useGrouping: false })
  const twoDigit = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false })
  const whole = Math.max(0, Math.round(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const secs = twoDigit.format(whole % 60)
  return hours > 0
    ? `${leading.format(hours)}:${twoDigit.format(minutes)}:${secs}`
    : `${leading.format(minutes)}:${secs}`
}

export interface RetentionAxis {
  first: string
  last: string
}

/** The time axis under each retention chart, from the start to the video's length. */
export function retentionAxisOf(
  durationSeconds: number | null,
  locale?: string,
): RetentionAxis | null {
  return durationSeconds
    ? { first: timeLabelOf(0, locale), last: timeLabelOf(durationSeconds, locale) }
    : null
}

/** A share still watching as the hover cards show it: a percentage to one decimal. */
export function watchingShareOf(audienceWatchRatio: number, locale?: string): string {
  return audienceWatchRatio.toLocaleString(locale, { style: 'percent', maximumFractionDigits: 1 })
}

/**
 * One point's numbers, as the hover cards show them. With the video's duration, the point shows as
 * a time into the video. Google's point is the end of a 1% slice, so that time is close, not exact.
 * With no duration, it shows as a percentage of the video.
 */
function pointTextOf(
  {
    elapsedVideoTimeRatio,
    audienceWatchRatio,
    relativeRetentionPerformance,
  }: AudienceRetentionPoint,
  durationSeconds: number | null,
  locale?: string,
): PointText {
  return {
    point: durationSeconds
      ? timeLabelOf(elapsedVideoTimeRatio * durationSeconds, locale)
      : elapsedVideoTimeRatio.toLocaleString(locale, { style: 'percent' }),
    watching: watchingShareOf(audienceWatchRatio, locale),
    // Google's own value, never a rank or a grade (ADR 0011).
    relative: relativeRetentionPerformance.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  }
}

// The relative retention chart's name, approved word for word in creator-analytics#55, as its
// sub-header in creator-analytics#69 and as its hover card's label in creator-analytics#74. Change
// it only with Nick.
export const relativeName = 'Relative retention'

// The hover cards' text is approved word for word in creator-analytics#74. Change it only with Nick.
const cardText = {
  watching: 'Watching',
  median: '(0.5 is the median)',
}

/** The watching chart's hover card at a point: its time in the video and the share still watching. */
export function watchingCardOf(
  point: AudienceRetentionPoint,
  durationSeconds: number | null,
  locale?: string,
): HoverCard {
  const text = pointTextOf(point, durationSeconds, locale)
  return { title: text.point, values: [{ label: cardText.watching, value: text.watching }] }
}

/**
 * The relative retention chart's hover card at a point: its time in the video and Google's value,
 * beside Google's median, never a rank or a grade (ADR 0011).
 */
export function relativeCardOf(
  point: AudienceRetentionPoint,
  durationSeconds: number | null,
  locale?: string,
): HoverCard {
  const text = pointTextOf(point, durationSeconds, locale)
  return {
    title: text.point,
    values: [{ label: relativeName, value: `${text.relative} ${cardText.median}` }],
  }
}
