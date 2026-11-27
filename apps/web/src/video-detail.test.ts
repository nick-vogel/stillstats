// Limits: these tests cover the choices the detail screen makes, as pure functions. No test here
// renders the screen, so none shows the thumbnail, the empty box in its place when the video has
// no thumbnail or its thumbnail fails to load, the charts, the window control, the links, or the
// layout at 375 pixels wide. Nick checks those at /app in a real browser.
import type { VideoDetailAnswer } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import {
  detailCardCountOf,
  detailCurrencyNoteOf,
  detailDaysOf,
  detailTotalOf,
  headlineOf,
  videoDetailQueryOf,
  videoDetailViewOf,
  viewOfVideo,
  youtubeWatchUrlOf,
} from './video-detail.ts'

const answer: VideoDetailAnswer = {
  video: {
    id: 'dQw4w9WgXcQ',
    title: 'A video',
    thumbnailUrl: null,
    thumbnails: [],
    publishedAt: '2026-09-01T16:00:00Z',
    scheduled: false,
    durationSeconds: 270,
    format: 'video',
    privacy: 'public',
    embeddable: true,
    madeForKids: false,
  },
  window: 'first7',
  totals: {
    engagedViews: 1200,
    views: 1500,
    averageViewPercentage: 42.5,
    subscribersGained: 7,
    estimatedMinutesWatched: 738,
  },
  days: [],
  audienceRetention: [],
  trafficSources: [],
  subscriberSplit: {
    subscribed: { engagedViews: 300, views: 400 },
    unsubscribed: { engagedViews: 1200, views: 1500 },
  },
  sincePublish: { rows: [] },
  awaitingProcessing: false,
  lastProcessedDay: '2026-10-05',
  creationDay: '2019-02-28',
  fetchedAt: '2026-10-08T10:00:00Z',
  fromCache: false,
}

describe('the detail screen for the API answer', () => {
  test('shows the video', () => {
    expect(videoDetailViewOf(answer)).toEqual({ kind: 'detail', answer })
  })

  test('for a video that is not on the channel, shows the not-found message', () => {
    expect(videoDetailViewOf({ refusal: 'video_not_found' })).toEqual({
      kind: 'refused',
      message: 'This video is not on this channel.',
    })
  })
})

describe("the detail the screen shows for the address's video", () => {
  test("is never another video's, as on the first render after a step, before the next read starts", () => {
    const shown = { kind: 'detail', answer } as const

    expect(viewOfVideo(shown, 'another-video')).toBeNull()
    expect(viewOfVideo(shown, answer.video.id)).toBe(shown)
  })
})

describe('the query the detail is read with', () => {
  test('names the window', () => {
    expect(videoDetailQueryOf({ window: 'first7' }).toString()).toBe('window=first7')
  })

  test('a custom range names its start and end after the window', () => {
    const range = { from: '2026-09-01', to: '2026-09-30' }
    expect(videoDetailQueryOf({ window: 'custom', range }).toString()).toBe(
      'window=custom&from=2026-09-01&to=2026-09-30',
    )
  })
})

test('a custom range the API refuses for its bounds is a view of its own, so the screen falls back', () => {
  expect(videoDetailViewOf({ error: 'invalid_range' })).toEqual({ kind: 'invalid-range' })
})

test('the watch link opens the video on YouTube', () => {
  expect(youtubeWatchUrlOf('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
})

const videoRevenue = {
  estimatedRevenue: 12.5,
  estimatedAdRevenue: 9,
  estimatedRedPartnerRevenue: 1.5,
  currency: 'EUR',
} as const

const earningDay = {
  day: '2026-09-01',
  engagedViews: 1200,
  views: 1500,
  estimatedMinutesWatched: 738,
  estimatedRevenue: 12.5,
  estimatedAdRevenue: 9,
  estimatedRedPartnerRevenue: 1.5,
}
const earningDays = [earningDay]

describe("the detail screen's headline numbers", () => {
  test('are the engaged views card with its views and the watch hours card, then average viewed and subscribers gained as smaller figures', () => {
    expect(headlineOf(answer, 'en-US')).toEqual({
      cards: [
        {
          label: 'Engaged views',
          text: '1,200',
          detail: '1,500 views',
          ratio: {
            text: 'Views are 1.3× engaged views',
            spoken: 'Views are 1.3 times engaged views',
          },
          chart: 'engagedViews',
        },
        { label: 'Watch hours', text: '12.3', chart: 'watchTime' },
      ],
      figures: [
        { label: 'Average viewed', text: '42.5%' },
        { label: 'Subscribers gained', text: '7' },
      ],
    })
  })

  // creator-analytics#357: €9.00 from ads and €1.50 from YouTube Premium over 1,200 engaged views.
  test("with the RPM switch on, the revenue card's RPM counts only ads and YouTube Premium", () => {
    const earning = { ...answer, revenue: videoRevenue, days: earningDays }

    expect(headlineOf(earning, 'en-US', { adsAndPremiumOnly: true }).cards[2]).toEqual({
      label: 'Estimated revenue',
      text: '€12.50',
      detail: 'RPM: €8.75',
      chart: 'revenue',
      detailChart: 'rpm',
    })
    expect(headlineOf(earning, 'en-US', { adsAndPremiumOnly: false }).cards[2]?.detail).toBe(
      'RPM: €10.42',
    )
  })

  test("with revenue, add the channel's revenue card for the video, with its RPM, after watch hours", () => {
    expect(
      headlineOf({ ...answer, revenue: videoRevenue, days: earningDays }, 'en-US').cards,
    ).toEqual([
      {
        label: 'Engaged views',
        text: '1,200',
        detail: '1,500 views',
        ratio: {
          text: 'Views are 1.3× engaged views',
          spoken: 'Views are 1.3 times engaged views',
        },
        chart: 'engagedViews',
      },
      { label: 'Watch hours', text: '12.3', chart: 'watchTime' },
      {
        label: 'Estimated revenue',
        text: '€12.50',
        detail: 'RPM: €10.42',
        chart: 'revenue',
        detailChart: 'rpm',
      },
    ])
  })

  test('without revenue consent, the revenue card says so with a button that gives it', () => {
    expect(headlineOf({ ...answer, revenue: { refusal: 'consent_missing' } }).cards[2]).toEqual({
      label: 'Estimated revenue',
      text: 'Revenue needs your consent.',
      message: true,
      consentButton: 'Give revenue consent',
    })
  })

  test('when no day of the video carries revenue, the revenue card says YouTube reports none', () => {
    const days = [{ ...earningDay, estimatedRevenue: 0 }]

    expect(headlineOf({ ...answer, revenue: videoRevenue, days }).cards[2]).toEqual({
      label: 'Estimated revenue',
      text: 'YouTube reports no revenue for this date range. That can happen when no revenue was earned during the date range, or when the channel is not in the YouTube Partner Program.',
      message: true,
    })
  })

  test('for a channel outside the YouTube Partner Program, the revenue card says YouTube reports no revenue for it', () => {
    expect(headlineOf({ ...answer, revenue: { refusal: 'not_monetized' } }).cards[2]).toEqual({
      label: 'Estimated revenue',
      text: 'This channel is not in the YouTube Partner Program, so YouTube reports no revenue for it.',
      message: true,
    })
  })

  // creator-analytics#1048: the video's own impressions and CTR are the last of the headline cards.
  const searched = [
    { type: 'YT_SEARCH', engagedViews: 50, views: 60, impressions: 3000, ctr: 0.021 },
  ] as const
  const history = {
    impressions: 3100,
    ctr: 0.0216,
    firstDay: '2026-09-10',
    newestDay: '2026-10-04',
  }

  test("with a paid channel's history, end with the impressions and CTR cards after revenue, neither choosing a chart", () => {
    const paid = {
      ...answer,
      revenue: videoRevenue,
      days: earningDays,
      trafficSources: [...searched],
    }

    expect(headlineOf({ ...paid, history }, 'en-US').cards.slice(2)).toEqual([
      expect.objectContaining({ label: 'Estimated revenue' }),
      { label: 'Impressions', text: '3,100' },
      { label: 'Impressions click-through rate', text: '2.2%' },
    ])
  })

  test('the impressions and CTR cards show exactly with the history and a traffic source', () => {
    const labelsOf = (shown: Pick<VideoDetailAnswer, 'history' | 'trafficSources'>) =>
      headlineOf({ ...answer, ...shown }).cards.map(({ label }) => label)
    const headline = ['Engaged views', 'Watch hours']
    const reach = ['Impressions', 'Impressions click-through rate']

    expect(labelsOf({ history, trafficSources: [...searched] })).toEqual([...headline, ...reach])
    expect(labelsOf({ history, trafficSources: [] })).toEqual(headline)
    expect(labelsOf({ trafficSources: [...searched] })).toEqual(headline)
  })
})

describe("the cards the detail's placeholder holds", () => {
  test('are three for a video the page knows nothing of, the revenue card included', () => {
    expect(detailCardCountOf(undefined, { window: 'last28' })).toBe(3)
  })

  test('are two for a video with no publish day, in a calendar window and in a window after publish, as its answer carries no revenue', () => {
    const known = { publishedAt: null, lastProcessedDay: '2026-10-03' }

    expect(detailCardCountOf(known, { window: 'last28' })).toBe(2)
    expect(detailCardCountOf(known, { window: 'first7' })).toBe(2)
  })

  test("are two for a custom range that ends the day before the video's publish day, and three for one that ends on it", () => {
    // 15:00 UTC is 08:00 in Los Angeles, so the publish day is Sep 10 there too.
    const known = { publishedAt: '2026-09-10T15:00:00Z', lastProcessedDay: '2026-10-03' }

    expect(
      detailCardCountOf(known, {
        window: 'custom',
        range: { from: '2026-08-01', to: '2026-09-09' },
      }),
    ).toBe(2)
    expect(
      detailCardCountOf(known, {
        window: 'custom',
        range: { from: '2026-08-01', to: '2026-09-10' },
      }),
    ).toBe(3)
  })

  test('read the publish day in Los Angeles, as the API does, not in UTC', () => {
    // 03:00 UTC on Sep 10 is 20:00 on Sep 9 in Los Angeles, so a range ending Sep 9 holds that day.
    const known = { publishedAt: '2026-09-10T03:00:00Z', lastProcessedDay: '2026-10-03' }

    expect(
      detailCardCountOf(known, {
        window: 'custom',
        range: { from: '2026-08-01', to: '2026-09-09' },
      }),
    ).toBe(3)
  })

  test('are three for a published video in a calendar window and in a window after publish', () => {
    const known = { publishedAt: '2026-09-10T15:00:00Z', lastProcessedDay: '2026-10-03' }

    expect(detailCardCountOf(known, { window: 'last28' })).toBe(3)
    expect(detailCardCountOf(known, { window: 'first7' })).toBe(3)
  })
})

describe("the note under the detail's cards on the currency", () => {
  test('shows when the revenue answered and a day of the video earned some', () => {
    expect(detailCurrencyNoteOf({ ...answer, revenue: videoRevenue, days: earningDays })).toBe(
      'YouTube converts revenue at its daily exchange rate. Your final amount is in AdSense.',
    )
  })

  test.each([
    ['without revenue', answer],
    ['with a revenue refusal', { ...answer, revenue: { refusal: 'consent_missing' } } as const],
    [
      'when no day of the video carries revenue',
      { ...answer, revenue: videoRevenue, days: [{ ...earningDay, estimatedRevenue: 0 }] },
    ],
  ])('shows none %s', (_, body) => {
    expect(detailCurrencyNoteOf(body)).toBeNull()
  })
})

describe("the total the detail's numbers table ends on", () => {
  test("is YouTube's own totals for the video", () => {
    expect(detailTotalOf(answer)).toEqual(answer.totals)
  })

  test('with revenue a day of the video earned, adds the three revenue numbers and their currency', () => {
    expect(detailTotalOf({ ...answer, revenue: videoRevenue, days: earningDays })).toEqual({
      ...answer.totals,
      ...videoRevenue,
    })
  })

  test('with a revenue refusal, carries no revenue', () => {
    expect(detailTotalOf({ ...answer, revenue: { refusal: 'not_monetized' } })).toEqual(
      answer.totals,
    )
  })

  test('when no day of the video carries revenue, carries no revenue', () => {
    const days = [{ ...earningDay, estimatedRevenue: 0 }]

    expect(detailTotalOf({ ...answer, revenue: videoRevenue, days })).toEqual(answer.totals)
  })
})

describe("the days the detail's charts and numbers table draw", () => {
  test('carry the revenue when a day of the video carries revenue', () => {
    expect(detailDaysOf({ ...answer, revenue: videoRevenue, days: earningDays })).toEqual(
      earningDays,
    )
  })

  test('carry no revenue when no day of the video carries revenue', () => {
    const days = [
      { ...earningDay, estimatedRevenue: 0, estimatedAdRevenue: 0, estimatedRedPartnerRevenue: 0 },
    ]

    expect(detailDaysOf({ ...answer, revenue: videoRevenue, days })).toEqual([
      { day: '2026-09-01', engagedViews: 1200, views: 1500, estimatedMinutesWatched: 738 },
    ])
  })
})
