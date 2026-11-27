import {
  addDays,
  type CustomRange,
  lastDaysOf,
  type VideoWindow,
  videoWindowDays,
  type WindowAfterPublish,
  type WindowChoice,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import type { Scoped } from '@creator-analytics/database'
import {
  type DateRange,
  type ReadRefusal,
  reportingDayOf,
  type YouTubeGateway,
} from '@creator-analytics/youtube-gateway'
import { isOneOf } from './one-of.ts'

// Google's numbers run a few days behind, 48 to 72 hours by the epic's own account, so the last
// processed day of a channel with recent views sits a few days back. The search reaches 90 days
// all the same: a longer range costs the same single query.
const lastProcessedDaySearchDays = 90

/** A range of days as the gateway's reads take it. */
function dateRangeOf({ from, to }: CustomRange): DateRange {
  return { startDate: from, endDate: to }
}

export function lastProcessedDaySearch(today: string): DateRange {
  return dateRangeOf(lastDaysOf(lastProcessedDaySearchDays, today, null))
}

/**
 * The last day Google has processed: the latest day the search found a row for (the gateway's
 * `lastProcessedDay` read), or four days before today when that is later. Today is the reporting
 * day in Pacific Time, so while it runs, the day three days back ended only 48 to 72 hours ago and
 * may still be unprocessed under Google's 72-hour delay, and the day four days back ended at least
 * 72 hours ago. The repo models Google as leaving a day with no activity out of its rows, which no
 * live check has covered, so an idle channel's latest day with a row lies further back, and a
 * channel with no activity in the days the search reaches has none.
 *
 * Every answer's `lastProcessedDay`, the windows, the daily series and the partial days read this
 * day, not the search's.
 */
export function processedThroughOf(latestRowDay: string | null, today: string): string {
  const delayBound = addDays(today, -4)
  return latestRowDay && latestRowDay > delayBound ? latestRowDay : delayBound
}

/**
 * Whether Google has processed no day on or after the publish day, given the last day it has
 * processed (`processedThroughOf`).
 */
export function isAwaitingProcessing(publishDay: string | null, processedThrough: string): boolean {
  return !!publishDay && publishDay > processedThrough
}

/** Lifetime and the calendar windows: the windows the channel summary covers too. */
export type LifetimeOrCalendarWindow = Exclude<VideoWindow, WindowAfterPublish>

/** The channel's creation day: the reporting day in Pacific Time of its creation time, if any. */
export function creationDayOf(createdAt: string | null): string | null {
  return createdAt ? reportingDayOf(new Date(createdAt)) : null
}

/**
 * The days a window covers. Lifetime runs from the channel's creation day in Pacific Time to today.
 * A calendar window ends at the last day Google has processed (`processedThroughOf`), so it holds
 * its full count of days with numbers, and starts its length before it, or on the creation day when
 * the channel is younger than the window. A channel created after that day has its creation day
 * alone, which Google has no numbers for yet.
 */
export function rangeOf(
  window: Exclude<LifetimeOrCalendarWindow, 'custom'>,
  today: string,
  createdAt: string | null,
  processedThrough: string,
): DateRange {
  const creationDay = creationDayOf(createdAt)
  if (window === 'lifetime') return { startDate: creationDay ?? today, endDate: today }
  if (creationDay && creationDay > processedThrough) {
    return { startDate: creationDay, endDate: creationDay }
  }
  return dateRangeOf(lastDaysOf(videoWindowDays[window], processedThrough, creationDay))
}

/**
 * The days of a custom range, or null when it starts before the channel's creation day or ends
 * after the last day Google has processed. A channel with no creation day has no lower bound.
 */
export function customRangeOf(
  range: CustomRange,
  creationDay: string | null,
  processedThrough: string,
): DateRange | null {
  if ((creationDay && range.from < creationDay) || range.to > processedThrough) return null
  return dateRangeOf(range)
}

/**
 * The days of lifetime or a calendar window, a custom range's included: `rangeOf`, or for `custom`
 * `customRangeOf` over its range. Null only for a custom range outside its bounds.
 */
export function calendarRangeOf(
  choice: WindowChoice<Exclude<LifetimeOrCalendarWindow, 'custom'>>,
  today: string,
  createdAt: string | null,
  processedThrough: string,
): DateRange | null {
  if (choice.window !== 'custom') return rangeOf(choice.window, today, createdAt, processedThrough)
  return customRangeOf(choice.range, creationDayOf(createdAt), processedThrough)
}

/**
 * The days a channel-wide answer covers for its calendar window or lifetime, with the bounds it
 * carries: the channel's snippet read for its creation day, then the last processed day read, then
 * `calendarRangeOf`. A refused read refuses the range, and a custom range outside its bounds is
 * `invalid_range`, before any metric read.
 */
export async function channelRangeOf(
  read: YouTubeGateway['read'],
  tx: Scoped<'user'>,
  channelId: string,
  choice: WindowChoice<Exclude<LifetimeOrCalendarWindow, 'custom'>>,
): Promise<
  | { ok: true; range: DateRange; processedThrough: string; creationDay: string | null }
  | { ok: false; refusal: ReadRefusal }
  | { ok: false; error: 'invalid_range' }
> {
  const snippet = await read(tx, channelId, 'channelSnippet', {})
  if (!snippet.ok) return snippet
  const today = reportingDayOf(tx.now)
  const lastProcessed = await read(tx, channelId, 'lastProcessedDay', lastProcessedDaySearch(today))
  if (!lastProcessed.ok) return lastProcessed
  const processedThrough = processedThroughOf(lastProcessed.value, today)
  const { createdAt } = snippet.value
  const range = calendarRangeOf(choice, today, createdAt, processedThrough)
  if (!range) return { ok: false, error: 'invalid_range' }
  return { ok: true, range, processedThrough, creationDay: creationDayOf(createdAt) }
}

/**
 * What a video's numbers are counted over: its own days of a window after publish, or the days of a
 * calendar window or lifetime, the same for every video. Null for a custom range outside its bounds.
 */
export function spanOf(
  choice: WindowChoice,
  today: string,
  createdAt: string | null,
  processedThrough: string,
): { afterPublish: WindowAfterPublish } | { calendar: DateRange } | null {
  if (choice.window === 'custom') {
    const calendar = customRangeOf(choice.range, creationDayOf(createdAt), processedThrough)
    return calendar && { calendar }
  }
  if (isOneOf(windowsAfterPublish, choice.window)) return { afterPublish: choice.window }
  return { calendar: rangeOf(choice.window, today, createdAt, processedThrough) }
}
