// Limits: these tests cover the numbers table under the charts as pure functions: its sort and the
// text a screen reader hears for it, its rows, its total row, its column groups and the rows its
// placeholder holds. The table takes no chart mode, so these hold in both modes; components.test.ts
// and placeholder.test.ts render it under the running total toggle. No DOM is drawn and no
// stylesheet evaluated here, so the sticky heading rows and the sticky total row, the box exactly
// ten body rows high, what a screen reader reads from each heading's aria-sort, and that the
// placeholder is as tall as the table that replaces it are checked by Nick at /app in a real
// browser. The lines between the columns are app.css rules, which web.test.ts reads and
// `pnpm test:browser` checks in Chrome.
import type { ChannelDay, VideoDay } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { revenueCardOf } from './cards.ts'
import {
  defaultViewsSort,
  numbersTableBoxRowsOf,
  numbersTableRowsOf,
  tableSortLabelOf,
  type ViewsSort,
  viewsColumns,
  viewsTableOf,
} from './numbers-table.ts'
import { headingSortOf } from './tables.ts'

function day(
  date: string,
  engagedViews: number,
  views: number,
  dayAfterPublish?: number,
): VideoDay {
  return {
    day: date,
    engagedViews,
    views,
    estimatedMinutesWatched: 0,
    ...(dayAfterPublish ? { dayAfterPublish } : {}),
  }
}

function watched(day: VideoDay, estimatedMinutesWatched: number): VideoDay {
  return { ...day, estimatedMinutesWatched }
}

// Engaged views, views and watch time rank the days differently, so a column sorting by another
// one shows.
const days = [
  watched(day('2026-09-01', 10, 50), 60),
  watched(day('2026-09-02', 0, 0), 90),
  day('2026-09-03', 30, 40),
]
const total = { engagedViews: 45, views: 70, estimatedMinutesWatched: 200 }

describe('the order of the numbers table', () => {
  test('is newest day first by default', () => {
    const { rows } = viewsTableOf(days, total, defaultViewsSort, 'en-US')

    expect(rows.map(({ day }) => day)).toEqual(['Sep 3, 2026', 'Sep 2, 2026', 'Sep 1, 2026'])
  })

  test.each([
    ['engagedViews', ['30', '10', '0']],
    ['views', ['50', '40', '0']],
    ['estimatedMinutesWatched', ['1.5', '1.0', '0.0']],
  ] as const)('sorted by %s descending, runs from the highest down', (column, texts) => {
    const { rows } = viewsTableOf(days, total, { column, direction: 'descending' }, 'en-US')

    expect(rows.map((row) => row[column])).toEqual(texts)
  })

  test.each([
    ['engagedViews', ['0', '10', '30']],
    ['views', ['0', '40', '50']],
    ['estimatedMinutesWatched', ['0.0', '1.0', '1.5']],
    ['day', ['Sep 1, 2026', 'Sep 2, 2026', 'Sep 3, 2026']],
  ] as const)('sorted by %s ascending, runs from the lowest or earliest up', (column, texts) => {
    const { rows } = viewsTableOf(days, total, { column, direction: 'ascending' }, 'en-US')

    expect(rows.map((row) => row[column])).toEqual(texts)
  })

  test('in a window after publish, sorts by the day after publish both ways', () => {
    const afterPublish = [
      day('2026-09-09', 5, 5, 9),
      day('2026-09-10', 9, 9, 10),
      day('2026-09-11', 1, 1, 11),
    ]

    expect(
      viewsTableOf(afterPublish, total, defaultViewsSort, 'en-US').rows.map(({ day }) => day),
    ).toEqual(['Day 11', 'Day 10', 'Day 9'])
    expect(
      viewsTableOf(
        afterPublish,
        total,
        { column: 'day', direction: 'ascending' },
        'en-US',
      ).rows.map(({ day }) => day),
    ).toEqual(['Day 9', 'Day 10', 'Day 11'])
  })

  test('sorts the dates by their place in the window, not by their text', () => {
    const { rows } = viewsTableOf(
      [day('2026-09-09', 1, 1), day('2026-09-10', 1, 1)],
      total,
      { column: 'day', direction: 'ascending' },
      'en-US',
    )

    expect(rows.map(({ day }) => day)).toEqual(['Sep 9, 2026', 'Sep 10, 2026'])
  })

  test('sorts a number column by its value, not by its text', () => {
    const { rows } = viewsTableOf(
      [day('2026-09-01', 900, 900), day('2026-09-02', 1200, 1200)],
      total,
      { column: 'views', direction: 'descending' },
      'en-US',
    )

    expect(rows.map(({ views }) => views)).toEqual(['1,200', '900'])
  })

  test('sorts watch hours by their minutes, not by the hours they round to', () => {
    const { rows } = viewsTableOf(
      [watched(day('2026-09-01', 1, 1), 62), watched(day('2026-09-02', 1, 1), 61)],
      total,
      { column: 'estimatedMinutesWatched', direction: 'descending' },
      'en-US',
    )

    expect(rows.map(({ day, estimatedMinutesWatched }) => [day, estimatedMinutesWatched])).toEqual([
      ['Sep 1, 2026', '1.0'],
      ['Sep 2, 2026', '1.0'],
    ])
  })

  test('keeps the newest of two days with the same number first, in either direction', () => {
    const tied = [day('2026-09-01', 7, 7), day('2026-09-02', 7, 7)]

    for (const direction of ['ascending', 'descending'] as const) {
      expect(
        viewsTableOf(tied, total, { column: 'views', direction }, 'en-US').rows.map(
          ({ day }) => day,
        ),
      ).toEqual(['Sep 2, 2026', 'Sep 1, 2026'])
    }
  })
})

describe('a heading of the numbers table', () => {
  test('on the sorted column, carries its direction and moves to the other direction', () => {
    expect(headingSortOf('views', { column: 'views', direction: 'descending' })).toEqual({
      direction: 'descending',
      next: { column: 'views', direction: 'ascending' },
    })
    expect(headingSortOf('views', { column: 'views', direction: 'ascending' })).toEqual({
      direction: 'ascending',
      next: { column: 'views', direction: 'descending' },
    })
  })

  test('on any other column, carries none and moves to descending', () => {
    expect(headingSortOf('engagedViews', defaultViewsSort)).toEqual({
      direction: 'none',
      next: { column: 'engagedViews', direction: 'descending' },
    })
  })
})

describe('the total row of the numbers table', () => {
  test("is YouTube's own total, not the sum of the days", () => {
    // The days add up to 40 engaged views, 90 views and 150 minutes; YouTube's total over the
    // window differs.
    const { total: row } = viewsTableOf(
      days,
      { engagedViews: 1200, views: 3400, estimatedMinutesWatched: 74_070 },
      defaultViewsSort,
      'en-US',
    )

    expect(row).toEqual({
      engagedViews: '1,200',
      views: '3,400',
      estimatedMinutesWatched: '1,234.5',
    })
  })

  test('stays apart from the rows whatever the sort', () => {
    for (const column of viewsColumns) {
      for (const direction of ['ascending', 'descending'] as const) {
        const { rows, total: row } = viewsTableOf(days, total, { column, direction }, 'en-US')

        expect(rows.map(({ day }) => day).toSorted()).toEqual([
          'Sep 1, 2026',
          'Sep 2, 2026',
          'Sep 3, 2026',
        ])
        expect(row).toEqual({ engagedViews: '45', views: '70', estimatedMinutesWatched: '3.3' })
      }
    }
  })
})

describe('the rows of the numbers table', () => {
  test('are each day as YouTube reports it, its watch time in hours', () => {
    const { rows } = viewsTableOf(
      [watched(day('2026-09-01', 1200, 3400), 738), day('2026-09-02', 0, 0)],
      total,
      { column: 'day', direction: 'ascending' },
      'en-US',
    )

    expect(rows).toEqual([
      {
        day: 'Sep 1, 2026',
        engagedViews: '1,200',
        views: '3,400',
        estimatedMinutesWatched: '12.3',
      },
      { day: 'Sep 2, 2026', engagedViews: '0', views: '0', estimatedMinutesWatched: '0.0' },
    ])
  })
})

describe('the rows the numbers table holds a place for while its numbers are read', () => {
  test.each([
    ['first1', 3],
    ['first7', 9],
  ] as const)('%s holds its heading row, a row per day and the total row: %i', (window, rows) => {
    expect(numbersTableRowsOf({ window }, false)).toBe(rows)
  })

  // A calendar window ends at the last processed day, so it holds its full count of days.
  test('last7 holds a row for each of its 7 days: 9', () => {
    expect(numbersTableRowsOf({ window: 'last7' }, false)).toBe(9)
  })

  test.each(['last28', 'last365', 'first28', 'first365'] as const)(
    '%s holds ten body rows at most, as the box shows: 12',
    (window) => {
      expect(numbersTableRowsOf({ window }, false)).toBe(12)
    },
  )

  test('with the revenue sources shown, a window holds their heading row too', () => {
    expect(numbersTableRowsOf({ window: 'last90' }, true)).toBe(13)
  })

  test('a custom range of 3 days holds the rows a 3-day window would: 5', () => {
    const range = { from: '2026-09-01', to: '2026-09-03' }
    expect(numbersTableRowsOf({ window: 'custom', range }, false)).toBe(5)
  })

  test('a custom range longer than the box holds ten body rows: 12', () => {
    const range = { from: '2026-01-01', to: '2026-09-30' }
    expect(numbersTableRowsOf({ window: 'custom', range }, false)).toBe(12)
  })

  test('lifetime holds the whole box, since its days come only with the answer', () => {
    expect(numbersTableRowsOf({ window: 'lifetime' }, false)).toBe(12)
  })
})

describe('the box the numbers table scrolls in', () => {
  test('holds the heading row, ten body rows and the total row', () => {
    expect(numbersTableBoxRowsOf(false)).toBe(12)
  })

  test('with the revenue sources shown, holds their heading row too', () => {
    expect(numbersTableBoxRowsOf(true)).toBe(13)
  })
})

describe('the sort a screen reader hears for the numbers table', () => {
  const headings = { day: 'Date', views: 'Views', otherSources: 'Other sources' }

  test('names a number column by its heading, highest or lowest first', () => {
    expect(tableSortLabelOf({ column: 'views', direction: 'descending' }, headings)).toBe(
      'Views, highest first',
    )
    expect(tableSortLabelOf({ column: 'otherSources', direction: 'ascending' }, headings)).toBe(
      'Other sources, lowest first',
    )
  })

  test('names the day column by its heading, newest or oldest first', () => {
    expect(tableSortLabelOf(defaultViewsSort, headings)).toBe('Date, newest first')
    expect(tableSortLabelOf({ column: 'day', direction: 'ascending' }, headings)).toBe(
      'Date, oldest first',
    )
  })
})

describe('the revenue columns of the numbers table', () => {
  function earned(
    date: string,
    estimatedRevenue: number,
    estimatedAdRevenue: number,
    estimatedRedPartnerRevenue: number,
  ): ChannelDay {
    return {
      day: date,
      engagedViews: 1,
      views: 1,
      estimatedMinutesWatched: 0,
      estimatedRevenue,
      estimatedAdRevenue,
      estimatedRedPartnerRevenue,
    }
  }

  // Ads and YouTube Premium rank the days differently from the total and from other sources.
  const earning = [
    earned('2026-09-01', 10, 2, 1),
    earned('2026-09-02', 1000.5, 900, 0.5),
    earned('2026-09-03', 50, 40, 9),
  ]
  const earningTotal = {
    ...total,
    estimatedRevenue: 1234.5,
    estimatedAdRevenue: 1000,
    estimatedRedPartnerRevenue: 100,
    currency: 'USD' as const,
  }

  const sources = { sources: true }

  test('show after the number columns when the days carry revenue, RPM after the revenue, the sources hidden by default', () => {
    expect(viewsTableOf(earning, earningTotal, defaultViewsSort, 'en-US').columns).toEqual([
      'day',
      'engagedViews',
      'views',
      'estimatedMinutesWatched',
      'estimatedRevenue',
      'rpm',
    ])
  })

  test('with the sources shown, show ads, YouTube Premium and other sources after the revenue and RPM', () => {
    expect(viewsTableOf(earning, earningTotal, defaultViewsSort, 'en-US', sources).columns).toEqual(
      [
        'day',
        'engagedViews',
        'views',
        'estimatedMinutesWatched',
        'estimatedRevenue',
        'rpm',
        'estimatedAdRevenue',
        'estimatedRedPartnerRevenue',
        'otherSources',
      ],
    )
  })

  test('sorted by a source column that is hidden, run newest day first and say so', () => {
    const { rows, sort } = viewsTableOf(
      earning,
      earningTotal,
      { column: 'estimatedAdRevenue', direction: 'descending' },
      'en-US',
    )

    expect(rows.map(({ day }) => day)).toEqual(['Sep 3, 2026', 'Sep 2, 2026', 'Sep 1, 2026'])
    expect(sort).toEqual(defaultViewsSort)
  })

  test('are absent when the total names no currency for the revenue, RPM among them', () => {
    const { currency: _, ...noCurrency } = earningTotal

    expect(viewsTableOf(earning, noCurrency, defaultViewsSort, 'en-US').columns).toEqual([
      'day',
      'engagedViews',
      'views',
      'estimatedMinutesWatched',
    ])
  })

  test("show every revenue cell and the total row in the total's currency, as the locale writes it", () => {
    const { rows, total: row } = viewsTableOf(
      earning,
      { ...earningTotal, currency: 'EUR' },
      { column: 'day', direction: 'ascending' },
      'de-DE',
      sources,
    )

    expect(rows[0]).toMatchObject({
      estimatedRevenue: '10,00\u00a0€',
      rpm: '10.000,00\u00a0€',
      estimatedAdRevenue: '2,00\u00a0€',
      estimatedRedPartnerRevenue: '1,00\u00a0€',
      otherSources: '7,00\u00a0€',
    })
    expect(row).toMatchObject({
      estimatedRevenue: '1.234,50\u00a0€',
      rpm: '27.433,33\u00a0€',
      estimatedAdRevenue: '1.000,00\u00a0€',
      estimatedRedPartnerRevenue: '100,00\u00a0€',
      otherSources: '134,50\u00a0€',
    })
  })

  test('are absent when the days carry no revenue, RPM among them', () => {
    expect(viewsTableOf(days, total, defaultViewsSort, 'en-US').columns).toEqual([
      'day',
      'engagedViews',
      'views',
      'estimatedMinutesWatched',
    ])
  })

  test("show each day's revenue, ads and YouTube Premium in USD, and other sources as the rest", () => {
    const { rows } = viewsTableOf(
      earning,
      earningTotal,
      { column: 'day', direction: 'ascending' },
      'en-US',
      sources,
    )

    expect(rows[0]).toEqual({
      day: 'Sep 1, 2026',
      engagedViews: '1',
      views: '1',
      estimatedMinutesWatched: '0.0',
      estimatedRevenue: '$10.00',
      rpm: '$10,000.00',
      estimatedAdRevenue: '$2.00',
      estimatedRedPartnerRevenue: '$1.00',
      otherSources: '$7.00',
    })
  })

  test("the total row is YouTube's own revenue totals, other sources the rest of them", () => {
    const { total: row } = viewsTableOf(earning, earningTotal, defaultViewsSort, 'en-US', sources)

    expect(row).toMatchObject({
      estimatedRevenue: '$1,234.50',
      estimatedAdRevenue: '$1,000.00',
      estimatedRedPartnerRevenue: '$100.00',
      otherSources: '$134.50',
    })
  })

  test.each([
    ['estimatedRevenue', ['$1,000.50', '$50.00', '$10.00']],
    ['estimatedAdRevenue', ['$900.00', '$40.00', '$2.00']],
    ['estimatedRedPartnerRevenue', ['$9.00', '$1.00', '$0.50']],
    ['otherSources', ['$100.00', '$7.00', '$1.00']],
  ] as const)('sorted by %s descending, runs from the highest amount down', (column, texts) => {
    const { rows } = viewsTableOf(
      earning,
      earningTotal,
      { column, direction: 'descending' },
      'en-US',
      sources,
    )

    expect(rows.map((row) => row[column])).toEqual(texts)
  })
})

describe('the RPM column of the numbers table', () => {
  function rated(date: string, engagedViews: number, estimatedRevenue: number): ChannelDay {
    return {
      day: date,
      engagedViews,
      views: engagedViews,
      estimatedMinutesWatched: 0,
      estimatedRevenue,
      estimatedAdRevenue: 0,
      estimatedRedPartnerRevenue: 0,
    }
  }

  // The rows come from the days as given, whatever mode the charts draw in. A running total's RPM
  // on Sep 3 would be $7.83, not the day's own $8.00.
  const ratedDays = [
    rated('2026-09-01', 1000, 4.57),
    rated('2026-09-02', 0, 3),
    rated('2026-09-03', 1500, 12),
    rated('2026-09-04', 2000, 0.5),
  ]
  const revenue = {
    estimatedRevenue: 21.2,
    estimatedAdRevenue: 0,
    estimatedRedPartnerRevenue: 0,
    currency: 'USD' as const,
  }
  const ratedTotal = { engagedViews: 4600, views: 4600, estimatedMinutesWatched: 0, ...revenue }
  const oldestFirst = { column: 'day', direction: 'ascending' } as const

  test("is each day's own revenue per 1,000 engaged views, empty on a day with no engaged views", () => {
    const { rows } = viewsTableOf(ratedDays, ratedTotal, oldestFirst, 'en-US')

    expect(rows.map(({ day, rpm }) => [day, rpm])).toEqual([
      ['Sep 1, 2026', '$4.57'],
      ['Sep 2, 2026', ''],
      ['Sep 3, 2026', '$8.00'],
      ['Sep 4, 2026', '$0.25'],
    ])
  })

  test('is in the currency of the total, as the locale writes it', () => {
    const { rows } = viewsTableOf(
      ratedDays,
      { ...ratedTotal, currency: 'EUR' },
      oldestFirst,
      'de-DE',
    )

    expect(rows[0]?.rpm).toBe('4,57\u00a0€')
  })

  test("in the total row, is the window's RPM, the revenue card's own", () => {
    const { total: row } = viewsTableOf(ratedDays, ratedTotal, oldestFirst, 'en-US')
    const card = revenueCardOf(revenue, ratedTotal.engagedViews, true, 'en-US')

    expect(row.rpm).toBe('$4.61')
    expect(card.detail).toBe(`RPM: ${row.rpm}`)
  })

  test('in the total row, is empty with no engaged views over the window', () => {
    const { total: row } = viewsTableOf(
      ratedDays,
      { ...ratedTotal, engagedViews: 0 },
      oldestFirst,
      'en-US',
    )

    expect(row.rpm).toBe('')
  })

  test.each([
    ['descending', ['$8.00', '$4.57', '$0.25', '']],
    ['ascending', ['$0.25', '$4.57', '$8.00', '']],
  ] as const)('sorted %s, runs by its number, the day with no RPM last', (direction, texts) => {
    const { rows } = viewsTableOf(ratedDays, ratedTotal, { column: 'rpm', direction }, 'en-US')

    expect(rows.map(({ rpm }) => rpm)).toEqual(texts)
  })

  test('sorted by RPM, keeps the newest of two days with no RPM first, in either direction', () => {
    const unrated = [rated('2026-09-01', 0, 1), rated('2026-09-02', 0, 2)]

    for (const direction of ['ascending', 'descending'] as const) {
      expect(
        viewsTableOf(unrated, ratedTotal, { column: 'rpm', direction }, 'en-US').rows.map(
          ({ day }) => day,
        ),
      ).toEqual(['Sep 2, 2026', 'Sep 1, 2026'])
    }
  })

  test('shows with the sources hidden or shown', () => {
    for (const sources of [false, true]) {
      expect(
        viewsTableOf(ratedDays, ratedTotal, oldestFirst, 'en-US', { sources }).columns,
      ).toContain('rpm')
    }
  })

  // creator-analytics#357: with the RPM switch on, ads plus YouTube Premium over the same engaged
  // views, from the same days and total as with it off.
  describe('with the RPM switch on', () => {
    function sourced(
      date: string,
      engagedViews: number,
      estimatedRevenue: number,
      estimatedAdRevenue: number,
      estimatedRedPartnerRevenue: number,
    ): ChannelDay {
      return {
        day: date,
        engagedViews,
        views: engagedViews,
        estimatedMinutesWatched: 0,
        estimatedRevenue,
        estimatedAdRevenue,
        estimatedRedPartnerRevenue,
      }
    }

    const sourcedDays = [
      sourced('2026-09-01', 1000, 10, 2, 1),
      sourced('2026-09-02', 0, 3, 1, 0),
      sourced('2026-09-03', 1000, 5, 4, 1),
      sourced('2026-09-04', 2000, 8, 6, 2),
    ]
    const sourcedRevenue = {
      estimatedRevenue: 26,
      estimatedAdRevenue: 13,
      estimatedRedPartnerRevenue: 4,
      currency: 'USD' as const,
    }
    const sourcedTotal = {
      engagedViews: 4000,
      views: 4000,
      estimatedMinutesWatched: 0,
      ...sourcedRevenue,
    }
    const tableOf = (adsAndPremiumOnly: boolean, sort: ViewsSort = oldestFirst) =>
      viewsTableOf(sourcedDays, sourcedTotal, sort, 'en-US', { adsAndPremiumOnly })

    test("is each day's ads and YouTube Premium per 1,000 engaged views, empty with no engaged views", () => {
      expect(tableOf(true).rows.map(({ rpm }) => rpm)).toEqual(['$3.00', '', '$5.00', '$4.00'])
      expect(tableOf(false).rows.map(({ rpm }) => rpm)).toEqual(['$10.00', '', '$5.00', '$4.00'])
    })

    test("in the total row, is the window's ads and YouTube Premium RPM, the revenue card's own", () => {
      const card = revenueCardOf(sourcedRevenue, 4000, true, 'en-US', { adsAndPremiumOnly: true })

      expect(tableOf(true).total.rpm).toBe('$4.25')
      expect(card.detail).toBe('RPM: $4.25')
      expect(tableOf(false).total.rpm).toBe('$6.50')
    })

    test('in the total row, is empty with no engaged views over the window', () => {
      const { total: row } = viewsTableOf(
        sourcedDays,
        { ...sourcedTotal, engagedViews: 0 },
        oldestFirst,
        'en-US',
        { adsAndPremiumOnly: true },
      )

      expect(row.rpm).toBe('')
    })

    test('sorted by RPM, runs by the ads and YouTube Premium RPM, the day with no RPM last', () => {
      const highest = { column: 'rpm', direction: 'descending' } as const

      expect(tableOf(true, highest).rows.map(({ rpm }) => rpm)).toEqual([
        '$5.00',
        '$4.00',
        '$3.00',
        '',
      ])
      expect(tableOf(false, highest).rows.map(({ rpm }) => rpm)).toEqual([
        '$10.00',
        '$5.00',
        '$4.00',
        '',
      ])
    })
  })
})

describe('the impressions and CTR columns of the numbers table', () => {
  const held = (date: string, impressions: number, ctr: number | null): ChannelDay => ({
    ...day(date, 1, 1),
    impressions,
    ctr,
  })
  const history = [
    day('2026-09-01', 1, 1),
    held('2026-09-02', 1200, 0.042),
    held('2026-09-03', 0, null),
  ]
  const historyTotal = { ...total, impressions: 1200, ctr: 0.042 }

  test("show after the number columns when the days carry the stored history, each day's own, empty on a day the history does not hold or with no CTR", () => {
    const table = viewsTableOf(history, historyTotal, defaultViewsSort, 'en-US')

    expect(table.columns).toEqual([
      'day',
      'engagedViews',
      'views',
      'estimatedMinutesWatched',
      'impressions',
      'ctr',
    ])
    expect(table.rows.map(({ impressions, ctr }) => [impressions, ctr])).toEqual([
      ['0', ''],
      ['1,200', '4.2%'],
      ['', ''],
    ])
  })

  test("the total row is the history's own over the range", () => {
    const table = viewsTableOf(history, historyTotal, defaultViewsSort, 'en-US')

    expect([table.total.impressions, table.total.ctr]).toEqual(['1,200', '4.2%'])
  })

  test('are absent when the days carry no stored history', () => {
    expect(viewsTableOf(days, total, defaultViewsSort, 'en-US').columns).not.toContain(
      'impressions',
    )
  })
})
