import type { RangeBounds } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  boundsOf,
  calendarMonthOf,
  compactRangeNameOf,
  compactRangeTextOf,
  customRangeErrorOf,
  dateOfDay,
  dayOfDate,
  disabledDaysOf,
  monthSpanOf,
  prefillOf,
  rangeDaysOf,
  rangePickedOf,
} from './custom-range.ts'

const bounds: RangeBounds = { creationDay: '2019-03-12', lastProcessedDay: '2026-10-07' }

describe('the bounds of a custom range', () => {
  test("are the answer's creation day and last processed day, and nothing else of it", () => {
    const answer = {
      window: 'last28',
      lastProcessedDay: '2026-10-07',
      creationDay: '2019-03-12',
      fetchedAt: '2026-10-08T10:00:00Z',
      fromCache: false,
    }
    expect(boundsOf(answer)).toStrictEqual(bounds)
  })
})

describe('the error a custom range shows beside its fields', () => {
  test.each([
    ['', '2026-10-01'],
    ['2026-10-01', ''],
    ['', ''],
  ])('an empty field: from %j to %j', (from, to) => {
    expect(customRangeErrorOf(from, to, bounds, 'en-GB')).toBe('Pick a start day and an end day.')
  })

  test('an end day before the start day', () => {
    expect(customRangeErrorOf('2026-10-02', '2026-10-01', bounds, 'en-GB')).toBe(
      'The end day is before the start day.',
    )
  })

  test("a start day before the channel's creation day", () => {
    expect(customRangeErrorOf('2019-03-11', '2019-04-01', bounds, 'en-GB')).toBe(
      'The channel starts on 12 March 2019. Pick that day or a later one.',
    )
  })

  test('an end day after the last processed day', () => {
    expect(customRangeErrorOf('2026-10-01', '2026-10-08', bounds, 'en-GB')).toBe(
      'YouTube has processed data up to 7 October 2026. Pick that day or an earlier one.',
    )
  })

  test('the empty fields come first, then the order, then the bounds', () => {
    expect(customRangeErrorOf('2019-01-01', '', bounds, 'en-GB')).toBe(
      'Pick a start day and an end day.',
    )
    expect(customRangeErrorOf('2026-10-09', '2026-10-08', bounds, 'en-GB')).toBe(
      'The end day is before the start day.',
    )
    expect(customRangeErrorOf('2019-01-01', '2026-12-01', bounds, 'en-GB')).toBe(
      'The channel starts on 12 March 2019. Pick that day or a later one.',
    )
  })

  test('a range from the creation day to the last processed day has none, and a one-day range none', () => {
    expect(customRangeErrorOf('2019-03-12', '2026-10-07', bounds, 'en-GB')).toBeNull()
    expect(customRangeErrorOf('2026-10-07', '2026-10-07', bounds, 'en-GB')).toBeNull()
  })

  test('with no bounds yet, only the empty fields and the order are checked', () => {
    expect(customRangeErrorOf('2001-01-01', '2099-01-01', null, 'en-GB')).toBeNull()
    expect(customRangeErrorOf('2026-10-02', '2026-10-01', null, 'en-GB')).toBe(
      'The end day is before the start day.',
    )
  })

  test('with no creation day, the start has no lower bound', () => {
    const noCreationDay = { creationDay: null, lastProcessedDay: '2026-10-07' }
    expect(customRangeErrorOf('2001-01-01', '2026-10-07', noCreationDay, 'en-GB')).toBeNull()
  })
})

describe('the days the fields start with', () => {
  test("a custom range's own days", () => {
    const range = { from: '2026-01-01', to: '2026-01-31' }
    expect(prefillOf({ window: 'custom', range }, bounds)).toEqual(range)
    expect(prefillOf({ window: 'custom', range }, null)).toEqual(range)
  })

  test('lifetime: the creation day to the last processed day', () => {
    expect(prefillOf({ window: 'lifetime' }, bounds)).toEqual({
      from: '2019-03-12',
      to: '2026-10-07',
    })
  })

  test.each([
    ['last7', '2026-10-01'],
    ['last28', '2026-09-10'],
    ['last90', '2026-07-10'],
    ['last365', '2025-10-08'],
  ] as const)('%s: the last processed day and the days before it', (window, from) => {
    expect(prefillOf({ window }, bounds)).toEqual({ from, to: '2026-10-07' })
  })

  test('a calendar window longer than the channel starts on the creation day', () => {
    const young = { creationDay: '2026-09-20', lastProcessedDay: '2026-10-07' }
    expect(prefillOf({ window: 'last90' }, young)).toEqual({ from: '2026-09-20', to: '2026-10-07' })
  })

  test.each(['first1', 'first7', 'first28', 'first90', 'first365'] as const)(
    '%s: the days of the last 28',
    (window) => {
      expect(prefillOf({ window }, bounds)).toEqual({ from: '2026-09-10', to: '2026-10-07' })
    },
  )

  test('with no bounds yet, a preset window leaves the fields empty', () => {
    expect(prefillOf({ window: 'last28' }, null)).toEqual({ from: '', to: '' })
  })
})

describe('the length of a custom range', () => {
  test('counts both ends, so a one-day range is 1 day', () => {
    expect(rangeDaysOf({ from: '2026-10-07', to: '2026-10-07' })).toBe(1)
    expect(rangeDaysOf({ from: '2026-09-01', to: '2026-10-01' })).toBe(31)
  })
})

describe("the compact button's text for an applied custom range", () => {
  test('inside the current year: the day and the short month, joined by "to"', () => {
    const range = { from: '2026-10-12', to: '2026-11-09' }
    expect(compactRangeTextOf(range, 2026, 'en-GB')).toBe('12 Oct to 9 Nov')
  })

  test('across a year: the year on both ends', () => {
    const range = { from: '2025-12-28', to: '2026-01-04' }
    expect(compactRangeTextOf(range, 2026, 'en-GB')).toBe('28 Dec 2025 to 4 Jan 2026')
  })

  test('inside a past year: the year on both ends', () => {
    const range = { from: '2025-03-01', to: '2025-03-09' }
    expect(compactRangeTextOf(range, 2026, 'en-GB')).toBe('1 Mar 2025 to 9 Mar 2025')
  })
})

describe("the compact button's accessible name", () => {
  test('inside one year: "Custom range, " and the full range, the year on the end', () => {
    const range = { from: '2026-10-12', to: '2026-11-09' }
    expect(compactRangeNameOf(range, 'en-GB')).toBe('Custom range, 12 October to 9 November 2026')
  })

  test('across a year: the year on both ends', () => {
    const range = { from: '2025-12-28', to: '2026-01-04' }
    expect(compactRangeNameOf(range, 'en-GB')).toBe(
      'Custom range, 28 December 2025 to 4 January 2026',
    )
  })
})

describe("the Calendar's days", () => {
  test('a day is the local midnight that starts it, and that date is the day again', () => {
    expect(dateOfDay('2026-10-07')).toEqual(new Date(2026, 9, 7))
    for (const day of ['2026-01-31', '2026-02-01', '2025-12-31', '2026-01-01', '2024-02-29']) {
      expect(dayOfDate(dateOfDay(day))).toBe(day)
    }
  })

  test('a date late in its day is still that day', () => {
    expect(dayOfDate(new Date(2026, 2, 9, 23, 59))).toBe('2026-03-09')
  })
})

describe("the Calendar's disabled days", () => {
  test("for a channel's bounds: the days before its creation day and after its last processed day", () => {
    expect(disabledDaysOf(bounds)).toEqual({ before: '2019-03-12', after: '2026-10-07' })
  })

  test('for a channel Google gives no creation day for: the days after its last processed day only', () => {
    expect(disabledDaysOf({ creationDay: null, lastProcessedDay: '2026-10-07' })).toEqual({
      before: null,
      after: '2026-10-07',
    })
  })

  test('with no bounds yet: none', () => {
    expect(disabledDaysOf(null)).toBeNull()
  })
})

describe("the Calendar's month and year dropdowns", () => {
  test("run from the creation day's month to the last processed day's month", () => {
    expect(monthSpanOf(bounds)).toEqual({ start: '2019-03', end: '2026-10' })
  })

  test('with no creation day, have no first month', () => {
    expect(monthSpanOf({ creationDay: null, lastProcessedDay: '2026-10-07' })).toEqual({
      start: null,
      end: '2026-10',
    })
  })

  test("with no bounds yet, keep the Calendar's own span", () => {
    expect(monthSpanOf(null)).toBeNull()
  })
})

describe('a tap on the Calendar', () => {
  const shown = { from: '2026-09-10', to: '2026-10-07' }

  test('on a range already whole, such as the prefill, starts a new range on the day tapped', () => {
    expect(rangePickedOf(shown, '2026-09-20')).toEqual({ from: '2026-09-20', to: '' })
  })

  test('on an empty range starts it on the day tapped', () => {
    expect(rangePickedOf({ from: '', to: '' }, '2026-09-20')).toEqual({
      from: '2026-09-20',
      to: '',
    })
  })

  test('two taps give the range between them', () => {
    const started = rangePickedOf(shown, '2026-09-20')
    expect(rangePickedOf(started, '2026-10-01')).toEqual({ from: '2026-09-20', to: '2026-10-01' })
  })

  test('a second tap before the first makes it the start and the first the end', () => {
    const started = rangePickedOf(shown, '2026-09-20')
    expect(rangePickedOf(started, '2026-09-02')).toEqual({ from: '2026-09-02', to: '2026-09-20' })
  })

  test('two taps on one day give a range of that one day', () => {
    const started = rangePickedOf(shown, '2026-09-20')
    expect(rangePickedOf(started, '2026-09-20')).toEqual({ from: '2026-09-20', to: '2026-09-20' })
  })
})

describe('the first month the Calendar shows', () => {
  test("showing one month: the month of the range's end", () => {
    expect(calendarMonthOf({ from: '2026-08-15', to: '2026-10-07' }, 1)).toBe('2026-10')
  })

  test("showing two months: the month before the end's, so the end is in the second", () => {
    expect(calendarMonthOf({ from: '2026-08-15', to: '2026-10-07' }, 2)).toBe('2026-09')
  })

  test('showing two months with the end in January: the December before it', () => {
    expect(calendarMonthOf({ from: '2025-12-20', to: '2026-01-04' }, 2)).toBe('2025-12')
  })

  test("with no end picked yet: the start's month", () => {
    expect(calendarMonthOf({ from: '2026-03-15', to: '' }, 1)).toBe('2026-03')
  })

  test('with neither day: none, so the Calendar opens on its own month', () => {
    expect(calendarMonthOf({ from: '', to: '' }, 2)).toBeNull()
  })
})
