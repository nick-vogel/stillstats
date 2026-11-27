import type { ChannelDay, ChartMode, RevenueAmounts, VideoDay } from '@creator-analytics/api-types'
import type { HoverCard } from './chart-slider.ts'
import { dayCtrOf, impressionsOf } from './history.ts'
import type { ProductEvent } from './landing.ts'

/**
 * A day of a channel or of a video. Only a video's day, in a window after publish, has a day after
 * publish.
 */
export type ChartDay = ChannelDay | VideoDay

/** A day as the chart draws it, in its mode. The plot places it by its index. */
export interface ChartPoint {
  day: ChartDay
}

export interface ViewsLines {
  /** The number at the top edge: the highest of either line, so both share one scale. */
  top: number
  /** The drawn days, which the hover card reads, so in running total mode it shows the line's sum. */
  points: ChartPoint[]
}

// The numbers every day carries. A later number joins the running total, the numbers table, its
// rows and its total row by joining this list and the table's `cellTextOf`: a day and YouTube's
// total over the window both carry it.
export const numberColumns = ['engagedViews', 'views', 'estimatedMinutesWatched'] as const
export type NumberColumn = (typeof numberColumns)[number]

/**
 * The revenue a day carries: a channel's when the summary's revenue answered, and a video's when the
 * detail's did.
 */
export const revenueAmountColumns = [
  'estimatedRevenue',
  'estimatedAdRevenue',
  'estimatedRedPartnerRevenue',
] as const satisfies readonly (keyof RevenueAmounts)[]

/** Whether the days carry revenue: the API puts it on every day or on none. */
export function daysCarryRevenue(days: ChartDay[]): boolean {
  return days.length > 0 && days.every((day) => 'estimatedRevenue' in day)
}

/**
 * Each day with the numbers of every day up to it added together, its revenue too when the days
 * carry it. The last day's numbers can differ from YouTube's own total over the window, which is
 * never a sum of the days. A day the stored history holds carries the impressions of every held
 * day up to it, and their channel CTR (ADR 0013), never a sum of daily CTRs; a day it does not
 * hold carries neither.
 */
export function runningTotalOf<Day extends ChartDay>(days: Day[]): Day[] {
  const columns = daysCarryRevenue(days)
    ? [...numberColumns, ...revenueAmountColumns]
    : numberColumns
  type Column = (typeof columns)[number]
  // Only the chosen columns: a revenue column seeded on days that carry none would add revenue.
  const sums = Object.fromEntries(columns.map((column) => [column, 0])) as Record<Column, number>
  const reach = { impressions: 0, clicks: 0 }
  return days.map((day) => {
    const numbers: Partial<Record<Column, number>> = day
    for (const column of columns) sums[column] += numbers[column] ?? 0
    const impressions = impressionsOf(day)
    if (impressions === null) return { ...day, ...sums }
    reach.impressions += impressions
    reach.clicks += impressions * (dayCtrOf(day) ?? 0)
    const ctr = reach.impressions === 0 ? null : reach.clicks / reach.impressions
    return { ...day, ...sums, impressions: reach.impressions, ctr }
  })
}

/** The days as the chart draws them in its mode. */
function daysIn<Day extends ChartDay>(days: Day[], mode: ChartMode): Day[] {
  return mode === 'aggregate' ? runningTotalOf(days) : days
}

/**
 * Engaged views and views over the window's days, on one scale, or null with no day. The API sends
 * every day of the window, a day with no numbers as zeros, so the lines have no gap.
 */
export function viewsChartOf(days: ChartDay[], mode: ChartMode): ViewsLines | null {
  if (days.length === 0) return null
  const drawn = daysIn(days, mode)
  const top = Math.max(...drawn.flatMap(({ engagedViews, views }) => [engagedViews, views]))
  return { top, points: drawn.map((day) => ({ day })) }
}

/** The day's place in a window after publish, or undefined for a channel's day or a calendar day. */
export function dayAfterPublishOf(day: ChartDay): number | undefined {
  return 'dayAfterPublish' in day ? day.dayAfterPublish : undefined
}

/** A day's place on the x axis: its date, or in a window after publish its day after publish. */
export function axisLabelOf(day: ChartDay, locale?: string): string {
  const dayAfterPublish = dayAfterPublishOf(day)
  if (dayAfterPublish !== undefined) return `Day ${dayAfterPublish}`
  // The day is a Pacific reporting day, written as it is, whatever the screen's time zone.
  return new Date(`${day.day}T00:00:00Z`).toLocaleDateString(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  })
}

/**
 * A count as a chart's y axis label: in compact notation, as the locale writes it, such as "12M"
 * for 12,345,678, so a large number leaves the plot its width. The hover cards and the tables keep
 * the full number.
 */
export function axisCountTextOf(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { notation: 'compact' }).format(value)
}

// The series names, approved word for word in creator-analytics#57 for the legend and the numbers
// table, and as the hover card's labels in creator-analytics#74. Change them only with Nick.
export const seriesNames = { engagedViews: 'Engaged views', views: 'Views' }

/**
 * The hover card at a day as the chart draws it: its place on the x axis, then its engaged views
 * and views.
 */
export function viewsCardOf(day: ChartDay, locale?: string): HoverCard {
  return {
    title: axisLabelOf(day, locale),
    values: [
      { label: seriesNames.engagedViews, value: day.engagedViews.toLocaleString(locale) },
      { label: seriesNames.views, value: day.views.toLocaleString(locale) },
    ],
  }
}

/** The event a chart mode change sends: the new mode, and nothing else. */
export function chartModeChangedEvent(mode: ChartMode): ProductEvent {
  return { name: 'views_chart_mode_changed', mode }
}
