// Limits: these tests read from the fake Google server, so they cannot prove Google's real uploads
// playlist, its real per-video numbers, its real quota accounting, how late its last processed day
// runs or the order of its rows. Nick reading his own channel's list on the deployed product covers
// those. A read-only check through the youtube MCP on 2026-10-07 found Google answers
// `dimensions=video` with a `video==` filter and `dimensions=day` against Nick's channel. It cannot
// show Google's row order. Another read-only check through the youtube MCP on 2026-10-07 found
// Google answers `dimensions=video,day`, the shape a window after publish reads, with a `video==`
// filter of 50 ids over 1,131 days (56,550 videos times days) with no refusal. A third check on
// 2026-10-07 found Google answers `dimensions=video,creatorContentType` with a `video==` filter,
// one row a video, for the 20 most viewed uploads, with `videoOnDemand` and `liveStream`. The
// channel-wide `creatorContentType` report answered `shorts` too, and the ticket's check on
// 2026-10-05 saw it per video. Neither check can show `story` or `unspecified`, which Google
// documents. A live read against Nick's channel on 2026-10-08 found Google's uploads playlist
// answers 398 items for his 390 uploads, 8 of them twice. These tests cannot show the stale row
// the web app kept for such a video, because the web app has no DOM test setup; Nick's browser
// check covers it. The fake answers whatever `privacyStatus` a test gives an upload, so the `ids`
// tests cannot show whether Google's uploads playlist holds unlisted and private videos for the
// owner; #75 checks that live. A held call is the fake accepting the connection and writing nothing,
// so the held-call tests cannot show a connection that never opens or an answer that trickles in,
// the other stalls the gateway's bound is for; they rest on gaxios turning its `timeout` into an
// abort of the whole request.
import type { VideoListAnswer } from '@creator-analytics/api-types'
import { connections, quotaUsage, type WebDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import type { FakeUpload, VideoNumbers } from '@creator-analytics/fake-google'
import { googleCallTimeoutMs } from '@creator-analytics/token-vault'
import { quotaDayOf } from '@creator-analytics/youtube-gateway'
import { and, eq } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { badRangeQueries, metricQueriesOf } from '../test/custom-range.ts'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'

// Emails no other test file signs in with. Test files run in parallel against one database, and
// two files that sign in the same emails in a different order deadlock on the unique email index.
const creator = { sub: '305813', email: 'lister@example.com', name: 'A Lister' }
const otherCreator = { sub: '405813', email: 'other-lister@example.com', name: 'Another Lister' }

const createdAt = '2019-03-01T06:00:00Z'

/** The nth upload, published n days after 2024-01-01, with numbers that name it. */
function upload(n: number, overrides: Partial<FakeUpload> = {}): FakeUpload {
  return {
    videoId: `video-${n}`,
    title: `Upload ${n}`,
    publishedAt: new Date(Date.UTC(2024, 0, 1 + n, 15)).toISOString(),
    metrics: {
      engagedViews: n * 10,
      views: n * 20,
      averageViewPercentage: 40 + (n % 10),
      subscribersGained: n,
      estimatedMinutesWatched: n * 30,
    },
    ...overrides,
  }
}

function withoutNumbers({ metrics: _, ...upload }: FakeUpload): FakeUpload {
  return upload
}

function uploads(count: number): FakeUpload[] {
  return Array.from({ length: count }, (_, i) => upload(i + 1))
}

/** Signs the creator in and connects their channel, which holds these uploads. */
async function connectedCreator(
  api: StartedApi,
  channelUploads: FakeUpload[],
  channelCreatedAt = createdAt,
) {
  const browser = await signIn(api, creator)
  api.google.pickChannel('UC-lister')
  api.google.setChannel('UC-lister', { createdAt: channelCreatedAt, uploads: channelUploads })
  await connect(browser)
  const { channels } = await channelsOf(browser)
  const channelId = channels[0]?.id
  if (!channelId) throw new Error('The creator has no connected channel')
  return { browser, channelId }
}

async function listVideos(
  browser: Browser,
  channelId: string,
  query: Record<string, string> | [string, string][] = {},
) {
  const search = new URLSearchParams(query)
  const response = await browser.fetch(`/api/channels/${channelId}/videos?${search}`)
  return { status: response.status, body: (await response.json()) as VideoListAnswer }
}

function readQuota(web: WebDatabase) {
  return web.asUser('quota-reader', (tx) =>
    tx.sql.select({ api: quotaUsage.api, units: quotaUsage.units }).from(quotaUsage),
  )
}

function idsOf(answer: VideoListAnswer): string[] {
  return answer.videos.map((video) => video.id)
}

describe('seam 1: list every upload with its lifetime numbers', () => {
  test('each video answers its id, title, thumbnail, publish date and lifetime numbers, watch time included', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload(1)])

    const listed = await listVideos(browser, channelId, { window: 'lifetime' })

    expect(listed.status).toBe(200)
    expect(listed.body.videos).toEqual([
      {
        id: 'video-1',
        title: 'Upload 1',
        thumbnailUrl: 'https://i.ytimg.com/vi/video-1/mqdefault.jpg',
        thumbnails: [
          { url: 'https://i.ytimg.com/vi/video-1/default.jpg', width: 120 },
          { url: 'https://i.ytimg.com/vi/video-1/mqdefault.jpg', width: 320 },
          { url: 'https://i.ytimg.com/vi/video-1/hqdefault.jpg', width: 480 },
        ],
        durationSeconds: null,
        publishedAt: '2024-01-02T15:00:00.000Z',
        scheduled: false,
        privacy: 'public',
        format: 'video',
        engagedViews: 10,
        views: 20,
        averageViewPercentage: 41,
        subscribersGained: 1,
        estimatedMinutesWatched: 30,
        awaitingProcessing: false,
      },
    ])
  })

  test('each video carries every thumbnail size Google gives it, narrowest first, and the medium one as its thumbnail only when Google gives that size', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, { thumbnailSizes: ['maxres', 'standard', 'high', 'medium', 'default'] }),
      upload(2, { thumbnailSizes: ['high'] }),
      upload(3, { thumbnailSizes: [] }),
    ])

    const listed = await listVideos(browser, channelId, { window: 'lifetime' })

    expect(
      listed.body.videos.map(({ id, thumbnailUrl, thumbnails }) => ({
        id,
        thumbnailUrl,
        thumbnails,
      })),
    ).toEqual([
      { id: 'video-3', thumbnailUrl: null, thumbnails: [] },
      {
        id: 'video-2',
        thumbnailUrl: null,
        thumbnails: [{ url: 'https://i.ytimg.com/vi/video-2/hqdefault.jpg', width: 480 }],
      },
      {
        id: 'video-1',
        thumbnailUrl: 'https://i.ytimg.com/vi/video-1/mqdefault.jpg',
        thumbnails: [
          { url: 'https://i.ytimg.com/vi/video-1/default.jpg', width: 120 },
          { url: 'https://i.ytimg.com/vi/video-1/mqdefault.jpg', width: 320 },
          { url: 'https://i.ytimg.com/vi/video-1/hqdefault.jpg', width: 480 },
          { url: 'https://i.ytimg.com/vi/video-1/sddefault.jpg', width: 640 },
          { url: 'https://i.ytimg.com/vi/video-1/maxresdefault.jpg', width: 1280 },
        ],
      },
    ])
  })

  test("every thumbnail URL in the list is on a ytimg.com host, the one the web app's img-src allows", async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, { thumbnailSizes: ['default', 'medium', 'high', 'standard', 'maxres'] }),
      upload(2),
    ])

    const listed = await listVideos(browser, channelId, { window: 'lifetime' })

    const urls = listed.body.videos.flatMap(({ thumbnailUrl, thumbnails }) => [
      thumbnailUrl,
      ...thumbnails.map(({ url }) => url),
    ])
    expect(urls).toHaveLength(10)
    for (const url of urls) expect(url).toMatch(/^https:\/\/([a-z0-9-]+\.)*ytimg\.com\//)
  })

  test('each video carries its length in seconds, none when Google gives none or a zero one, at no extra Data API call', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, { duration: 'PT12M34S' }),
      upload(2, { duration: 'PT1H2M3S' }),
      upload(3),
      upload(4, { duration: 'P0D' }),
    ])
    const before = api.google.dataApiRequests.length

    const listed = await listVideos(browser, channelId, { window: 'lifetime' })

    expect(listed.body.videos.map(({ id, durationSeconds }) => [id, durationSeconds])).toEqual([
      ['video-4', null],
      ['video-3', null],
      ['video-2', 3723],
      ['video-1', 754],
    ])
    // The uploads read that lists the videos holds the length already, from its one videos.list
    // call for the status and contentDetails parts.
    const videosCalls = api.google.dataApiRequests
      .slice(before)
      .filter((url) => url.pathname === '/youtube/v3/videos')
    const partsOf = (url: URL) =>
      new Set(url.searchParams.getAll('part').flatMap((part) => part.split(',')))
    expect(videosCalls.map(partsOf)).toEqual([new Set(['status', 'contentDetails'])])
  })

  test("the list runs newest first, whatever the uploads playlist's order", async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload(2), upload(3), upload(1)])

    const listed = await listVideos(browser, channelId)

    expect(idsOf(listed.body)).toEqual(['video-3', 'video-2', 'video-1'])
  })

  // The channel's createdAt, 2019-03-01T06:00:00Z, falls on 2019-02-28 in Pacific Time and on
  // 2019-03-01 in UTC. The fake answers a video's lifetime numbers only to a range starting on or
  // before the Pacific day, so a range starting on the UTC day would list zeros.
  test("lifetime runs from the channel's creation day in Pacific Time", async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload(1)])

    const listed = await listVideos(browser, channelId, { window: 'lifetime' })

    expect(listed.body.videos[0]).toMatchObject({
      id: 'video-1',
      engagedViews: 10,
      views: 20,
      averageViewPercentage: 41,
      subscribersGained: 1,
    })
  })

  test('a video with no row in the Analytics answer shows zeros and stays in the list', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1),
      withoutNumbers(upload(2)),
    ])

    const listed = await listVideos(browser, channelId)

    expect(listed.body.videos[0]).toMatchObject({
      id: 'video-2',
      engagedViews: 0,
      views: 0,
      averageViewPercentage: 0,
      subscribersGained: 0,
      estimatedMinutesWatched: 0,
    })
    expect(idsOf(listed.body)).toEqual(['video-2', 'video-1'])
  })

  test("each video carries its format from Google's content type, and none when Google gives it no format", async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, { creatorContentType: 'videoOnDemand' }),
      upload(2, { creatorContentType: 'shorts' }),
      upload(3, { creatorContentType: 'liveStream' }),
      upload(4, { creatorContentType: 'story' }),
      withoutNumbers(upload(5)),
    ])

    const listed = await listVideos(browser, channelId)

    expect(listed.body.videos.map(({ id, format }) => [id, format])).toEqual([
      ['video-5', null],
      ['video-4', null],
      ['video-3', 'live'],
      ['video-2', 'short'],
      ['video-1', 'video'],
    ])
  })

  test('a video Google answers under two content types takes the format of the one with more views', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, { contentTypeViews: { liveStream: 5, videoOnDemand: 20 } }),
      upload(2, { contentTypeViews: { shorts: 30, videoOnDemand: 10 } }),
    ])

    const listed = await listVideos(browser, channelId)

    expect(listed.body.videos.map(({ id, format }) => [id, format])).toEqual([
      ['video-2', 'short'],
      ['video-1', 'video'],
    ])
  })

  test('a format filter lists only videos of that format, and a video with no format only under all', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1),
      upload(2, { creatorContentType: 'shorts' }),
      upload(3, { creatorContentType: 'liveStream' }),
      withoutNumbers(upload(4)),
    ])

    const listed = await Promise.all(
      ['all', 'video', 'short', 'live'].map((format) => listVideos(browser, channelId, { format })),
    )

    expect(listed.map(({ body }) => idsOf(body))).toEqual([
      ['video-4', 'video-3', 'video-2', 'video-1'],
      ['video-1'],
      ['video-2'],
      ['video-3'],
    ])
    expect(listed[0]?.body.videos.find(({ id }) => id === 'video-4')).toMatchObject({
      format: null,
    })
  })

  test('a format filter applies before pagination, so the page count counts only that format', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(
      api,
      uploads(25).map((video, i) => (i < 12 ? { ...video, creatorContentType: 'shorts' } : video)),
    )

    const second = await listVideos(browser, channelId, {
      format: 'short',
      pageSize: '10',
      page: '2',
    })

    expect(second.body).toMatchObject({ page: 2, pageSize: 10, pageCount: 2 })
    expect(idsOf(second.body)).toEqual(['video-2', 'video-1'])
  })

  test('pageSize=10 answers the newest 10 uploads, and the page count', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(25))

    const first = await listVideos(browser, channelId, { pageSize: '10' })
    const third = await listVideos(browser, channelId, { pageSize: '10', page: '3' })

    expect(first.body).toMatchObject({ page: 1, pageSize: 10, pageCount: 3 })
    expect(idsOf(first.body)).toEqual(Array.from({ length: 10 }, (_, i) => `video-${25 - i}`))
    expect(idsOf(third.body)).toEqual(['video-5', 'video-4', 'video-3', 'video-2', 'video-1'])
  })

  test('a page defaults to 50 videos', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(51))

    const listed = await listVideos(browser, channelId)

    expect(listed.body).toMatchObject({ page: 1, pageSize: 50, pageCount: 2 })
    expect(listed.body.videos).toHaveLength(50)
  })

  test('a page past the last answers no videos and the real page count', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))

    const listed = await listVideos(browser, channelId, { page: '2' })

    expect(listed).toEqual({
      status: 200,
      body: expect.objectContaining({ videos: [], page: 2, pageCount: 1 }),
    })
  })

  test('a page or page size that is not a whole number in range is refused before any read', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    const before = api.google.dataApiRequests.length

    const refused = await Promise.all(
      [
        { pageSize: '51' },
        { pageSize: '0' },
        { pageSize: '1.5' },
        { page: '0' },
        { page: '1.5' },
        { page: 'two' },
      ].map((query) => listVideos(browser, channelId, query)),
    )

    expect(refused.map(({ status }) => status)).toEqual([400, 400, 400, 400, 400, 400])
    expect(refused.map(({ body }) => body)).toEqual(
      Array.from({ length: 6 }, () => ({ error: 'invalid_query' })),
    )
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('an unknown format is refused with invalid_format before any read', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    const before = api.google.dataApiRequests.length

    const refused = await Promise.all(
      ['shorts', 'Video', ''].map((format) => listVideos(browser, channelId, { format })),
    )

    expect(refused).toEqual(
      Array.from({ length: 3 }, () => ({ status: 400, body: { error: 'invalid_format' } })),
    )
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('a scheduled video is left out unless the query includes scheduled videos', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1),
      { videoId: 'video-2', title: 'Upload 2', scheduledFor: '2027-01-01T17:00:00Z' },
    ])

    const hidden = await listVideos(browser, channelId)
    const shown = await listVideos(browser, channelId, { includeScheduled: 'true' })

    expect(idsOf(hidden.body)).toEqual(['video-1'])
    expect(shown.body.videos[0]).toMatchObject({
      id: 'video-2',
      publishedAt: '2027-01-01T17:00:00.000Z',
      scheduled: true,
    })
    expect(idsOf(shown.body)).toEqual(['video-2', 'video-1'])
  })

  test('with a latest row day later than four days before today, the last processed day is that day', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload(1)])
    api.google.setLastProcessedDay('2026-10-05')

    const listed = await listVideos(browser, channelId)

    expect(listed.body.lastProcessedDay).toBe('2026-10-05')
  })

  test('1,200 uploads cost 49 Data API units and 7 Analytics queries on a cold cache, and none on a warm one', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(1200))

    const cold = await listVideos(browser, channelId)
    const afterCold = await readQuota(web)
    const warm = await listVideos(browser, channelId, { page: '2' })

    expect(cold.body).toMatchObject({ pageCount: 24, fromCache: false })
    expect(warm.body).toMatchObject({ page: 2, fromCache: true })
    // The connect flow's channels.list call and the channel list's name read are the 50th and
    // 51st Data API units.
    expect(afterCold).toEqual(
      expect.arrayContaining([
        { api: 'data', units: 51 },
        { api: 'analytics', units: 7 },
      ]),
    )
    expect(await readQuota(web)).toEqual(afterCold)
  })
})

/** Five uploads, published in id order, whose numbers put them in a different order per metric. */
const unevenUploads = [
  upload(1, {
    metrics: {
      engagedViews: 30,
      views: 300,
      averageViewPercentage: 45.5,
      subscribersGained: 2,
      estimatedMinutesWatched: 500,
    },
  }),
  upload(2, {
    metrics: {
      engagedViews: 50,
      views: 100,
      averageViewPercentage: 70,
      subscribersGained: 4,
      estimatedMinutesWatched: 200,
    },
  }),
  upload(3, {
    metrics: {
      engagedViews: 10,
      views: 500,
      averageViewPercentage: 20,
      subscribersGained: 5,
      estimatedMinutesWatched: 400,
    },
  }),
  upload(4, {
    metrics: {
      engagedViews: 40,
      views: 200,
      averageViewPercentage: 99.5,
      subscribersGained: 1,
      estimatedMinutesWatched: 300,
    },
  }),
  upload(5, {
    metrics: {
      engagedViews: 20,
      views: 400,
      averageViewPercentage: 60,
      subscribersGained: 3,
      estimatedMinutesWatched: 100,
    },
  }),
]

/** Every page of the list, 2 videos a page, as one list of ids. */
async function allPagesOf(browser: Browser, channelId: string, query: Record<string, string>) {
  const first = await listVideos(browser, channelId, { ...query, pageSize: '2' })
  const rest = await Promise.all(
    Array.from({ length: first.body.pageCount - 1 }, (_, i) =>
      listVideos(browser, channelId, { ...query, pageSize: '2', page: String(i + 2) }),
    ),
  )
  return [first, ...rest].flatMap(({ body }) => idsOf(body))
}

describe('seam 1: list videos by visibility', () => {
  const mixedPrivacy = [
    upload(1),
    upload(2, { privacyStatus: 'unlisted' }),
    upload(3, { privacyStatus: 'private' }),
  ]

  test('with no visibility or visibility=public, the list answers public videos only', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, mixedPrivacy)

    const listed = await Promise.all([
      listVideos(browser, channelId),
      listVideos(browser, channelId, { visibility: 'public' }),
    ])

    expect(listed.map(({ body }) => idsOf(body))).toEqual([['video-1'], ['video-1']])
  })

  test('visibility=all lists public, unlisted and private videos, each with its privacy', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, mixedPrivacy)

    const listed = await listVideos(browser, channelId, { visibility: 'all' })

    expect(listed.body.videos.map(({ id, privacy }) => [id, privacy])).toEqual([
      ['video-3', 'private'],
      ['video-2', 'unlisted'],
      ['video-1', 'public'],
    ])
  })

  test('with visibility=public, the page count and a metric sort cover public videos only', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1),
      upload(2),
      upload(3),
      upload(10, { privacyStatus: 'unlisted' }),
      upload(11, { privacyStatus: 'unlisted' }),
    ])

    const query = { visibility: 'public', sort: '-views', pageSize: '2' }
    const first = await listVideos(browser, channelId, query)
    const second = await listVideos(browser, channelId, { ...query, page: '2' })

    expect(first.body.pageCount).toBe(2)
    expect([idsOf(first.body), idsOf(second.body)]).toEqual([['video-3', 'video-2'], ['video-1']])
  })

  test('an unknown visibility is refused with invalid_visibility before any read', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    const before = api.google.dataApiRequests.length

    const refused = await Promise.all(
      ['unlisted', '', 'ALL'].map((visibility) => listVideos(browser, channelId, { visibility })),
    )

    expect(refused).toEqual(
      Array.from({ length: 3 }, () => ({ status: 400, body: { error: 'invalid_visibility' } })),
    )
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('a scheduled video follows includeScheduled alone: hidden under visibility=all, listed private under visibility=public', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1),
      { videoId: 'video-2', title: 'Upload 2', scheduledFor: '2027-01-01T17:00:00Z' },
    ])

    const hidden = await listVideos(browser, channelId, { visibility: 'all' })
    const shown = await listVideos(browser, channelId, {
      visibility: 'public',
      includeScheduled: 'true',
    })

    expect(idsOf(hidden.body)).toEqual(['video-1'])
    expect(shown.body.videos.map(({ id, privacy }) => [id, privacy])).toEqual([
      ['video-2', 'private'],
      ['video-1', 'public'],
    ])
  })
})

describe('seam 1: sort every upload before the list is paged', () => {
  test.for([
    ['-publishedAt', [5, 4, 3, 2, 1]],
    ['publishedAt', [1, 2, 3, 4, 5]],
    ['-engagedViews', [2, 4, 1, 5, 3]],
    ['engagedViews', [3, 5, 1, 4, 2]],
    ['-views', [3, 5, 1, 4, 2]],
    ['views', [2, 4, 1, 5, 3]],
    ['-averageViewPercentage', [4, 2, 5, 1, 3]],
    ['averageViewPercentage', [3, 1, 5, 2, 4]],
    ['-subscribersGained', [3, 2, 5, 1, 4]],
    ['subscribersGained', [4, 1, 5, 2, 3]],
    ['-estimatedMinutesWatched', [1, 3, 4, 2, 5]],
    ['estimatedMinutesWatched', [5, 2, 4, 3, 1]],
  ] as const)('sort=%s orders every upload, then pages it', async ([sort, order], { web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, unevenUploads)

    const listed = await allPagesOf(browser, channelId, { window: 'lifetime', sort })

    expect(listed).toEqual(order.map((n) => `video-${n}`))
  })

  test('videos that tie on the sort key run newest first, in either direction', async ({ web }) => {
    const api = await startApi(web)
    const tied = { engagedViews: 5, views: 100, averageViewPercentage: 50, subscribersGained: 0 }
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, { metrics: tied }),
      upload(2, { metrics: { ...tied, views: 300 } }),
      upload(3, { metrics: tied }),
      upload(4, { metrics: tied }),
    ])

    const ascending = await listVideos(browser, channelId, { window: 'lifetime', sort: 'views' })
    const descending = await listVideos(browser, channelId, { window: 'lifetime', sort: '-views' })

    expect(idsOf(ascending.body)).toEqual(['video-4', 'video-3', 'video-1', 'video-2'])
    expect(idsOf(descending.body)).toEqual(['video-2', 'video-4', 'video-3', 'video-1'])
  })

  test('videos that tie on watch time run newest first, in either direction', async ({ web }) => {
    const api = await startApi(web)
    const tied = {
      engagedViews: 5,
      views: 100,
      averageViewPercentage: 50,
      subscribersGained: 0,
      estimatedMinutesWatched: 60,
    }
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, { metrics: tied }),
      upload(2, { metrics: { ...tied, estimatedMinutesWatched: 90 } }),
      upload(3, { metrics: tied }),
      upload(4, { metrics: tied }),
    ])

    const ascending = await listVideos(browser, channelId, {
      window: 'lifetime',
      sort: 'estimatedMinutesWatched',
    })
    const descending = await listVideos(browser, channelId, {
      window: 'lifetime',
      sort: '-estimatedMinutesWatched',
    })

    expect(idsOf(ascending.body)).toEqual(['video-4', 'video-3', 'video-1', 'video-2'])
    expect(idsOf(descending.body)).toEqual(['video-2', 'video-4', 'video-3', 'video-1'])
  })

  test('a watch time sort is accepted in every window, calendar and after publish', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))

    const windows = [
      'lifetime',
      'last7',
      'last28',
      'last90',
      'last365',
      'first1',
      'first7',
      'first28',
      'first90',
      'first365',
    ]
    const sorts = ['estimatedMinutesWatched', '-estimatedMinutesWatched']
    const answered = await Promise.all(
      windows.flatMap((window) =>
        sorts.map((sort) => listVideos(browser, channelId, { window, sort })),
      ),
    )

    expect(answered.map(({ status }) => status)).toEqual(answered.map(() => 200))
  })

  test('videos published at the same moment run by id in either direction of a publishedAt sort', async ({
    web,
  }) => {
    const api = await startApi(web)
    const sameMoment = '2024-06-01T15:00:00.000Z'
    const { browser, channelId } = await connectedCreator(api, [
      upload(2, { publishedAt: sameMoment }),
      upload(1, { publishedAt: sameMoment }),
    ])

    const ascending = await listVideos(browser, channelId, { sort: 'publishedAt' })
    const descending = await listVideos(browser, channelId, { sort: '-publishedAt' })

    expect(idsOf(ascending.body)).toEqual(['video-1', 'video-2'])
    expect(idsOf(descending.body)).toEqual(['video-1', 'video-2'])
  })

  // The gateway reads the uploads playlist 50 items a call, so the repeat of video-1 after 50
  // uploads comes back on a later playlistItems.list page than its first copy, as Nick's did.
  const oldestFirst = Array.from({ length: 50 }, (_, i) => i + 1)
  const newestFirst = oldestFirst.toReversed()

  test.for([
    ['-publishedAt', newestFirst],
    ['publishedAt', oldestFirst],
    ['-subscribersGained', newestFirst],
  ] as const)(
    'sort=%s lists a video the uploads playlist answers twice once, in its sorted place',
    async ([sort, order], { web }) => {
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, [...uploads(50), upload(1)])

      const listed = await allPagesOf(browser, channelId, { sort })

      expect(listed).toEqual(order.map((n) => `video-${n}`))
    },
  )

  test('an unknown sort is refused with invalid_sort before any read', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    const before = api.google.dataApiRequests.length

    const refused = await Promise.all(
      ['rank', '--views', '+views', 'views desc', ''].map((sort) =>
        listVideos(browser, channelId, { sort }),
      ),
    )

    expect(refused).toEqual(
      Array.from({ length: 5 }, () => ({ status: 400, body: { error: 'invalid_sort' } })),
    )
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })
})

// Noon on 2026-10-07 in Pacific Time, so today is 2026-10-07.
const noonToday = new Date('2026-10-07T19:00:00Z')

/** Numbers that name the window they belong to. */
function windowNumbers(n: number): VideoNumbers {
  return {
    engagedViews: n,
    views: n + 1,
    averageViewPercentage: n + 0.5,
    subscribersGained: n + 2,
    estimatedMinutesWatched: n + 3,
  }
}

describe('seam 1: count every video over a calendar window', () => {
  test('window=last7 lists each video with its numbers over the last processed day and the 6 days before', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, {
        rangeMetrics: [
          { startDate: '2026-09-28', endDate: '2026-10-04', metrics: windowNumbers(7) },
        ],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await listVideos(browser, channelId, { window: 'last7' })

    expect(listed.status).toBe(200)
    expect(listed.body).toMatchObject({ window: 'last7', lastProcessedDay: '2026-10-04' })
    expect(listed.body.videos[0]).toMatchObject({ id: 'video-1', ...windowNumbers(7) })
  })

  test('with a latest row day older than four days before today, a calendar window ends four days before today', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, {
        rangeMetrics: [
          { startDate: '2026-09-27', endDate: '2026-10-03', metrics: windowNumbers(7) },
        ],
      }),
    ])
    // A last day with a row further back than Google's 72-hour delay, as an idle channel's would be
    // if Google leaves a day with no activity out of a `dimensions=day` answer. The fake is told the
    // day, so this test cannot show that Google does; no live check has covered it.
    api.google.setLastProcessedDay('2026-09-20')

    const listed = await listVideos(browser, channelId, { window: 'last7' })

    expect(listed.body).toMatchObject({ window: 'last7', lastProcessedDay: '2026-10-03' })
    expect(listed.body.videos[0]).toMatchObject({ id: 'video-1', ...windowNumbers(7) })
  })

  test('with no latest row day in the last 90 days, a calendar window ends four days before today', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const channelUploads = [
      upload(1, {
        rangeMetrics: [
          { startDate: '2026-09-27', endDate: '2026-10-03', metrics: windowNumbers(7) },
        ],
      }),
    ]
    const { browser, channelId } = await connectedCreator(api, channelUploads)
    // A channel that holds no days answers the last processed day search with no rows.
    api.google.setChannel('UC-lister', { createdAt, uploads: channelUploads, days: {} })

    const listed = await listVideos(browser, channelId, { window: 'last7' })

    expect(listed.body).toMatchObject({ window: 'last7', lastProcessedDay: '2026-10-03' })
    expect(listed.body.videos[0]).toMatchObject({ id: 'video-1', ...windowNumbers(7) })
  })

  test('a video with no row over a calendar window shows zeros, watch time included', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, {
        rangeMetrics: [
          { startDate: '2026-10-01', endDate: '2026-10-07', metrics: windowNumbers(7) },
        ],
      }),
      withoutNumbers(upload(2)),
    ])

    const listed = await listVideos(browser, channelId, { window: 'last7' })

    expect(listed.body.videos.find(({ id }) => id === 'video-2')).toMatchObject({
      engagedViews: 0,
      views: 0,
      averageViewPercentage: 0,
      subscribersGained: 0,
      estimatedMinutesWatched: 0,
    })
  })

  test('last28, last90 and last365 each end at the last processed day and start their length before it', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, {
        rangeMetrics: [
          { startDate: '2026-09-07', endDate: '2026-10-04', metrics: windowNumbers(28) },
          { startDate: '2026-07-07', endDate: '2026-10-04', metrics: windowNumbers(90) },
          { startDate: '2025-10-05', endDate: '2026-10-04', metrics: windowNumbers(365) },
        ],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await Promise.all(
      ['last28', 'last90', 'last365'].map((window) => listVideos(browser, channelId, { window })),
    )

    expect(listed.map(({ body }) => [body.window, body.videos[0]])).toEqual([
      ['last28', expect.objectContaining(windowNumbers(28))],
      ['last90', expect.objectContaining(windowNumbers(90))],
      ['last365', expect.objectContaining(windowNumbers(365))],
    ])
  })

  // The channel was created on 2026-09-20 in Pacific Time, 17 days before today, so last28 would
  // otherwise start on 2026-09-10.
  test("a calendar window longer than the channel's life starts on the channel's creation day", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(
      api,
      [
        upload(1, {
          rangeMetrics: [
            { startDate: '2026-09-20', endDate: '2026-10-04', metrics: windowNumbers(28) },
          ],
        }),
      ],
      '2026-09-20T19:00:00Z',
    )
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await listVideos(browser, channelId, { window: 'last28' })

    expect(listed.body.videos[0]).toMatchObject({ id: 'video-1', ...windowNumbers(28) })
  })

  test("a channel created after the window's last day counts its calendar window over its creation day alone", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    // Created on 2026-10-06 in Pacific Time, after the last processed day, where a calendar window
    // ends.
    const { browser, channelId } = await connectedCreator(
      api,
      [
        upload(1, {
          rangeMetrics: [
            { startDate: '2026-10-06', endDate: '2026-10-06', metrics: windowNumbers(1) },
          ],
        }),
      ],
      '2026-10-06T19:00:00Z',
    )
    api.google.setLastProcessedDay('2026-10-05')

    const listed = await listVideos(browser, channelId, { window: 'last7' })

    expect(listed.body.videos[0]).toMatchObject({ id: 'video-1', ...windowNumbers(1) })
  })

  test('an unknown window is refused with invalid_window before any read', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    const before = api.google.dataApiRequests.length

    const refused = await Promise.all(
      ['last30', 'Last7', ''].map((window) => listVideos(browser, channelId, { window })),
    )

    expect(refused).toEqual(
      Array.from({ length: 3 }, () => ({ status: 400, body: { error: 'invalid_window' } })),
    )
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('a query bad in several ways is refused for the first of page, window, sort, format and ids', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))

    const refused = await Promise.all(
      [
        { page: '0', window: 'bogus', sort: 'bogus', format: 'bogus', ids: '' },
        { window: 'bogus', sort: 'bogus', format: 'bogus', ids: '' },
        { sort: 'bogus', format: 'bogus', ids: '' },
        { format: 'bogus', ids: '' },
        { ids: '' },
      ].map((query) => listVideos(browser, channelId, query)),
    )

    expect(refused.map(({ body }) => body)).toEqual([
      { error: 'invalid_query' },
      { error: 'invalid_window' },
      { error: 'invalid_sort' },
      { error: 'invalid_format' },
      { error: 'invalid_ids' },
    ])
  })

  test('each window is its own cached read, so a switch back within 6 hours costs no quota', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))

    await listVideos(browser, channelId, { window: 'lifetime' })
    const afterLifetime = await readQuota(web)
    const last28 = await listVideos(browser, channelId, { window: 'last28' })
    const afterLast28 = await readQuota(web)
    // 5 hours on, 17:00 the same day in Pacific Time.
    clock.advance(5 * 60 * 60 * 1000)
    const switchedBack = await Promise.all([
      listVideos(browser, channelId, { window: 'lifetime' }),
      listVideos(browser, channelId, { window: 'last28', sort: '-views' }),
    ])

    // The last processed day's read and the lifetime content types read are shared; the metrics
    // read is the window's own.
    expect(afterLifetime).toContainEqual({ api: 'analytics', units: 3 })
    expect(last28.body.fromCache).toBe(false)
    expect(afterLast28).toContainEqual({ api: 'analytics', units: 4 })
    expect(switchedBack.map(({ body }) => [body.window, body.fromCache])).toEqual([
      ['lifetime', true],
      ['last28', true],
    ])
    expect(await readQuota(web)).toEqual(afterLast28)
  })

  test('a query with no window answers the last 28 days', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, {
        rangeMetrics: [
          { startDate: '2026-09-10', endDate: '2026-10-07', metrics: windowNumbers(28) },
        ],
      }),
    ])

    const listed = await listVideos(browser, channelId)

    expect(listed.body.window).toBe('last28')
    expect(listed.body.videos[0]).toMatchObject({ id: 'video-1', ...windowNumbers(28) })
  })
})

/** The publish day top of a list answer, as [id, engaged views] pairs. */
function topOf({ body }: { body: VideoListAnswer }) {
  return body.publishDayTop?.map(({ id, engagedViews }) => [id, engagedViews])
}

/** An upload published on this day in Pacific Time, with these days. */
function publishedOn(n: number, day: string, days: FakeUpload['days'] = []): FakeUpload {
  return upload(n, { publishedAt: `${day}T15:00:00Z`, days })
}

describe('seam 1: count every video over a window after publish', () => {
  test("window=first7 adds each video's own daily rows over its 7 days, watch time included, with no average percentage viewed", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      publishedOn(1, '2026-09-01', [
        {
          day: '2026-09-01',
          engagedViews: 1,
          views: 2,
          subscribersGained: 1,
          estimatedMinutesWatched: 10,
        },
        { day: '2026-09-07', engagedViews: 3, views: 4, subscribersGained: 2 },
        {
          day: '2026-09-08',
          engagedViews: 100,
          views: 100,
          subscribersGained: 100,
          estimatedMinutesWatched: 100,
        },
      ]),
      publishedOn(2, '2026-09-05', [
        { day: '2026-09-05', engagedViews: 5, views: 6, estimatedMinutesWatched: 20 },
        {
          day: '2026-09-11',
          engagedViews: 7,
          views: 8,
          subscribersGained: 3,
          estimatedMinutesWatched: 25,
        },
      ]),
      publishedOn(3, '2026-09-03'),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await listVideos(browser, channelId, { window: 'first7' })

    expect(listed.status).toBe(200)
    expect(listed.body.window).toBe('first7')
    const numbersOf = listed.body.videos.map(
      ({
        id,
        engagedViews,
        views,
        averageViewPercentage,
        subscribersGained,
        estimatedMinutesWatched,
        partial,
      }) => ({
        id,
        engagedViews,
        views,
        averageViewPercentage,
        subscribersGained,
        estimatedMinutesWatched,
        partial,
      }),
    )
    expect(numbersOf).toEqual([
      {
        id: 'video-2',
        engagedViews: 12,
        views: 14,
        averageViewPercentage: undefined,
        subscribersGained: 3,
        estimatedMinutesWatched: 45,
        partial: undefined,
      },
      {
        id: 'video-3',
        engagedViews: 0,
        views: 0,
        averageViewPercentage: undefined,
        subscribersGained: 0,
        estimatedMinutesWatched: 0,
        partial: undefined,
      },
      {
        id: 'video-1',
        engagedViews: 4,
        views: 6,
        averageViewPercentage: undefined,
        subscribersGained: 3,
        estimatedMinutesWatched: 10,
        partial: undefined,
      },
    ])
  })

  // Video 1's first90 ends on 2025-08-29 and its first365 on 2026-05-31; its first365 runs over
  // several daily rows queries, each of which answers some of its days. Video 2's first1 is its
  // publish day alone, and its first90 and first365 run past 2026-10-04, the last processed day. Each
  // day's views are 3 times its engaged views, so the two numbers add apart.
  test.for([
    ['first1', { engagedViews: 1, views: 3 }, { engagedViews: 32, views: 96 }],
    ['first90', { engagedViews: 3, views: 9 }, { engagedViews: 96, views: 288 }],
    ['first365', { engagedViews: 15, views: 45 }, { engagedViews: 96, views: 288 }],
  ] as const)(
    "window=%s adds each video's own daily rows from its publish day",
    async ([window, video1, video2], { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, [
        publishedOn(1, '2025-06-01', [
          { day: '2025-05-31', engagedViews: 128, views: 384 },
          { day: '2025-06-01', engagedViews: 1, views: 3 },
          { day: '2025-08-29', engagedViews: 2, views: 6 },
          { day: '2025-08-30', engagedViews: 4, views: 12 },
          { day: '2026-05-31', engagedViews: 8, views: 24 },
          { day: '2026-06-01', engagedViews: 16, views: 48 },
        ]),
        publishedOn(2, '2026-09-01', [
          { day: '2026-09-01', engagedViews: 32, views: 96 },
          { day: '2026-10-04', engagedViews: 64, views: 192 },
        ]),
      ])
      api.google.setLastProcessedDay('2026-10-04')

      const listed = await listVideos(browser, channelId, { window, sort: 'publishedAt' })

      expect(listed.status).toBe(200)
      expect(listed.body.window).toBe(window)
      expect(
        listed.body.videos.map(({ id, engagedViews, views }) => ({ id, engagedViews, views })),
      ).toEqual([
        { id: 'video-1', ...video1 },
        { id: 'video-2', ...video2 },
      ])
    },
  )

  // Published on 2026-09-25, so each window ends on or after 2026-10-22, and Google has processed
  // 2026-09-25 to 2026-10-04: 10 of its days.
  test.for([
    ['first28', 28],
    ['first90', 90],
    ['first365', 365],
  ] as const)(
    'in %s, a video whose window Google has not processed to its end carries the days it has',
    async ([window, of], { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, [
        publishedOn(1, '2026-09-25', [{ day: '2026-09-26', engagedViews: 1, views: 2 }]),
        { videoId: 'video-2', title: 'Upload 2', scheduledFor: '2026-10-20T15:00:00Z' },
      ])
      api.google.setLastProcessedDay('2026-10-04')

      const listed = await listVideos(browser, channelId, { window })

      expect(listed.body.videos).toEqual([
        expect.objectContaining({ id: 'video-1', engagedViews: 1, partial: { days: 10, of } }),
      ])
      const scheduled = await listVideos(browser, channelId, { window, includeScheduled: 'true' })
      expect(scheduled.body.videos[0]).toMatchObject({ id: 'video-2', partial: { days: 0, of } })
    },
  )

  test('a listed video is awaiting processing until Google has processed a day on or after its publish day', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      publishedOn(1, '2026-10-05', []),
      publishedOn(2, '2026-10-04', []),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await listVideos(browser, channelId)

    expect(
      listed.body.videos.map(({ id, awaitingProcessing }) => ({ id, awaitingProcessing })),
    ).toEqual([
      { id: 'video-1', awaitingProcessing: true },
      { id: 'video-2', awaitingProcessing: false },
    ])
  })

  test('a listed video with no publish date is not awaiting processing', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { publishedAt: _, ...undated } = upload(1)
    const { browser, channelId } = await connectedCreator(api, [undated])
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await listVideos(browser, channelId)

    expect(listed.body.videos).toEqual([
      expect.objectContaining({ id: 'video-1', publishedAt: null, awaitingProcessing: false }),
    ])
  })

  // No processed day in the 90-day search: the channel had no activity, and Google's numbers run
  // at most 72 hours late, so it has processed through 2026-10-03.
  test('with no latest row day, a window that ended before four days ago is complete, and a video published since is awaiting processing', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const quietUploads = [
      publishedOn(1, '2026-06-29', []),
      publishedOn(2, '2026-10-05', []),
      publishedOn(3, '2026-10-04', []),
    ]
    const { browser, channelId } = await connectedCreator(api, quietUploads)
    api.google.setChannel('UC-lister', { createdAt, uploads: quietUploads, days: {} })

    const listed = await listVideos(browser, channelId, { window: 'first28' })

    expect(
      listed.body.videos.map(({ id, partial, awaitingProcessing }) => ({
        id,
        partial,
        awaitingProcessing,
      })),
    ).toEqual([
      { id: 'video-2', partial: { days: 0, of: 28 }, awaitingProcessing: true },
      { id: 'video-3', partial: { days: 0, of: 28 }, awaitingProcessing: true },
      { id: 'video-1', partial: undefined, awaitingProcessing: false },
    ])
  })

  // Videos 1 and 2 are complete in the window and videos 3 and 4 partial, each with numbers on its
  // publish day only. The last processed day is 2026-10-04, so in first1 videos 3 and 4 are
  // published after it, Google answers no day of theirs, and they tie at 0, newest first either way.
  test.for([
    [
      'first1',
      ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'],
      ['video-4', 'video-3'],
      ['video-4', 'video-3'],
    ],
    [
      'first7',
      ['2026-08-01', '2026-08-02', '2026-10-01', '2026-10-02'],
      ['video-3', 'video-4'],
      ['video-4', 'video-3'],
    ],
    [
      'first90',
      ['2026-06-01', '2026-06-02', '2026-09-01', '2026-09-02'],
      ['video-3', 'video-4'],
      ['video-4', 'video-3'],
    ],
    [
      'first365',
      ['2025-06-01', '2025-06-02', '2026-09-01', '2026-09-02'],
      ['video-3', 'video-4'],
      ['video-4', 'video-3'],
    ],
  ] as const)(
    'in %s, partial videos follow every complete video in a metric sort in either direction; a publish date sort ignores partiality',
    async ([window, publishDays, partialDescending, partialAscending], { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const [day1, day2, day3, day4] = publishDays
      const { browser, channelId } = await connectedCreator(api, [
        publishedOn(1, day1, [{ day: day1, engagedViews: 5, views: 5 }]),
        publishedOn(2, day2, [{ day: day2, engagedViews: 1, views: 1 }]),
        publishedOn(3, day3, [{ day: day3, engagedViews: 9, views: 9 }]),
        publishedOn(4, day4, [{ day: day4, engagedViews: 3, views: 3 }]),
      ])
      api.google.setLastProcessedDay('2026-10-04')

      const sorted = await Promise.all(
        ['-engagedViews', 'engagedViews', '-publishedAt'].map((sort) =>
          listVideos(browser, channelId, { window, sort }),
        ),
      )

      expect(sorted.map(({ body }) => idsOf(body))).toEqual([
        ['video-1', 'video-2', ...partialDescending],
        ['video-2', 'video-1', ...partialAscending],
        ['video-4', 'video-3', 'video-2', 'video-1'],
      ])
    },
  )

  // Video 1 has minutes on its publish day and the day after, so first1 counts only the first of
  // them and the longer windows add both: video 1 runs below video 2 in first1 and above it after.
  // Videos 3 and 4 are partial, as in the test above, and in first1 tie at 0, newest first.
  test.for([
    [
      'first1',
      ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'],
      ['video-2', 'video-1'],
      ['video-4', 'video-3'],
      ['video-4', 'video-3'],
    ],
    [
      'first7',
      ['2026-08-01', '2026-08-02', '2026-10-01', '2026-10-02'],
      ['video-1', 'video-2'],
      ['video-3', 'video-4'],
      ['video-4', 'video-3'],
    ],
    [
      'first28',
      ['2026-07-01', '2026-07-02', '2026-09-20', '2026-09-21'],
      ['video-1', 'video-2'],
      ['video-3', 'video-4'],
      ['video-4', 'video-3'],
    ],
    [
      'first90',
      ['2026-06-01', '2026-06-02', '2026-09-01', '2026-09-02'],
      ['video-1', 'video-2'],
      ['video-3', 'video-4'],
      ['video-4', 'video-3'],
    ],
    [
      'first365',
      ['2025-06-01', '2025-06-02', '2026-09-01', '2026-09-02'],
      ['video-1', 'video-2'],
      ['video-3', 'video-4'],
      ['video-4', 'video-3'],
    ],
  ] as const)(
    "in %s, a watch time sort orders complete videos by their own days' minutes added up, and partial videos after them in either direction",
    async ([window, publishDays, completeDescending, partialDescending, partialAscending], {
      web,
      clock,
    }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const [day1, day2, day3, day4] = publishDays
      const minutes = (day: string, estimatedMinutesWatched: number) => ({
        day,
        engagedViews: 1,
        views: 1,
        estimatedMinutesWatched,
      })
      const { browser, channelId } = await connectedCreator(api, [
        publishedOn(1, day1, [minutes(day1, 3), minutes(day2, 4)]),
        publishedOn(2, day2, [minutes(day2, 5)]),
        publishedOn(3, day3, [minutes(day3, 60)]),
        publishedOn(4, day4, [minutes(day4, 20)]),
      ])
      api.google.setLastProcessedDay('2026-10-04')

      const sorted = await Promise.all(
        ['-estimatedMinutesWatched', 'estimatedMinutesWatched'].map((sort) =>
          listVideos(browser, channelId, { window, sort }),
        ),
      )

      expect(sorted.map(({ body }) => idsOf(body))).toEqual([
        [...completeDescending, ...partialDescending],
        [...completeDescending.toReversed(), ...partialAscending],
      ])
    },
  )

  test('a sort by average percentage viewed in a window after publish is refused with sort_after_publish before any read', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    const before = api.google.dataApiRequests.length

    const windows = ['first1', 'first7', 'first28', 'first90', 'first365']
    const refused = await Promise.all(
      windows.map((window) =>
        listVideos(browser, channelId, { window, sort: '-averageViewPercentage' }),
      ),
    )

    expect(refused.map(({ status, body }) => [status, body])).toEqual(
      windows.map(() => [400, { error: 'sort_after_publish' }]),
    )
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  // The uploads publish one a day from 2024-01-02 to 2027-04-15, and today is 2027-06-01. The daily
  // rows reads cut the days from the first publish day to the last window's end into 100-day
  // slices: 1,247 days in first365 and first90, 1,227 in first28 and 1,206 in first7, 13 slices
  // each, and 1,200 days and 12 slices in first1. At most 464 videos' windows meet a slice, so each
  // slice is one query.
  test('1,200 uploads cost 13 daily rows queries in first365 on a cold cache, one for each 100-day slice', async ({
    web,
    clock,
  }) => {
    clock.set(new Date('2027-06-01T19:00:00Z'))
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(1200))

    const first365 = await listVideos(browser, channelId, { window: 'first365' })

    expect(first365.body).toMatchObject({ pageCount: 24, fromCache: false })
    // With the last processed day's read and 3 content types reads.
    expect(await readQuota(web)).toContainEqual({ api: 'analytics', units: 1 + 3 + 13 })
  })

  // The same 1,200 uploads and slices. The first slice's query asks the same 100 videos over the
  // same days in every window, so once first365 has read it, each later window reads every slice
  // but that one: 12 of 13 in first90, first28 and first7, and 11 of 12 in first1. Five lists of
  // 1,200 uploads take up to 6 seconds in CI beside the rest of the suite, past the default 5.
  test("after first365, the cache answers each later window's first slice", async ({
    web,
    clock,
  }) => {
    clock.set(new Date('2027-06-01T19:00:00Z'))
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(1200))
    await listVideos(browser, channelId, { window: 'first365' })
    const analyticsUnits = async () =>
      (await readQuota(web)).find(({ api }) => api === 'analytics')?.units ?? 0

    let before = await analyticsUnits()
    const unitsOf: Record<string, number> = {}
    for (const window of ['first90', 'first28', 'first7', 'first1']) {
      await listVideos(browser, channelId, { window })
      const after = await analyticsUnits()
      unitsOf[window] = after - before
      before = after
    }

    expect(unitsOf).toEqual({ first90: 12, first28: 12, first7: 12, first1: 11 })
  }, 20_000)

  // 300 uploads, one a day from 2024-01-02, whose first365 windows run over 7 slices. A video's
  // totals add every query that reads it, so a day two of its queries read would count twice.
  test('in first365, no two daily rows reads of a video share a day', async ({ web, clock }) => {
    clock.set(new Date('2027-06-01T19:00:00Z'))
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(300))

    await listVideos(browser, channelId, { window: 'first365' })

    const rangesOf = new Map<string, { startDate: string; endDate: string }[]>()
    for (const query of api.google.analyticsRequests) {
      if (query.get('dimensions') !== 'video,day') continue
      const range = { startDate: query.get('startDate') ?? '', endDate: query.get('endDate') ?? '' }
      for (const videoId of (query.get('filters') ?? '').replace('video==', '').split(',')) {
        rangesOf.set(videoId, [...(rangesOf.get(videoId) ?? []), range])
      }
    }
    const sharingADay = [...rangesOf].filter(([, ranges]) => {
      let lastRead = ''
      return ranges
        .toSorted((a, b) => a.startDate.localeCompare(b.startDate))
        .some(({ startDate, endDate }) => {
          const shares = startDate <= lastRead
          if (endDate > lastRead) lastRead = endDate
          return shares
        })
    })
    expect(rangesOf.size).toBe(300)
    expect(sharingADay.map(([videoId]) => videoId)).toEqual([])
  })

  // 600 videos published on one day all meet the same slice, past the 500 ids one query takes. Their
  // first90 ends on 2026-08-29, inside the slice's 100 days, so the slice is the only one.
  test('a slice 600 videos meet costs two daily rows queries, which count every video', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(
      api,
      Array.from({ length: 600 }, (_, i) =>
        publishedOn(i + 1, '2026-06-01', [{ day: '2026-06-01', engagedViews: 1, views: 1 }]),
      ),
    )
    api.google.setLastProcessedDay('2026-10-04')

    const lowestFirst = await listVideos(browser, channelId, {
      window: 'first90',
      sort: 'engagedViews',
    })

    const dailyRowsReads = api.google.analyticsRequests.filter(
      (query) => query.get('dimensions') === 'video,day',
    )
    expect(dailyRowsReads).toHaveLength(2)
    expect(lowestFirst.body.pageCount).toBe(12)
    expect(new Set(lowestFirst.body.videos.map(({ engagedViews }) => engagedViews))).toEqual(
      new Set([1]),
    )
  })

  // 600 videos published on one day meet one slice, read 500 a query, and the uploads playlist
  // repeats video 1 at its end, so the slice's two queries would each list it. The uploads read
  // lists a repeated video once, so it is one row, read once, and its day counts once.
  test('a video the uploads list repeats counts each of its days once', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const videos = Array.from({ length: 600 }, (_, i) =>
      publishedOn(i + 1, '2026-06-01', [{ day: '2026-06-01', engagedViews: 1, views: 1 }]),
    )
    const { browser, channelId } = await connectedCreator(api, [
      ...videos,
      publishedOn(1, '2026-06-01'),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await listVideos(browser, channelId, {
      window: 'first90',
      sort: '-engagedViews',
    })

    expect(
      listed.body.videos
        .filter(({ id }) => id === 'video-1')
        .map(({ engagedViews }) => engagedViews),
    ).toEqual([1])
  })

  // Video 1 is complete in first28: its window runs 2026-09-01 to 2026-09-28, so the day before
  // and the day after it count for nothing. Video 2 is partial, 10 of 28 days processed, and video
  // 3 was published after the last processed day.
  test('in first28, each video carries its engaged views for each processed day of its window, day 1 its publish day, 0 for a day with no row', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      publishedOn(1, '2026-09-01', [
        { day: '2026-08-31', engagedViews: 50, views: 50 },
        { day: '2026-09-01', engagedViews: 5, views: 6 },
        { day: '2026-09-03', engagedViews: 7, views: 8 },
        { day: '2026-09-28', engagedViews: 9, views: 10 },
        { day: '2026-09-29', engagedViews: 100, views: 100 },
      ]),
      publishedOn(2, '2026-09-25', [{ day: '2026-09-26', engagedViews: 2, views: 3 }]),
      publishedOn(3, '2026-10-05'),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await listVideos(browser, channelId, { window: 'first28', sort: 'publishedAt' })

    const video1Days = Array.from({ length: 28 }, () => 0)
    video1Days[0] = 5
    video1Days[2] = 7
    video1Days[27] = 9
    expect(
      listed.body.videos.map(({ id, engagedViewsByDay }) => ({ id, engagedViewsByDay })),
    ).toEqual([
      { id: 'video-1', engagedViewsByDay: video1Days },
      { id: 'video-2', engagedViewsByDay: [0, 2, 0, 0, 0, 0, 0, 0, 0, 0] },
      { id: 'video-3', engagedViewsByDay: [] },
    ])
  })

  // Twelve videos, each with engaged views on its publish day and more the day after, which no
  // publish day counts. Videos 3 and 4 tie, and the newer runs first. Video 13 was published after
  // the last processed day, so Google has not processed its publish day.
  test('in first7, the answer carries the 10 videos with the most engaged views on their publish day, each with its publish time, across every page, most first, ties newest first', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const publishDayViews = [5, 50, 30, 30, 1, 70, 20, 10, 60, 40, 2, 3]
    const { browser, channelId } = await connectedCreator(api, [
      ...publishDayViews.map((engagedViews, i) => {
        const day = `2026-09-${String(i + 1).padStart(2, '0')}`
        const nextDay = `2026-09-${String(i + 2).padStart(2, '0')}`
        return publishedOn(i + 1, day, [
          { day, engagedViews, views: engagedViews },
          { day: nextDay, engagedViews: 1000, views: 1000 },
        ])
      }),
      publishedOn(13, '2026-10-05'),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await listVideos(browser, channelId, { window: 'first7', pageSize: '2' })

    expect(idsOf(listed.body)).toEqual(['video-13', 'video-12'])
    expect(listed.body.publishDayTop).toEqual([
      {
        id: 'video-6',
        title: 'Upload 6',
        publishedAt: '2026-09-06T15:00:00.000Z',
        engagedViews: 70,
      },
      {
        id: 'video-9',
        title: 'Upload 9',
        publishedAt: '2026-09-09T15:00:00.000Z',
        engagedViews: 60,
      },
      {
        id: 'video-2',
        title: 'Upload 2',
        publishedAt: '2026-09-02T15:00:00.000Z',
        engagedViews: 50,
      },
      {
        id: 'video-10',
        title: 'Upload 10',
        publishedAt: '2026-09-10T15:00:00.000Z',
        engagedViews: 40,
      },
      {
        id: 'video-4',
        title: 'Upload 4',
        publishedAt: '2026-09-04T15:00:00.000Z',
        engagedViews: 30,
      },
      {
        id: 'video-3',
        title: 'Upload 3',
        publishedAt: '2026-09-03T15:00:00.000Z',
        engagedViews: 30,
      },
      {
        id: 'video-7',
        title: 'Upload 7',
        publishedAt: '2026-09-07T15:00:00.000Z',
        engagedViews: 20,
      },
      {
        id: 'video-8',
        title: 'Upload 8',
        publishedAt: '2026-09-08T15:00:00.000Z',
        engagedViews: 10,
      },
      {
        id: 'video-1',
        title: 'Upload 1',
        publishedAt: '2026-09-01T15:00:00.000Z',
        engagedViews: 5,
      },
      {
        id: 'video-12',
        title: 'Upload 12',
        publishedAt: '2026-09-12T15:00:00.000Z',
        engagedViews: 3,
      },
    ])
  })

  // Video 1 is a Short and video 2 unlisted. Video 3 had no row on its publish day, which Google
  // has processed, so it counts 0; video 4 was published after the last processed day.
  test("in first1, the publish day top follows the list's format and visibility, holds every video when fewer than 10, and leaves out an unprocessed publish day", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, {
        publishedAt: '2026-09-01T15:00:00Z',
        days: [{ day: '2026-09-01', engagedViews: 9, views: 9 }],
        creatorContentType: 'shorts',
      }),
      upload(2, {
        publishedAt: '2026-09-02T15:00:00Z',
        days: [{ day: '2026-09-02', engagedViews: 8, views: 8 }],
        privacyStatus: 'unlisted',
      }),
      publishedOn(3, '2026-09-03'),
      publishedOn(4, '2026-10-05'),
      publishedOn(5, '2026-09-05', [{ day: '2026-09-05', engagedViews: 4, views: 4 }]),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const [publicAll, publicVideos, everyVisibility] = await Promise.all([
      listVideos(browser, channelId, { window: 'first1' }),
      listVideos(browser, channelId, { window: 'first1', format: 'video' }),
      listVideos(browser, channelId, { window: 'first1', visibility: 'all' }),
    ])

    expect(topOf(publicAll)).toEqual([
      ['video-1', 9],
      ['video-5', 4],
      ['video-3', 0],
    ])
    expect(topOf(publicVideos)).toEqual([
      ['video-5', 4],
      ['video-3', 0],
    ])
    expect(topOf(everyVisibility)).toEqual([
      ['video-1', 9],
      ['video-2', 8],
      ['video-5', 4],
      ['video-3', 0],
    ])
  })

  // The last processed day's read, the content types read and the one daily rows slice: the days
  // and the top come from the reads the totals already spend.
  test("a first28 list's days and publish day top cost no Analytics query past its totals, and a calendar window carries neither", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      publishedOn(1, '2026-09-01', [{ day: '2026-09-01', engagedViews: 5, views: 5 }]),
      publishedOn(2, '2026-09-05', [{ day: '2026-09-06', engagedViews: 3, views: 3 }]),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const first28 = await listVideos(browser, channelId, { window: 'first28' })
    const afterFirst28 = await readQuota(web)
    const last28 = await listVideos(browser, channelId, { window: 'last28' })

    expect(first28.body.publishDayTop).toHaveLength(2)
    expect(
      first28.body.videos.every(({ engagedViewsByDay }) => engagedViewsByDay?.length === 28),
    ).toBe(true)
    expect(afterFirst28).toContainEqual({ api: 'analytics', units: 3 })
    expect(last28.body.publishDayTop).toBeUndefined()
    expect(last28.body.videos.map(({ engagedViewsByDay }) => engagedViewsByDay)).toEqual([
      undefined,
      undefined,
    ])
  })
})

/** An upload published on this day with these engaged views on it, and these overrides. */
function launchedOn(
  n: number,
  day: string,
  engagedViews: number,
  overrides: Partial<FakeUpload> = {},
): FakeUpload {
  return upload(n, {
    publishedAt: `${day}T15:00:00Z`,
    days: [{ day, engagedViews, views: engagedViews }],
    ...overrides,
  })
}

describe('seam 1: the average engaged views of the newest public uploads', () => {
  // Two uploads of each format and one Google gives no format, each window processed whole. Video
  // 1 has two days inside its 7, so its count is their sum.
  test('in first7, each format filter averages its own uploads, and every format counts one Google gives no format too', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, {
        publishedAt: '2026-09-01T15:00:00Z',
        days: [
          { day: '2026-09-01', engagedViews: 10, views: 10 },
          { day: '2026-09-03', engagedViews: 20, views: 20 },
        ],
      }),
      launchedOn(2, '2026-09-02', 50),
      launchedOn(3, '2026-09-03', 7, { creatorContentType: 'shorts' }),
      launchedOn(4, '2026-09-04', 9, { creatorContentType: 'shorts' }),
      launchedOn(5, '2026-09-05', 4, { creatorContentType: 'liveStream' }),
      launchedOn(6, '2026-09-06', 6, { contentTypeViews: { liveStream: 30, videoOnDemand: 5 } }),
      launchedOn(7, '2026-09-07', 104, { creatorContentType: 'story' }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const [all, video, short, live] = await Promise.all(
      (['all', 'video', 'short', 'live'] as const).map((format) =>
        listVideos(browser, channelId, { window: 'first7', format }),
      ),
    )

    expect(all?.body.newestAverage).toEqual({ format: 'all', count: 7, engagedViews: 30 })
    expect(video?.body.newestAverage).toEqual({ format: 'video', count: 2, engagedViews: 40 })
    expect(short?.body.newestAverage).toEqual({ format: 'short', count: 2, engagedViews: 8 })
    expect(live?.body.newestAverage).toEqual({ format: 'live', count: 2, engagedViews: 5 })
  })

  // Videos 3 to 6 are each newer than the two counted, with far more engaged views. Video 3 was
  // published on 2026-10-01, so Google has processed 4 of its 7 days.
  test('a partial, an unlisted, a private and a scheduled video are left out', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      launchedOn(1, '2026-09-01', 10),
      launchedOn(2, '2026-09-02', 20),
      launchedOn(3, '2026-10-01', 1000),
      launchedOn(4, '2026-09-20', 1000, { privacyStatus: 'unlisted' }),
      launchedOn(5, '2026-09-21', 1000, { privacyStatus: 'private' }),
      { videoId: 'video-6', title: 'Upload 6', scheduledFor: '2026-10-20T15:00:00Z' },
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await listVideos(browser, channelId, { window: 'first7' })

    expect(listed.body.newestAverage).toEqual({ format: 'all', count: 2, engagedViews: 15 })
  })

  // Video n has 2n engaged views on its publish day, so the newest 10, videos 3 to 12, add to 150.
  test('of 12 qualifying uploads, it counts the newest 10 only', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(
      api,
      Array.from({ length: 12 }, (_, i) =>
        launchedOn(i + 1, `2026-09-${String(i + 1).padStart(2, '0')}`, 2 * (i + 1)),
      ),
    )
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await listVideos(browser, channelId, { window: 'first7' })

    expect(listed.body.newestAverage).toEqual({ format: 'all', count: 10, engagedViews: 15 })
  })

  test('an average that is not whole is answered unrounded', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      launchedOn(1, '2026-09-01', 2),
      launchedOn(2, '2026-09-02', 3),
      launchedOn(3, '2026-09-03', 5),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await listVideos(browser, channelId, { window: 'first28' })

    expect(listed.body.newestAverage?.count).toBe(3)
    expect(listed.body.newestAverage?.engagedViews).toBeCloseTo(3.3333333, 6)
  })

  test('one qualifying upload gives no average, and neither does a calendar window, lifetime or a custom range', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      launchedOn(1, '2026-09-01', 10),
      launchedOn(2, '2026-09-02', 20, { creatorContentType: 'shorts' }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const [oneShort, first7, last28, lifetime, custom] = await Promise.all([
      listVideos(browser, channelId, { window: 'first7', format: 'short' }),
      listVideos(browser, channelId, { window: 'first7' }),
      listVideos(browser, channelId, { window: 'last28' }),
      listVideos(browser, channelId, { window: 'lifetime' }),
      listVideos(browser, channelId, { window: 'custom', from: '2026-09-01', to: '2026-09-30' }),
    ])

    expect(oneShort.status).toBe(200)
    expect(oneShort.body).not.toHaveProperty('newestAverage')
    expect(first7.body.newestAverage).toEqual({ format: 'all', count: 2, engagedViews: 15 })
    for (const calendar of [last28, lifetime, custom]) {
      expect(calendar.status).toBe(200)
      expect(calendar.body).not.toHaveProperty('newestAverage')
    }
  })

  // Video 3 is unlisted and video 4 scheduled: the list's switches show them, the average never
  // counts them.
  test("the same average whatever the list's visibility switch, scheduled toggle, sort, page and ids", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      launchedOn(1, '2026-09-01', 10),
      launchedOn(2, '2026-09-02', 30),
      launchedOn(3, '2026-09-03', 500, { privacyStatus: 'unlisted' }),
      { videoId: 'video-4', title: 'Upload 4', scheduledFor: '2026-10-20T15:00:00Z' },
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const queries: Record<string, string>[] = [
      {},
      { visibility: 'all' },
      { includeScheduled: 'true' },
      { sort: '-engagedViews' },
      { sort: 'publishedAt' },
      { page: '2', pageSize: '1' },
      { ids: 'video-3' },
    ]
    const answers = await Promise.all(
      queries.map((query) => listVideos(browser, channelId, { window: 'first7', ...query })),
    )

    expect(answers.map(({ status }) => status)).toEqual(queries.map(() => 200))
    expect(answers.map(({ body }) => body.newestAverage)).toEqual(
      queries.map(() => ({ format: 'all', count: 2, engagedViews: 20 })),
    )
  })
})

describe('seam 1: the video list refuses a repeated query parameter', () => {
  // Two values of each parameter, each valid alone, with the code a bad value of it gets.
  const repeats: [string, [string, string], string][] = [
    ['page', ['1', '2'], 'invalid_query'],
    ['pageSize', ['10', '25'], 'invalid_query'],
    ['includeScheduled', ['true', 'false'], 'invalid_query'],
    ['window', ['lifetime', 'last28'], 'invalid_window'],
    ['sort', ['views', '-publishedAt'], 'invalid_sort'],
    ['format', ['short', 'video'], 'invalid_format'],
    ['visibility', ['public', 'all'], 'invalid_visibility'],
    ['ids', ['video-1', 'video-2'], 'invalid_ids'],
  ]

  test('each parameter sent twice is refused with its own code before any read', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    const before = api.google.dataApiRequests.length

    const refused = await Promise.all(
      repeats.map(([name, [first, second]]) =>
        listVideos(browser, channelId, [
          [name, first],
          [name, second],
        ]),
      ),
    )

    expect(refused).toEqual(repeats.map(([, , error]) => ({ status: 400, body: { error } })))
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('with two parameters sent twice, the one the checks read first is refused, as with two bad values, whatever the address order', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))

    const refused = await listVideos(browser, channelId, [
      ['format', 'short'],
      ['format', 'video'],
      ['sort', 'views'],
      ['sort', '-publishedAt'],
    ])

    expect(refused).toEqual({ status: 400, body: { error: 'invalid_sort' } })
  })

  test('ids is read last: with ids and visibility both sent twice, visibility is refused, whatever the address order', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))

    const refused = await listVideos(browser, channelId, [
      ['ids', 'video-1'],
      ['ids', 'video-2'],
      ['visibility', 'public'],
      ['visibility', 'all'],
    ])

    expect(refused).toEqual({ status: 400, body: { error: 'invalid_visibility' } })
  })
})

describe('seam 1: the video list over a custom range', () => {
  test('a custom range that is bad before any read is refused with invalid_range before any read', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    const before = api.google.dataApiRequests.length

    const refused = []
    for (const query of badRangeQueries) refused.push(await listVideos(browser, channelId, query))

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
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    api.google.setLastProcessedDay('2026-10-04')

    // The creation day is 2019-02-28 in Pacific Time.
    const refused = [
      await listVideos(browser, channelId, {
        window: 'custom',
        from: '2019-02-27',
        to: '2019-03-10',
      }),
      await listVideos(browser, channelId, {
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

  test('a range of the creation day alone, and one that ends on the last processed day, are answered', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    api.google.setLastProcessedDay('2026-10-04')

    const answered = [
      await listVideos(browser, channelId, {
        window: 'custom',
        from: '2019-02-28',
        to: '2019-02-28',
      }),
      await listVideos(browser, channelId, {
        window: 'custom',
        from: '2026-10-01',
        to: '2026-10-04',
      }),
    ]

    expect(answered.map(({ status }) => status)).toEqual([200, 200])
  })

  test("each video carries its numbers over the custom range's days, in every sort", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, {
        rangeMetrics: [
          { startDate: '2026-09-20', endDate: '2026-09-22', metrics: windowNumbers(3) },
        ],
      }),
      upload(2, {
        rangeMetrics: [
          { startDate: '2026-09-20', endDate: '2026-09-22', metrics: windowNumbers(5) },
        ],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const range = { window: 'custom', from: '2026-09-20', to: '2026-09-22' }
    const listed = await listVideos(browser, channelId, range)
    const byPercentage = await listVideos(browser, channelId, {
      ...range,
      sort: 'averageViewPercentage',
    })

    expect(listed.status).toBe(200)
    expect(listed.body.window).toBe('custom')
    expect(listed.body.videos).toMatchObject([
      { id: 'video-2', ...windowNumbers(5) },
      { id: 'video-1', ...windowNumbers(3) },
    ])
    expect(idsOf(byPercentage.body)).toEqual(['video-1', 'video-2'])
  })

  test("every list carries the channel's creation day in Pacific Time, a preset window's too", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    api.google.setLastProcessedDay('2026-10-04')

    const lists = [
      await listVideos(browser, channelId, { window: 'first7' }),
      await listVideos(browser, channelId, {
        window: 'custom',
        from: '2026-09-01',
        to: '2026-09-30',
      }),
    ]

    expect(lists.map(({ body }) => body.creationDay)).toEqual(['2019-02-28', '2019-02-28'])
  })

  test('a custom range spends the Analytics queries of the calendar window of the same days, and shares its cache entries', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    // A channel that holds no days answers the last processed day search with no rows, so last28
    // resolves to 2026-09-06 to 2026-10-03.
    api.google.setChannel('UC-lister', { createdAt, uploads: uploads(3), days: {} })
    await listVideos(browser, channelId, { window: 'custom', from: '2026-09-06', to: '2026-10-03' })
    const customQueries = api.google.analyticsRequests.length

    const other = await signIn(api, otherCreator)
    api.google.pickChannel('UC-other-lister')
    api.google.setChannel('UC-other-lister', { createdAt, uploads: uploads(3), days: {} })
    await connect(other)
    const { channels } = await channelsOf(other)
    const otherChannelId = channels[0]?.id
    if (!otherChannelId) throw new Error('The other creator has no connected channel')
    await listVideos(other, otherChannelId, { window: 'last28' })
    const last28Queries = api.google.analyticsRequests.length - customQueries

    const last28 = await listVideos(browser, channelId, { window: 'last28' })

    expect(customQueries).toBeGreaterThan(0)
    expect(last28Queries).toBe(customQueries)
    expect(last28.body.fromCache).toBe(true)
    expect(api.google.analyticsRequests).toHaveLength(customQueries + last28Queries)
  })
})

/** These ids, comma-separated, as the `ids` parameter carries them. */
function idList(...ns: number[]): string {
  return ns.map((n) => `video-${n}`).join(',')
}

describe('seam 1: answer a set of video ids', () => {
  // A repeated ids is refused in the repeat table, with every other parameter's repeat.
  test('more than 50 ids, an empty list or a malformed list is refused with invalid_ids before any read', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    const before = api.google.dataApiRequests.length

    const fiftyOne = idList(...Array.from({ length: 51 }, (_, i) => i + 1))
    const badIds = [fiftyOne, '', 'abc,d!e', 'video-1,,video-2', 'video-1,', 'video 1']
    const refused = await Promise.all(badIds.map((ids) => listVideos(browser, channelId, { ids })))

    expect(refused).toEqual(
      Array.from({ length: 6 }, () => ({ status: 400, body: { error: 'invalid_ids' } })),
    )
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('exactly 50 ids are accepted', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [...uploads(3), upload(51)])

    const listed = await listVideos(browser, channelId, {
      ids: idList(...Array.from({ length: 50 }, (_, i) => i + 1)),
    })

    expect(listed.status).toBe(200)
    expect(idsOf(listed.body)).toEqual(['video-3', 'video-2', 'video-1'])
  })

  test('the answer holds exactly the listed uploads, public, unlisted, private and scheduled alike', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1),
      upload(2, { privacyStatus: 'unlisted' }),
      upload(3, { privacyStatus: 'private' }),
      { videoId: 'video-4', title: 'Upload 4', scheduledFor: '2027-01-01T17:00:00Z' },
      upload(5),
      upload(6, { privacyStatus: 'unlisted' }),
    ])

    const listed = await listVideos(browser, channelId, { ids: idList(4, 3, 2, 1) })

    expect(listed.status).toBe(200)
    expect(idsOf(listed.body)).toEqual(['video-4', 'video-3', 'video-2', 'video-1'])
    expect(listed.body.videos[0]).toMatchObject({ id: 'video-4', scheduled: true })
  })

  test('the listed uploads answer whatever visibility says: public and all answer the same set', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1),
      upload(2, { privacyStatus: 'unlisted' }),
      upload(3, { privacyStatus: 'private' }),
      upload(4, { privacyStatus: 'unlisted' }),
    ])

    const lists = await Promise.all(
      (['public', 'all'] as const).map((visibility) =>
        listVideos(browser, channelId, { ids: idList(3, 2, 1), visibility }),
      ),
    )

    expect(lists.map(({ status }) => status)).toEqual([200, 200])
    expect(lists.map(({ body }) => idsOf(body))).toEqual([
      ['video-3', 'video-2', 'video-1'],
      ['video-3', 'video-2', 'video-1'],
    ])
  })

  test('an id not among the uploads is left out, and the rest are answered', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))

    const listed = await listVideos(browser, channelId, { ids: 'video-1,not-an-upload,video-3' })

    expect(listed.status).toBe(200)
    expect(idsOf(listed.body)).toEqual(['video-3', 'video-1'])
  })

  test('ids combine with a calendar window: each listed video carries its numbers over the window', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, {
        rangeMetrics: [
          { startDate: '2026-09-10', endDate: '2026-10-07', metrics: windowNumbers(28) },
        ],
      }),
      upload(2),
    ])

    const listed = await listVideos(browser, channelId, { ids: idList(1), window: 'last28' })

    expect(listed.body.window).toBe('last28')
    expect(listed.body.videos).toEqual([
      expect.objectContaining({ id: 'video-1', ...windowNumbers(28) }),
    ])
  })

  test('ids combine with a window after publish: each listed video adds its own days', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      publishedOn(1, '2026-09-01', [
        { day: '2026-09-01', engagedViews: 1, views: 2, subscribersGained: 1 },
        { day: '2026-09-07', engagedViews: 3, views: 4, subscribersGained: 2 },
        { day: '2026-09-08', engagedViews: 100, views: 100, subscribersGained: 100 },
      ]),
      publishedOn(2, '2026-09-05', [{ day: '2026-09-05', engagedViews: 5, views: 6 }]),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await listVideos(browser, channelId, { ids: idList(1), window: 'first7' })

    expect(listed.body.window).toBe('first7')
    expect(listed.body.videos).toEqual([
      expect.objectContaining({ id: 'video-1', engagedViews: 4, views: 6, subscribersGained: 3 }),
    ])
    expect(listed.body.videos[0]).not.toHaveProperty('averageViewPercentage')
  })

  test('ids combine with a format filter: a listed video of another format is left out', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1),
      upload(2, { creatorContentType: 'shorts' }),
      upload(3, { creatorContentType: 'shorts' }),
    ])

    const listed = await listVideos(browser, channelId, { ids: idList(1, 2), format: 'short' })

    expect(idsOf(listed.body)).toEqual(['video-2'])
  })

  test('ids combine with a sort: the listed videos run in the order the sort asks for', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, { metrics: { ...windowNumbers(1), engagedViews: 300 } }),
      upload(2, { metrics: { ...windowNumbers(2), engagedViews: 100 } }),
      upload(3, { metrics: { ...windowNumbers(3), engagedViews: 200 } }),
      upload(4, { metrics: { ...windowNumbers(4), engagedViews: 900 } }),
    ])

    const listed = await listVideos(browser, channelId, {
      ids: idList(1, 2, 3),
      window: 'lifetime',
      sort: '-engagedViews',
    })

    expect(idsOf(listed.body)).toEqual(['video-1', 'video-3', 'video-2'])
  })

  test('the page size is capped at the number of ids', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(5))

    const listed = await Promise.all([
      listVideos(browser, channelId, { ids: idList(1, 2, 3) }),
      listVideos(browser, channelId, { ids: idList(1, 2, 3), pageSize: '10' }),
      listVideos(browser, channelId, { ids: idList(1, 2, 3, 3) }),
      listVideos(browser, channelId, { ids: idList(1, 2, 3), pageSize: '2' }),
    ])

    expect(listed.map(({ body }) => [body.pageSize, body.pageCount, idsOf(body)])).toEqual([
      [3, 1, ['video-3', 'video-2', 'video-1']],
      [3, 1, ['video-3', 'video-2', 'video-1']],
      [3, 1, ['video-3', 'video-2', 'video-1']],
      [2, 2, ['video-3', 'video-2']],
    ])
  })

  test('a cached read with ids spends no quota, after the same ids or after the full list', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))

    const first = await listVideos(browser, channelId, { ids: idList(1, 2) })
    const afterFirst = await readQuota(web)
    const again = await listVideos(browser, channelId, { ids: idList(1, 2) })
    const afterAgain = await readQuota(web)
    await listVideos(browser, channelId, { window: 'last7' })
    const afterFullList = await readQuota(web)
    const otherIds = await listVideos(browser, channelId, { ids: idList(3), window: 'last7' })

    expect(first.body.fromCache).toBe(false)
    expect(again.body.fromCache).toBe(true)
    expect(afterAgain).toEqual(afterFirst)
    expect(otherIds.body.fromCache).toBe(true)
    expect(idsOf(otherIds.body)).toEqual(['video-3'])
    expect(await readQuota(web)).toEqual(afterFullList)
  })

  test('a malformed visibility sent once with ids is still refused with invalid_visibility before any read', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    const before = api.google.dataApiRequests.length

    const refused = await listVideos(browser, channelId, { ids: idList(1, 2), visibility: 'bogus' })

    expect(refused).toEqual({ status: 400, body: { error: 'invalid_visibility' } })
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  // Without ids, the default visibility=public would leave the unlisted and private uploads out of
  // the publish day top. With ids, the top holds every listed upload whatever its visibility.
  test('in first1 with ids, the publish day top holds the listed unlisted and private uploads, most first, and none left out of ids', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1, {
        publishedAt: '2026-09-01T15:00:00Z',
        days: [{ day: '2026-09-01', engagedViews: 9, views: 9 }],
        privacyStatus: 'unlisted',
      }),
      upload(2, {
        publishedAt: '2026-09-02T15:00:00Z',
        days: [{ day: '2026-09-02', engagedViews: 7, views: 7 }],
        privacyStatus: 'private',
      }),
      publishedOn(3, '2026-09-03', [{ day: '2026-09-03', engagedViews: 4, views: 4 }]),
      upload(4, {
        publishedAt: '2026-09-04T15:00:00Z',
        days: [{ day: '2026-09-04', engagedViews: 20, views: 20 }],
        privacyStatus: 'unlisted',
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await listVideos(browser, channelId, { ids: idList(1, 2, 3), window: 'first1' })

    expect(listed.status).toBe(200)
    expect(topOf(listed)).toEqual([
      ['video-1', 9],
      ['video-2', 7],
      ['video-3', 4],
    ])
  })
})

describe('seam 1: the video list keeps the existing refusals', () => {
  test('a user without a membership to the channel gets not_connected', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    expect((await listVideos(browser, channelId)).status).toBe(200)
    const other = await signIn(api, otherCreator)

    const read = await listVideos(other, channelId)

    expect(read).toEqual({ status: 404, body: { refusal: 'not_connected' } })
  })

  test('a channel whose connection is revoked gets no list, not even a cached one', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    expect((await listVideos(browser, channelId)).status).toBe(200)
    const userId = await userIdOf(web, creator.email)
    await web.asUser(userId, (tx) => tx.sql.update(connections).set({ status: 'revoked' }))

    const read = await listVideos(browser, channelId)

    expect(read).toEqual({ status: 410, body: { refusal: 'connection_revoked' } })
  })

  test('a list that would take the Data API above 90% of its daily limit gets quota_reserved', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    // 90% of the Data API's 10,000 units a day, all spent.
    await web.asUser('quota-writer', (tx) =>
      tx.sql
        .update(quotaUsage)
        .set({ units: 9_000 })
        .where(and(eq(quotaUsage.api, 'data'), eq(quotaUsage.quotaDay, quotaDayOf(tx.now)))),
    )

    const read = await listVideos(browser, channelId)

    expect(read).toEqual({ status: 503, body: { refusal: 'quota_reserved' } })
  })

  test('a list whose Analytics query Google answers with an error gets google_failed', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    api.google.failAnalytics(500)

    const read = await listVideos(browser, channelId)

    expect(read).toEqual({ status: 502, body: { refusal: 'google_failed' } })
  })

  test('a list whose uploads read Google stops answering partway gets google_failed, and keeps the units spent before', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    api.google.dropDataApi('/youtube/v3/playlistItems')

    const read = await listVideos(browser, channelId)

    expect(read).toEqual({ status: 502, body: { refusal: 'google_failed' } })
    // The connect flow's channels.list call, the channel list's name read and the uploads read's own.
    expect(await readQuota(web)).toEqual([{ api: 'data', units: 3 }])
    expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
      level: 'error',
      message: 'The YouTube data API did not answer a call',
    })
    // The request line may name the channel by its internal id, as it stays on main-box; no other
    // line does, and no line holds its YouTube id.
    const logged = api.logs.join('\n')
    const otherLines = api.logs.filter((line) => JSON.parse(line).message !== 'API request')
    expect(otherLines.join('\n')).not.toContain(channelId)
    expect(logged).not.toContain('UC-lister')
  })
  test("a cold list whose first Analytics query Google never answers gets google_failed, and keeps the uploads read's units", async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    api.google.dropAnalyticsApi()

    const read = await listVideos(browser, channelId)

    expect(read).toEqual({ status: 502, body: { refusal: 'google_failed' } })
    // The connect flow's channels.list call, the channel list's name read, and the uploads read's
    // channels.list, playlistItems.list and videos.list calls, all answered.
    expect(await readQuota(web)).toEqual([{ api: 'data', units: 5 }])
    expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
      level: 'error',
      message: 'The YouTube analytics API did not answer a call',
    })
  })

  // Each test's timeout is half production's bound, and the held call never answers, so only the
  // API's bound on a Google call can end the request in time.
  const heldCallTest = { timeout: googleCallTimeoutMs / 2 }
  // Short enough to end well inside the test's timeout, long enough that the fake's answered calls
  // never reach it.
  const shortCallBoundMs = 500

  test(
    "a cold list whose first Analytics query Google holds open past the bound gets google_failed, and keeps the uploads read's units",
    heldCallTest,
    async ({ web }) => {
      const api = await startApi(web, { googleCallTimeoutMs: shortCallBoundMs })
      const { browser, channelId } = await connectedCreator(api, uploads(3))
      api.google.holdAnalyticsApi()

      const read = await listVideos(browser, channelId)

      expect(read).toEqual({ status: 502, body: { refusal: 'google_failed' } })
      // The connect flow's channels.list call, the channel list's name read, and the uploads read's
      // channels.list, playlistItems.list and videos.list calls, all answered.
      expect(await readQuota(web)).toEqual([{ api: 'data', units: 5 }])
      expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
        level: 'error',
        message: 'The YouTube analytics API did not answer a call',
      })
    },
  )

  test(
    'a list whose uploads read Google holds open past the bound gets google_failed, and keeps the units spent before',
    heldCallTest,
    async ({ web }) => {
      const api = await startApi(web, { googleCallTimeoutMs: shortCallBoundMs })
      const { browser, channelId } = await connectedCreator(api, uploads(3))
      api.google.holdDataApi('/youtube/v3/playlistItems')

      const read = await listVideos(browser, channelId)

      expect(read).toEqual({ status: 502, body: { refusal: 'google_failed' } })
      // The connect flow's channels.list call, the channel list's name read and the uploads read's own.
      expect(await readQuota(web)).toEqual([{ api: 'data', units: 3 }])
      expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
        level: 'error',
        message: 'The YouTube data API did not answer a call',
      })
    },
  )

  test(
    "a list whose access token refresh Google's token endpoint holds open past the bound gets google_failed",
    heldCallTest,
    async ({ web, clock }) => {
      const api = await startApi(web, { googleCallTimeoutMs: shortCallBoundMs })
      const { browser, channelId } = await connectedCreator(api, uploads(3))
      // An hour on, the connection's access token is about to expire, so the read refreshes it first.
      clock.advance(60 * 60 * 1000)
      api.google.holdTokenEndpoint()

      const read = await listVideos(browser, channelId)

      expect(read).toEqual({ status: 502, body: { refusal: 'google_failed' } })
      // The connect flow's channels.list call and the channel list's name read; the list made none.
      expect(await readQuota(web)).toEqual([{ api: 'data', units: 2 }])
      expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
        level: 'error',
        message: "Google's token endpoint did not answer a call",
      })
    },
  )

  test(
    "a list whose access token refresh Google's token endpoint answers with a body that stalls past the bound gets google_failed",
    heldCallTest,
    async ({ web, clock }) => {
      const api = await startApi(web, { googleCallTimeoutMs: shortCallBoundMs })
      const { browser, channelId } = await connectedCreator(api, uploads(3))
      // An hour on, the connection's access token is about to expire, so the read refreshes it first.
      clock.advance(60 * 60 * 1000)
      api.google.stallTokenEndpointBody()

      const read = await listVideos(browser, channelId)

      expect(read).toEqual({ status: 502, body: { refusal: 'google_failed' } })
      // The connect flow's channels.list call and the channel list's name read; the list made none.
      expect(await readQuota(web)).toEqual([{ api: 'data', units: 2 }])
      expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
        level: 'error',
        message: "Google's token endpoint did not answer a call",
      })
    },
  )

  test("a list whose access token refresh Google's token endpoint answers with a 5xx gets google_failed", async ({
    web,
    clock,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, uploads(3))
    // An hour on, the connection's access token is about to expire, so the read refreshes it first.
    clock.advance(60 * 60 * 1000)
    api.google.failTokenEndpoint(503)

    const read = await listVideos(browser, channelId)

    expect(read).toEqual({ status: 502, body: { refusal: 'google_failed' } })
    // The connect flow's channels.list call and the channel list's name read; the list made none.
    expect(await readQuota(web)).toEqual([{ api: 'data', units: 2 }])
    expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
      level: 'error',
      message: "Google's token endpoint did not answer a call",
    })
  })
})

// Limits: the test harness runs a test's scopes one at a time on one connection, so this test
// cannot show two requests reading the database in parallel; production gives each its own. It is
// an end-to-end smoke test: nothing forces the twenty requests to overlap, so without the harness's
// queue it goes red only on the runs where two of them do. The deterministic guards of the queue
// are the "scopes opened at once" tests in packages/database/test/scopes.test.ts.
describe('seam 1: list requests in flight at once', () => {
  test('twenty list requests in flight at once each answer the creator their own list', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload(1),
      upload(2, { creatorContentType: 'shorts' }),
      upload(3, { creatorContentType: 'liveStream' }),
      withoutNumbers(upload(4)),
    ])
    const formats = Array.from({ length: 5 }, () => ['all', 'video', 'short', 'live']).flat()

    const listed = await Promise.all(
      formats.map((format) => listVideos(browser, channelId, { format })),
    )

    expect(listed.map(({ status }) => status)).toEqual(formats.map(() => 200))
    expect(listed.map(({ body }) => idsOf(body))).toEqual(
      formats.map(
        (format) =>
          ({
            all: ['video-4', 'video-3', 'video-2', 'video-1'],
            video: ['video-1'],
            short: ['video-2'],
            live: ['video-3'],
          })[format],
      ),
    )
  })
})
