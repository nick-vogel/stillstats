// Limits: these tests cover the history's label, note and start as pure functions. No test here
// draws a chart or the cards; app.test.ts renders them over the fake API, and the browser walk
// (`pnpm test:browser`) draws the charts in Chrome.
import type { ChannelDay } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  ctrTextOf,
  historyNewestNoteOf,
  historyNoteOf,
  historyPartialOf,
  historyStartIndexOf,
  purgeNoteOf,
} from './history.ts'

function day(date: string, held?: { impressions: number; ctr: number | null }): ChannelDay {
  return { day: date, engagedViews: 0, views: 0, estimatedMinutesWatched: 0, ...held }
}

const range = [
  day('2026-10-01'),
  day('2026-10-02'),
  day('2026-10-03', { impressions: 100, ctr: 0.05 }),
  day('2026-10-04', { impressions: 0, ctr: null }),
]
const history = { impressions: 100, ctr: 0.05, firstDay: '2026-10-03', newestDay: '2026-10-04' }

describe("the history's partial range", () => {
  test('a range that starts before the history start is labelled with the days the history holds of all of them', () => {
    expect(historyPartialOf(range, history)).toBe('2 of 4 days')
  })

  test('a range the history covers has no label', () => {
    expect(historyPartialOf(range.slice(2), history)).toBeNull()
  })

  test("the note gives the history start only when the range starts before it, and always the range's newest held day", () => {
    expect([
      historyNoteOf(range, history, 'en-GB'),
      historyNoteOf(range.slice(2), history, 'en-GB'),
    ]).toEqual([
      'In this range, impressions and click-through rate run to 4 October 2026. The history starts on 3 October 2026.',
      'In this range, impressions and click-through rate run to 4 October 2026.',
    ])
  })

  test("the note speaks of the range when the history holds later days the range's totals leave out, and of the store when the range holds none of its days", () => {
    const later = { ...history, newestDay: '2026-10-06' }
    expect([
      historyNoteOf(range.slice(2, 3), later, 'en-GB'),
      historyNoteOf(range.slice(0, 2), later, 'en-GB'),
    ]).toEqual([
      'In this range, impressions and click-through rate run to 3 October 2026.',
      'Impressions and click-through rate are stored up to 6 October 2026. The history starts on 3 October 2026.',
    ])
  })

  test('the history start falls at the first held day, and nowhere when the range starts with it', () => {
    expect([historyStartIndexOf(range), historyStartIndexOf(range.slice(2))]).toEqual([2, null])
  })
})

describe('a click-through rate', () => {
  test('shows as a percentage with one decimal place, and as nothing when there is none', () => {
    expect([ctrTextOf(0.042, 'en-US'), ctrTextOf(null, 'en-US')]).toEqual(['4.2%', ''])
  })
})

describe("the video list's and the video screen's note on the history (creator-analytics#785)", () => {
  const ends = { firstDay: '2026-09-10', newestDay: '2026-10-04' }

  test('names the newest day the history holds, and the history start when some numbers start before it', () => {
    expect([
      historyNewestNoteOf(ends, false, 'en-GB'),
      historyNewestNoteOf(ends, true, 'en-GB'),
    ]).toEqual([
      'Impressions and click-through rate are stored up to 4 October 2026.',
      'Impressions and click-through rate are stored up to 4 October 2026. The history starts on 10 September 2026.',
    ])
  })
})

describe("an ended channel's note on its purge date (creator-analytics#787)", () => {
  test('says the subscription has ended and the day its history is deleted', () => {
    expect(purgeNoteOf({ ...history, purgeDate: '2026-12-17' }, 'en-US')).toBe(
      'Your subscription has ended. This history is deleted on December 17, 2026.',
    )
  })

  test("is null for a paid channel's history, which carries no purge date", () => {
    expect(purgeNoteOf(history, 'en-US')).toBeNull()
  })
})
