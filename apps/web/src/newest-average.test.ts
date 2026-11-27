// Limits: these tests cover the sentence as text, from a list answer the tests write. No test here
// renders it, so none shows where it sits above the list; the markup tests in components.test.ts
// do. None reads the API's own average, which the API's tests cover over the fake Google.
import type {
  NewestAverage,
  NewestHistoryAverage,
  VideoListAnswer,
} from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  newestAverageTextOf,
  newestHistoryAverageTextOf,
  newestUploadsNoteOf,
} from './newest-average.ts'

const answer: VideoListAnswer = {
  videos: [],
  window: 'first7',
  page: 1,
  pageSize: 50,
  pageCount: 1,
  revenue: { refusal: 'consent_missing' },
  lastProcessedDay: '2026-10-04',
  creationDay: '2019-02-28',
  fetchedAt: '2026-10-07T09:00:00.000Z',
  fromCache: false,
}

function textOf(
  newestAverage: Partial<NewestAverage> | undefined,
  window: VideoListAnswer['window'] = 'first7',
  locale = 'en-US',
) {
  return newestAverageTextOf(
    {
      ...answer,
      window,
      ...(newestAverage
        ? { newestAverage: { format: 'all', count: 10, engagedViews: 1234, ...newestAverage } }
        : {}),
    },
    locale,
  )
}

describe('the sentence on the average engaged views of the newest public uploads', () => {
  test('names the format the uploads were picked by', () => {
    expect(textOf({ format: 'all' })).toBe(
      'Your 10 newest public uploads averaged 1,234 engaged views in their first 7 days.',
    )
    expect(textOf({ format: 'video' })).toBe(
      'Your 10 newest public videos averaged 1,234 engaged views in their first 7 days.',
    )
    expect(textOf({ format: 'short' })).toBe(
      'Your 10 newest public Shorts averaged 1,234 engaged views in their first 7 days.',
    )
    expect(textOf({ format: 'live' })).toBe(
      'Your 10 newest public live streams averaged 1,234 engaged views in their first 7 days.',
    )
  })

  test('names the days: the publish day for first1, the first N days for the other windows', () => {
    expect(textOf({}, 'first1')).toBe(
      'Your 10 newest public uploads averaged 1,234 engaged views on their publish day.',
    )
    expect(textOf({}, 'first7')).toBe(
      'Your 10 newest public uploads averaged 1,234 engaged views in their first 7 days.',
    )
    expect(textOf({}, 'first28')).toBe(
      'Your 10 newest public uploads averaged 1,234 engaged views in their first 28 days.',
    )
    expect(textOf({}, 'first90')).toBe(
      'Your 10 newest public uploads averaged 1,234 engaged views in their first 90 days.',
    )
    expect(textOf({}, 'first365')).toBe(
      'Your 10 newest public uploads averaged 1,234 engaged views in their first 365 days.',
    )
  })

  test('gives a count under 10 as it is, and the average rounded to a whole number in the locale digits', () => {
    expect(textOf({ count: 3, engagedViews: 1233.5 })).toBe(
      'Your 3 newest public uploads averaged 1,234 engaged views in their first 7 days.',
    )
    expect(textOf({ count: 2, engagedViews: 1234.4 }, 'first7', 'de-DE')).toBe(
      'Your 2 newest public uploads averaged 1.234 engaged views in their first 7 days.',
    )
  })

  test('gives no sentence with no average, a count under 2, or in a calendar window', () => {
    expect(textOf(undefined)).toBeNull()
    expect(textOf({ count: 1 })).toBeNull()
    expect(textOf({}, 'last7')).toBeNull()
    expect(textOf({}, 'last28')).toBeNull()
    expect(textOf({}, 'lifetime')).toBeNull()
    expect(textOf({}, 'custom')).toBeNull()
  })
})

describe('the sentence on the average impressions and CTR of the newest public uploads (creator-analytics#785)', () => {
  function historyTextOf(
    average: Partial<NewestHistoryAverage> | undefined,
    window: VideoListAnswer['window'] = 'first7',
  ) {
    return newestHistoryAverageTextOf(
      {
        ...answer,
        window,
        ...(average
          ? {
              newestHistoryAverage: {
                format: 'video',
                count: 10,
                impressions: 12_339.6,
                ctr: 0.0456,
                ...average,
              },
            }
          : {}),
      },
      'en-US',
    )
  }

  test('a full one names the 10 uploads, their impressions rounded and the CTR to one decimal place', () => {
    expect(historyTextOf({})).toBe(
      'Your 10 newest public videos averaged 12,340 impressions at a 4.6% click-through rate in their first 7 days.',
    )
    expect(historyTextOf({ format: 'all' }, 'first1')).toBe(
      'Your 10 newest public uploads averaged 12,340 impressions at a 4.6% click-through rate on their publish day.',
    )
  })

  test('a thin one names its count, and one with no impressions names no rate', () => {
    expect(historyTextOf({ count: 3, format: 'short' })).toBe(
      'Your 3 newest public Shorts averaged 12,340 impressions at a 4.6% click-through rate in their first 7 days.',
    )
    expect(historyTextOf({ count: 2, impressions: 0, ctr: null })).toBe(
      'Your 2 newest public videos averaged 0 impressions in their first 7 days.',
    )
  })

  test('none with no average, a count under 2, or in a calendar window', () => {
    expect(historyTextOf(undefined)).toBeNull()
    expect(historyTextOf({ count: 1 })).toBeNull()
    expect(historyTextOf({}, 'last28')).toBeNull()
  })
})

describe("the video screen's note on the uploads its newest uploads columns average (creator-analytics#785)", () => {
  test('names the count, the format and the days, and is none with no average or in a calendar window', () => {
    expect(newestUploadsNoteOf({ format: 'short', count: 3 }, 'first28')).toBe(
      'The newest uploads columns average your 3 newest public Shorts in their first 28 days.',
    )
    expect(newestUploadsNoteOf({ format: 'all', count: 10 }, 'first1')).toBe(
      'The newest uploads columns average your 10 newest public uploads on their publish day.',
    )
    expect(newestUploadsNoteOf(undefined, 'first7')).toBeNull()
    expect(newestUploadsNoteOf({ format: 'video', count: 3 }, 'last28')).toBeNull()
  })
})
