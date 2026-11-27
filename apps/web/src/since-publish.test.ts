// Limits: these tests cover the since publish table's text, cells, rows and sort, as pure functions.
// No test renders the table, so none shows its layout, the age line under Lifetime, what a screen
// reader reads from each heading's aria-sort, or the table at 375 pixels wide. Nick checks those on a
// video's screen in a real browser. The placeholder's row count is checked against hand-written
// finished stages, not against an answer the API gives. It reads the publish day and the finished
// rule from api-types, the same `pacificDayOf` and `isWindowFinished` the API's `partialOf` uses, so
// the two cannot drift apart there; a change to `partialOf` that stops using that rule goes unseen.
import type { SincePublish, SincePublishRow, SincePublishStage } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  defaultSincePublishSort,
  rememberSincePublishOf,
  sincePublishPlaceholderRowsFor,
  sincePublishPlaceholderRowsOf,
  sincePublishSortLabelOf,
  sincePublishTableOf,
  sincePublishText,
} from './since-publish.ts'

function row(stage: SincePublishRow['stage'], overrides: Partial<SincePublishRow> = {}) {
  return {
    stage,
    engagedViews: 1234,
    views: 2345,
    estimatedMinutesWatched: 738,
    ...overrides,
  } satisfies SincePublishRow
}

const stages = ['first1', 'first7', 'first28', 'first90', 'first365', 'lifetime'] as const

const withoutRevenue: SincePublish = { rows: stages.map((stage) => row(stage)) }

const byStage = { column: 'engagedViews', direction: 'descending' } as const

describe('the since publish table', () => {
  test('names each stage by its text, publish day first and lifetime last, when they tie', () => {
    const table = sincePublishTableOf(withoutRevenue, byStage, 'en-US')

    expect(table.rows.map(({ stage }) => stage)).toEqual(
      stages.map((stage) => sincePublishText.stages[stage]),
    )
  })

  test('without revenue, shows engaged views, views and watch hours, each as the locale writes it', () => {
    const table = sincePublishTableOf(withoutRevenue, byStage, 'en-US')

    expect(table.columns).toEqual([
      { column: 'engagedViews', heading: 'Engaged views' },
      { column: 'views', heading: 'Views' },
      { column: 'estimatedMinutesWatched', heading: 'Watch hours' },
    ])
    expect(table.rows[0]?.cells).toEqual({
      engagedViews: '1,234',
      views: '2,345',
      estimatedMinutesWatched: '12.3',
    })
  })

  test('with revenue, adds an estimated revenue column in the currency the rows carry it in', () => {
    const table = sincePublishTableOf(
      {
        rows: stages.map((stage) => row(stage, { estimatedRevenue: 4.57 })),
        revenueCurrency: 'EUR',
      },
      byStage,
      'en-US',
    )

    expect(table.columns.at(-1)).toEqual({
      column: 'estimatedRevenue',
      heading: 'Estimated revenue',
    })
    expect(table.rows.at(-1)?.cells.estimatedRevenue).toBe('€4.57')
  })

  test('shows no estimated revenue column when no stage carries revenue', () => {
    const table = sincePublishTableOf(
      { rows: stages.map((stage) => row(stage, { estimatedRevenue: 0 })), revenueCurrency: 'EUR' },
      byStage,
      'en-US',
    )

    expect(table.columns.map(({ column }) => column)).toEqual([
      'engagedViews',
      'views',
      'estimatedMinutesWatched',
    ])
    expect(table.rows.at(-1)?.cells).not.toHaveProperty('estimatedRevenue')
  })

  test('hides each stage the video has not finished, and shows each finished one', () => {
    const table = sincePublishTableOf(
      {
        rows: [
          row('first1'),
          row('first7'),
          row('first28', { partial: { days: 10, of: 28 } }),
          row('first365', { partial: { days: 10, of: 365 } }),
          row('lifetime'),
        ],
      },
      byStage,
      'en-US',
    )

    expect(table.rows.map(({ stage }) => stage)).toEqual([
      'Publish day',
      'First 7 days',
      'Lifetime',
    ])
  })

  test("shows the video's age under Lifetime alone", () => {
    const table = sincePublishTableOf(
      { rows: [row('first7'), row('lifetime')], daysSincePublish: 172 },
      byStage,
      'en-US',
    )

    expect(table.rows.map(({ note }) => note)).toEqual([null, '172 days since publish'])
  })

  test('writes an age of one day in the singular', () => {
    const table = sincePublishTableOf(
      { rows: [row('lifetime')], daysSincePublish: 1 },
      byStage,
      'en-US',
    )

    expect(table.rows[0]?.note).toBe('1 day since publish')
  })

  test('shows no age when the answer carries none', () => {
    expect(sincePublishTableOf(withoutRevenue, byStage, 'en-US').rows.at(-1)?.note).toBeNull()
  })
})

describe('the order of the since publish table', () => {
  const ranked: SincePublish = {
    rows: [
      row('first1', { engagedViews: 10, views: 900 }),
      row('first7', { engagedViews: 70, views: 100 }),
      row('lifetime', { engagedViews: 500, views: 500 }),
    ],
  }

  test('is engaged views, highest first, by default', () => {
    expect(defaultSincePublishSort).toEqual({ column: 'engagedViews', direction: 'descending' })
    expect(
      sincePublishTableOf(ranked, defaultSincePublishSort, 'en-US').rows.map(({ stage }) => stage),
    ).toEqual(['Lifetime', 'First 7 days', 'Publish day'])
  })

  test('sorts by another column, lowest first, by its number and not its text', () => {
    expect(
      sincePublishTableOf(ranked, { column: 'views', direction: 'ascending' }, 'en-US').rows.map(
        ({ stage }) => stage,
      ),
    ).toEqual(['First 7 days', 'Lifetime', 'Publish day'])
  })

  test('is announced by its heading, highest or lowest first', () => {
    expect(sincePublishSortLabelOf(defaultSincePublishSort)).toBe('Engaged views, highest first')
    expect(sincePublishSortLabelOf({ column: 'estimatedRevenue', direction: 'ascending' })).toBe(
      'Estimated revenue, lowest first',
    )
  })
})

describe("the since publish placeholder's rows", () => {
  // Each case names the stages the API counts finished for it, the publish day (Pacific Time) as
  // day 1, up to the last processed day.
  const cases: {
    name: string
    publishedAt: string | null
    lastProcessedDay: string
    finished: SincePublishStage[]
  }[] = [
    {
      name: 'a video younger than 7 days, its publish day processed',
      publishedAt: '2026-10-01T15:00:00Z',
      lastProcessedDay: '2026-10-03',
      finished: ['first1'],
    },
    {
      name: 'a video younger than 7 days, its publish day not yet processed',
      publishedAt: '2026-10-05T15:00:00Z',
      lastProcessedDay: '2026-10-04',
      finished: [],
    },
    {
      name: 'a video between 90 and 365 days old',
      publishedAt: '2026-05-01T15:00:00Z',
      lastProcessedDay: '2026-10-04',
      finished: ['first1', 'first7', 'first28', 'first90'],
    },
    {
      name: 'a video older than 365 days',
      publishedAt: '2024-01-01T15:00:00Z',
      lastProcessedDay: '2026-10-04',
      finished: ['first1', 'first7', 'first28', 'first90', 'first365'],
    },
    {
      name: 'a video on the day its first 7 days finish',
      publishedAt: '2026-09-28T15:00:00Z',
      lastProcessedDay: '2026-10-04',
      finished: ['first1', 'first7'],
    },
    {
      name: 'a video the day before its first 7 days finish',
      publishedAt: '2026-09-28T15:00:00Z',
      lastProcessedDay: '2026-10-03',
      finished: ['first1'],
    },
    {
      name: 'a video on the day its first 28 days finish',
      publishedAt: '2026-09-07T15:00:00Z',
      lastProcessedDay: '2026-10-04',
      finished: ['first1', 'first7', 'first28'],
    },
    {
      name: 'a video on the day its first 90 days finish',
      publishedAt: '2026-07-07T15:00:00Z',
      lastProcessedDay: '2026-10-04',
      finished: ['first1', 'first7', 'first28', 'first90'],
    },
    {
      name: 'a video the day before its first 365 days finish',
      publishedAt: '2025-10-06T15:00:00Z',
      lastProcessedDay: '2026-10-04',
      finished: ['first1', 'first7', 'first28', 'first90'],
    },
    {
      name: 'a video on the day its first 365 days finish',
      publishedAt: '2025-10-05T15:00:00Z',
      lastProcessedDay: '2026-10-04',
      finished: ['first1', 'first7', 'first28', 'first90', 'first365'],
    },
    {
      // 22:30 on 1 October in Pacific Time, 2 October in UTC: day 7 by Google's day, not day 6.
      name: 'a video published late in the evening Pacific Time, the next day in UTC',
      publishedAt: '2026-10-02T05:30:00Z',
      lastProcessedDay: '2026-10-07',
      finished: ['first1', 'first7'],
    },
    {
      name: 'a video with no publish date',
      publishedAt: null,
      lastProcessedDay: '2026-10-04',
      finished: [],
    },
  ]

  test.each(cases)('hold the heading, each finished stage and lifetime for $name', (known) => {
    expect(sincePublishPlaceholderRowsOf(known)).toBe(known.finished.length + 2)
  })
})

describe("the since publish placeholder's rows for a video the page has an answer for", () => {
  test('hold every stage for a video no answer has carried', () => {
    expect(sincePublishPlaceholderRowsFor('never-answered')).toBe(7)
  })

  test("hold a remembered video's finished stages", () => {
    rememberSincePublishOf(
      [
        { id: 'young-video', publishedAt: '2026-10-01T15:00:00Z' },
        { id: 'old-video', publishedAt: '2024-01-01T15:00:00Z' },
      ],
      '2026-10-03',
    )

    expect(sincePublishPlaceholderRowsFor('young-video')).toBe(3)
    expect(sincePublishPlaceholderRowsFor('old-video')).toBe(7)
  })

  test('take the later answer for the same video', () => {
    rememberSincePublishOf(
      [{ id: 'later-video', publishedAt: '2026-09-28T15:00:00Z' }],
      '2026-10-03',
    )
    rememberSincePublishOf(
      [{ id: 'later-video', publishedAt: '2026-09-28T15:00:00Z' }],
      '2026-10-04',
    )

    expect(sincePublishPlaceholderRowsFor('later-video')).toBe(4)
  })
})
