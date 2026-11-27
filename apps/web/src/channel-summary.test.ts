import type { ChannelSummaryAnswer } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  summaryQueryOf,
  summaryRequestOf,
  summaryShownFor,
  summaryViewOf,
} from './channel-summary.ts'
import { listRouteOf } from './route.ts'

const answer: ChannelSummaryAnswer = {
  window: 'lifetime',
  format: 'all',
  engagedViews: 1200,
  views: 34000,
  estimatedMinutesWatched: 74_070,
  revenue: { refusal: 'consent_missing' },
  daily: [],
  uploads: [],
  lastProcessedDay: '2026-10-04',
  creationDay: '2019-02-28',
  fetchedAt: '2026-10-07T19:00:00.000Z',
  fromCache: false,
}

describe('when the channel summary shows', () => {
  test.each(['lifetime', 'last7', 'last28', 'last90', 'last365'] as const)(
    'the %s window shows the summary',
    (window) => {
      expect(summaryShownFor(window)).toBe(true)
    },
  )

  test.each(['first1', 'first7', 'first28', 'first90', 'first365'] as const)(
    'the %s window hides the summary, since a channel has no publish day',
    (window) => {
      expect(summaryShownFor(window)).toBe(false)
    },
  )
})

const revenue = {
  estimatedRevenue: 1234.5,
  estimatedAdRevenue: 1000,
  estimatedRedPartnerRevenue: 100,
  noFormatRevenue: 5.4,
  everyFormatRevenue: 1234.5,
  currency: 'USD',
} as const

// A day that carries revenue, as every day of an answer whose revenue answered does.
const earningDay = {
  day: '2026-10-04',
  engagedViews: 3,
  views: 5,
  estimatedMinutesWatched: 9,
  estimatedRevenue: 1.5,
  estimatedAdRevenue: 1,
  estimatedRedPartnerRevenue: 0.25,
}
const earningDaily = [earningDay]

describe("what the channel summary shows for the API's answer", () => {
  test('a channel without revenue consent shows the engaged views card with its views, the watch hours card, and the revenue card asking for consent', () => {
    expect(summaryViewOf(answer, 'en-US')).toEqual({
      kind: 'figures',
      cards: [
        {
          label: 'Engaged views',
          text: '1,200',
          detail: '34,000 views',
          ratio: {
            text: 'Views are 28.3× engaged views',
            spoken: 'Views are 28.3 times engaged views',
          },
          chart: 'engagedViews',
        },
        { label: 'Watch hours', text: '1,234.5', chart: 'watchTime' },
        {
          label: 'Estimated revenue',
          text: 'Revenue needs your consent.',
          message: true,
          consentButton: 'Give revenue consent',
        },
      ],
      noFormatNote: null,
      currencyNote: null,
      historyNote: null,
      purgeNote: null,
      daily: [],
      total: { engagedViews: 1200, views: 34000, estimatedMinutesWatched: 74_070 },
      lastProcessedDay: '2026-10-04',
      uploads: [],
    })
  })

  // creator-analytics#357: $1,000 from ads and $100 from YouTube Premium over 1,200 engaged views.
  test("with the RPM switch on, the revenue card's RPM counts only ads and YouTube Premium", () => {
    const body = { ...answer, revenue, daily: earningDaily }
    const revenueCardIn = (view: ReturnType<typeof summaryViewOf>) =>
      view.kind === 'figures' ? view.cards[2] : undefined

    expect(revenueCardIn(summaryViewOf(body, 'en-US', { adsAndPremiumOnly: true }))).toEqual({
      label: 'Estimated revenue',
      text: '$1,234.50',
      detail: 'RPM: $916.67',
      chart: 'revenue',
      detailChart: 'rpm',
    })
    expect(revenueCardIn(summaryViewOf(body, 'en-US', { adsAndPremiumOnly: false }))?.detail).toBe(
      'RPM: $1,028.75',
    )
  })

  test('a channel with revenue shows the estimated revenue card in USD with its RPM, the note on the revenue tied to no format, and the revenue totals for the numbers table', () => {
    expect(summaryViewOf({ ...answer, revenue, daily: earningDaily }, 'en-US')).toEqual({
      kind: 'figures',
      cards: [
        {
          label: 'Engaged views',
          text: '1,200',
          detail: '34,000 views',
          ratio: {
            text: 'Views are 28.3× engaged views',
            spoken: 'Views are 28.3 times engaged views',
          },
          chart: 'engagedViews',
        },
        { label: 'Watch hours', text: '1,234.5', chart: 'watchTime' },
        {
          label: 'Estimated revenue',
          text: '$1,234.50',
          detail: 'RPM: $1,028.75',
          chart: 'revenue',
          detailChart: 'rpm',
        },
      ],
      noFormatNote: "YouTube ties $5.40 of this channel's revenue to no video or format.",
      currencyNote:
        'YouTube converts revenue at its daily exchange rate. Your final amount is in AdSense.',
      historyNote: null,
      purgeNote: null,
      daily: earningDaily,
      total: {
        engagedViews: 1200,
        views: 34000,
        estimatedMinutesWatched: 74_070,
        estimatedRevenue: 1234.5,
        estimatedAdRevenue: 1000,
        estimatedRedPartnerRevenue: 100,
        currency: 'USD',
      },
      lastProcessedDay: '2026-10-04',
      uploads: [],
    })
  })

  test("a channel with revenue in another currency shows the card, the note on the revenue tied to no format and the numbers table's total in the answer's currency", () => {
    const view = summaryViewOf(
      { ...answer, revenue: { ...revenue, currency: 'EUR' }, daily: earningDaily },
      'de-DE',
    )

    expect(view).toMatchObject({
      cards: [{}, {}, { text: '1.234,50 €' }],
      noFormatNote: "YouTube ties 5,40\u00a0€ of this channel's revenue to no video or format.",
      total: { estimatedRevenue: 1234.5, currency: 'EUR' },
    })
  })

  test('a channel whose days carry no revenue shows that YouTube reports none in place of $0.00', () => {
    const view = summaryViewOf(
      {
        ...answer,
        revenue: { ...revenue, estimatedRevenue: 0, estimatedAdRevenue: 0 },
        daily: [{ ...earningDay, estimatedRevenue: 0 }],
      },
      'en-US',
    )

    expect(view).toMatchObject({
      cards: [
        {},
        {},
        {
          text: 'YouTube reports no revenue for this date range. That can happen when no revenue was earned during the date range, or when the channel is not in the YouTube Partner Program.',
          message: true,
        },
      ],
    })
  })

  test('a channel whose days carry no revenue draws no revenue chart and shows no revenue in the numbers table or the notes', () => {
    const zeroDay = {
      ...earningDay,
      estimatedRevenue: 0,
      estimatedAdRevenue: 0,
      estimatedRedPartnerRevenue: 0,
    }
    const view = summaryViewOf(
      {
        ...answer,
        revenue: {
          ...revenue,
          estimatedRevenue: 0,
          estimatedAdRevenue: 0,
          estimatedRedPartnerRevenue: 0,
          noFormatRevenue: 0,
          everyFormatRevenue: 0,
        },
        daily: [zeroDay],
      },
      'en-US',
    )

    if (view.kind !== 'figures') throw new Error(view.kind)
    expect(view.noFormatNote).toBeNull()
    expect(view.currencyNote).toBeNull()
    expect(view.daily).toEqual([
      { day: '2026-10-04', engagedViews: 3, views: 5, estimatedMinutesWatched: 9 },
    ])
    expect(view.total).toEqual({
      engagedViews: 1200,
      views: 34000,
      estimatedMinutesWatched: 74_070,
    })
  })

  test("one format of a channel YouTube reports no revenue for in any format shows that YouTube reports none in place of $0.00, as the format's days cannot say so", () => {
    const view = summaryViewOf(
      {
        ...answer,
        format: 'live',
        revenue: { ...revenue, estimatedRevenue: 0, estimatedAdRevenue: 0, everyFormatRevenue: 0 },
        daily: [{ ...earningDay, estimatedRevenue: 0 }],
      },
      'en-US',
    )

    expect(view).toMatchObject({
      cards: [
        {},
        {},
        {
          text: 'YouTube reports no revenue for this date range. That can happen when no revenue was earned during the date range, or when the channel is not in the YouTube Partner Program.',
          message: true,
        },
      ],
    })
  })

  test('one format of a channel YouTube reports no revenue for in any format draws no revenue chart and shows no revenue in the numbers table or the notes', () => {
    const view = summaryViewOf(
      {
        ...answer,
        format: 'short',
        revenue: {
          ...revenue,
          estimatedRevenue: 0,
          estimatedAdRevenue: 0,
          estimatedRedPartnerRevenue: 0,
          noFormatRevenue: 0,
          everyFormatRevenue: 0,
        },
        daily: [
          {
            ...earningDay,
            estimatedRevenue: 0,
            estimatedAdRevenue: 0,
            estimatedRedPartnerRevenue: 0,
          },
        ],
      },
      'en-US',
    )

    if (view.kind !== 'figures') throw new Error(view.kind)
    expect(view.noFormatNote).toBeNull()
    expect(view.currencyNote).toBeNull()
    expect(view.daily).toEqual([
      { day: '2026-10-04', engagedViews: 3, views: 5, estimatedMinutesWatched: 9 },
    ])
    expect(view.total).toEqual({
      engagedViews: 1200,
      views: 34000,
      estimatedMinutesWatched: 74_070,
    })
  })

  test('one format whose days carry no revenue shows its amount when the channel has revenue in another format, since it can be in the YouTube Partner Program', () => {
    const view = summaryViewOf(
      {
        ...answer,
        format: 'live',
        revenue: { ...revenue, estimatedRevenue: 0, estimatedAdRevenue: 0 },
        daily: [{ ...earningDay, estimatedRevenue: 0 }],
      },
      'en-US',
    )

    expect(view).toMatchObject({ cards: [{}, {}, { text: '$0.00', chart: 'revenue' }] })
  })

  test('one format whose days carry no revenue draws its zeros when the channel has revenue in another format', () => {
    const daily = [{ ...earningDay, estimatedRevenue: 0 }]
    const view = summaryViewOf(
      {
        ...answer,
        format: 'live',
        revenue: { ...revenue, estimatedRevenue: 0, estimatedAdRevenue: 0 },
        daily,
      },
      'en-US',
    )

    expect(view).toMatchObject({ daily, total: { estimatedRevenue: 0, currency: 'USD' } })
  })

  test('a channel outside the YouTube Partner Program shows no note on the currency', () => {
    expect(
      summaryViewOf({ ...answer, revenue: { refusal: 'not_monetized' } }, 'en-US'),
    ).toMatchObject({ kind: 'figures', currencyNote: null })
  })

  test("carries the channel's days for the charts", () => {
    const daily = [{ day: '2026-10-04', engagedViews: 3, views: 5, estimatedMinutesWatched: 9 }]

    expect(summaryViewOf({ ...answer, daily })).toMatchObject({ kind: 'figures', daily })
  })

  test("carries the answer's own totals for the numbers table, not a sum of its days", () => {
    // The days add up to 3 engaged views, 5 views and 9 minutes; the answer's totals are YouTube's
    // own.
    const daily = [{ day: '2026-10-04', engagedViews: 3, views: 5, estimatedMinutesWatched: 9 }]

    expect(summaryViewOf({ ...answer, daily })).toMatchObject({
      kind: 'figures',
      total: { engagedViews: 1200, views: 34000, estimatedMinutesWatched: 74_070 },
    })
  })

  test('carries the last processed day, for the note under the chart', () => {
    expect(summaryViewOf({ ...answer, lastProcessedDay: '2026-10-02' })).toMatchObject({
      kind: 'figures',
      lastProcessedDay: '2026-10-02',
    })
  })

  test('a refusal shows its text and no figure', () => {
    expect(summaryViewOf({ refusal: 'quota_reserved' })).toEqual({
      kind: 'refused',
      message: 'The product has used its YouTube quota for today. Try again tomorrow.',
    })
  })

  test('a custom range the API refuses for its bounds is a view of its own, so the screen falls back', () => {
    expect(summaryViewOf({ error: 'invalid_range' })).toEqual({ kind: 'invalid-range' })
  })

  test('an error with no text of its own names the summary and the code', () => {
    expect(summaryViewOf({ error: 'internal' })).toEqual({
      kind: 'refused',
      message: 'Reading the channel summary failed: internal',
    })
  })
})

describe("a paid channel's stored history in the summary view", () => {
  const daily = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map((day, i) => ({
    day,
    engagedViews: 0,
    views: 0,
    estimatedMinutesWatched: 0,
    ...(i < 2 ? {} : { impressions: 250, ctr: 0.042 }),
  }))
  const history = { impressions: 500, ctr: 0.042, firstDay: '2026-10-03', newestDay: '2026-10-04' }

  test('a paid channel shows the impressions and CTR cards after the others, each labelled with the days the history holds when the range starts before it, and the history totals for the numbers table', () => {
    const view = summaryViewOf({ ...answer, daily, history }, 'en-US')

    expect(view).toMatchObject({
      kind: 'figures',
      historyNote: expect.stringContaining('October 3, 2026'),
      total: { impressions: 500, ctr: 0.042 },
    })
    expect(view.kind === 'figures' && view.cards.slice(3)).toEqual([
      { label: 'Impressions', text: '500', detail: '2 of 4 days', chart: 'impressions' },
      {
        label: 'Impressions click-through rate',
        text: '4.2%',
        detail: '2 of 4 days',
        chart: 'ctr',
      },
    ])
  })

  test('a range the history holds no day of, before its start or after its newest day, shows a sentence saying so on the impressions and CTR cards in place of a number', () => {
    const unheld = daily.slice(0, 2)
    const noneHeld = { impressions: 0, ctr: null }
    const cardsOf = (firstDay: string, newestDay: string) => {
      const view = summaryViewOf(
        { ...answer, daily: unheld, history: { ...noneHeld, firstDay, newestDay } },
        'en-US',
      )
      return view.kind === 'figures' && view.cards.slice(3)
    }
    const sentences = [
      { label: 'Impressions', text: 'No stored history in this range', message: true },
      {
        label: 'Impressions click-through rate',
        text: 'No stored history in this range',
        message: true,
      },
    ]

    expect([cardsOf('2026-10-03', '2026-10-04'), cardsOf('2026-09-01', '2026-09-30')]).toEqual([
      sentences,
      sentences,
    ])
  })

  test("an ended channel shows its history's cards and its note, and the note on its purge date (creator-analytics#787)", () => {
    const view = summaryViewOf(
      { ...answer, daily, history: { ...history, purgeDate: '2026-12-17' } },
      'en-US',
    )

    expect(view).toMatchObject({
      kind: 'figures',
      historyNote: expect.stringContaining('October 3, 2026'),
      purgeNote: 'Your subscription has ended. This history is deleted on December 17, 2026.',
    })
    expect(view.kind === 'figures' && view.cards.slice(3).map(({ label }) => label)).toEqual([
      'Impressions',
      'Impressions click-through rate',
    ])
  })

  test("a paid channel's history, which carries no purge date, has no note on one", () => {
    expect(summaryViewOf({ ...answer, daily, history }, 'en-US')).toMatchObject({
      purgeNote: null,
    })
  })

  test('a free channel, whose answer carries no history, shows no impressions or CTR card and no note on the history', () => {
    const view = summaryViewOf({ ...answer, daily }, 'en-US')

    expect(view).toMatchObject({ kind: 'figures', historyNote: null })
    expect(view.kind === 'figures' && view.cards.map(({ label }) => label)).toEqual([
      'Engaged views',
      'Watch hours',
      'Estimated revenue',
    ])
  })
})

describe('the query the channel summary is read with', () => {
  test('every format and public uploads leave the format and the visibility out, as the API reads them by default', () => {
    expect(
      summaryQueryOf({ window: 'last28', format: 'all', visibility: 'public' }).toString(),
    ).toBe('window=last28')
  })

  test('a custom range names its start and end after the window', () => {
    const range = { from: '2026-09-01', to: '2026-09-30' }
    expect(
      summaryQueryOf({ window: 'custom', range, format: 'short', visibility: 'public' }).toString(),
    ).toBe('window=custom&from=2026-09-01&to=2026-09-30&format=short')
  })

  test.each(['video', 'short', 'live'] as const)('the %s format names the format', (format) => {
    expect(
      Object.fromEntries(summaryQueryOf({ window: 'lifetime', format, visibility: 'public' })),
    ).toEqual({ window: 'lifetime', format })
  })

  test('every visibility names the visibility, so the uploads take unlisted and private ones too', () => {
    expect(
      Object.fromEntries(summaryQueryOf({ window: 'last7', format: 'short', visibility: 'all' })),
    ).toEqual({ window: 'last7', format: 'short', visibility: 'all' })
  })
})

describe('the summary a route reads', () => {
  test.each(['public', 'all'] as const)(
    'it carries the visibility in force, %s, beside the window and the format',
    (visibility) => {
      expect(summaryRequestOf(listRouteOf('?window=last7&format=short'), visibility)).toEqual({
        window: 'last7',
        format: 'short',
        visibility,
      })
    },
  )

  test('a custom range carries its range and the visibility', () => {
    expect(
      summaryRequestOf(listRouteOf('?window=custom&from=2026-09-01&to=2026-09-30'), 'all'),
    ).toEqual({
      window: 'custom',
      range: { from: '2026-09-01', to: '2026-09-30' },
      format: 'all',
      visibility: 'all',
    })
  })

  test('a window after publish reads no summary', () => {
    expect(summaryRequestOf(listRouteOf('?window=first7'), 'all')).toBeNull()
  })
})

describe("the summary view's uploads", () => {
  test("the view carries the answer's uploads, in the answer's order", () => {
    const uploads = [
      { id: 'vid-2', title: 'A Short', publishDay: '2026-10-03', format: 'short' },
      { id: 'vid-1', title: 'A video', publishDay: '2026-10-01', format: null },
    ] as const satisfies ChannelSummaryAnswer['uploads']

    const view = summaryViewOf({ ...answer, uploads: [...uploads] }, 'en-US')

    expect(view).toMatchObject({ kind: 'figures', uploads })
  })
})
