import type { WindowAfterPublish } from './channel-summary.ts'
import { type CustomRange, videoWindowDays } from './videos.ts'

/**
 * Days as the API and the web app write them, YYYY-MM-DD, counted in whole days. Both apps read a
 * custom range's `from` and `to` with `customRangeOfDays`, so the web app takes a range the API
 * takes.
 */

const dayMs = 24 * 60 * 60 * 1000

/** Whether the text is a YYYY-MM-DD day that exists, `2026-02-30` not among them. */
export function isDayText(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const time = Date.parse(text)
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === text
}

/**
 * A custom range from its two days as text, or why it is none, before its bounds are known: a day
 * missing or one that is not a day (`isDayText`), then an end before the start.
 */
export function customRangeOfDays(
  from: string | undefined,
  to: string | undefined,
): { ok: true; range: CustomRange } | { ok: false; fault: 'not_a_day' | 'end_before_start' } {
  if (from === undefined || to === undefined || !isDayText(from) || !isDayText(to)) {
    return { ok: false, fault: 'not_a_day' }
  }
  if (to < from) return { ok: false, fault: 'end_before_start' }
  return { ok: true, range: { from, to } }
}

/** The YYYY-MM-DD day `days` days after `day`, or before it when `days` is negative. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(day) + days * dayMs).toISOString().slice(0, 10)
}

/** How many days `day` falls after `from`: 0 on the same day, negative before it. */
export function daysFrom(from: string, day: string): number {
  return Math.round((Date.parse(day) - Date.parse(from)) / dayMs)
}

/**
 * The days a calendar window of `days` days covers, as the API resolves them and the web app fills
 * a custom range's fields with: `lastDay` and the `days - 1` days before it, starting no earlier
 * than the channel's creation day when Google gives one.
 */
export function lastDaysOf(days: number, lastDay: string, creationDay: string | null): CustomRange {
  const start = addDays(lastDay, -(days - 1))
  return { from: creationDay && creationDay > start ? creationDay : start, to: lastDay }
}

/**
 * The UTC day of a time, as YYYY-MM-DD, as a date column takes it. It is the day of an activity day
 * and of the active user count, not Google's reporting day (`pacificDayOf`).
 */
export function utcDayOf(time: Date): string {
  return time.toISOString().slice(0, 10)
}

/**
 * The reporting day a time falls in, as YYYY-MM-DD: its calendar day in Pacific Time. Google defines
 * a day as midnight to midnight Pacific Time, from the Reporting API's dimensions page, checked
 * 2026-10-07, and its quota day turns at the same midnight. A channel has no time zone of its own.
 */
export function pacificDayOf(time: Date | string): string {
  // en-CA formats a date as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof time === 'string' ? new Date(time) : time)
}

/**
 * The days Google has processed for a video: from its publish day, as day 1, through
 * `lastProcessedDay`, as a window after publish counts them. 0 before the publish day, and for a
 * video with no publish day.
 */
export function daysProcessedSince(publishDay: string | null, lastProcessedDay: string): number {
  if (publishDay === null) return 0
  return Math.max(0, daysFrom(publishDay, lastProcessedDay) + 1)
}

/**
 * Whether a video has finished a window after publish: its days processed (`daysProcessedSince`)
 * reach the window's. A video with no publish day has finished none.
 */
export function isWindowFinished(
  window: WindowAfterPublish,
  publishDay: string | null,
  lastProcessedDay: string,
): boolean {
  return daysProcessedSince(publishDay, lastProcessedDay) >= videoWindowDays[window]
}
