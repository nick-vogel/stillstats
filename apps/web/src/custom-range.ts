import {
  type CustomRange,
  customRangeOfDays,
  daysFrom,
  defaultVideoWindow,
  lastDaysOf,
  type RangeBounds,
  videoWindowDays,
  type WindowChoice,
} from '@creator-analytics/api-types'
import { longDateOf } from './processing.ts'
import { isWindowAfterPublish } from './route.ts'

/** An answer's bounds alone, so the bar holds no more of the answer than it reads. */
export function boundsOf({ creationDay, lastProcessedDay }: RangeBounds): RangeBounds {
  return { creationDay, lastProcessedDay }
}

// The texts a custom range shows are approved word for word in creator-analytics#118: the choice
// "Custom range", the button "Apply", and four errors, two here and the two that name a day in
// `customRangeErrorOf`. Change them only with Nick.
export const customRangeText = {
  option: 'Custom range',
  apply: 'Apply',
  emptyField: 'Pick a start day and an end day.',
  endBeforeStart: 'The end day is before the start day.',
}

// The compact button's text and its accessible name are approved by Nick on 2026-11-12
// (creator-analytics#643, #687): the two ends joined by "to", and the name "Custom range, " then the
// full range. Change them only with Nick.
export const compactRangeText = {
  join: ' to ',
  namePrefix: `${customRangeText.option}, `,
}

// The Calendar's own names for its month buttons and its caption's dropdowns (creator-analytics#690),
// in place of react-day-picker's English defaults. Flagged for Nick's approval at code complete.
export const calendarText = {
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  month: 'Month',
  year: 'Year',
}

/**
 * The Calendar shows two months when the viewport is at least this wide, the web app's narrow
 * breakpoint (app.css's `max-width: 40rem` rules), and one below it. `CustomRangeCalendar` reads
 * it through matchMedia.
 */
export const twoMonthsQuery = '(min-width: 40rem)'

/** A `YYYY-MM-DD` day as the Calendar's `Date`: the local midnight that starts it. */
export function dateOfDay(day: string): Date {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}

/** A Calendar `Date` as its `YYYY-MM-DD` day, read in local time, as `dateOfDay` writes it. */
export function dayOfDate(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * The days the Calendar disables, as the last day before which (`before`) and after which
 * (`after`) none can be picked: the channel's creation day, none when Google gives none, and its
 * last processed day. Null with no bounds yet, so no day is disabled; the API still refuses a
 * range outside them.
 */
export function disabledDaysOf(
  bounds: RangeBounds | null,
): { before: string | null; after: string } | null {
  if (!bounds) return null
  return { before: bounds.creationDay, after: bounds.lastProcessedDay }
}

/**
 * The first and last month the caption's dropdowns offer, as `YYYY-MM`: the creation day's month,
 * none when Google gives none, to the last processed day's month. Null with no bounds yet, so the
 * Calendar keeps its own span.
 */
export function monthSpanOf(
  bounds: RangeBounds | null,
): { start: string | null; end: string } | null {
  if (!bounds) return null
  return {
    start: bounds.creationDay?.slice(0, 7) ?? null,
    end: bounds.lastProcessedDay.slice(0, 7),
  }
}

/**
 * The range after a tap on `day` in the Calendar showing `shown`. On a whole range, the prefill
 * among them, or an empty one, the tap starts a new range on `day` with no end yet. On a range
 * with only its start, the tap ends it: on `day` when it is the start or later, and with `day` as
 * the start and the old start as the end when it is earlier.
 */
export function rangePickedOf(shown: CustomRange, day: string): CustomRange {
  if (!shown.from || shown.to) return { from: day, to: '' }
  return day < shown.from ? { from: day, to: shown.from } : { from: shown.from, to: day }
}

/**
 * The first month the Calendar shows, as `YYYY-MM`, so the range's end, or its start with no end
 * yet, is in the last of the `months` shown. Null with neither day, so the Calendar opens on its
 * own month.
 */
export function calendarMonthOf(shown: CustomRange, months: number): string | null {
  const day = shown.to || shown.from
  if (!day) return null
  const [year = 0, month = 1] = day.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - months, 1))
  return first.toISOString().slice(0, 7)
}

/** A day as the browser's locale writes it, with the parts `options` names. */
function dayTextOf(day: string, options: Intl.DateTimeFormatOptions, locale?: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, { ...options, timeZone: 'UTC' })
}

/**
 * The compact button's text for an applied range: each end's day and short month, such as
 * "12 Oct to 9 Nov". Both ends take the year when the range crosses a year or ends outside
 * `currentYear`, such as "28 Dec 2025 to 4 Jan 2026".
 */
export function compactRangeTextOf(
  { from, to }: CustomRange,
  currentYear: number,
  locale?: string,
): string {
  const withYear = from.slice(0, 4) !== to.slice(0, 4) || Number(to.slice(0, 4)) !== currentYear
  const options: Intl.DateTimeFormatOptions = withYear
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' }
  return [dayTextOf(from, options, locale), dayTextOf(to, options, locale)].join(
    compactRangeText.join,
  )
}

/**
 * The compact button's accessible name: "Custom range, " and the full range with the year always,
 * on the end alone inside one year ("12 October to 9 November 2026") and on both ends across one.
 */
export function compactRangeNameOf({ from, to }: CustomRange, locale?: string): string {
  const long: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  const withYear: Intl.DateTimeFormatOptions = { ...long, year: 'numeric' }
  const start = dayTextOf(from, from.slice(0, 4) === to.slice(0, 4) ? long : withYear, locale)
  return `${compactRangeText.namePrefix}${start}${compactRangeText.join}${dayTextOf(to, withYear, locale)}`
}

/**
 * Why the fields cannot be applied, or null when they can: a field is empty, the end is before the
 * start, the start is before the channel's creation day, or the end is after the last processed day,
 * in that order. The bounds are checked only once an answer has given them, and the creation day
 * only when Google gives one; the API refuses a range outside them in any case.
 */
export function customRangeErrorOf(
  from: string,
  to: string,
  bounds: RangeBounds | null,
  locale?: string,
): string | null {
  const custom = customRangeOfDays(from, to)
  if (!custom.ok) {
    return custom.fault === 'not_a_day'
      ? customRangeText.emptyField
      : customRangeText.endBeforeStart
  }
  if (bounds?.creationDay && from < bounds.creationDay) {
    return `The channel starts on ${longDateOf(bounds.creationDay, locale)}. Pick that day or a later one.`
  }
  if (bounds && to > bounds.lastProcessedDay) {
    return `YouTube has processed data up to ${longDateOf(bounds.lastProcessedDay, locale)}. Pick that day or an earlier one.`
  }
  return null
}

/**
 * The days the fields start with when the creator chooses "Custom range", so Apply works at once:
 * the days of the window on screen, as the API resolves them. A custom range keeps its own. Lifetime
 * runs from the creation day to the last processed day; a calendar window ends at the last processed
 * day and starts its length before it, no earlier than the creation day; a window after publish
 * takes the last 28 days. With no bounds yet, the fields start empty.
 */
export function prefillOf(choice: WindowChoice, bounds: RangeBounds | null): CustomRange {
  if (choice.window === 'custom') return choice.range
  if (!bounds) return { from: '', to: '' }
  const { creationDay, lastProcessedDay: to } = bounds
  const { window } = choice
  if (window === 'lifetime') return { from: creationDay ?? '', to }
  const calendar = isWindowAfterPublish(window) ? defaultVideoWindow : window
  return lastDaysOf(videoWindowDays[calendar], to, creationDay)
}

/** How many days a custom range covers, both ends counted: 1 for a range of one day. */
export function rangeDaysOf({ from, to }: CustomRange): number {
  return daysFrom(from, to) + 1
}
