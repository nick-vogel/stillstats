// Limits: these tests cover the views chart's days and scale, its running total, its axis labels
// and its hover card's text, as pure functions. Its numbers table is tested in
// numbers-table.test.ts, its keys in chart-slider.test.ts, and the lines TanStack Charts draws in
// metric-plot.test.ts. No test here draws the chart, so none shows how the two lines look over each
// other, the card over them, the layout at 375 pixels wide, or what a screen reader reads from the
// toggle. The browser walk (apps/site/test/screenshot/browser-walk.ts, `pnpm test:browser`) drives
// the chart in Chrome; Nick checks its look at /app.
import type { ChannelDay, VideoDay } from '@creator-analytics/api-types'
import { describe, expect, onTestFinished, test, vi } from 'vitest'
import {
  axisCountTextOf,
  axisLabelOf,
  chartModeChangedEvent,
  runningTotalOf,
  viewsCardOf,
  viewsChartOf,
} from './views-chart.ts'

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

const days = [day('2026-09-01', 10, 20), day('2026-09-02', 0, 0), day('2026-09-03', 30, 40)]

describe('the running total', () => {
  test('sums impressions over the days the history holds, gives each the channel CTR of every held day to it, and leaves a day before the history without either', () => {
    const channelDay = (date: string, held?: Partial<ChannelDay>): ChannelDay => ({
      day: date,
      engagedViews: 0,
      views: 0,
      estimatedMinutesWatched: 0,
      ...held,
    })
    const running = runningTotalOf([
      channelDay('2026-10-01'),
      channelDay('2026-10-02', { impressions: 100, ctr: 0.1 }),
      channelDay('2026-10-03', { impressions: 0, ctr: null }),
      channelDay('2026-10-04', { impressions: 300, ctr: 0.02 }),
    ])

    // (100 x 0.1 + 300 x 0.02) / 400, never 0.1 + 0.02.
    expect(running.map(({ impressions, ctr }) => ({ impressions, ctr }))).toEqual([
      { impressions: undefined, ctr: undefined },
      { impressions: 100, ctr: 0.1 },
      { impressions: 100, ctr: 0.1 },
      { impressions: 400, ctr: 0.04 },
    ])
  })

  test('adds each day to the days before it', () => {
    expect(runningTotalOf(days)).toEqual([
      day('2026-09-01', 10, 20),
      day('2026-09-02', 10, 20),
      day('2026-09-03', 40, 60),
    ])
  })

  test("adds each day's watch time to the days before it too", () => {
    const watched = [
      { ...day('2026-09-01', 1, 2), estimatedMinutesWatched: 30 },
      { ...day('2026-09-02', 0, 0), estimatedMinutesWatched: 0 },
      { ...day('2026-09-03', 3, 4), estimatedMinutesWatched: 45 },
    ]

    expect(runningTotalOf(watched).map((day) => day.estimatedMinutesWatched)).toEqual([30, 30, 75])
  })

  test('keeps each day and its day after publish', () => {
    expect(runningTotalOf([day('2026-09-01', 1, 2, 1), day('2026-09-02', 3, 4, 2)])).toEqual([
      day('2026-09-01', 1, 2, 1),
      day('2026-09-02', 4, 6, 2),
    ])
  })
})

describe('the running total with revenue', () => {
  const earned = (date: string, revenue: number, ads: number, premium: number) => ({
    day: date,
    engagedViews: 0,
    views: 0,
    estimatedMinutesWatched: 0,
    estimatedRevenue: revenue,
    estimatedAdRevenue: ads,
    estimatedRedPartnerRevenue: premium,
  })

  test("adds each day's revenue and its sources to the days before it", () => {
    expect(
      runningTotalOf([earned('2026-09-01', 2, 1, 0.5), earned('2026-09-02', 3, 2, 0.25)]),
    ).toEqual([earned('2026-09-01', 2, 1, 0.5), earned('2026-09-02', 5, 3, 0.75)])
  })

  test('adds no revenue to days that carry none', () => {
    expect(runningTotalOf(days)[0]).not.toHaveProperty('estimatedRevenue')
  })
})

describe('the views chart', () => {
  test('holds every day, both lines on one scale, its top the highest of either', () => {
    expect(viewsChartOf(days, 'daily')).toEqual({
      top: 40,
      points: [
        { day: day('2026-09-01', 10, 20) },
        { day: day('2026-09-02', 0, 0) },
        { day: day('2026-09-03', 30, 40) },
      ],
    })
  })

  test('in running total mode, holds the running total, its top the total at the last day', () => {
    expect(viewsChartOf(days, 'aggregate')).toEqual({
      top: 60,
      points: [
        { day: day('2026-09-01', 10, 20) },
        { day: day('2026-09-02', 10, 20) },
        { day: day('2026-09-03', 40, 60) },
      ],
    })
  })

  test('with engaged views above views on a day, raises its top to the engaged views', () => {
    expect(viewsChartOf([day('2026-09-01', 8, 4), day('2026-09-02', 0, 2)], 'daily')?.top).toBe(8)
  })

  test('is absent with no day', () => {
    expect(viewsChartOf([], 'daily')).toBeNull()
  })
})

describe('the x axis of the views chart', () => {
  test('in a lifetime or calendar window, labels a day with its date', () => {
    expect(axisLabelOf(day('2026-09-03', 0, 0), 'en-US')).toBe('Sep 3, 2026')
  })

  test('labels the Pacific day as written, even on a screen west of UTC', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    onTestFinished(() => {
      vi.unstubAllEnvs()
    })

    expect(axisLabelOf(day('2026-01-01', 0, 0), 'en-US')).toBe('Jan 1, 2026')
  })

  test('in a window after publish, labels a day with its day after publish', () => {
    expect(axisLabelOf(day('2026-09-03', 0, 0, 3), 'en-US')).toBe('Day 3')
  })
})

describe("the views chart's hover card", () => {
  test("on a calendar day, shows the date, the day's engaged views and its views", () => {
    expect(viewsCardOf(day('2026-09-30', 352, 701), 'en-US')).toEqual({
      title: 'Sep 30, 2026',
      values: [
        { label: 'Engaged views', value: '352' },
        { label: 'Views', value: '701' },
      ],
    })
  })

  test('in a window after publish, shows the day after publish', () => {
    expect(viewsCardOf(day('2026-09-03', 1, 2, 3), 'en-US').title).toBe('Day 3')
  })

  test('writes its counts with the thousands grouped, as the locale writes them', () => {
    expect(viewsCardOf(day('2026-09-02', 1205, 3406), 'en-US').values).toEqual([
      { label: 'Engaged views', value: '1,205' },
      { label: 'Views', value: '3,406' },
    ])
  })
})

describe('a count as a chart axis label', () => {
  test('is compact, as the locale writes it', () => {
    expect([axisCountTextOf(12_345_678, 'en-US'), axisCountTextOf(12_345_678, 'fr-FR')]).toEqual([
      '12M',
      '12\u00a0M',
    ])
  })

  test('stays whole below a thousand, and at zero', () => {
    expect([axisCountTextOf(999, 'en-US'), axisCountTextOf(0, 'en-US')]).toEqual(['999', '0'])
  })
})

describe('the event a chart mode change sends', () => {
  test.each(['daily', 'aggregate'] as const)('a change to %s sends the mode only', (mode) => {
    expect(chartModeChangedEvent(mode)).toEqual({ name: 'views_chart_mode_changed', mode })
  })
})
