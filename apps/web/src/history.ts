import type { ChannelHistory, VideoListHistory } from '@creator-analytics/api-types'
import { dayCountOf, longDateOf } from './processing.ts'
import type { ChartDay } from './views-chart.ts'

// Drafted for creator-analytics#783. Every string here was approved by Nick word for word on 2026-11-19.
export const historyText = {
  impressions: 'Impressions',
  ctr: 'Impressions click-through rate',
  ctrColumn: 'CTR',
  noImpressions: 'No impressions in this range',
  noStoredHistory: 'No stored history in this range',
  startMarker: 'History starts',
}

// Drafted for creator-analytics#785. Every string here was approved by Nick word for word on 2026-11-19.
export const videoHistoryText = {
  /** The heading of the video screen's table of impressions and CTR by traffic source. */
  sourcesHeading: 'Impressions and click-through rate',
  /** Its headings for the newest uploads' average of each source, in a window after publish. */
  averageImpressions: 'Newest uploads, impressions',
  averageCtr: 'Newest uploads, CTR',
}

// Drafted for creator-analytics#787.
export const endedText = {
  /** The note under an ended channel's history, with the day it is deleted on. */
  purgeNote: (date: string) => `Your subscription has ended. This history is deleted on ${date}.`, // approved by Nick word for word on 2026-11-19
  /** The action after it, which goes to Settings' subscribe buttons. */
  subscribeAgain: 'Subscribe again', // approved by Nick word for word on 2026-11-19
}

/**
 * The note on an ended channel's history: that its subscription has ended, and the day the history
 * is deleted on. Null for a history with no purge date, a paid channel's.
 */
export function purgeNoteOf(history: ChannelHistory, locale?: string): string | null {
  return history.purgeDate === undefined
    ? null
    : endedText.purgeNote(longDateOf(history.purgeDate, locale))
}

/** A day's impressions from the stored history, or null on a day the history does not hold. */
export function impressionsOf(day: ChartDay): number | null {
  return 'impressions' in day && day.impressions !== undefined ? day.impressions : null
}

/**
 * A day's click-through rate from the stored history, from 0 to 1, or null on a day the history
 * does not hold or a day with no impressions.
 */
export function dayCtrOf(day: ChartDay): number | null {
  return 'ctr' in day && day.ctr !== undefined ? day.ctr : null
}

/** Whether the days carry the stored history: the API puts it on each day the history holds. */
export function daysCarryHistory(days: ChartDay[]): boolean {
  return days.some((day) => impressionsOf(day) !== null)
}

/** A click-through rate as a percentage with one decimal place, "4.2%", or "" for none. */
export function ctrTextOf(ctr: number | null, locale?: string): string {
  if (ctr === null) return ''
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ctr)
}

/**
 * The history's partial label, "12 of 28 days": the days of `daily` the history holds of all of
 * them, when the range starts before the history start. Null when the history covers the range.
 */
export function historyPartialOf(daily: ChartDay[], history: ChannelHistory): string | null {
  const first = daily[0]
  if (!first || history.firstDay <= first.day) return null
  const held = daily.filter((day) => impressionsOf(day) !== null).length
  return `${held} of ${dayCountOf(daily.length)}`
}

/**
 * The note under the cards on the history: the newest day it holds among the range's days, said of
 * the range, since the cards' totals stop there (ADR 0017), or its newest day, said of the store,
 * when it holds none of them; and, when the range starts before the history start, that day too.
 */
export function historyNoteOf(daily: ChartDay[], history: ChannelHistory, locale?: string): string {
  const rangeNewest = daily.findLast((day) => impressionsOf(day) !== null)?.day
  const newest =
    rangeNewest === undefined
      ? `Impressions and click-through rate are stored up to ${longDateOf(history.newestDay, locale)}.`
      : `In this range, impressions and click-through rate run to ${longDateOf(rangeNewest, locale)}.`
  if (historyPartialOf(daily, history) === null) return newest
  return `${newest} The history starts on ${longDateOf(history.firstDay, locale)}.`
}

/**
 * Where the history start falls among the days: the index of the first day the history holds, when
 * the days start before it, or null when the history covers them or holds none of them.
 */
export function historyStartIndexOf(days: ChartDay[]): number | null {
  const index = days.findIndex((day) => impressionsOf(day) !== null)
  return index > 0 ? index : null
}

/**
 * The note on the history above the video list and in the video screen's traffic sources: the
 * newest day it holds (ADR 0017), and the history start when some numbers shown start before it
 * (`startsBefore`), as their "N of M days" labels say.
 */
export function historyNewestNoteOf(
  { firstDay, newestDay }: VideoListHistory,
  startsBefore: boolean,
  locale?: string,
): string {
  const newest = `Impressions and click-through rate are stored up to ${longDateOf(newestDay, locale)}.`
  return startsBefore ? `${newest} The history starts on ${longDateOf(firstDay, locale)}.` : newest
}
