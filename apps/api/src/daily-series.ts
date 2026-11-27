import { addDays, type RevenueAmounts } from '@creator-analytics/api-types'
import type { DateRange } from '@creator-analytics/youtube-gateway'

/** One day of a daily series. */
interface SeriesDay {
  /** YYYY-MM-DD, a reporting day in Pacific Time. */
  day: string
  engagedViews: number
  views: number
  estimatedMinutesWatched: number
}

/**
 * Each day of the range, oldest first, with Google's rows and zeros for a day Google has no row
 * for. The days run to the last day Google has processed (`processedThroughOf`), or to Google's
 * latest row should it answer a later one, and never past the range's end: the series shows no
 * zeros for a day Google has not processed.
 */
export function everyDayOf(
  { startDate, endDate }: DateRange,
  processedThrough: string,
  rows: SeriesDay[],
): SeriesDay[] {
  const rowOf = new Map(rows.map((row) => [row.day, row]))
  const latest = [processedThrough, ...rowOf.keys()].sort().at(-1) ?? processedThrough
  const lastDay = latest < endDate ? latest : endDate
  const days: SeriesDay[] = []
  for (let day = startDate; day <= lastDay; day = addDays(day, 1)) {
    days.push(rowOf.get(day) ?? { day, engagedViews: 0, views: 0, estimatedMinutesWatched: 0 })
  }
  return days
}

/** The revenue of a day or a video Google answers no revenue row for. */
export const noRevenue: RevenueAmounts = {
  estimatedRevenue: 0,
  estimatedAdRevenue: 0,
  estimatedRedPartnerRevenue: 0,
}

/**
 * The days of a daily series, a channel's or a video's, with each day's revenue laid on them, and
 * zeros for a day Google has no revenue row for. A revenue row for a day the series does not run to
 * is left out.
 */
export function withRevenueOf<Day extends { day: string }>(
  days: Day[],
  revenueDays: ({ day: string } & RevenueAmounts)[],
): (Day & RevenueAmounts)[] {
  const revenueOf = new Map(revenueDays.map(({ day, ...revenue }) => [day, revenue]))
  return days.map((day) => ({ ...day, ...(revenueOf.get(day.day) ?? noRevenue) }))
}
