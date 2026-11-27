// Limits: these tests cover the stacked charts' days and scales, their hover cards' text, the charts
// the days draw, the chart a small screen falls back to and the event a card's choice sends, as
// pure functions. The lines TanStack Charts draws, one x per day on every chart, are tested in
// metric-plot.test.ts. No test here draws a chart or renders the stack, so none shows the four
// charts over one another, one pointer moving the card on all four, the cards as choosers, or where
// the breakpoint falls on a real screen. The browser walk (apps/site/test/screenshot/browser-walk.ts,
// `pnpm test:browser`) drives the stacked charts in Chrome; Nick checks their look at /app.
import type { ChannelDay, RevenueCurrency, VideoDay } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { revenueCardOf } from './cards.ts'
import {
  chartMetricChangedEvent,
  chartShownOf,
  chartsDrawnOf,
  ctrHoverOf,
  dayRpmOf,
  impressionsHoverOf,
  metricChartsOf,
  revenueHoverOf,
  rpmHoverOf,
  scaleLabelsOf,
  watchHoursHoverOf,
} from './metric-charts.ts'

function day(date: string, engagedViews: number, views: number, minutes: number): VideoDay {
  return { day: date, engagedViews, views, estimatedMinutesWatched: minutes }
}

function earned(
  date: string,
  engagedViews: number,
  views: number,
  minutes: number,
  revenue: number,
): ChannelDay {
  return {
    ...day(date, engagedViews, views, minutes),
    estimatedRevenue: revenue,
    estimatedAdRevenue: revenue / 2,
    estimatedRedPartnerRevenue: 0,
  }
}

const days = [
  earned('2026-09-01', 10, 20, 60, 2),
  earned('2026-09-02', 0, 0, 0, 0),
  earned('2026-09-03', 30, 40, 240, 1),
]

describe('the days of the stacked charts', () => {
  test.each([
    ['one day', days.slice(0, 1)],
    ['two days', days.slice(0, 2)],
    ['many days', days],
  ])('with %s, every chart reads one point per day', (_count, drawn) => {
    const charts = metricChartsOf(drawn, 'daily')

    expect(charts?.points.map(({ day }) => day.day)).toEqual(drawn.map(({ day }) => day))
  })

  test('is absent with no day', () => {
    expect(metricChartsOf([], 'daily')).toBeNull()
  })
})

describe('the stacked charts in each mode', () => {
  test('daily, each chart reads its own number on its own scale', () => {
    expect(metricChartsOf(days, 'daily')).toEqual({
      points: [{ day: days[0] }, { day: days[1] }, { day: days[2] }],
      engagedViews: { top: 40 },
      watchTime: { top: 240 },
      revenue: { top: 2 },
      rpm: { top: 200 },
      impressions: null,
      ctr: null,
    })
  })

  test('as a running total, every chart reads the running total, and the points carry it', () => {
    const charts = metricChartsOf(days, 'aggregate')

    expect([charts?.engagedViews, charts?.watchTime, charts?.revenue, charts?.rpm]).toEqual([
      { top: 60 },
      { top: 300 },
      { top: 3 },
      { top: 200 },
    ])
    expect(charts?.points.map(({ day }) => day.estimatedMinutesWatched)).toEqual([60, 60, 300])
  })

  test('with only zeros, every top is zero', () => {
    const charts = metricChartsOf(
      [earned('2026-09-01', 0, 0, 0, 0), earned('2026-09-02', 0, 0, 0, 0)],
      'daily',
    )

    expect([charts?.engagedViews, charts?.watchTime, charts?.revenue, charts?.rpm]).toEqual([
      { top: 0 },
      { top: 0 },
      { top: 0 },
      { top: 0 },
    ])
  })
})

describe('the revenue chart', () => {
  test('with a day below zero, its scale runs from the lowest day up, so the line stays inside the plot', () => {
    const charts = metricChartsOf(
      [earned('2026-09-01', 1, 1, 1, 3), earned('2026-09-02', 1, 1, 1, -1.2)],
      'daily',
    )

    expect(charts?.revenue).toEqual({ top: 3, bottom: -1.2 })
  })

  test('with every day below zero, its scale runs from the lowest day up to zero, so zero stays its top', () => {
    const charts = metricChartsOf(
      [earned('2026-09-01', 1, 1, 1, -2), earned('2026-09-02', 1, 1, 1, -1)],
      'daily',
    )

    expect(charts?.revenue).toEqual({ top: 0, bottom: -2 })
  })

  test('with no day below zero, its scale runs from zero, and carries no bottom', () => {
    const charts = metricChartsOf(
      [earned('2026-09-01', 1, 1, 1, 2), earned('2026-09-02', 1, 1, 1, 1)],
      'daily',
    )

    expect(charts?.revenue).toEqual({ top: 2 })
  })

  test('is absent when the days carry no revenue: no consent, or not monetized', () => {
    const charts = metricChartsOf([day('2026-09-01', 1, 2, 3), day('2026-09-02', 4, 5, 6)], 'daily')

    expect(charts?.revenue).toBeNull()
    expect(charts?.watchTime.top).toBe(6)
  })
})

describe('the RPM chart', () => {
  // RPM is each day's estimated revenue over its engaged views, times 1,000 (#244's rule).
  test("daily, each point is that day's RPM, and a day with zero engaged views has no point", () => {
    const charts = metricChartsOf(days, 'daily')

    expect(charts?.points.map(({ day }) => dayRpmOf(day))).toEqual([200, null, 1000 / 30])
  })

  // The days sum to 3 in revenue over 40 engaged views: an RPM to date of 75. A running sum of the
  // daily RPMs would end at 233.33.
  test('as a running total, each point is the RPM to date, never a running sum of daily RPM', () => {
    const charts = metricChartsOf(days, 'aggregate')

    expect(charts?.points.map(({ day }) => dayRpmOf(day))).toEqual([200, 200, 75])
  })

  test('as a running total, there is no point before the first engaged view', () => {
    const late = [earned('2026-09-01', 0, 4, 0, 0), ...days]

    expect(metricChartsOf(late, 'aggregate')?.points.map(({ day }) => dayRpmOf(day))).toEqual([
      null,
      200,
      200,
      75,
    ])
  })

  test("as a running total, its last point equals the revenue card's RPM when the days add up to the totals", () => {
    const last = metricChartsOf(days, 'aggregate')?.points.at(-1)
    if (!last) throw new Error('no last point')
    const card = revenueCardOf(
      {
        estimatedRevenue: 3,
        estimatedAdRevenue: 1.5,
        estimatedRedPartnerRevenue: 0,
        currency: 'USD',
      },
      40,
      true,
      'en-US',
    )

    expect(card.detail).toBe('RPM: $75.00')
    expect(`RPM: ${rpmHoverOf(last.day, 'USD', 'en-US').values[0]?.value}`).toBe(card.detail)
  })

  test('its scale runs from zero up to the highest RPM, over the days that have one', () => {
    expect(metricChartsOf(days, 'daily')?.rpm).toEqual({ top: 200 })
  })

  test('with a day below zero after a refund, its scale runs from the lowest RPM up', () => {
    const refunded = [earned('2026-09-01', 10, 10, 0, 3), earned('2026-09-02', 20, 20, 0, -1)]

    expect(metricChartsOf(refunded, 'daily')?.rpm).toEqual({ top: 300, bottom: -50 })
  })

  test('with no day carrying an RPM, its scale is zero', () => {
    const unseen = [earned('2026-09-01', 0, 3, 0, 0), earned('2026-09-02', 0, 1, 0, 0)]

    expect(metricChartsOf(unseen, 'daily')?.rpm).toEqual({ top: 0 })
  })

  test('is absent when the days carry no revenue, as the revenue chart is', () => {
    const charts = metricChartsOf([day('2026-09-01', 1, 2, 3), day('2026-09-02', 4, 5, 6)], 'daily')

    expect(charts?.rpm).toBeNull()
  })

  test('a day without revenue has no RPM', () => {
    expect(dayRpmOf(day('2026-09-01', 10, 20, 30))).toBeNull()
  })
})

// creator-analytics#357: with the RPM switch on, RPM counts only ads and YouTube Premium, over the
// same days and engaged views as with it off.
describe('the RPM chart with the RPM switch on', () => {
  function sourced(
    date: string,
    engagedViews: number,
    estimatedRevenue: number,
    estimatedAdRevenue: number,
    estimatedRedPartnerRevenue: number,
  ): ChannelDay {
    return {
      ...day(date, engagedViews, engagedViews, 0),
      estimatedRevenue,
      estimatedAdRevenue,
      estimatedRedPartnerRevenue,
    }
  }

  // Ads plus YouTube Premium: $8 of $20, $2 of $2 and $12 of $18.
  const sourcedDays = [
    sourced('2026-09-01', 1000, 20, 5, 3),
    sourced('2026-09-02', 0, 2, 1, 1),
    sourced('2026-09-03', 1000, 18, 10, 2),
  ]
  const on = { adsAndPremiumOnly: true }
  const off = { adsAndPremiumOnly: false }
  const rpmsOf = (mode: 'daily' | 'aggregate', options: { adsAndPremiumOnly: boolean }) =>
    metricChartsOf(sourcedDays, mode, options)?.points.map(({ day }) =>
      dayRpmOf(day, options.adsAndPremiumOnly),
    )

  test("daily, each point is that day's ads and YouTube Premium RPM, and zero engaged views have no point", () => {
    expect(rpmsOf('daily', on)).toEqual([8, null, 12])
    expect(rpmsOf('daily', off)).toEqual([20, null, 18])
  })

  // $22 of ads and YouTube Premium to date over 2,000 engaged views, against $40 in all.
  test('as a running total, each point is the ads and YouTube Premium RPM to date', () => {
    expect(rpmsOf('aggregate', on)).toEqual([8, 10, 11])
    expect(rpmsOf('aggregate', off)).toEqual([20, 22, 20])
  })

  test("as a running total, its last point equals the revenue card's RPM with the switch on", () => {
    const last = metricChartsOf(sourcedDays, 'aggregate', on)?.points.at(-1)
    if (!last) throw new Error('no last point')
    const total = {
      estimatedRevenue: 40,
      estimatedAdRevenue: 16,
      estimatedRedPartnerRevenue: 6,
      currency: 'USD',
    } as const
    const card = revenueCardOf(total, 2000, true, 'en-US', on)

    expect(card.detail).toBe('RPM: $11.00')
    expect(`RPM: ${rpmHoverOf(last.day, 'USD', 'en-US', on).values[0]?.value}`).toBe(card.detail)
  })

  test('its scale runs from zero up to the highest ads and YouTube Premium RPM', () => {
    expect(metricChartsOf(sourcedDays, 'daily', on)?.rpm).toEqual({ top: 12 })
    expect(metricChartsOf(sourcedDays, 'daily', off)?.rpm).toEqual({ top: 20 })
  })

  test("its hover card shows the day's ads and YouTube Premium RPM, and no value at zero engaged views", () => {
    const [first, second] = sourcedDays
    if (!first || !second) throw new Error('no days')

    expect(rpmHoverOf(first, 'USD', 'en-US', on).values).toEqual([{ label: 'RPM', value: '$8.00' }])
    expect(rpmHoverOf(first, 'USD', 'en-US', off).values).toEqual([
      { label: 'RPM', value: '$20.00' },
    ])
    expect(rpmHoverOf(second, 'USD', 'en-US', on).values).toEqual([{ label: 'RPM', value: '' }])
  })
})

describe("the charts' scale labels", () => {
  function labelsOf(
    days: (VideoDay | ChannelDay)[],
    currency: RevenueCurrency | undefined,
    locale: string,
  ) {
    const charts = metricChartsOf(days, 'daily')
    if (!charts) throw new Error('The days draw no chart.')
    return scaleLabelsOf(charts, currency, locale)
  }

  // 74,070 minutes is 1,234.5 watch hours. $12,345 over 12,345,678 engaged views is an RPM of
  // $0.99995, which rounds to $1.
  const large = [
    earned('2026-09-01', 12_345_678, 1_000, 74_070, 12_345),
    earned('2026-09-02', 1, 1, 0, 0),
  ]

  test('are compact at the top, with the revenue in its currency, and zero at the bottom', () => {
    expect(labelsOf(large, 'USD', 'en-US')).toEqual({
      engagedViews: { top: '12M', bottom: '0' },
      watchTime: { top: '1.2K', bottom: '0' },
      revenue: { top: '$12K', bottom: '0' },
      rpm: { top: '$1', bottom: '0' },
      impressions: null,
      ctr: null,
    })
  })

  test('are compact as another locale writes them', () => {
    expect(labelsOf(large, 'EUR', 'fr-FR')).toEqual({
      engagedViews: { top: '12\u00a0M', bottom: '0' },
      watchTime: { top: '1,2\u00a0k', bottom: '0' },
      revenue: { top: '12\u00a0k\u00a0€', bottom: '0' },
      rpm: { top: '1\u00a0€', bottom: '0' },
      impressions: null,
      ctr: null,
    })
  })

  test.each([
    ['ar-EG', '٠'],
    ['hi-IN-u-nu-deva', '०'],
  ])('write the zero at the bottom in the digits %s writes', (locale, zero) => {
    const labels = labelsOf(large, 'USD', locale)

    expect(labels.engagedViews.top).not.toMatch(/[0-9]/)
    expect([labels.engagedViews.bottom, labels.watchTime.bottom, labels.revenue?.bottom]).toEqual([
      zero,
      zero,
      zero,
    ])
  })

  test("show the revenue chart's lowest day below zero at its bottom, compact", () => {
    const refunded = [earned('2026-09-01', 1, 1, 0, 12_345), earned('2026-09-02', 1, 1, 0, -2_500)]

    expect(labelsOf(refunded, 'USD', 'en-US').revenue).toEqual({
      top: '$12K',
      bottom: '-$2.5K',
    })
  })

  test("show the RPM chart's lowest day below zero at its bottom, compact in the currency", () => {
    const refunded = [earned('2026-09-01', 10, 1, 0, 30), earned('2026-09-02', 100, 1, 0, -150)]

    expect(labelsOf(refunded, 'USD', 'en-US').rpm).toEqual({ top: '$3K', bottom: '-$1.5K' })
  })

  test('show the impressions compact and the CTR as a percentage, each from zero', () => {
    const held = [{ ...day('2026-09-01', 1, 1, 0), impressions: 12_345, ctr: 0.0625 }]

    expect([
      labelsOf(held, 'USD', 'en-US').impressions,
      labelsOf(held, 'USD', 'en-US').ctr,
    ]).toEqual([
      { top: '12K', bottom: '0' },
      { top: '6.3%', bottom: '0.0%' },
    ])
  })

  test('have no revenue chart without revenue on the days or without a currency', () => {
    const plain = [day('2026-09-01', 1, 1, 0)]

    expect(labelsOf(plain, 'USD', 'en-US').revenue).toBeNull()
    expect(labelsOf(large, undefined, 'en-US').revenue).toBeNull()
    expect(labelsOf(plain, 'USD', 'en-US').rpm).toBeNull()
    expect(labelsOf(large, undefined, 'en-US').rpm).toBeNull()
  })
})

describe("the watch hours, revenue and RPM charts' hover cards", () => {
  test('on a calendar day, the watch hours card shows the date and its watch hours', () => {
    expect(watchHoursHoverOf(day('2026-09-30', 0, 0, 1068), 'en-US')).toEqual({
      title: 'Sep 30, 2026',
      values: [{ label: 'Watch hours', value: '17.8' }],
    })
  })

  test('on a calendar day, the revenue card shows the date and its estimated revenue', () => {
    expect(revenueHoverOf(earned('2026-09-30', 0, 0, 0, 1.42), 'USD', 'en-US')).toEqual({
      title: 'Sep 30, 2026',
      values: [{ label: 'Estimated revenue', value: '$1.42' }],
    })
  })

  test("the revenue card shows the day's revenue in the answer's currency, as the locale writes it", () => {
    expect(revenueHoverOf(earned('2026-09-30', 0, 0, 0, 1.42), 'EUR', 'de-DE').values).toEqual([
      { label: 'Estimated revenue', value: '1,42\u00a0€' },
    ])
  })

  test("on a calendar day, the RPM card shows the date and that day's RPM in the answer's currency", () => {
    expect(rpmHoverOf(earned('2026-09-30', 400, 0, 0, 1.83), 'USD', 'en-US')).toEqual({
      title: 'Sep 30, 2026',
      values: [{ label: 'RPM', value: '$4.58' }],
    })
    expect(rpmHoverOf(earned('2026-09-30', 400, 0, 0, 1.83), 'EUR', 'de-DE').values).toEqual([
      { label: 'RPM', value: '4,58\u00a0€' },
    ])
  })

  test('on a day with zero engaged views, the RPM card shows no value, as the empty cell does', () => {
    expect(rpmHoverOf(earned('2026-09-30', 0, 3, 0, 0), 'USD', 'en-US')).toEqual({
      title: 'Sep 30, 2026',
      values: [{ label: 'RPM', value: '' }],
    })
  })

  test('in a window after publish, the watch hours card shows the day after publish', () => {
    expect(
      watchHoursHoverOf({ ...day('2026-09-03', 0, 0, 60), dayAfterPublish: 3 }, 'en-US').title,
    ).toBe('Day 3')
  })

  test("as a running total, each card reads its chart's point, the sum up to that day", () => {
    const [, second] = metricChartsOf(days, 'aggregate')?.points ?? []
    if (!second) throw new Error('no second point')

    expect(watchHoursHoverOf(second.day, 'en-US').values).toEqual([
      { label: 'Watch hours', value: '1.0' },
    ])
    expect(revenueHoverOf(second.day, 'USD', 'en-US').values).toEqual([
      { label: 'Estimated revenue', value: '$2.00' },
    ])
    expect(rpmHoverOf(second.day, 'USD', 'en-US').values).toEqual([
      { label: 'RPM', value: '$200.00' },
    ])
  })
})

describe('the charts the days draw, which are the cards that can choose one', () => {
  test('are all four, RPM after revenue, when the days carry revenue', () => {
    expect(chartsDrawnOf(days)).toEqual(['engagedViews', 'watchTime', 'revenue', 'rpm'])
  })

  test('leave out revenue and RPM when the days carry none', () => {
    expect(chartsDrawnOf([day('2026-09-01', 10, 20, 60)])).toEqual(['engagedViews', 'watchTime'])
  })

  test('are none with no day, even when the summary answered with revenue', () => {
    expect(chartsDrawnOf([])).toEqual([])
  })
})

describe('the impressions and CTR charts', () => {
  const held = (date: string, impressions: number, ctr: number | null): ChannelDay => ({
    ...day(date, 0, 0, 0),
    impressions,
    ctr,
  })
  const history = [
    day('2026-09-01', 10, 20, 60),
    held('2026-09-02', 100, 0.1),
    held('2026-09-03', 300, 0.02),
  ]

  test('daily, each scales to its highest day the history holds', () => {
    const charts = metricChartsOf(history, 'daily')

    expect([charts?.impressions, charts?.ctr]).toEqual([{ top: 300 }, { top: 0.1 }])
  })

  test('are absent when the days carry no stored history', () => {
    const charts = metricChartsOf([day('2026-09-01', 10, 20, 60)], 'daily')

    expect([charts?.impressions, charts?.ctr]).toEqual([null, null])
  })

  test('are drawn after the others when the days carry the stored history', () => {
    expect(chartsDrawnOf(history)).toEqual(['engagedViews', 'watchTime', 'impressions', 'ctr'])
  })

  test('show their numbers on the hover card, and the label alone on a day the history does not hold', () => {
    expect([
      impressionsHoverOf(history[1] as ChannelDay, 'en-US').values,
      ctrHoverOf(history[1] as ChannelDay, 'en-US').values,
      impressionsHoverOf(history[0] as ChannelDay, 'en-US').values,
    ]).toEqual([
      [{ label: 'Impressions', value: '100' }],
      [{ label: 'CTR', value: '10.0%' }],
      [{ label: 'Impressions', value: '' }],
    ])
  })
})

describe('the chart a screen too small to stack the charts shows', () => {
  test.each(['impressions', 'ctr'] as const)(
    'is engaged views when %s is chosen and the history charts do not show',
    (card) => {
      expect([chartShownOf(card, true, false), chartShownOf(card, false, true)]).toEqual([
        'engagedViews',
        card,
      ])
    },
  )

  test.each(['engagedViews', 'watchTime', 'revenue', 'rpm'] as const)(
    'is the chosen card %s when its chart shows',
    (card) => {
      expect(chartShownOf(card, true)).toBe(card)
    },
  )

  test('is engaged views when revenue is chosen and the revenue chart does not show', () => {
    expect(chartShownOf('revenue', false)).toBe('engagedViews')
  })

  test('is engaged views when RPM is chosen and the revenue chart does not show', () => {
    expect(chartShownOf('rpm', false)).toBe('engagedViews')
  })

  test('is watch hours when chosen and the revenue chart does not show', () => {
    expect(chartShownOf('watchTime', false)).toBe('watchTime')
  })
})

describe('the event a card choosing a chart sends', () => {
  test.each(['engagedViews', 'watchTime', 'revenue', 'rpm'] as const)(
    'choosing %s sends the metric only',
    (metric) => {
      expect(chartMetricChangedEvent(metric)).toEqual({ name: 'chart_metric_changed', metric })
    },
  )
})
