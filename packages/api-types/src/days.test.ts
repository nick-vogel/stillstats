import { describe, expect, test } from 'vitest'
import {
  customRangeOfDays,
  daysProcessedSince,
  isDayText,
  isWindowFinished,
  pacificDayOf,
} from './days.ts'

describe('a day in a query or the address', () => {
  test.each(['2026-10-07', '2024-02-29'])('%s is a day', (text) => {
    expect(isDayText(text)).toBe(true)
  })

  test.each(['2026-02-30', '2026-13-01', '2026-10-7', 'yesterday', ''])('%s is not', (text) => {
    expect(isDayText(text)).toBe(false)
  })
})

describe("a custom range's two days", () => {
  test('two days, the end on or after the start, are a range', () => {
    expect(customRangeOfDays('2026-09-01', '2026-09-30')).toEqual({
      ok: true,
      range: { from: '2026-09-01', to: '2026-09-30' },
    })
    expect(customRangeOfDays('2026-09-01', '2026-09-01')).toEqual({
      ok: true,
      range: { from: '2026-09-01', to: '2026-09-01' },
    })
  })

  test.each([
    [undefined, '2026-09-30'],
    ['2026-09-01', undefined],
    ['', '2026-09-30'],
    ['2026-02-30', '2026-09-30'],
  ])('from %j to %j is not a day, before the order is checked', (from, to) => {
    expect(customRangeOfDays(from, to)).toEqual({ ok: false, fault: 'not_a_day' })
  })

  test('an end before the start', () => {
    expect(customRangeOfDays('2026-09-02', '2026-09-01')).toEqual({
      ok: false,
      fault: 'end_before_start',
    })
  })
})

describe('the reporting day a time falls in', () => {
  test('a time late in the evening Pacific Time is still that day, though UTC has turned', () => {
    expect(pacificDayOf('2026-10-07T05:00:00Z')).toBe('2026-10-06')
  })

  test.each([
    ['2026-03-08T07:59:59Z', '2026-03-07'],
    ['2026-03-08T08:00:00Z', '2026-03-08'],
    ['2026-11-01T06:59:59Z', '2026-10-31'],
    ['2026-11-01T07:00:00Z', '2026-11-01'],
  ])('across a daylight saving change, %s falls in %s', (time, day) => {
    expect(pacificDayOf(time)).toBe(day)
  })

  test('a time and its ISO text fall in the same day', () => {
    const time = new Date('2026-10-07T05:00:00Z')
    expect(pacificDayOf(time)).toBe(pacificDayOf(time.toISOString()))
  })
})

describe('the days Google has processed since a video was published', () => {
  test('the publish day itself is day 1', () => {
    expect(daysProcessedSince('2026-10-06', '2026-10-06')).toBe(1)
  })

  test.each([
    ['2026-10-06', '2026-10-12', 7],
    ['2025-10-01', '2026-09-30', 365],
  ])(
    'published %s, processed through %s: the last processed day counts, %i days',
    (publishDay, lastDay, days) => {
      expect(daysProcessedSince(publishDay, lastDay)).toBe(days)
    },
  )

  test.each([
    ['2026-10-06', '2026-10-05'],
    ['2026-10-06', '2026-09-29'],
  ])('published %s, processed through %s: 0, never fewer', (publishDay, lastDay) => {
    expect(daysProcessedSince(publishDay, lastDay)).toBe(0)
  })

  test('a video with no publish day has 0', () => {
    expect(daysProcessedSince(null, '2026-10-12')).toBe(0)
  })
})

describe('whether a video has finished a window after publish', () => {
  test.each([
    ['first7', '2026-09-28', '2026-10-03', false],
    ['first7', '2026-09-28', '2026-10-04', true],
    ['first1', '2026-09-28', '2026-09-28', true],
    ['first1', '2026-09-28', '2026-09-27', false],
    ['first365', '2025-10-01', '2026-09-29', false],
    ['first365', '2025-10-01', '2026-09-30', true],
  ] as const)(
    '%s published %s, processed through %s: %s',
    (window, publishDay, lastDay, finished) => {
      expect(isWindowFinished(window, publishDay, lastDay)).toBe(finished)
    },
  )

  test('a video with no publish day has finished none', () => {
    expect(isWindowFinished('first1', null, '2026-10-04')).toBe(false)
  })
})
