// Pre-PR review 1 of creator-analytics#64, findings 1 and 2. Each test states the correct
// behaviour, so it is red until the finding is fixed.
import type { ChannelDay } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { revenueCardOf } from '../../../../apps/web/src/cards.ts'
import { summaryViewOf } from '../../../../apps/web/src/channel-summary.ts'
import { chartsDrawnOf, metricChartsOf } from '../../../../apps/web/src/metric-charts.ts'
import { defaultViewsSort, viewsTableOf } from '../../../../apps/web/src/numbers-table.ts'
import { listRouteOf } from '../../../../apps/web/src/route.ts'
import { listRouteFor } from '../../../../apps/web/src/video-list.ts'

function zeroRevenueDay(day: string): ChannelDay {
  return {
    day,
    engagedViews: 10,
    views: 20,
    estimatedMinutesWatched: 60,
    estimatedRevenue: 0,
    estimatedAdRevenue: 0,
    estimatedRedPartnerRevenue: 0,
  }
}

const days = [zeroRevenueDay('2026-09-01'), zeroRevenueDay('2026-09-02')]

describe('finding 1: Google answers zeros for a channel outside the Partner Program', () => {
  test('the revenue card says there is no revenue (holds today)', () => {
    const card = revenueCardOf(
      {
        estimatedRevenue: 0,
        estimatedAdRevenue: 0,
        estimatedRedPartnerRevenue: 0,
        currency: 'USD',
      },
      20,
      days,
      'en-US',
    )
    expect(card.message).toBe(true)
  })

  const view = summaryViewOf(
    {
      window: 'last28',
      format: 'all',
      engagedViews: 20,
      views: 40,
      estimatedMinutesWatched: 120,
      revenue: {
        estimatedRevenue: 0,
        estimatedAdRevenue: 0,
        estimatedRedPartnerRevenue: 0,
        noFormatRevenue: 0,
        everyFormatRevenue: 0,
        currency: 'USD',
      },
      daily: days,
      lastProcessedDay: '2026-09-02',
      fetchedAt: '2026-09-03T00:00:00.000Z',
      fromCache: false,
    },
    'en-US',
  )
  if (view.kind !== 'figures') throw new Error(view.message)

  test('so no revenue chart is drawn', () => {
    expect(metricChartsOf(view.daily, 'daily')?.revenue).toBeNull()
    expect(chartsDrawnOf(view.daily)).not.toContain('revenue')
  })

  test('so the numbers table shows no revenue column', () => {
    const table = viewsTableOf(view.daily, 'daily', view.total, defaultViewsSort, 'en-US')
    expect(table.columns).not.toContain('estimatedRevenue')
  })
})

describe('finding 2: a sort by a column that is switched off', () => {
  test('a watch hours sort from the address with the Watch hours column off reads newest first', () => {
    const route = listRouteOf('?sort=-estimatedMinutesWatched&page=2')
    expect(listRouteFor(route, { views: false, watchTime: false, revenue: true }, false).sort).toBe(
      '-publishedAt',
    )
  })
})
