// Limits: these tests read from the fake Google server, so they cannot prove Google's real
// numbers, its real retention curve, the traffic source types it names, how late its last
// processed day runs or the order of its rows. Nick opening one of his own videos on the deployed
// product covers those. A read-only check through the youtube MCP on 2026-10-07 found Google
// answers all five query shapes against one of Nick's videos: the four list metrics with only a
// `video==` filter, `dimensions=day`, `dimensions=elapsedVideoTimeRatio`,
// `dimensions=insightTrafficSourceType` and `dimensions=subscribedStatus`, each with that filter.
// A live check on 2026-10-08 found Google answers `engagedViews` beside `views` with
// `dimensions=subscribedStatus` for one video. The duration comes from the fake's
// `contentDetails.duration`, so these tests cannot prove the value Google gives a live or
// upcoming video.
import type {
  SincePublishRow,
  VideoDetailAnswer,
  VideoListAnswer,
} from '@creator-analytics/api-types'
import { connections } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import type { FakeChannel, FakeUpload, VideoNumbers } from '@creator-analytics/fake-google'
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
const creator = { sub: '306113', email: 'detailer@example.com', name: 'A Detailer' }
const otherCreator = {
  sub: '406113',
  email: 'other-detailer@example.com',
  name: 'Another Detailer',
}

const createdAt = '2019-03-01T06:00:00Z'

// Noon on 2026-10-07 in Pacific Time, so today is 2026-10-07.
const noonToday = new Date('2026-10-07T19:00:00Z')

/** Numbers that name the range they belong to. */
function numbers(n: number): VideoNumbers {
  return {
    engagedViews: n,
    views: n + 1,
    averageViewPercentage: n + 0.5,
    subscribersGained: n + 2,
    estimatedMinutesWatched: n + 3,
  }
}

/** An upload published on 2026-09-01 in Pacific Time. */
function upload(overrides: Partial<FakeUpload> = {}): FakeUpload {
  return {
    videoId: 'video-1',
    title: 'Upload 1',
    publishedAt: '2026-09-01T15:00:00Z',
    ...overrides,
  }
}

/** Signs the creator in and connects their channel, which holds these uploads. */
async function connectedCreator(
  api: StartedApi,
  channelUploads: FakeUpload[],
  channel: Partial<FakeChannel> = {},
) {
  const browser = await signIn(api, creator)
  api.google.pickChannel('UC-detailer')
  api.google.setChannel('UC-detailer', { createdAt, uploads: channelUploads, ...channel })
  await connect(browser)
  const { channels } = await channelsOf(browser)
  const channelId = channels[0]?.id
  if (!channelId) throw new Error('The creator has no connected channel')
  return { browser, channelId }
}

async function videoDetail(
  browser: Browser,
  channelId: string,
  videoId: string,
  query: Record<string, string> | [string, string][] = {},
) {
  const search = new URLSearchParams(query)
  const response = await browser.fetch(`/api/channels/${channelId}/videos/${videoId}?${search}`)
  return { status: response.status, body: (await response.json()) as VideoDetailAnswer }
}

describe('seam 1: one video over a window', () => {
  test('the lifetime detail answers the video, its totals since publish, watch time included, and the last processed day', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload({ metrics: numbers(1000) })])
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'lifetime' })

    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({
      video: {
        id: 'video-1',
        title: 'Upload 1',
        publishedAt: '2026-09-01T15:00:00.000Z',
        scheduled: false,
      },
      window: 'lifetime',
      totals: numbers(1000),
      lastProcessedDay: '2026-10-04',
    })
  })

  test('the detail answers every thumbnail size Google gives the video, narrowest first, and the medium one as its thumbnail only when Google gives that size', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ thumbnailSizes: ['maxres', 'standard', 'high', 'medium', 'default'] }),
      upload({ videoId: 'video-2', thumbnailSizes: ['high'] }),
      upload({ videoId: 'video-3', thumbnailSizes: [] }),
    ])

    const videos = await Promise.all(
      ['video-1', 'video-2', 'video-3'].map(async (videoId) => {
        const { body } = await videoDetail(browser, channelId, videoId, { window: 'lifetime' })
        return { thumbnailUrl: body.video.thumbnailUrl, thumbnails: body.video.thumbnails }
      }),
    )

    expect(videos).toEqual([
      {
        thumbnailUrl: 'https://i.ytimg.com/vi/video-1/mqdefault.jpg',
        thumbnails: [
          { url: 'https://i.ytimg.com/vi/video-1/default.jpg', width: 120 },
          { url: 'https://i.ytimg.com/vi/video-1/mqdefault.jpg', width: 320 },
          { url: 'https://i.ytimg.com/vi/video-1/hqdefault.jpg', width: 480 },
          { url: 'https://i.ytimg.com/vi/video-1/sddefault.jpg', width: 640 },
          { url: 'https://i.ytimg.com/vi/video-1/maxresdefault.jpg', width: 1280 },
        ],
      },
      {
        thumbnailUrl: null,
        thumbnails: [{ url: 'https://i.ytimg.com/vi/video-2/hqdefault.jpg', width: 480 }],
      },
      { thumbnailUrl: null, thumbnails: [] },
    ])
  })

  test("the detail's video carries the thumbnails its list row carries, each on a ytimg.com host, the one the web app's img-src allows", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'lifetime' })
    const list = await browser.fetch(`/api/channels/${channelId}/videos?window=lifetime`)
    const { videos } = (await list.json()) as VideoListAnswer

    expect(detail.body.video.thumbnails).toEqual(videos[0]?.thumbnails)
    const urls = [
      detail.body.video.thumbnailUrl,
      ...detail.body.video.thumbnails.map(({ url }) => url),
    ]
    expect(urls).toHaveLength(4)
    for (const url of urls) expect(url).toMatch(/^https:\/\/([a-z0-9-]+\.)*ytimg\.com\//)
  })

  test('without a window, the detail covers the last 28 days', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        rangeMetrics: [{ startDate: '2026-09-10', endDate: '2026-10-07', metrics: numbers(28) }],
      }),
    ])

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.body).toMatchObject({ window: 'last28', totals: numbers(28) })
  })

  test('window=last7 counts the video over the last processed day and the 6 days before', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        rangeMetrics: [{ startDate: '2026-09-28', endDate: '2026-10-04', metrics: numbers(7) }],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'last7' })

    expect(detail.body).toMatchObject({ window: 'last7', totals: numbers(7) })
  })

  test('a window that starts before the video was published counts from its publish day', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    // 2026-10-03 at 01:00 UTC is still 2026-10-02 in Pacific Time.
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        publishedAt: '2026-10-03T01:00:00Z',
        rangeMetrics: [{ startDate: '2026-10-02', endDate: '2026-10-07', metrics: numbers(28) }],
      }),
    ])

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'last28' })

    expect(detail.body.totals).toEqual(numbers(28))
  })

  test('a video with no row in the window has zero totals', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.body.totals).toEqual({
      engagedViews: 0,
      views: 0,
      averageViewPercentage: 0,
      subscribersGained: 0,
      estimatedMinutesWatched: 0,
    })
  })

  test('the daily series runs from the first counted day to the last processed day, with its watch time, and zeros for absent days', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        publishedAt: '2026-10-01T15:00:00Z',
        days: [
          { day: '2026-10-04', engagedViews: 1, views: 2 },
          { day: '2026-10-02', engagedViews: 3, views: 5, estimatedMinutesWatched: 14 },
          { day: '2026-10-06', engagedViews: 9, views: 9, estimatedMinutesWatched: 30 },
        ],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-05')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'last7' })

    expect(detail.body.days).toEqual([
      { day: '2026-10-01', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
      { day: '2026-10-02', engagedViews: 3, views: 5, estimatedMinutesWatched: 14 },
      { day: '2026-10-03', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
      { day: '2026-10-04', engagedViews: 1, views: 2, estimatedMinutesWatched: 0 },
      { day: '2026-10-05', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
    ])
  })

  test('with no latest row day in the last 90 days, the daily series runs to four days before today', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    // A channel that holds no days answers the last processed day search with no rows.
    const { browser, channelId } = await connectedCreator(
      api,
      [upload({ days: [{ day: '2026-10-03', engagedViews: 4, views: 6 }] })],
      { days: {} },
    )

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'last7' })

    expect(detail.body.lastProcessedDay).toBe('2026-10-03')
    expect(detail.body.days).toEqual([
      { day: '2026-09-27', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
      { day: '2026-09-28', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
      { day: '2026-09-29', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
      { day: '2026-09-30', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
      { day: '2026-10-01', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
      { day: '2026-10-02', engagedViews: 0, views: 0, estimatedMinutesWatched: 0 },
      { day: '2026-10-03', engagedViews: 4, views: 6, estimatedMinutesWatched: 0 },
    ])
  })

  test("the retention curve answers both of Google's ratios, from the start of the video", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        retention: [
          {
            elapsedVideoTimeRatio: 0.02,
            audienceWatchRatio: 0.73,
            relativeRetentionPerformance: 0.46,
          },
          {
            elapsedVideoTimeRatio: 0.01,
            audienceWatchRatio: 1.12,
            relativeRetentionPerformance: 0.38,
          },
        ],
      }),
    ])

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.body.audienceRetention).toEqual([
      { elapsedVideoTimeRatio: 0.01, audienceWatchRatio: 1.12, relativeRetentionPerformance: 0.38 },
      { elapsedVideoTimeRatio: 0.02, audienceWatchRatio: 0.73, relativeRetentionPerformance: 0.46 },
    ])
  })

  test('the traffic source types answer their engaged views and views, most engaged views first, then most views, then by type', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        trafficSources: {
          RELATED_VIDEO: { engagedViews: 20, views: 30 },
          YT_SEARCH: { engagedViews: 610, views: 845 },
          EXT_URL: { engagedViews: 20, views: 30 },
          NOTIFICATION: { engagedViews: 20, views: 41 },
          SUBSCRIBER: { engagedViews: 98, views: 125 },
        },
      }),
    ])

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.body.trafficSources).toEqual([
      { type: 'YT_SEARCH', engagedViews: 610, views: 845 },
      { type: 'SUBSCRIBER', engagedViews: 98, views: 125 },
      { type: 'NOTIFICATION', engagedViews: 20, views: 41 },
      { type: 'EXT_URL', engagedViews: 20, views: 30 },
      { type: 'RELATED_VIDEO', engagedViews: 20, views: 30 },
    ])
  })

  test('the video detail answer carries no countries, and the API sends no per-video country query', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.status).toBe(200)
    expect(detail.body).not.toHaveProperty('countries')
    expect(
      api.google.analyticsRequests.filter((query) => query.get('dimensions') === 'country'),
    ).toEqual([])
  })

  test('the subscriber split answers the engaged views and views of subscribed and unsubscribed viewers', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        subscriberNumbers: {
          SUBSCRIBED: { engagedViews: 40, views: 48 },
          UNSUBSCRIBED: { engagedViews: 900, views: 1088 },
        },
      }),
    ])

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.body.subscriberSplit).toEqual({
      subscribed: { engagedViews: 40, views: 48 },
      unsubscribed: { engagedViews: 900, views: 1088 },
    })
  })

  test('a subscribed status Google has no row for answers zero engaged views and zero views', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ subscriberNumbers: { UNSUBSCRIBED: { engagedViews: 9, views: 12 } } }),
    ])

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.body.subscriberSplit).toEqual({
      subscribed: { engagedViews: 0, views: 0 },
      unsubscribed: { engagedViews: 9, views: 12 },
    })
  })

  test("the detail carries the video's duration in seconds", async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload({ duration: 'PT1H2M3S' })])

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.body.video.durationSeconds).toBe(3723)
  })

  test('a video Google gives no duration, or a zero one, carries none', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ videoId: 'video-1' }),
      upload({ videoId: 'video-2', duration: 'P0D' }),
    ])

    const none = await videoDetail(browser, channelId, 'video-1')
    const zero = await videoDetail(browser, channelId, 'video-2')

    expect(none.body.video.durationSeconds).toBeNull()
    expect(zero.body.video.durationSeconds).toBeNull()
  })

  test("the duration and whether the video can play cost no extra Google call: the detail's Data API reads are one channels.list, the playlist pages and one videos.list, for the status and contentDetails parts", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ duration: 'PT4M30S', embeddable: false, madeForKids: true }),
    ])
    const before = api.google.dataApiRequests.length

    await videoDetail(browser, channelId, 'video-1')

    const partsOf = (url: URL) =>
      new Set(url.searchParams.getAll('part').flatMap((part) => part.split(',')))
    expect(
      api.google.dataApiRequests
        .slice(before)
        .map((url) => ({ path: url.pathname, parts: partsOf(url) })),
    ).toEqual([
      { path: '/youtube/v3/channels', parts: new Set(['snippet', 'contentDetails']) },
      { path: '/youtube/v3/playlistItems', parts: new Set(['snippet', 'contentDetails']) },
      { path: '/youtube/v3/videos', parts: new Set(['status', 'contentDetails']) },
    ])
  })

  test('a scheduled video answers zeros and no series, awaiting processing, and asks Google only for the last processed day', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      { videoId: 'video-1', title: 'Upload 1', scheduledFor: '2026-10-20T15:00:00Z' },
    ])

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({
      video: { publishedAt: '2026-10-20T15:00:00.000Z', scheduled: true, durationSeconds: null },
      totals: {
        engagedViews: 0,
        views: 0,
        averageViewPercentage: 0,
        subscribersGained: 0,
        estimatedMinutesWatched: 0,
      },
      days: [],
      audienceRetention: [],
      trafficSources: [],
      subscriberSplit: {
        subscribed: { engagedViews: 0, views: 0 },
        unsubscribed: { engagedViews: 0, views: 0 },
      },
      awaitingProcessing: true,
    })
    expect(api.google.analyticsRequests).toHaveLength(1)
  })

  test('a video awaiting processing answers zeros and no series in a window after publish and in lifetime, and sends no Analytics query for it', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    // The fake answers a row and lifetime numbers for the video, so any read of them would show.
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        publishedAt: '2026-10-05T15:00:00Z',
        metrics: numbers(5),
        days: [dayOf('2026-10-05', 1)],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const first7 = await videoDetail(browser, channelId, 'video-1', { window: 'first7' })
    const lifetime = await videoDetail(browser, channelId, 'video-1', { window: 'lifetime' })

    const noNumbers = {
      totals: {
        engagedViews: 0,
        views: 0,
        averageViewPercentage: 0,
        subscribersGained: 0,
        estimatedMinutesWatched: 0,
      },
      days: [],
      audienceRetention: [],
      trafficSources: [],
      subscriberSplit: {
        subscribed: { engagedViews: 0, views: 0 },
        unsubscribed: { engagedViews: 0, views: 0 },
      },
    }
    for (const detail of [first7, lifetime]) {
      expect(detail.status).toBe(200)
      expect(detail.body).toMatchObject({
        video: { id: 'video-1' },
        ...noNumbers,
        awaitingProcessing: true,
        lastProcessedDay: '2026-10-04',
      })
      expect(detail.body.sincePublish).toEqual({ rows: unprocessedRows() })
    }
    expect(first7.body.partial).toEqual({ days: 0, of: 7 })
    expect(lifetime.body).not.toHaveProperty('partial')
    expect(
      api.google.analyticsRequests.filter((query) => query.get('filters') === 'video==video-1'),
    ).toEqual([])
  })

  test("a video with no publish day counts the window's own days in a calendar, lifetime or custom window, and no day in a window after publish", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    // A private draft never published and never scheduled: Google may give it no publish time.
    const { browser, channelId } = await connectedCreator(api, [
      {
        videoId: 'video-1',
        title: 'Draft',
        privacyStatus: 'private',
        metrics: numbers(1000),
        rangeMetrics: [
          { startDate: '2026-09-07', endDate: '2026-10-04', metrics: numbers(28) },
          { startDate: '2026-09-01', endDate: '2026-10-04', metrics: numbers(34) },
        ],
      },
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const last28 = await videoDetail(browser, channelId, 'video-1', { window: 'last28' })
    const lifetime = await videoDetail(browser, channelId, 'video-1', { window: 'lifetime' })
    const custom = await videoDetail(browser, channelId, 'video-1', {
      window: 'custom',
      from: '2026-09-01',
      to: '2026-10-04',
    })
    const before = api.google.analyticsRequests.length
    const first28 = await videoDetail(browser, channelId, 'video-1', { window: 'first28' })

    expect(last28.body).toMatchObject({ totals: numbers(28), awaitingProcessing: false })
    expect(lifetime.body).toMatchObject({ totals: numbers(1000), awaitingProcessing: false })
    expect(custom.body).toMatchObject({ totals: numbers(34), awaitingProcessing: false })
    expect(first28.body).toMatchObject({
      totals: {
        engagedViews: 0,
        views: 0,
        averageViewPercentage: 0,
        subscribersGained: 0,
        estimatedMinutesWatched: 0,
      },
      days: [],
      awaitingProcessing: false,
    })
    expect(
      api.google.analyticsRequests
        .slice(before)
        .filter((query) => query.get('filters') === 'video==video-1'),
    ).toEqual([])
  })

  test('a video is awaiting processing until Google has processed a day on or after its publish day', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ videoId: 'video-1', publishedAt: '2026-10-05T15:00:00Z' }),
      upload({ videoId: 'video-2', publishedAt: '2026-10-04T15:00:00Z' }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const after = await videoDetail(browser, channelId, 'video-1')
    const onTheDay = await videoDetail(browser, channelId, 'video-2')

    expect(after.body.awaitingProcessing).toBe(true)
    expect(onTheDay.body.awaitingProcessing).toBe(false)
  })

  test('with a last processed day four days before today, a video published the day after it is awaiting processing, and an older video gets no zero day after it', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ videoId: 'video-1', publishedAt: '2026-10-04T15:00:00Z' }),
      upload({
        videoId: 'video-2',
        days: [
          { day: '2026-10-02', engagedViews: 3, views: 3 },
          { day: '2026-10-03', engagedViews: 3, views: 3 },
        ],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-03')

    const young = await videoDetail(browser, channelId, 'video-1', { window: 'first7' })
    const older = await videoDetail(browser, channelId, 'video-2', { window: 'last7' })

    expect(young.body).toMatchObject({ awaitingProcessing: true, partial: { days: 0, of: 7 } })
    expect(young.body.sincePublish.daysSincePublish).toBeUndefined()
    expect(older.body.lastProcessedDay).toBe('2026-10-03')
    expect(older.body.days.at(-1)).toEqual({
      day: '2026-10-03',
      engagedViews: 3,
      views: 3,
      estimatedMinutesWatched: 0,
    })
  })

  test('with no latest row day, a video published in the last four days is awaiting processing, and one published before is not', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(
      api,
      [
        upload({ videoId: 'video-1', publishedAt: '2026-10-05T15:00:00Z' }),
        upload({ videoId: 'video-2', publishedAt: '2026-08-01T15:00:00Z' }),
        upload({ videoId: 'video-3', publishedAt: '2026-10-04T15:00:00Z' }),
      ],
      { days: {} },
    )

    const recent = await videoDetail(browser, channelId, 'video-1')
    const older = await videoDetail(browser, channelId, 'video-2')
    const fourDaysOld = await videoDetail(browser, channelId, 'video-3')

    expect(recent.body.awaitingProcessing).toBe(true)
    expect(older.body.awaitingProcessing).toBe(false)
    expect(fourDaysOld.body.awaitingProcessing).toBe(true)
  })

  test('with a latest row day older than four days before today, a video published before four days ago counts its days through then, and is not awaiting processing', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    // An idle channel: its last day with a row is 2026-09-20.
    const { browser, channelId } = await connectedCreator(
      api,
      [upload({ publishedAt: '2026-10-02T15:00:00Z' })],
      { days: { '2026-09-20': { engagedViews: 1, views: 1 } } },
    )

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'first7' })

    expect(detail.body).toMatchObject({ awaitingProcessing: false, partial: { days: 2, of: 7 } })
    expect(detail.body.sincePublish.daysSincePublish).toBe(2)
  })

  test('a second read inside the cache window spends no quota', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    const first = await videoDetail(browser, channelId, 'video-1')
    const asked = api.google.analyticsRequests.length

    const second = await videoDetail(browser, channelId, 'video-1')

    expect(second.body).toEqual({ ...first.body, fromCache: true })
    expect(api.google.analyticsRequests).toHaveLength(asked)
  })
})

describe('seam 1: whether the video can play', () => {
  test('a public, an unlisted and a private video answer their privacy, embeddable and not made for kids', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ videoId: 'video-1', privacyStatus: 'public', embeddable: true, madeForKids: false }),
      upload({
        videoId: 'video-2',
        privacyStatus: 'unlisted',
        embeddable: true,
        madeForKids: false,
      }),
      upload({
        videoId: 'video-3',
        privacyStatus: 'private',
        embeddable: true,
        madeForKids: false,
      }),
    ])

    const videos = await Promise.all(
      ['video-1', 'video-2', 'video-3'].map(async (videoId) => {
        const { body } = await videoDetail(browser, channelId, videoId)
        const { privacy, embeddable, madeForKids } = body.video
        return { privacy, embeddable, madeForKids }
      }),
    )

    expect(videos).toEqual([
      { privacy: 'public', embeddable: true, madeForKids: false },
      { privacy: 'unlisted', embeddable: true, madeForKids: false },
      { privacy: 'private', embeddable: true, madeForKids: false },
    ])
  })

  test('a video Google marks not embeddable answers embeddable false', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload({ embeddable: false })])

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.body.video.embeddable).toBe(false)
  })

  test('a video Google marks made for kids answers madeForKids true', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload({ madeForKids: true })])

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.body.video.madeForKids).toBe(true)
  })

  test("a video whose status leaves out embeddable and madeForKids answers Google's defaults: embeddable, and not made for kids", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect({
      embeddable: detail.body.video.embeddable,
      madeForKids: detail.body.video.madeForKids,
    }).toEqual({ embeddable: true, madeForKids: false })
  })
})

/** The Analytics queries for content types, the video list's format read. */
function contentTypeQueriesOf(api: StartedApi): URLSearchParams[] {
  return api.google.analyticsRequests.filter(
    (query) => query.get('dimensions') === 'video,creatorContentType',
  )
}

describe("seam 1: the video's format", () => {
  test("the detail answers the format of Google's content type: video, short and live, and null for a video Google answers no content type row for", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ videoId: 'video-1', metrics: numbers(1), creatorContentType: 'videoOnDemand' }),
      upload({ videoId: 'video-2', metrics: numbers(2), creatorContentType: 'shorts' }),
      upload({ videoId: 'video-3', metrics: numbers(3), creatorContentType: 'liveStream' }),
      // No numbers, so the fake answers no content type row for it.
      upload({ videoId: 'video-4' }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const formats = []
    for (const videoId of ['video-1', 'video-2', 'video-3', 'video-4']) {
      const { status, body } = await videoDetail(browser, channelId, videoId)
      formats.push([videoId, status, body.video.format])
    }

    expect(formats).toEqual([
      ['video-1', 200, 'video'],
      ['video-2', 200, 'short'],
      ['video-3', 200, 'live'],
      ['video-4', 200, null],
    ])
  })

  test('a detail opened after the video list reads no content type of its own: one content type query in all', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ videoId: 'video-1', metrics: numbers(1), creatorContentType: 'shorts' }),
      upload({ videoId: 'video-2', metrics: numbers(2) }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    await browser.fetch(`/api/channels/${channelId}/videos?window=last28`)
    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.body.video.format).toBe('short')
    expect(contentTypeQueriesOf(api)).toHaveLength(1)
  })

  test("past one query's worth of videos, the detail of the last upload reads the list's own batch, so the list's two content type queries are all", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const count = 501
    const { browser, channelId } = await connectedCreator(
      api,
      Array.from({ length: count }, (_, i) =>
        upload({
          videoId: `video-${i + 1}`,
          title: `Upload ${i + 1}`,
          metrics: numbers(i + 1),
          creatorContentType: i + 1 === count ? 'liveStream' : 'videoOnDemand',
        }),
      ),
    )
    api.google.setLastProcessedDay('2026-10-04')

    await browser.fetch(`/api/channels/${channelId}/videos?window=last28`)
    const detail = await videoDetail(browser, channelId, `video-${count}`)

    expect(detail.body.video.format).toBe('live')
    expect(contentTypeQueriesOf(api)).toHaveLength(2)
  })

  test('a video awaiting processing answers no format, and sends no content type query', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        publishedAt: '2026-10-05T15:00:00Z',
        metrics: numbers(5),
        creatorContentType: 'shorts',
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.body).toMatchObject({ awaitingProcessing: true, video: { format: null } })
    expect(contentTypeQueriesOf(api)).toEqual([])
  })
})

describe('seam 1: one video over a window after publish', () => {
  test("window=first28 counts the video's own 28 days from its publish day, average percentage viewed included", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        rangeMetrics: [{ startDate: '2026-09-01', endDate: '2026-09-28', metrics: numbers(28) }],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'first28' })

    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({ window: 'first28', totals: numbers(28) })
    expect(detail.body).not.toHaveProperty('partial')
  })

  test('the daily series of a window after publish is labelled by day after publish, day 1 the publish day', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        days: [
          { day: '2026-09-01', engagedViews: 1, views: 2, estimatedMinutesWatched: 5 },
          { day: '2026-09-07', engagedViews: 3, views: 4 },
          { day: '2026-09-08', engagedViews: 9, views: 9 },
        ],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'first7' })

    const zeros = { engagedViews: 0, views: 0, estimatedMinutesWatched: 0 }
    expect(detail.body.days).toEqual([
      {
        day: '2026-09-01',
        dayAfterPublish: 1,
        engagedViews: 1,
        views: 2,
        estimatedMinutesWatched: 5,
      },
      { day: '2026-09-02', dayAfterPublish: 2, ...zeros },
      { day: '2026-09-03', dayAfterPublish: 3, ...zeros },
      { day: '2026-09-04', dayAfterPublish: 4, ...zeros },
      { day: '2026-09-05', dayAfterPublish: 5, ...zeros },
      { day: '2026-09-06', dayAfterPublish: 6, ...zeros },
      {
        day: '2026-09-07',
        dayAfterPublish: 7,
        engagedViews: 3,
        views: 4,
        estimatedMinutesWatched: 0,
      },
    ])
  })

  // Published on 2026-09-25, so first28 runs to 2026-10-22. Google has processed 2026-09-25 to
  // 2026-10-04, 10 of the 28 days, and the range asked of Google ends at today.
  test('a video whose window after publish Google has not processed to its end carries the days it has', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        publishedAt: '2026-09-25T15:00:00Z',
        rangeMetrics: [{ startDate: '2026-09-25', endDate: '2026-10-07', metrics: numbers(10) }],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'first28' })

    expect(detail.body).toMatchObject({ totals: numbers(10), partial: { days: 10, of: 28 } })
    expect(detail.body.days.map(({ dayAfterPublish }) => dayAfterPublish)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
  })

  test('window=first1 counts the publish day alone, as day 1', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        rangeMetrics: [{ startDate: '2026-09-01', endDate: '2026-09-01', metrics: numbers(1) }],
        days: [
          { day: '2026-09-01', engagedViews: 1, views: 2 },
          { day: '2026-09-02', engagedViews: 9, views: 9 },
        ],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'first1' })

    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({ window: 'first1', totals: numbers(1) })
    expect(detail.body.days).toEqual([
      {
        day: '2026-09-01',
        dayAfterPublish: 1,
        engagedViews: 1,
        views: 2,
        estimatedMinutesWatched: 0,
      },
    ])
    expect(detail.body).not.toHaveProperty('partial')
  })

  // first90 from 2026-06-01 ends on 2026-08-29, and first365 from 2025-09-01 on 2026-08-31.
  test.for([
    ['first90', '2026-06-01T15:00:00Z', '2026-06-01', '2026-08-29', 90],
    ['first365', '2025-09-01T15:00:00Z', '2025-09-01', '2026-08-31', 365],
  ] as const)(
    "window=%s counts the video's own days from its publish day",
    async ([window, publishedAt, startDate, endDate, length], { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, [
        upload({ publishedAt, rangeMetrics: [{ startDate, endDate, metrics: numbers(length) }] }),
      ])
      api.google.setLastProcessedDay('2026-10-04')

      const detail = await videoDetail(browser, channelId, 'video-1', { window })

      expect(detail.status).toBe(200)
      expect(detail.body).toMatchObject({ window, totals: numbers(length) })
      expect(detail.body).not.toHaveProperty('partial')
      expect(detail.body.days).toHaveLength(length)
      expect(detail.body.days.at(0)).toMatchObject({ day: startDate, dayAfterPublish: 1 })
      expect(detail.body.days.at(-1)).toMatchObject({ day: endDate, dayAfterPublish: length })
    },
  )

  // Published on 2026-09-01, so Google has processed 34 days of the window, to 2026-10-04, and the
  // range asked of Google ends at today.
  test.for([
    ['first90', 90],
    ['first365', 365],
  ] as const)(
    'in %s, a video Google has not processed to the end of the window carries the days it has',
    async ([window, of], { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, [
        upload({
          rangeMetrics: [{ startDate: '2026-09-01', endDate: '2026-10-07', metrics: numbers(34) }],
        }),
      ])
      api.google.setLastProcessedDay('2026-10-04')

      const detail = await videoDetail(browser, channelId, 'video-1', { window })

      expect(detail.body).toMatchObject({ totals: numbers(34), partial: { days: 34, of } })
      expect(detail.body.days.map(({ dayAfterPublish }) => dayAfterPublish)).toEqual(
        Array.from({ length: 34 }, (_, i) => i + 1),
      )
    },
  )

  test('a scheduled video carries none of the days of its window after publish', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      { videoId: 'video-1', title: 'Upload 1', scheduledFor: '2026-10-20T15:00:00Z' },
    ])

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'first7' })

    expect(detail.body).toMatchObject({
      days: [],
      awaitingProcessing: true,
      partial: { days: 0, of: 7 },
    })
  })

  test('a calendar window carries no day after publish and no partial days', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        publishedAt: '2026-10-05T15:00:00Z',
        days: [{ day: '2026-10-05', engagedViews: 1, views: 2 }],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-05')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'last7' })

    expect(detail.body).not.toHaveProperty('partial')
    expect(detail.body.days).toEqual([
      { day: '2026-10-05', engagedViews: 1, views: 2, estimatedMinutesWatched: 0 },
    ])
  })
})

/** A video's numbers on one day: n engaged views, 2n views and 3n minutes, with revenue n / 100. */
function dayOf(day: string, n: number) {
  return {
    day,
    engagedViews: n,
    views: 2 * n,
    estimatedMinutesWatched: 3 * n,
    estimatedRevenue: n / 100,
  }
}

/** A stage's numbers: the sum of days whose n add up to `n`. */
function stageOf(stage: SincePublishRow['stage'], n: number, revenue = false): SincePublishRow {
  return {
    stage,
    engagedViews: n,
    views: 2 * n,
    estimatedMinutesWatched: 3 * n,
    ...(revenue ? { estimatedRevenue: n / 100 } : {}),
  }
}

/** The lifetime totals of `yearOldVideo`, YouTube's own, set apart from the sum of its days. */
const yearOldLifetime: VideoNumbers = {
  engagedViews: 5,
  views: 6,
  averageViewPercentage: 40,
  subscribersGained: 2,
  estimatedMinutesWatched: 7,
  estimatedRevenue: 0.25,
}

// Published on 2025-09-01, so its first 7 days end on 2025-09-07, its first 28 on 2025-09-28, its
// first 90 on 2025-11-29 and its first 365 on 2026-08-31. A day on each side of each stage's end
// shows which stages count it.
const yearOldVideo = upload({
  publishedAt: '2025-09-01T15:00:00Z',
  metrics: yearOldLifetime,
  days: [
    dayOf('2025-09-01', 1),
    dayOf('2025-09-07', 10),
    dayOf('2025-09-08', 100),
    dayOf('2025-09-28', 1000),
    dayOf('2025-09-29', 10000),
    dayOf('2025-11-29', 100000),
    dayOf('2025-11-30', 1000000),
    dayOf('2026-08-31', 10000000),
    dayOf('2026-09-01', 100000000),
  ],
})

/** The since publish rows of `yearOldVideo`, with its revenue or without it. */
function yearOldRows(revenue: boolean): SincePublishRow[] {
  return [
    stageOf('first1', 1, revenue),
    stageOf('first7', 11, revenue),
    stageOf('first28', 1111, revenue),
    stageOf('first90', 111111, revenue),
    stageOf('first365', 11111111, revenue),
    {
      stage: 'lifetime',
      engagedViews: 5,
      views: 6,
      estimatedMinutesWatched: 7,
      ...(revenue ? { estimatedRevenue: 0.25 } : {}),
    },
  ]
}

/** The since publish rows of a video Google has processed no day of: zeros, and none of the days. */
function unprocessedRows(): SincePublishRow[] {
  return [
    { ...stageOf('first1', 0), partial: { days: 0, of: 1 } },
    { ...stageOf('first7', 0), partial: { days: 0, of: 7 } },
    { ...stageOf('first28', 0), partial: { days: 0, of: 28 } },
    { ...stageOf('first90', 0), partial: { days: 0, of: 90 } },
    { ...stageOf('first365', 0), partial: { days: 0, of: 365 } },
    stageOf('lifetime', 0),
  ]
}

/** The Analytics queries of one video by day, as [startDate, endDate, metrics, currency]. */
function dayQueriesOf(api: StartedApi) {
  return api.google.analyticsRequests
    .filter(
      (query) => query.get('dimensions') === 'day' && query.get('filters') === 'video==video-1',
    )
    .map((query) => [
      query.get('startDate'),
      query.get('endDate'),
      query.get('metrics'),
      query.get('currency'),
    ])
}

describe('seam 1: since publish', () => {
  test("a video older than a year carries each stage as the sum of its own days, and lifetime as YouTube's own total", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [yearOldVideo])
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.status).toBe(200)
    // 2025-09-01 is day 1, so 2026-10-04, the last processed day, is day 399.
    expect(detail.body.sincePublish).toEqual({ rows: yearOldRows(false), daysSincePublish: 399 })
  })

  test('one query by day, from the publish day to the last processed day, feeds every stage, and a second visit inside the cache window spends no quota', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [yearOldVideo])
    api.google.setLastProcessedDay('2026-10-04')

    const first = await videoDetail(browser, channelId, 'video-1', { window: 'last7' })
    const asked = api.google.analyticsRequests.length
    const second = await videoDetail(browser, channelId, 'video-1', { window: 'last7' })

    expect(dayQueriesOf(api)).toEqual([
      ['2026-09-28', '2026-10-04', 'engagedViews,views,estimatedMinutesWatched', null],
      ['2025-09-01', '2026-10-04', 'engagedViews,views,estimatedMinutesWatched', null],
    ])
    expect(second.body.sincePublish).toEqual(first.body.sincePublish)
    expect(api.google.analyticsRequests).toHaveLength(asked)
  })

  // Published on 2026-09-25: Google has processed it to 2026-10-04, 10 days.
  test('a 10-day-old video carries its publish day and first 7 days whole, and the days it has of every longer stage', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        publishedAt: '2026-09-25T15:00:00Z',
        metrics: { ...yearOldLifetime, estimatedRevenue: 0 },
        days: [dayOf('2026-09-25', 1), dayOf('2026-10-01', 10), dayOf('2026-10-04', 100)],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.body.sincePublish.rows).toEqual([
      stageOf('first1', 1),
      stageOf('first7', 11),
      { ...stageOf('first28', 111), partial: { days: 10, of: 28 } },
      { ...stageOf('first90', 111), partial: { days: 10, of: 90 } },
      { ...stageOf('first365', 111), partial: { days: 10, of: 365 } },
      { stage: 'lifetime', engagedViews: 5, views: 6, estimatedMinutesWatched: 7 },
    ])
    expect(detail.body.sincePublish.daysSincePublish).toBe(10)
  })

  test('a video YouTube has not processed yet carries zeros and none of the days of every stage, and makes no query for them', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ publishedAt: '2026-10-05T15:00:00Z', days: [dayOf('2026-10-05', 1)] }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'lifetime' })

    expect(detail.body.sincePublish.rows).toEqual(unprocessedRows())
    expect(detail.body.sincePublish).not.toHaveProperty('daysSincePublish')
    expect(dayQueriesOf(api)).toEqual([])
  })

  test('with revenue consent, a video YouTube has not processed yet carries no revenue in any stage and makes no revenue call', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ publishedAt: '2026-10-05T15:00:00Z', days: [dayOf('2026-10-05', 1)] }),
    ])
    await giveRevenueConsent(browser, channelId)
    await savePreferences(browser, { currency: 'EUR' })
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'lifetime' })

    expect(detail.body).not.toHaveProperty('revenue')
    expect(detail.body.sincePublish).toEqual({ rows: unprocessedRows() })
    expect(dayQueriesOf(api)).toEqual([])
  })

  test('a scheduled video carries zeros in every stage, and makes no query for them', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      { videoId: 'video-1', title: 'Upload 1', scheduledFor: '2026-10-20T15:00:00Z' },
    ])

    const detail = await videoDetail(browser, channelId, 'video-1')

    expect(detail.body.sincePublish.rows).toEqual(unprocessedRows())
    expect(dayQueriesOf(api)).toEqual([])
  })

  test('the stages answer the same in every window', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [yearOldVideo])
    api.google.setLastProcessedDay('2026-10-04')

    const answers = []
    for (const window of ['lifetime', 'last7', 'first28']) {
      answers.push((await videoDetail(browser, channelId, 'video-1', { window })).body.sincePublish)
    }

    expect(answers[0]?.rows.map(({ stage }) => stage)).toEqual([
      'first1',
      'first7',
      'first28',
      'first90',
      'first365',
      'lifetime',
    ])
    expect(answers.slice(1)).toEqual([answers[0], answers[0]])
  })

  test("in the lifetime window, the lifetime row reads the window's own totals and revenue, so it spends no query of its own", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [yearOldVideo])
    await giveRevenueConsent(browser, channelId)
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'lifetime' })

    expect(detail.body.sincePublish).toEqual({
      rows: yearOldRows(true),
      revenueCurrency: 'USD',
      daysSincePublish: 399,
    })
    const totalsQueries = api.google.analyticsRequests
      .filter((query) => !query.has('dimensions') && query.get('filters') === 'video==video-1')
      .map((query) => [query.get('startDate'), query.get('endDate'), query.get('metrics')])
    // The lifetime window's own two: its totals, then its revenue.
    expect(totalsQueries).toEqual([
      [
        '2025-09-01',
        '2026-10-07',
        'engagedViews,views,averageViewPercentage,subscribersGained,estimatedMinutesWatched',
      ],
      [
        '2025-09-01',
        '2026-10-07',
        'estimatedRevenue,estimatedAdRevenue,estimatedRedPartnerRevenue',
      ],
    ])
  })

  test("with revenue consent, every stage carries its days' revenue added up, lifetime YouTube's own, in the saved currency, from the same one query by day", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [yearOldVideo])
    await giveRevenueConsent(browser, channelId)
    await savePreferences(browser, { currency: 'EUR' })
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'last7' })

    expect(detail.body.sincePublish).toEqual({
      rows: yearOldRows(true),
      revenueCurrency: 'EUR',
      daysSincePublish: 399,
    })
    expect(dayQueriesOf(api)).toEqual(
      expect.arrayContaining([
        [
          '2025-09-01',
          '2026-10-04',
          'engagedViews,views,estimatedMinutesWatched,estimatedRevenue',
          'EUR',
        ],
      ]),
    )
    expect(dayQueriesOf(api).filter(([startDate]) => startDate === '2025-09-01')).toHaveLength(1)
  })

  test('without revenue consent, and for a channel outside the YouTube Partner Program, no stage carries revenue and the stages still answer', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [yearOldVideo])
    api.google.setLastProcessedDay('2026-10-04')

    const withoutConsent = await videoDetail(browser, channelId, 'video-1')
    await giveRevenueConsent(browser, channelId)
    api.google.setPartnerProgram('UC-detailer', false)
    const outside = await videoDetail(browser, channelId, 'video-1', { window: 'last7' })

    expect(withoutConsent.body.sincePublish).toEqual({
      rows: yearOldRows(false),
      daysSincePublish: 399,
    })
    expect(outside.body.revenue).toEqual({ refusal: 'not_monetized' })
    expect(outside.body.sincePublish).toEqual({ rows: yearOldRows(false), daysSincePublish: 399 })
  })
})

describe('seam 1: the video detail refuses what it cannot answer', () => {
  test('a user without a membership to the channel gets not_connected', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    expect((await videoDetail(browser, channelId, 'video-1')).status).toBe(200)
    const other = await signIn(api, otherCreator)

    const read = await videoDetail(other, channelId, 'video-1')

    expect(read).toEqual({ status: 404, body: { refusal: 'not_connected' } })
  })

  test('a channel whose connection is revoked gets no detail, not even a cached one', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    expect((await videoDetail(browser, channelId, 'video-1')).status).toBe(200)
    const userId = await userIdOf(web, creator.email)
    await web.asUser(userId, (tx) => tx.sql.update(connections).set({ status: 'revoked' }))

    const read = await videoDetail(browser, channelId, 'video-1')

    expect(read).toEqual({ status: 410, body: { refusal: 'connection_revoked' } })
  })

  test("a video id not among the channel's uploads gets video_not_found before any Analytics query", async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])

    const refused = await Promise.all(
      ['video-2', 'video-1,video-2', 'video-1;country==US'].map((videoId) =>
        videoDetail(browser, channelId, encodeURIComponent(videoId)),
      ),
    )

    expect(refused).toEqual(
      Array.from({ length: 3 }, () => ({ status: 404, body: { refusal: 'video_not_found' } })),
    )
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('an unknown window is refused with invalid_window before any read', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    const before = api.google.dataApiRequests.length

    const refused = await videoDetail(browser, channelId, 'video-1', { window: 'last30' })

    expect(refused).toEqual({ status: 400, body: { error: 'invalid_window' } })
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('a window sent twice is refused with invalid_window before any read', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    const before = api.google.dataApiRequests.length

    const refused = await videoDetail(browser, channelId, 'video-1', [
      ['window', 'lifetime'],
      ['window', 'last28'],
    ])

    expect(refused).toEqual({ status: 400, body: { error: 'invalid_window' } })
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })
})

describe('seam 1: one video over a custom range', () => {
  test('a custom range that is bad before any read is refused with invalid_range before any read', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    const before = api.google.dataApiRequests.length

    const refused = []
    for (const query of badRangeQueries) {
      refused.push(await videoDetail(browser, channelId, 'video-1', query))
    }

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
    const { browser, channelId } = await connectedCreator(api, [upload()])
    api.google.setLastProcessedDay('2026-10-04')

    // The creation day is 2019-02-28 in Pacific Time.
    const refused = [
      await videoDetail(browser, channelId, 'video-1', {
        window: 'custom',
        from: '2019-02-27',
        to: '2019-03-10',
      }),
      await videoDetail(browser, channelId, 'video-1', {
        window: 'custom',
        from: '2026-10-01',
        to: '2026-10-05',
      }),
    ]

    expect(refused).toEqual([
      { status: 400, body: { error: 'invalid_range' } },
      { status: 400, body: { error: 'invalid_range' } },
    ])
    expect(metricQueriesOf(api, noonToday)).toHaveLength(0)
  })

  test('a range that ends on the last processed day is answered', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1', {
      window: 'custom',
      from: '2026-10-01',
      to: '2026-10-04',
    })

    expect(detail.status).toBe(200)
    expect(detail.body.days.map(({ day }) => day)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
  })

  test('a custom range counts the video from the later of its start and the publish day, to its end', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    // Published 2026-09-01 in Pacific Time.
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        rangeMetrics: [
          { startDate: '2026-09-01', endDate: '2026-09-03', metrics: numbers(3) },
          { startDate: '2026-09-10', endDate: '2026-09-12', metrics: numbers(12) },
        ],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const beforePublish = await videoDetail(browser, channelId, 'video-1', {
      window: 'custom',
      from: '2026-08-25',
      to: '2026-09-03',
    })
    const afterPublish = await videoDetail(browser, channelId, 'video-1', {
      window: 'custom',
      from: '2026-09-10',
      to: '2026-09-12',
    })

    expect(beforePublish.body).toMatchObject({ window: 'custom', totals: numbers(3) })
    expect(beforePublish.body.days.map(({ day }) => day)).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ])
    expect(afterPublish.body).toMatchObject({ window: 'custom', totals: numbers(12) })
    expect(afterPublish.body.days.map(({ day }) => day)).toEqual([
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
    ])
  })

  test('a custom range that ends before the publish day answers no days, and asks Google nothing over it', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    api.google.setLastProcessedDay('2026-10-04')

    // The creation day alone, long before the video's publish day of 2026-09-01.
    const detail = await videoDetail(browser, channelId, 'video-1', {
      window: 'custom',
      from: '2019-02-28',
      to: '2019-02-28',
    })

    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({ window: 'custom', days: [], audienceRetention: [] })
    expect(
      api.google.analyticsRequests.filter((query) => query.get('endDate') === '2019-02-28'),
    ).toEqual([])
  })

  test('with revenue consent, a custom range that ends before the publish day answers the same since publish rows as lifetime, revenue included', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ days: [dayOf('2026-09-01', 100), dayOf('2026-09-10', 50)] }),
    ])
    await giveRevenueConsent(browser, channelId)
    api.google.setLastProcessedDay('2026-10-04')

    const lifetime = await videoDetail(browser, channelId, 'video-1', { window: 'lifetime' })
    const beforePublish = await videoDetail(browser, channelId, 'video-1', {
      window: 'custom',
      from: '2025-01-01',
      to: '2025-01-31',
    })

    expect(lifetime.body.sincePublish.revenueCurrency).toBe('USD')
    expect(beforePublish.body.sincePublish).toEqual(lifetime.body.sincePublish)
  })

  test('for a channel outside the YouTube Partner Program, a custom range that ends before the publish day answers its since publish rows without revenue', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ days: [dayOf('2026-09-01', 100), dayOf('2026-09-10', 50)] }),
    ])
    await giveRevenueConsent(browser, channelId)
    api.google.setPartnerProgram('UC-detailer', false)
    api.google.setLastProcessedDay('2026-10-04')

    const beforePublish = await videoDetail(browser, channelId, 'video-1', {
      window: 'custom',
      from: '2025-01-01',
      to: '2025-01-31',
    })

    expect(beforePublish.status).toBe(200)
    expect(beforePublish.body).not.toHaveProperty('revenue')
    expect(beforePublish.body.sincePublish).not.toHaveProperty('revenueCurrency')
    expect(beforePublish.body.sincePublish.rows.filter((row) => 'estimatedRevenue' in row)).toEqual(
      [],
    )
    expect(
      api.google.analyticsRequests.map((query) => [
        query.get('startDate'),
        query.get('endDate'),
        query.get('metrics'),
      ]),
    ).toContainEqual([
      '2026-09-01',
      '2026-10-07',
      'estimatedRevenue,estimatedAdRevenue,estimatedRedPartnerRevenue',
    ])
  })

  test('a custom range that ends before the publish day is refused when the revenue read over the lifetime range fails, and asks Google nothing after it', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ days: [dayOf('2026-09-01', 100)] }),
      upload({ videoId: 'video-2', title: 'Upload 2', days: [dayOf('2026-09-01', 100)] }),
    ])
    await giveRevenueConsent(browser, channelId)
    api.google.setLastProcessedDay('2026-10-04')
    const custom = { window: 'custom', from: '2025-01-01', to: '2025-01-31' }
    // Video 2's read leaves the last processed day in the cache, so video 1's reads its revenue first.
    await videoDetail(browser, channelId, 'video-2', custom)
    const before = api.google.analyticsRequests.length
    api.google.failAnalytics(500)

    const refused = await videoDetail(browser, channelId, 'video-1', custom)

    expect(refused).toEqual({ status: 502, body: { refusal: 'google_failed' } })
    expect(
      api.google.analyticsRequests
        .slice(before)
        .map((query) => [query.get('startDate'), query.get('endDate'), query.get('metrics')]),
    ).toEqual([
      [
        '2026-09-01',
        '2026-10-07',
        'estimatedRevenue,estimatedAdRevenue,estimatedRedPartnerRevenue',
      ],
    ])
  })

  test("every detail carries the channel's creation day in Pacific Time, a preset window's too", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    api.google.setLastProcessedDay('2026-10-04')

    const details = [
      await videoDetail(browser, channelId, 'video-1', { window: 'first7' }),
      await videoDetail(browser, channelId, 'video-1', {
        window: 'custom',
        from: '2026-09-01',
        to: '2026-09-30',
      }),
    ]

    expect(details.map(({ body }) => body.creationDay)).toEqual(['2019-02-28', '2019-02-28'])
  })
})
