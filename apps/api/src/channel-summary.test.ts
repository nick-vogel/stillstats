// Limits: these tests read from the fake Google server, so they cannot prove Google's real channel
// totals, which days its daily series leaves out, how late its last processed day runs or its real
// quota accounting. Nick reading his own channel's summary on the deployed product covers those.
import type { ChannelSummaryAnswer } from '@creator-analytics/api-types'
import {
  connections,
  deletionRequests,
  quotaUsage,
  type WebDatabase,
} from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import type { FakeChannel, FakeRevenue, FakeUpload } from '@creator-analytics/fake-google'
import { quotaDayOf } from '@creator-analytics/youtube-gateway'
import { eq } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { badRangeQueries, metricQueriesOf } from '../test/custom-range.ts'
import {
  channelsOf,
  connect,
  giveRevenueConsent,
  savePreferences,
  signIn,
  userIdOf,
} from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'

// Emails no other test file signs in with. Test files run in parallel against one database, and
// two files that sign in the same emails in a different order deadlock on the unique email index.
const creator = { sub: '305849', email: 'summariser@example.com', name: 'A Summariser' }
const otherCreator = {
  sub: '405849',
  email: 'other-summariser@example.com',
  name: 'Another Summariser',
}

// Noon on 2026-10-07 in Pacific Time, so today is 2026-10-07.
const noonToday = new Date('2026-10-07T19:00:00Z')

const channel: FakeChannel = {
  createdAt: '2019-03-01T06:00:00Z',
  uploads: [],
  totals: { engagedViews: 1200, views: 3400, estimatedMinutesWatched: 4500 },
}

/** Signs the creator in and connects their channel, which the fake holds as given. */
async function connectedCreator(api: StartedApi, fakeChannel: FakeChannel = channel) {
  const browser = await signIn(api, creator)
  api.google.pickChannel('UC-summariser')
  api.google.setChannel('UC-summariser', fakeChannel)
  await connect(browser)
  const { channels } = await channelsOf(browser)
  const channelId = channels[0]?.id
  if (!channelId) throw new Error('The creator has no connected channel')
  return { browser, channelId }
}

async function readSummary(
  browser: Browser,
  channelId: string,
  query: Record<string, string> | [string, string][] = {},
) {
  const search = new URLSearchParams(query)
  const response = await browser.fetch(`/api/channels/${channelId}/summary?${search}`)
  return { status: response.status, body: (await response.json()) as ChannelSummaryAnswer }
}

function readSummaries(browser: Browser, channelId: string, windows: string[]) {
  return Promise.all(windows.map((window) => readSummary(browser, channelId, { window })))
}

function readAnalyticsQuota(web: WebDatabase) {
  return web.asUser('quota-reader', (tx) =>
    tx.sql
      .select({ units: quotaUsage.units })
      .from(quotaUsage)
      .where(eq(quotaUsage.api, 'analytics')),
  )
}

// 90% of the Analytics API's 100,000 queries a day.
const usableAnalyticsQueries = 90_000

/** Spends all but the next two queries of the Analytics API's usable quota for today. */
async function spendAnalyticsQuotaToTheLastTwoQueries(web: WebDatabase) {
  await web.asUser('quota-writer', async (tx) => {
    await tx.sql
      .insert(quotaUsage)
      .values({ api: 'analytics', quotaDay: quotaDayOf(tx.now), units: usableAnalyticsQueries - 2 })
  })
}

/** The Analytics queries that asked for the channel's totals, watch time too, with no dimension. */
function totalsQueriesOf(api: StartedApi) {
  return api.google.analyticsRequests.filter(
    (query) =>
      !query.has('dimensions') &&
      query.get('metrics') === 'engagedViews,views,estimatedMinutesWatched',
  )
}

describe('seam 1: the channel summary over a calendar window or lifetime', () => {
  test("the summary answers YouTube's own channel totals over the window, watch time included", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    api.google.setLastProcessedDay('2026-10-04')

    const summary = await readSummary(browser, channelId, { window: 'last28' })

    expect(summary.status).toBe(200)
    expect(summary.body).toMatchObject({
      window: 'last28',
      engagedViews: 1200,
      views: 3400,
      estimatedMinutesWatched: 4500,
    })
    // A calendar window ends at the last processed day, so it holds its full 28 days of numbers.
    expect(
      totalsQueriesOf(api).map((query) => [query.get('startDate'), query.get('endDate')]),
    ).toEqual([['2026-09-07', '2026-10-04']])
  })

  test('without a window, the summary covers the last 28 days', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    const summary = await readSummary(browser, channelId)

    expect(summary.body.window).toBe('last28')
    expect(
      totalsQueriesOf(api).map((query) => [query.get('startDate'), query.get('endDate')]),
    ).toEqual([['2026-09-10', '2026-10-07']])
  })

  test("lifetime covers the channel's creation day in Pacific Time to today", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    const summary = await readSummary(browser, channelId, { window: 'lifetime' })

    expect(summary.body.window).toBe('lifetime')
    expect(
      totalsQueriesOf(api).map((query) => [query.get('startDate'), query.get('endDate')]),
    ).toEqual([['2019-02-28', '2026-10-07']])
  })

  test('a window after publish is refused with window_after_publish before any read', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const before = api.google.dataApiRequests.length

    const windows = ['first1', 'first7', 'first28', 'first90', 'first365']
    const refused = await readSummaries(browser, channelId, windows)

    expect(refused).toEqual(
      windows.map(() => ({ status: 400, body: { error: 'window_after_publish' } })),
    )
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('an unknown window is refused with invalid_window before any read', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const before = api.google.dataApiRequests.length

    const refused = await readSummaries(browser, channelId, ['last30', 'First7', ''])

    expect(refused).toEqual(
      Array.from({ length: 3 }, () => ({ status: 400, body: { error: 'invalid_window' } })),
    )
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('the daily series runs from the first day of the window to the last processed day, with its watch time, and zeros for a day YouTube leaves out', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      days: {
        '2026-09-27': { engagedViews: 1, views: 2, estimatedMinutesWatched: 3 },
        '2026-10-01': { engagedViews: 5, views: 9, estimatedMinutesWatched: 42 },
        '2026-10-03': { engagedViews: 7, views: 11 },
        '2026-10-04': { engagedViews: 3, views: 4, estimatedMinutesWatched: 12 },
        '2026-10-05': { engagedViews: 8, views: 8, estimatedMinutesWatched: 20 },
      },
    })
    api.google.setLastProcessedDay('2026-10-04')

    const summary = await readSummary(browser, channelId, { window: 'last7' })

    expect(summary.body.lastProcessedDay).toBe('2026-10-04')
    expect(summary.body.daily).toEqual([
      { day: '2026-09-28', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
      { day: '2026-09-29', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
      { day: '2026-09-30', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
      { day: '2026-10-01', engagedViews: 5, views: 9, estimatedMinutesWatched: 42 },
      { day: '2026-10-02', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
      { day: '2026-10-03', engagedViews: 7, views: 11, estimatedMinutesWatched: 0 },
      { day: '2026-10-04', engagedViews: 3, views: 4, estimatedMinutesWatched: 12 },
    ])
  })

  test('with a last processed day four days before today, an active channel gets no zero day after it: the daily series and the summary end there', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const days = Object.fromEntries(
      ['09-27', '09-28', '09-29', '09-30', '10-01', '10-02', '10-03'].map((day) => [
        `2026-${day}`,
        { engagedViews: 10, views: 10, estimatedMinutesWatched: 10 },
      ]),
    )
    const { browser, channelId } = await connectedCreator(api, { ...channel, days })
    api.google.setLastProcessedDay('2026-10-03')

    const summary = await readSummary(browser, channelId, { window: 'last7' })

    expect(summary.body.lastProcessedDay).toBe('2026-10-03')
    expect(summary.body.daily.map(({ day }) => day)).toEqual(Object.keys(days))
    expect(summary.body.daily.every(({ views }) => views === 10)).toBe(true)
  })

  test('with a latest row day older than four days before today, the daily series still holds every day of the window, and the summary says Google has processed through four days before today', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    // An idle channel: its last day with a row is 2026-09-20.
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      days: { '2026-09-20': { engagedViews: 5, views: 9, estimatedMinutesWatched: 42 } },
    })

    const summary = await readSummary(browser, channelId, { window: 'last7' })

    expect(summary.body.lastProcessedDay).toBe('2026-10-03')
    expect(summary.body.daily).toEqual(
      ['09-27', '09-28', '09-29', '09-30', '10-01', '10-02', '10-03'].map((day) => ({
        day: `2026-${day}`,
        engagedViews: 0,
        views: 0,
        estimatedMinutesWatched: 0,
      })),
    )
  })

  test('a channel with no latest row day in the last 90 days gets a daily series of zeros for every day of the window, through four days before today', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, { ...channel, days: {} })

    const summary = await readSummary(browser, channelId, { window: 'last28' })

    expect(summary.status).toBe(200)
    expect(summary.body.lastProcessedDay).toBe('2026-10-03')
    expect(summary.body.daily).toHaveLength(28)
    expect(summary.body.daily[0]?.day).toBe('2026-09-06')
    expect(summary.body.daily.at(-1)?.day).toBe('2026-10-03')
    expect(summary.body.daily.every(({ views }) => views === 0)).toBe(true)
  })
})

/**
 * A channel holding its own numbers and different numbers for each format. The formats' totals sum
 * to less than the channel's own, so a summary of every format cannot be their sum.
 */
const channelWithFormats: FakeChannel = {
  ...channel,
  days: { '2026-10-03': { engagedViews: 70, views: 110, estimatedMinutesWatched: 140 } },
  formats: {
    videoOnDemand: {
      totals: { engagedViews: 300, views: 900, estimatedMinutesWatched: 1800 },
      days: { '2026-10-03': { engagedViews: 30, views: 90, estimatedMinutesWatched: 60 } },
      estimatedRevenue: 9.5,
      estimatedAdRevenue: 8,
      estimatedRedPartnerRevenue: 1,
      revenueDays: { '2026-10-03': { estimatedRevenue: 0.9, estimatedAdRevenue: 0.75 } },
    },
    shorts: {
      totals: { engagedViews: 800, views: 2300 },
      days: { '2026-10-03': { engagedViews: 35, views: 15 } },
      estimatedRevenue: 1.25,
      estimatedAdRevenue: 1,
      estimatedRedPartnerRevenue: 0.25,
      revenueDays: { '2026-10-03': { estimatedRevenue: 0.2, estimatedAdRevenue: 0.15 } },
    },
    liveStream: {
      totals: { engagedViews: 50, views: 150 },
      days: { '2026-10-03': { engagedViews: 5, views: 5 } },
      estimatedRevenue: 0.5,
      estimatedAdRevenue: 0.5,
      estimatedRedPartnerRevenue: 0,
      revenueDays: { '2026-10-03': { estimatedRevenue: 0.1, estimatedAdRevenue: 0.1 } },
    },
  },
}

describe('seam 1: the channel summary of one format', () => {
  test.for([
    [
      'video',
      'videoOnDemand',
      { engagedViews: 300, views: 900, estimatedMinutesWatched: 1800 },
      { estimatedRevenue: 9.5, estimatedAdRevenue: 8, estimatedRedPartnerRevenue: 1 },
      {
        engagedViews: 30,
        views: 90,
        estimatedMinutesWatched: 60,
        estimatedRevenue: 0.9,
        estimatedAdRevenue: 0.75,
        estimatedRedPartnerRevenue: 0,
      },
    ],
    [
      'short',
      'shorts',
      { engagedViews: 800, views: 2300, estimatedMinutesWatched: 0 },
      { estimatedRevenue: 1.25, estimatedAdRevenue: 1, estimatedRedPartnerRevenue: 0.25 },
      {
        engagedViews: 35,
        views: 15,
        estimatedMinutesWatched: 0,
        estimatedRevenue: 0.2,
        estimatedAdRevenue: 0.15,
        estimatedRedPartnerRevenue: 0,
      },
    ],
    [
      'live',
      'liveStream',
      { engagedViews: 50, views: 150, estimatedMinutesWatched: 0 },
      { estimatedRevenue: 0.5, estimatedAdRevenue: 0.5, estimatedRedPartnerRevenue: 0 },
      {
        engagedViews: 5,
        views: 5,
        estimatedMinutesWatched: 0,
        estimatedRevenue: 0.1,
        estimatedAdRevenue: 0.1,
        estimatedRedPartnerRevenue: 0,
      },
    ],
  ] as const)(
    "a %s summary answers that format's totals, daily series and revenue sources, read with Google's lowercase %s filter, the revenue tied to no format over the window, and the revenue of every format",
    // The content type names the filter in the title; the fake answers a format only under it.
    async ([format, _contentType, totals, revenue, day], { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, channelWithFormats)
      api.google.setRevenue('UC-summariser', { ...channelRevenue, noFormatRevenue: 5.4 })
      api.google.setLastProcessedDay('2026-10-04')
      await giveRevenueConsent(browser, channelId)

      const summary = await readSummary(browser, channelId, { window: 'last7', format })

      expect(summary.status).toBe(200)
      expect(summary.body).toMatchObject({
        window: 'last7',
        format,
        ...totals,
        revenue: { ...revenue, noFormatRevenue: 5.4 },
      })
      // The three formats' revenue and the revenue tied to no format.
      expect(summary.body.revenue).toHaveProperty('everyFormatRevenue', 9.5 + 1.25 + 0.5 + 5.4)
      expect(summary.body.daily).toContainEqual({ day: '2026-10-03', ...day })
    },
  )

  test("without a format, or with all, the summary answers the channel's own totals and daily series", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, channelWithFormats)

    const unset = await readSummary(browser, channelId, { window: 'last7' })
    const all = await readSummary(browser, channelId, { window: 'last28', format: 'all' })

    expect([unset.body, all.body]).toMatchObject([
      { format: 'all', engagedViews: 1200, views: 3400, estimatedMinutesWatched: 4500 },
      { format: 'all', engagedViews: 1200, views: 3400, estimatedMinutesWatched: 4500 },
    ])
    // One format's 2026-10-03 is 30, 35 or 5 engaged views, so these are the channel's own days.
    for (const { body } of [unset, all]) {
      expect(body.daily).toContainEqual({
        day: '2026-10-03',
        engagedViews: 70,
        views: 110,
        estimatedMinutesWatched: 140,
      })
    }
  })

  test('an unknown format is refused with invalid_format before any read', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const before = api.google.dataApiRequests.length

    const refused = []
    for (const format of ['bogus', 'SHORTS', 'shorts', '']) {
      refused.push(await readSummary(browser, channelId, { format }))
    }

    expect(refused).toEqual(
      Array.from({ length: 4 }, () => ({ status: 400, body: { error: 'invalid_format' } })),
    )
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('a summary with no format shares the cache entry of all, and each format keeps its own entry', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, channelWithFormats)

    const unset = await readSummary(browser, channelId, { window: 'last7' })
    const all = await readSummary(browser, channelId, { window: 'last7', format: 'all' })
    const shorts = await readSummary(browser, channelId, { window: 'last7', format: 'short' })
    const videos = await readSummary(browser, channelId, { window: 'last7', format: 'video' })
    const allAgain = await readSummary(browser, channelId, { window: 'last7', format: 'all' })

    expect([unset.body, all.body, shorts.body, videos.body, allAgain.body]).toMatchObject([
      { engagedViews: 1200, fromCache: false },
      { engagedViews: 1200, fromCache: true },
      { engagedViews: 800, fromCache: false },
      { engagedViews: 300, fromCache: false },
      { engagedViews: 1200, fromCache: true },
    ])
  })
})

/**
 * An upload published at the time given, with lifetime numbers, so Google answers its content type:
 * `videoOnDemand` unless overridden.
 */
function publishedUpload(
  videoId: string,
  publishedAt: string,
  overrides: Partial<FakeUpload> = {},
): FakeUpload {
  return {
    videoId,
    title: `Title of ${videoId}`,
    publishedAt,
    metrics: {
      engagedViews: 10,
      views: 20,
      averageViewPercentage: 40,
      subscribersGained: 1,
      estimatedMinutesWatched: 30,
    },
    ...overrides,
  }
}

function uploadIdsOf(answer: ChannelSummaryAnswer): string[] {
  return answer.uploads.map(({ id }) => id)
}

describe("seam 1: the channel summary's uploads", () => {
  // With the last processed day 2026-10-04, last7 runs from 2026-09-28 to 2026-10-04. A time at
  // 19:00Z is noon in Pacific Time, so its publish day is its UTC date.
  test('the summary carries each upload published on a day of its daily series, newest first, ties by id, and leaves out a scheduled upload and uploads before or after the window', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      uploads: [
        publishedUpload('before', '2026-09-27T19:00:00Z'),
        publishedUpload('first-day', '2026-09-28T19:00:00Z'),
        publishedUpload('busy-early', '2026-10-01T15:00:00Z', { creatorContentType: 'shorts' }),
        publishedUpload('busy-b', '2026-10-01T19:00:00Z'),
        publishedUpload('busy-a', '2026-10-01T19:00:00Z', { creatorContentType: 'liveStream' }),
        publishedUpload('last-day', '2026-10-04T19:00:00Z'),
        publishedUpload('unprocessed', '2026-10-05T19:00:00Z'),
        {
          videoId: 'scheduled',
          title: 'A scheduled upload',
          scheduledFor: '2026-10-09T19:00:00Z',
        },
      ],
    })
    api.google.setLastProcessedDay('2026-10-04')

    const summary = await readSummary(browser, channelId, { window: 'last7' })

    expect(summary.status).toBe(200)
    expect(summary.body.uploads).toEqual([
      { id: 'last-day', title: 'Title of last-day', publishDay: '2026-10-04', format: 'video' },
      { id: 'busy-a', title: 'Title of busy-a', publishDay: '2026-10-01', format: 'live' },
      { id: 'busy-b', title: 'Title of busy-b', publishDay: '2026-10-01', format: 'video' },
      { id: 'busy-early', title: 'Title of busy-early', publishDay: '2026-10-01', format: 'short' },
      { id: 'first-day', title: 'Title of first-day', publishDay: '2026-09-28', format: 'video' },
    ])
  })

  test('over lifetime, which runs to today, the uploads still end at the last processed day', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      uploads: [
        publishedUpload('old', '2019-03-02T19:00:00Z'),
        publishedUpload('processed', '2026-10-04T19:00:00Z'),
        publishedUpload('today', '2026-10-07T17:00:00Z'),
      ],
    })
    api.google.setLastProcessedDay('2026-10-04')

    const summary = await readSummary(browser, channelId, { window: 'lifetime' })

    expect(uploadIdsOf(summary.body)).toEqual(['processed', 'old'])
  })

  test('when the daily series runs past the last processed day, the uploads run to its last day too', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      days: {
        '2026-10-04': { engagedViews: 1, views: 1, estimatedMinutesWatched: 1 },
        '2026-10-05': { engagedViews: 1, views: 1, estimatedMinutesWatched: 1 },
      },
      uploads: [
        publishedUpload('processed', '2026-10-04T19:00:00Z'),
        publishedUpload('newly-processed', '2026-10-05T19:00:00Z'),
      ],
    })
    api.google.setLastProcessedDay('2026-10-04')
    // The last7 summary caches the last processed day, 2026-10-04. Google then processes
    // 2026-10-05, and lifetime's daily series, a cache entry of its own, answers its row.
    await readSummary(browser, channelId, { window: 'last7' })
    api.google.setLastProcessedDay('2026-10-05')

    const summary = await readSummary(browser, channelId, { window: 'lifetime' })

    expect(summary.body.daily.at(-1)?.day).toBe('2026-10-05')
    expect(uploadIdsOf(summary.body)).toEqual(['newly-processed', 'processed'])
  })

  test('a format filter carries only uploads of that format, and an upload with no format only under all', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      uploads: [
        publishedUpload('a-video', '2026-10-01T19:00:00Z'),
        publishedUpload('a-short', '2026-10-02T19:00:00Z', { creatorContentType: 'shorts' }),
        publishedUpload('a-live', '2026-10-03T19:00:00Z', { creatorContentType: 'liveStream' }),
        publishedUpload('a-story', '2026-10-04T19:00:00Z', { creatorContentType: 'story' }),
      ],
    })
    api.google.setLastProcessedDay('2026-10-04')

    const summaries = []
    for (const format of ['all', 'video', 'short', 'live']) {
      summaries.push(await readSummary(browser, channelId, { window: 'last7', format }))
    }

    expect(summaries.map(({ body }) => uploadIdsOf(body))).toEqual([
      ['a-story', 'a-live', 'a-short', 'a-video'],
      ['a-video'],
      ['a-short'],
      ['a-live'],
    ])
    expect(summaries[0]?.body.uploads[0]).toMatchObject({ id: 'a-story', format: null })
  })

  test('without a visibility, or with public, the summary carries public uploads only; with all, unlisted and private ones too', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      uploads: [
        publishedUpload('public', '2026-10-01T19:00:00Z'),
        publishedUpload('unlisted', '2026-10-02T19:00:00Z', { privacyStatus: 'unlisted' }),
        publishedUpload('private', '2026-10-03T19:00:00Z', { privacyStatus: 'private' }),
      ],
    })
    api.google.setLastProcessedDay('2026-10-04')

    const unset = await readSummary(browser, channelId, { window: 'last7' })
    const publicOnly = await readSummary(browser, channelId, {
      window: 'last7',
      visibility: 'public',
    })
    const all = await readSummary(browser, channelId, { window: 'last7', visibility: 'all' })

    expect([unset, publicOnly, all].map(({ body }) => uploadIdsOf(body))).toEqual([
      ['public'],
      ['public'],
      ['private', 'unlisted', 'public'],
    ])
    // The numbers are the channel's whatever the visibility.
    expect(all.body.engagedViews).toBe(unset.body.engagedViews)
  })

  test('a summary whose uploads read Google stops answering partway gets google_failed', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      uploads: [publishedUpload('an-upload', '2026-09-01T19:00:00Z')],
    })
    api.google.dropDataApi('/youtube/v3/playlistItems')

    const read = await readSummary(browser, channelId)

    expect(read).toEqual({ status: 502, body: { refusal: 'google_failed' } })
  })
})

describe('seam 1: the channel summary of one visibility', () => {
  test('an unknown visibility is refused with invalid_visibility before any read', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const before = api.google.dataApiRequests.length

    const refused = []
    for (const visibility of ['bogus', 'PUBLIC', 'unlisted', '']) {
      refused.push(await readSummary(browser, channelId, { visibility }))
    }

    expect(refused).toEqual(
      Array.from({ length: 4 }, () => ({ status: 400, body: { error: 'invalid_visibility' } })),
    )
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('a bad format and a bad visibility together are refused for the format, which the checks read first', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    const refused = await readSummary(browser, channelId, [
      ['visibility', 'bogus'],
      ['format', 'bogus'],
    ])

    expect(refused).toEqual({ status: 400, body: { error: 'invalid_format' } })
  })
})

describe('seam 1: the channel summary refuses a repeated query parameter', () => {
  // Two values of each parameter, each valid alone, with the code a bad value of it gets. Both
  // windows are calendar windows, so window_after_publish cannot be the reason.
  const repeats: [string, [string, string], string][] = [
    ['window', ['last7', 'last28'], 'invalid_window'],
    ['format', ['short', 'video'], 'invalid_format'],
    ['visibility', ['public', 'all'], 'invalid_visibility'],
  ]

  test('each parameter sent twice is refused with its own code before any read', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const before = api.google.dataApiRequests.length

    const refused = []
    for (const [name, [first, second]] of repeats) {
      refused.push(
        await readSummary(browser, channelId, [
          [name, first],
          [name, second],
        ]),
      )
    }

    expect(refused).toEqual(repeats.map(([, , error]) => ({ status: 400, body: { error } })))
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('with two parameters sent twice, the one the checks read first is refused, as with two bad values, whatever the address order', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    const refused = await readSummary(browser, channelId, [
      ['format', 'short'],
      ['format', 'video'],
      ['window', 'last7'],
      ['window', 'last28'],
    ])

    expect(refused).toEqual({ status: 400, body: { error: 'invalid_window' } })
  })
})

describe('seam 1: the channel summary over a custom range', () => {
  test('a custom range that is bad before any read is refused with invalid_range before any read', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const before = api.google.dataApiRequests.length

    const refused = []
    for (const query of badRangeQueries) refused.push(await readSummary(browser, channelId, query))

    expect(refused).toEqual(
      badRangeQueries.map(() => ({ status: 400, body: { error: 'invalid_range' } })),
    )
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('a start before the creation day, or an end after the last processed day, is refused with invalid_range before any metric read', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    api.google.setLastProcessedDay('2026-10-04')

    // The creation day is 2019-02-28 in Pacific Time.
    const beforeCreation = await readSummary(browser, channelId, {
      window: 'custom',
      from: '2019-02-27',
      to: '2019-03-10',
    })
    const afterProcessed = await readSummary(browser, channelId, {
      window: 'custom',
      from: '2026-10-01',
      to: '2026-10-05',
    })

    expect([beforeCreation, afterProcessed]).toEqual([
      { status: 400, body: { error: 'invalid_range' } },
      { status: 400, body: { error: 'invalid_range' } },
    ])
    expect(metricQueriesOf(api, noonToday)).toHaveLength(0)
  })

  test('a range of the creation day alone, and one that ends on the last processed day, are answered', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    api.google.setLastProcessedDay('2026-10-04')

    const creationDay = await readSummary(browser, channelId, {
      window: 'custom',
      from: '2019-02-28',
      to: '2019-02-28',
    })
    const toLastProcessed = await readSummary(browser, channelId, {
      window: 'custom',
      from: '2026-10-01',
      to: '2026-10-04',
    })

    expect([creationDay.status, toLastProcessed.status]).toEqual([200, 200])
  })

  test('the summary of a custom range covers its days, and its daily series runs from its start to its end', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      days: {
        '2026-09-19': { engagedViews: 1, views: 2, estimatedMinutesWatched: 3 },
        '2026-09-21': { engagedViews: 5, views: 9, estimatedMinutesWatched: 42 },
        '2026-10-04': { engagedViews: 3, views: 4, estimatedMinutesWatched: 12 },
      },
    })

    const summary = await readSummary(browser, channelId, {
      window: 'custom',
      from: '2026-09-20',
      to: '2026-09-22',
    })

    expect(summary.status).toBe(200)
    expect(summary.body).toMatchObject({ window: 'custom', engagedViews: 1200 })
    expect(
      totalsQueriesOf(api).map((query) => [query.get('startDate'), query.get('endDate')]),
    ).toEqual([['2026-09-20', '2026-09-22']])
    expect(summary.body.daily).toEqual([
      { day: '2026-09-20', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
      { day: '2026-09-21', engagedViews: 5, views: 9, estimatedMinutesWatched: 42 },
      { day: '2026-09-22', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
    ])
  })

  test("every summary carries the channel's creation day in Pacific Time, a preset window's too", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    api.google.setLastProcessedDay('2026-10-04')

    const summaries = [
      await readSummary(browser, channelId, { window: 'last28' }),
      await readSummary(browser, channelId, {
        window: 'custom',
        from: '2026-09-01',
        to: '2026-09-30',
      }),
    ]

    expect(summaries.map(({ body }) => body.creationDay)).toEqual(['2019-02-28', '2019-02-28'])
  })

  test('a custom range spends the Analytics queries of the calendar window of the same days, and shares its cache entries', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, { ...channel, days: {} })
    // With no processed day in the search, last28 resolves to 2026-09-06 to 2026-10-03.
    await readSummary(browser, channelId, {
      window: 'custom',
      from: '2026-09-06',
      to: '2026-10-03',
    })
    const customQueries = api.google.analyticsRequests.length

    const other = await signIn(api, otherCreator)
    api.google.pickChannel('UC-other-summariser')
    api.google.setChannel('UC-other-summariser', { ...channel, days: {} })
    await connect(other)
    const { channels } = await channelsOf(other)
    const otherChannelId = channels[0]?.id
    if (!otherChannelId) throw new Error('The other creator has no connected channel')
    await readSummary(other, otherChannelId, { window: 'last28' })
    const last28Queries = api.google.analyticsRequests.length - customQueries

    const last28 = await readSummary(browser, channelId, { window: 'last28' })

    expect(customQueries).toBeGreaterThan(0)
    expect(last28Queries).toBe(customQueries)
    expect(last28.body.fromCache).toBe(true)
    expect(api.google.analyticsRequests).toHaveLength(customQueries + last28Queries)
  })
})

describe('seam 1: who gets a channel summary', () => {
  test('a channel whose connection is revoked gets no summary, not even a cached one', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const cached = await readSummary(browser, channelId)
    expect(cached.status).toBe(200)
    const userId = await userIdOf(web, creator.email)
    await web.asUser(userId, (tx) => tx.sql.update(connections).set({ status: 'revoked' }))

    const revoked = await readSummary(browser, channelId)

    expect(revoked).toEqual({ status: 410, body: { refusal: 'connection_revoked' } })
  })

  // Read in the channel's scope: the deletion request ends the creator's membership.
  test('a summary whose token refresh Google refuses with invalid_grant gets connection_revoked, and the channel is revoked and its deletion requested', async ({
    web,
    worker,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    // The creator removes the product's access in their Google account settings.
    for (const token of api.google.issuedRefreshTokens) {
      await fetch(api.google.revocationEndpoint, {
        method: 'POST',
        body: new URLSearchParams({ token }),
      })
    }
    const userId = await userIdOf(web, creator.email)
    await web.asUser(userId, (tx) =>
      tx.sql.update(connections).set({ accessTokenExpiresAt: tx.now }),
    )
    const before = api.google.analyticsRequests.length + api.google.dataApiRequests.length

    const read = await readSummary(browser, channelId)

    expect(read).toEqual({ status: 410, body: { refusal: 'connection_revoked' } })
    expect(api.google.analyticsRequests.length + api.google.dataApiRequests.length).toBe(before)
    expect(
      await worker.forChannel(channelId, async (tx) => ({
        connections: await tx.sql.select({ status: connections.status }).from(connections),
        requests: await tx.sql.select({ reason: deletionRequests.reason }).from(deletionRequests),
      })),
    ).toEqual({ connections: [{ status: 'revoked' }], requests: [{ reason: 'google_revocation' }] })
  })

  test('a user without a membership to the channel gets not_connected, even with a cached summary', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const cached = await readSummary(browser, channelId)
    expect(cached.status).toBe(200)
    const other = await signIn(api, otherCreator)

    const read = await readSummary(other, channelId)

    expect(read).toEqual({ status: 404, body: { refusal: 'not_connected' } })
  })
})

/** The channel's revenue over any window and by day. */
const channelRevenue: FakeRevenue = {
  estimatedRevenue: 42.8,
  estimatedAdRevenue: 30.5,
  estimatedRedPartnerRevenue: 4.25,
  days: {
    '2026-10-02': {
      estimatedRevenue: 2.5,
      estimatedAdRevenue: 2,
      estimatedRedPartnerRevenue: 0.25,
    },
    '2026-10-03': { estimatedRevenue: 1 },
  },
  noFormatRevenue: 5.4,
}

/** The Analytics queries that asked for revenue, in the order they went. */
function revenueQueriesOf(api: StartedApi) {
  return api.google.analyticsRequests.filter((query) =>
    query.get('metrics')?.includes('estimatedRevenue'),
  )
}

/** A creator with revenue consent, whose channel earns `channelRevenue`. */
async function earningCreator(api: StartedApi) {
  const connected = await connectedCreator(api)
  api.google.setRevenue('UC-summariser', channelRevenue)
  api.google.setLastProcessedDay('2026-10-04')
  await giveRevenueConsent(connected.browser, connected.channelId)
  return connected
}

describe('seam 1: revenue in the channel summary', () => {
  test("with revenue consent, the summary carries YouTube's revenue over the window, its ad and YouTube Premium parts, and the revenue tied to no format", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api)

    const summary = await readSummary(browser, channelId, { window: 'last90' })

    expect(summary.status).toBe(200)
    expect(summary.body.revenue).toEqual({
      estimatedRevenue: 42.8,
      estimatedAdRevenue: 30.5,
      estimatedRedPartnerRevenue: 4.25,
      noFormatRevenue: 5.4,
      // The channel holds no format in the fake, so its report by format answers the no-format row.
      everyFormatRevenue: 5.4,
      currency: 'USD',
    })
    // The fake's revenue reports ignore dates, so only the queries prove the window: every revenue
    // query asks for it.
    expect(
      revenueQueriesOf(api).map((query) => [query.get('startDate'), query.get('endDate')]),
    ).toEqual([
      ['2026-07-07', '2026-10-04'],
      ['2026-07-07', '2026-10-04'],
      ['2026-07-07', '2026-10-04'],
    ])
  })

  test('with revenue consent, each day of the daily series carries its revenue and the two sources, zeros for a day YouTube reports no revenue for', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api)

    const summary = await readSummary(browser, channelId, { window: 'last7' })

    const noRevenueDay = {
      engagedViews: 0,
      views: 0,
      estimatedMinutesWatched: 0,
      estimatedRevenue: 0,
      estimatedAdRevenue: 0,
      estimatedRedPartnerRevenue: 0,
    }
    expect(summary.body.daily).toEqual([
      { day: '2026-09-28', ...noRevenueDay },
      { day: '2026-09-29', ...noRevenueDay },
      { day: '2026-09-30', ...noRevenueDay },
      {
        day: '2026-10-01',
        engagedViews: 0,
        views: 0,
        estimatedMinutesWatched: 0,
        estimatedRevenue: 0,
        estimatedAdRevenue: 0,
        estimatedRedPartnerRevenue: 0,
      },
      {
        day: '2026-10-02',
        engagedViews: 0,
        views: 0,
        estimatedMinutesWatched: 0,
        estimatedRevenue: 2.5,
        estimatedAdRevenue: 2,
        estimatedRedPartnerRevenue: 0.25,
      },
      {
        day: '2026-10-03',
        engagedViews: 0,
        views: 0,
        estimatedMinutesWatched: 0,
        estimatedRevenue: 1,
        estimatedAdRevenue: 0,
        estimatedRedPartnerRevenue: 0,
      },
      {
        day: '2026-10-04',
        engagedViews: 0,
        views: 0,
        estimatedMinutesWatched: 0,
        estimatedRevenue: 0,
        estimatedAdRevenue: 0,
        estimatedRedPartnerRevenue: 0,
      },
    ])
  })

  test('without revenue consent, the summary says so in place of revenue, its days carry none, and it makes no revenue call', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    api.google.setRevenue('UC-summariser', channelRevenue)
    api.google.setLastProcessedDay('2026-10-04')

    const summary = await readSummary(browser, channelId, { window: 'last7' })

    expect(summary.status).toBe(200)
    expect(summary.body.revenue).toEqual({ refusal: 'consent_missing' })
    expect(summary.body.daily[0]).toEqual({
      day: '2026-09-28',
      engagedViews: 0,
      views: 0,
      estimatedMinutesWatched: 0,
    })
    expect(revenueQueriesOf(api)).toEqual([])
  })

  test('a channel outside the YouTube Partner Program gets its other numbers and not_monetized for its revenue, after one revenue call', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api)
    api.google.setPartnerProgram('UC-summariser', false)

    const summary = await readSummary(browser, channelId, { window: 'last7' })

    expect(summary.status).toBe(200)
    expect(summary.body).toMatchObject({
      engagedViews: 1200,
      views: 3400,
      estimatedMinutesWatched: 4500,
      revenue: { refusal: 'not_monetized' },
    })
    expect(summary.body.daily[0]).not.toHaveProperty('estimatedRevenue')
    expect(revenueQueriesOf(api)).toHaveLength(1)
  })

  test("Google's 403 for a channel outside the YouTube Partner Program is not logged as an error", async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api)
    api.google.setPartnerProgram('UC-summariser', false)
    const before = api.logs.length

    await readSummary(browser, channelId)

    expect(api.logs.slice(before).map((line) => JSON.parse(line).level)).not.toContain('error')
  })

  test("Google's 403 to a revenue read is logged with its reason and message and the channel's id, and no token", async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api)
    api.google.setPartnerProgram('UC-summariser', false)

    const summary = await readSummary(browser, channelId)

    expect(summary.body).toMatchObject({ revenue: { refusal: 'not_monetized' } })
    // A logged value is always text.
    expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
      level: 'warn',
      message:
        'The YouTube analytics API answered a revenue read with a 403, reason forbidden: Forbidden',
      context: { channelId, status: '403' },
    })
    const logged = api.logs.join('\n')
    expect(api.google.issuedAccessTokens.length).toBeGreaterThan(0)
    expect(api.google.issuedAccessTokens.filter((token) => logged.includes(token))).toEqual([])
    expect(logged).not.toContain('UC-summariser')
  })

  test("Google's 403 to a read without revenue is logged as an error with its reason and message, and no token", async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const message = 'The request cannot be completed because you have exceeded your quota.'
    api.google.failAnalytics(403, { reason: 'quotaExceeded', message })

    const summary = await readSummary(browser, channelId)

    expect(summary).toEqual({ status: 502, body: { refusal: 'google_failed' } })
    // A logged value is always text.
    expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
      level: 'error',
      message: `The YouTube analytics API answered a call with an error, reason quotaExceeded: ${message}`,
      context: { status: '403' },
    })
    const logged = api.logs.join('\n')
    expect(api.google.issuedAccessTokens.length).toBeGreaterThan(0)
    expect(api.google.issuedAccessTokens.filter((token) => logged.includes(token))).toEqual([])
    expect(logged).not.toContain('UC-summariser')
  })

  test('a summary whose other numbers come from the cache and whose not_monetized comes from Google says it did not come from the cache', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    api.google.setRevenue('UC-summariser', channelRevenue)
    api.google.setPartnerProgram('UC-summariser', false)
    await readSummary(browser, channelId, { window: 'last7' })
    await giveRevenueConsent(browser, channelId)

    const summary = await readSummary(browser, channelId, { window: 'last7' })

    expect(summary.body).toMatchObject({ revenue: { refusal: 'not_monetized' }, fromCache: false })
  })

  test('a second summary inside 6 hours answers not_monetized again without asking Google', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api)
    api.google.setPartnerProgram('UC-summariser', false)
    await readSummary(browser, channelId, { window: 'last7' })
    const calls = api.google.analyticsRequests.length
    api.google.setPartnerProgram('UC-summariser', true)
    clock.set(new Date(noonToday.getTime() + 5 * 60 * 60 * 1000))

    const second = await readSummary(browser, channelId, { window: 'last7' })

    expect(second.body.revenue).toEqual({ refusal: 'not_monetized' })
    expect(api.google.analyticsRequests).toHaveLength(calls)
  })

  test('after 6 hours, a channel that joined the YouTube Partner Program shows its revenue, with no new consent and the revenue scope still held', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api)
    api.google.setPartnerProgram('UC-summariser', false)
    await readSummary(browser, channelId, { window: 'last7' })
    const consents = api.google.authorizationRequests.length
    api.google.setPartnerProgram('UC-summariser', true)
    clock.set(new Date(noonToday.getTime() + 7 * 60 * 60 * 1000))

    const joined = await readSummary(browser, channelId, { window: 'last7' })

    expect(joined.body.revenue).toEqual({
      estimatedRevenue: 42.8,
      estimatedAdRevenue: 30.5,
      estimatedRedPartnerRevenue: 4.25,
      noFormatRevenue: 5.4,
      everyFormatRevenue: 5.4,
      currency: 'USD',
    })
    expect(api.google.authorizationRequests).toHaveLength(consents)
    const userId = await userIdOf(web, creator.email)
    const [connection] = await web.asUser(userId, (tx) => tx.sql.select().from(connections))
    expect(connection?.scopes.map(({ name }) => name)).toContain('yt-analytics-monetary.readonly')
  })
})

describe("seam 1: revenue in the creator's currency", () => {
  test('with no saved currency, every revenue query asks Google for USD and the answer says USD', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api)

    const summary = await readSummary(browser, channelId, { window: 'last28' })

    expect(summary.body.revenue).toEqual(expect.objectContaining({ currency: 'USD' }))
    expect(revenueQueriesOf(api).map((query) => query.get('currency'))).toEqual([
      'USD',
      'USD',
      'USD',
    ])
  })

  test('with a saved currency, every revenue query asks Google for it, the answer says it, and no other query sends a currency', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api)
    await savePreferences(browser, { currency: 'EUR' })

    const summary = await readSummary(browser, channelId, { window: 'last28' })

    expect(summary.body.revenue).toEqual(expect.objectContaining({ currency: 'EUR' }))
    expect(revenueQueriesOf(api).map((query) => query.get('currency'))).toEqual([
      'EUR',
      'EUR',
      'EUR',
    ])
    // Google ignores the currency on a report with no revenue metric, so none is sent.
    const others = api.google.analyticsRequests.filter(
      (query) => !query.get('metrics')?.includes('estimatedRevenue'),
    )
    expect(others.length).toBeGreaterThan(0)
    expect(others.filter((query) => query.has('currency'))).toEqual([])
  })

  test('each currency keeps its own cache entry for revenue, and shares every other read', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api)
    await readSummary(browser, channelId, { window: 'last28' })
    const afterUsd = api.google.analyticsRequests.length

    await savePreferences(browser, { currency: 'EUR' })
    const inEuros = await readSummary(browser, channelId, { window: 'last28' })
    const eurosQueries = api.google.analyticsRequests.slice(afterUsd)

    await savePreferences(browser, { currency: 'USD' })
    const backInDollars = await readSummary(browser, channelId, { window: 'last28' })

    // The euro summary asks Google again for its three revenue queries, and for nothing else.
    expect(eurosQueries.map((query) => [query.get('metrics'), query.get('currency')])).toEqual([
      ['estimatedRevenue,estimatedAdRevenue,estimatedRedPartnerRevenue', 'EUR'],
      ['estimatedRevenue,estimatedAdRevenue,estimatedRedPartnerRevenue', 'EUR'],
      ['estimatedRevenue', 'EUR'],
    ])
    expect(inEuros.body).toEqual(
      expect.objectContaining({
        fromCache: false,
        revenue: expect.objectContaining({ currency: 'EUR' }),
      }),
    )
    // Back in dollars, every read is still in the cache.
    expect(api.google.analyticsRequests.length).toBe(afterUsd + 3)
    expect(backInDollars.body).toEqual(
      expect.objectContaining({
        fromCache: true,
        revenue: expect.objectContaining({ currency: 'USD' }),
      }),
    )
  })
})

describe('seam 1: the channel summary spends quota once per cache window', () => {
  test('a summary without revenue consent costs one Analytics unit for each of its three queries', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    await readSummary(browser, channelId)

    expect(api.google.analyticsRequests).toHaveLength(3)
    expect(await readAnalyticsQuota(web)).toEqual([{ units: 3 }])
  })

  test('a summary with revenue consent costs three more Analytics units, one for each revenue query', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api)

    await readSummary(browser, channelId)

    expect(api.google.analyticsRequests).toHaveLength(6)
    expect(await readAnalyticsQuota(web)).toEqual([{ units: 6 }])
  })

  test('a summary of a channel outside the YouTube Partner Program costs one more Analytics unit, for the refused revenue query', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api)
    api.google.setPartnerProgram('UC-summariser', false)

    await readSummary(browser, channelId)

    expect(api.google.analyticsRequests).toHaveLength(4)
    expect(await readAnalyticsQuota(web)).toEqual([{ units: 4 }])
  })

  test("a summary on a cold cache makes four Data API calls: the channel snippet and the uploads read's channels, playlist items and videos calls", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      uploads: [{ videoId: 'vid-1', title: 'An upload', publishedAt: '2026-09-01T12:00:00Z' }],
    })
    // Past the 6 hours the channel list's own read of the snippet stays cached.
    clock.set(new Date(noonToday.getTime() + 7 * 60 * 60 * 1000))
    const before = api.google.dataApiRequests.length

    const summary = await readSummary(browser, channelId, { window: 'last7' })

    expect(summary.status).toBe(200)
    expect(api.google.dataApiRequests.slice(before).map((url) => url.pathname)).toEqual([
      '/youtube/v3/channels',
      '/youtube/v3/channels',
      '/youtube/v3/playlistItems',
      '/youtube/v3/videos',
    ])
  })

  test('a summary inside the cache window of the channel list and the video list makes no Data API call and no content types query, since they read the channel snippet, the uploads and their content types', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      uploads: [publishedUpload('an-upload', '2026-09-01T19:00:00Z')],
    })
    const listed = await browser.fetch(`/api/channels/${channelId}/videos`)
    expect(listed.status).toBe(200)
    const dataBefore = api.google.dataApiRequests.length
    const contentTypesQueries = () =>
      api.google.analyticsRequests.filter((query) =>
        query.get('dimensions')?.includes('creatorContentType'),
      ).length
    const contentTypesBefore = contentTypesQueries()

    const summary = await readSummary(browser, channelId)

    expect(summary.status).toBe(200)
    expect(api.google.dataApiRequests).toHaveLength(dataBefore)
    expect(contentTypesBefore).toBe(1)
    expect(contentTypesQueries()).toBe(contentTypesBefore)
  })

  test('a summary that would spend the reserved Analytics quota is refused with quota_reserved, and the log names no channel', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await spendAnalyticsQuotaToTheLastTwoQueries(web)

    const refused = await readSummary(browser, channelId)

    expect(refused).toEqual({ status: 503, body: { refusal: 'quota_reserved' } })
    // The last two allowed queries spent the final usable units. A logged value is always text.
    expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
      level: 'warn',
      message: 'Refused a YouTube analytics API call to keep its reserved quota',
      context: {
        quotaDay: quotaDayOf(noonToday),
        unitsSpent: String(usableAnalyticsQueries),
        unitsUsable: String(usableAnalyticsQueries),
      },
    })
    // The request line may name the channel by its internal id, as it stays on main-box; no other
    // line does, and no line holds its YouTube id.
    const logged = api.logs.join('\n')
    const otherLines = api.logs.filter((line) => JSON.parse(line).message !== 'API request')
    expect(otherLines.join('\n')).not.toContain(channelId)
    expect(logged).not.toContain('UC-summariser')
  })

  test('a cached summary is still served once the quota is reserved', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const first = await readSummary(browser, channelId)
    await web.asUser('quota-writer', (tx) =>
      tx.sql
        .update(quotaUsage)
        .set({ units: usableAnalyticsQueries })
        .where(eq(quotaUsage.api, 'analytics')),
    )
    const refused = await readSummary(browser, channelId, { window: 'last7' })
    expect(refused.body).toEqual({ refusal: 'quota_reserved' })

    const cached = await readSummary(browser, channelId)

    expect(cached).toEqual({ status: 200, body: { ...first.body, fromCache: true } })
  })

  test('quota units are recorded for each call, including a call Google answers with an error', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await readSummary(browser, channelId)
    api.google.failAnalytics(500)

    const failed = await readSummary(browser, channelId, { window: 'last7' })

    expect(failed).toEqual({ status: 502, body: { refusal: 'google_failed' } })
    // The three queries of the first summary, and the failed totals query of the second.
    expect(await readAnalyticsQuota(web)).toEqual([{ units: 4 }])
  })

  test('a second summary inside the cache window does not call Google and says it came from the cache', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, {
      ...channel,
      days: { '2026-10-01': { engagedViews: 5, views: 9 } },
    })
    const first = await readSummary(browser, channelId, { window: 'last7' })
    const calls = api.google.analyticsRequests.length + api.google.dataApiRequests.length

    const second = await readSummary(browser, channelId, { window: 'last7' })

    expect(api.google.analyticsRequests.length + api.google.dataApiRequests.length).toBe(calls)
    expect(second.body).toEqual({ ...first.body, fromCache: true })
  })
})
