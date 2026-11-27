// Limits: these tests read the requests a fake fetch records. They show the client asks the browser
// to include credentials, and cannot show a browser attaching the stillstats.com session cookie from
// an extension origin (host access, SameSite, Firefox's cookie partitioning). creator-analytics#101
// watches both browsers' network panels for the cookie.
import type { ListedChannel, VideoListAnswer, VideoRow } from '@creator-analytics/api-types'
import { describe, expect, test } from 'vitest'
import { createProductApi, type VideosQuery } from './product-api.ts'

const origin = 'https://stillstats.example'

const channel: ListedChannel = {
  id: 'channel-1',
  youtubeChannelId: 'UC123',
  title: 'Nick Vogel',
  handle: '@nick_vogel',
  revenueConsentedAt: null,
}

interface SentRequest {
  url: string
  method: string
  credentials: RequestCredentials | undefined
  contentType: string | null
  accessClientId: string | null
  accessClientSecret: string | null
  body: string | null
}

/** A fetch that records each request the API would receive and answers with the next reply. */
function fakeApi(...replies: Array<Response | Error>) {
  const requests: SentRequest[] = []
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    requests.push({
      url: String(input),
      method: init?.method ?? 'GET',
      credentials: init?.credentials,
      contentType: new Headers(init?.headers).get('content-type'),
      accessClientId: new Headers(init?.headers).get('CF-Access-Client-Id'),
      accessClientSecret: new Headers(init?.headers).get('CF-Access-Client-Secret'),
      body: typeof init?.body === 'string' ? init.body : null,
    })
    const reply = replies.shift() ?? new Response(null, { status: 500 })
    if (reply instanceof Error) throw reply
    return reply
  }
  return { fetch, requests }
}

/**
 * A fetch that never answers, the way a stalled API looks to the browser. Like a real fetch, it
 * rejects with the signal's reason when the request's signal aborts; with no signal it hangs for good.
 */
function hangingFetch() {
  return async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
    new Promise<Response>((_, reject) => {
      const signal = init?.signal
      if (!signal) return
      if (signal.aborted) reject(signal.reason)
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
}

/** Fetches that answer each reply in turn, then hang on every request after them. */
function answerThenHang(...replies: Response[]) {
  const hang = hangingFetch()
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const reply = replies.shift()
    return reply ?? hang(input, init)
  }
}

/** A bound short enough for a test to reach on real timers. */
const shortBoundMs = 20

/** Long enough for the short bound to fire, short enough that a read with no bound goes red fast. */
const hangTestTimeoutMs = 1_000

const channelsReply = () => Response.json({ channels: [channel] })

function clock(start = 1_000_000) {
  let now = start
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms
    },
  }
}

describe('reading the channels', () => {
  test('the read is a GET of /api/channels that asks the browser to include credentials', async () => {
    const api = fakeApi(channelsReply())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    await product.readChannels()

    expect(api.requests).toMatchObject([
      { url: `${origin}/api/channels`, method: 'GET', credentials: 'include' },
    ])
  })

  test("a signed-in read answers the creator's channels", async () => {
    const api = fakeApi(channelsReply())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.readChannels()).toEqual({ state: 'signed-in', channels: [channel] })
  })

  test('a 401 reads as signed out', async () => {
    const api = fakeApi(Response.json({ error: 'unauthorized' }, { status: 401 }))
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.readChannels()).toEqual({ state: 'signed-out' })
  })

  test('a 500 reads as failed', async () => {
    const api = fakeApi(Response.json({ error: 'internal' }, { status: 500 }))
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.readChannels()).toEqual({ state: 'failed' })
  })

  test('a request the network drops reads as failed', async () => {
    const api = fakeApi(new TypeError('Failed to fetch'))
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.readChannels()).toEqual({ state: 'failed' })
  })

  test('a 200 whose body is not a channel list reads as failed', async () => {
    const api = fakeApi(Response.json({ error: 'internal' }))
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.readChannels()).toEqual({ state: 'failed' })
  })

  test(
    'a read the API never answers reads as failed once the bound passes',
    async () => {
      const product = createProductApi({
        origin,
        fetch: hangingFetch(),
        now: clock().now,
        answerWithinMs: shortBoundMs,
      })

      expect(await product.readChannels()).toEqual({ state: 'failed' })
    },
    hangTestTimeoutMs,
  )
})

describe('the short cache keeps repeat reads off the network', () => {
  test('a second read within 30 seconds sends no request and answers the same channels', async () => {
    const api = fakeApi(channelsReply())
    const time = clock()
    const product = createProductApi({ origin, fetch: api.fetch, now: time.now })

    await product.readChannels()
    time.advance(29_999)

    expect(await product.readChannels()).toEqual({ state: 'signed-in', channels: [channel] })
    expect(api.requests).toHaveLength(1)
  })

  test('a read 30 seconds later asks the API again', async () => {
    const api = fakeApi(channelsReply(), channelsReply())
    const time = clock()
    const product = createProductApi({ origin, fetch: api.fetch, now: time.now })

    await product.readChannels()
    time.advance(30_000)
    await product.readChannels()

    expect(api.requests).toHaveLength(2)
  })

  test('a signed-out read is not kept, so a sign-in shows on the next read', async () => {
    const api = fakeApi(new Response(null, { status: 401 }), channelsReply())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    await product.readChannels()

    expect(await product.readChannels()).toEqual({ state: 'signed-in', channels: [channel] })
  })

  test('a failed read is not kept', async () => {
    const api = fakeApi(new Response(null, { status: 503 }), channelsReply())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    await product.readChannels()

    expect(await product.readChannels()).toEqual({ state: 'signed-in', channels: [channel] })
  })
})

describe('sending a usage event', () => {
  test('extension_popup_sign_in_clicked is a POST to the relay that asks the browser to include credentials', async () => {
    const api = fakeApi(new Response(null, { status: 204 }))
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    await product.sendEvent({ name: 'extension_popup_sign_in_clicked' })

    expect(api.requests).toEqual([
      {
        url: `${origin}/api/events`,
        method: 'POST',
        credentials: 'include',
        contentType: 'application/json',
        accessClientId: null,
        accessClientSecret: null,
        body: '{"name":"extension_popup_sign_in_clicked"}',
      },
    ])
  })

  test('an event the relay accepts answers sent', async () => {
    const api = fakeApi(new Response(null, { status: 204 }))
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.sendEvent({ name: 'extension_popup_sign_in_clicked' })).toBe(true)
  })

  test.each([
    ['a refusal', () => new Response(null, { status: 401 })],
    ['a dropped request', () => new TypeError('Failed to fetch')],
  ])('an event that meets %s answers not sent', async (_, reply) => {
    const api = fakeApi(reply())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.sendEvent({ name: 'extension_popup_sign_in_clicked' })).toBe(false)
  })

  test(
    'an event the relay never answers answers not sent once the bound passes',
    async () => {
      const product = createProductApi({
        origin,
        fetch: hangingFetch(),
        now: clock().now,
        answerWithinMs: shortBoundMs,
      })

      expect(await product.sendEvent({ name: 'extension_popup_sign_in_clicked' })).toBe(false)
    },
    hangTestTimeoutMs,
  )
})

const studioChannelId = 'UC123'

const videoAnswer: VideoListAnswer = {
  videos: [
    {
      id: 'NDha0z6zDA8',
      title: 'Payload Local API',
      thumbnailUrl: null,
      thumbnails: [],
      durationSeconds: null,
      publishedAt: '2026-10-06T15:00:00Z',
      scheduled: false,
      privacy: 'public',
      format: 'video',
      engagedViews: 1234,
      views: 1400,
      averageViewPercentage: 41.2,
      subscribersGained: 3,
      estimatedMinutesWatched: 0,
      awaitingProcessing: false,
    },
  ],
  window: 'lifetime',
  page: 1,
  pageSize: 1,
  pageCount: 1,
  revenue: { refusal: 'consent_missing' },
  lastProcessedDay: '2026-10-07',
  creationDay: null,
  fetchedAt: '2026-10-10T12:00:00Z',
  fromCache: false,
}

const videosReply = () => Response.json(videoAnswer)

const cardRead: VideosQuery = {
  youtubeChannelId: studioChannelId,
  ids: ['NDha0z6zDA8'],
  window: 'lifetime',
}

describe('reading videos for a Studio channel', () => {
  test("the video read asks for the matching channel's videos by its Stillstats id, with the ids and the window", async () => {
    const other: ListedChannel = { ...channel, id: 'channel-2', youtubeChannelId: 'UC999' }
    const api = fakeApi(Response.json({ channels: [other, channel] }), videosReply())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    await product.readVideos({ ...cardRead, ids: ['NDha0z6zDA8', 'abcdefghijk'] })

    expect(api.requests[1]).toMatchObject({
      url: `${origin}/api/channels/channel-1/videos?ids=NDha0z6zDA8%2Cabcdefghijk&window=lifetime`,
      method: 'GET',
      credentials: 'include',
    })
  })

  test("a read the API answers is the video list, with the matched channel's Stillstats id", async () => {
    const api = fakeApi(channelsReply(), videosReply())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.readVideos(cardRead)).toEqual({
      state: 'read',
      channelId: 'channel-1',
      answer: videoAnswer,
    })
  })

  test('a Studio channel no listed channel matches is not in Stillstats, and no video request is made', async () => {
    const api = fakeApi(channelsReply())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.readVideos({ ...cardRead, youtubeChannelId: 'UC999' })).toEqual({
      state: 'channel-not-in-stillstats',
    })
    expect(api.requests).toHaveLength(1)
  })

  test.each([
    ['the channel read', () => [new Response(null, { status: 401 })]],
    ['the video read', () => [channelsReply(), new Response(null, { status: 401 })]],
  ])('a 401 on %s reads as signed out', async (_, replies) => {
    const api = fakeApi(...replies())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.readVideos(cardRead)).toEqual({ state: 'signed-out' })
  })

  test('after a 401 on a video read, the kept channels are not served: the next channel read asks the API and reads as signed out', async () => {
    const api = fakeApi(
      channelsReply(),
      new Response(null, { status: 401 }),
      new Response(null, { status: 401 }),
    )
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })
    await product.readVideos(cardRead)

    expect(await product.readChannels()).toEqual({ state: 'signed-out' })
    expect(api.requests).toHaveLength(3)
  })

  test('after a 401 on a video read, a video read kept before it is not served: the same read asks the API again', async () => {
    const api = fakeApi(
      channelsReply(),
      videosReply(),
      new Response(null, { status: 401 }),
      channelsReply(),
      videosReply(),
    )
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })
    await product.readVideos(cardRead)
    await product.readVideos({ ...cardRead, ids: ['abcdefghijk'] })

    await product.readVideos(cardRead)

    expect(api.requests).toHaveLength(5)
  })

  test('after a 401 on a channel read, a video read kept before it is not served: the same read asks the API again', async () => {
    const api = fakeApi(
      channelsReply(),
      videosReply(),
      new Response(null, { status: 401 }),
      channelsReply(),
      videosReply(),
    )
    const time = clock()
    const product = createProductApi({ origin, fetch: api.fetch, now: time.now })
    await product.readChannels()
    time.advance(20_000)
    await product.readVideos(cardRead)
    time.advance(11_000)
    expect(await product.readChannels()).toEqual({ state: 'signed-out' })

    await product.readVideos(cardRead)

    expect(api.requests).toHaveLength(5)
    expect(api.requests[4]?.url).toBe(api.requests[1]?.url)
    expect(api.requests[4]?.url).toContain(`${origin}/api/channels/channel-1/videos?`)
  })

  test.each([
    ['not_connected', 404],
    ['connection_revoked', 410],
    ['quota_reserved', 503],
    ['google_failed', 502],
  ] as const)('a %s refusal reads as that refusal', async (refusal, status) => {
    const api = fakeApi(channelsReply(), Response.json({ refusal }, { status }))
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.readVideos(cardRead)).toEqual({ state: 'refused', refusal })
  })

  test.each([
    [
      'a 500 on the video read',
      () => [channelsReply(), Response.json({ error: 'internal' }, { status: 500 })],
    ],
    ['a dropped video request', () => [channelsReply(), new TypeError('Failed to fetch')]],
    ['a failed channel read', () => [new Response(null, { status: 500 })]],
    [
      'a channel read whose 200 body is not a channel list',
      () => [Response.json({ error: 'internal' })],
    ],
    ['a 200 whose body is not JSON', () => [channelsReply(), new Response('<html>')]],
    [
      'a 200 whose body is not a video list',
      () => [channelsReply(), Response.json({ error: 'internal' })],
    ],
  ])('%s reads as failed', async (_, replies) => {
    const api = fakeApi(...replies())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.readVideos(cardRead)).toEqual({ state: 'failed' })
  })

  test(
    'a video read the API never answers reads as failed once the bound passes',
    async () => {
      const product = createProductApi({
        origin,
        fetch: answerThenHang(channelsReply()),
        now: clock().now,
        answerWithinMs: shortBoundMs,
      })

      expect(await product.readVideos(cardRead)).toEqual({ state: 'failed' })
    },
    hangTestTimeoutMs,
  )

  test('a repeat of the same read within 30 seconds sends no request, and answers from the cache', async () => {
    const api = fakeApi(channelsReply(), videosReply())
    const time = clock()
    const product = createProductApi({ origin, fetch: api.fetch, now: time.now })

    await product.readVideos(cardRead)
    time.advance(29_999)

    expect(await product.readVideos(cardRead)).toEqual({
      state: 'read',
      channelId: 'channel-1',
      answer: { ...videoAnswer, fromCache: true },
    })
    expect(api.requests).toHaveLength(2)
  })

  test("the same read for another listed channel within 30 seconds asks the API for that channel's videos", async () => {
    const other: ListedChannel = { ...channel, id: 'channel-2', youtubeChannelId: 'UC999' }
    const api = fakeApi(Response.json({ channels: [channel, other] }), videosReply(), videosReply())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    await product.readVideos(cardRead)
    const read = await product.readVideos({ ...cardRead, youtubeChannelId: 'UC999' })

    expect(api.requests.map(({ url }) => url)).toEqual([
      `${origin}/api/channels`,
      `${origin}/api/channels/channel-1/videos?ids=NDha0z6zDA8&window=lifetime`,
      `${origin}/api/channels/channel-2/videos?ids=NDha0z6zDA8&window=lifetime`,
    ])
    expect(read).toMatchObject({ state: 'read', channelId: 'channel-2' })
  })

  test('a read of other ids within 30 seconds asks the API for them', async () => {
    const api = fakeApi(channelsReply(), videosReply(), videosReply())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    await product.readVideos(cardRead)
    await product.readVideos({ ...cardRead, ids: ['abcdefghijk'] })

    expect(api.requests.map(({ url }) => url)).toEqual([
      `${origin}/api/channels`,
      `${origin}/api/channels/channel-1/videos?ids=NDha0z6zDA8&window=lifetime`,
      `${origin}/api/channels/channel-1/videos?ids=abcdefghijk&window=lifetime`,
    ])
  })

  test('the same read 30 seconds later asks the API again', async () => {
    const api = fakeApi(channelsReply(), videosReply(), channelsReply(), videosReply())
    const time = clock()
    const product = createProductApi({ origin, fetch: api.fetch, now: time.now })

    await product.readVideos(cardRead)
    time.advance(30_000)
    await product.readVideos(cardRead)

    expect(api.requests).toHaveLength(4)
  })
})

/** The card's second read: the newest 10 public Shorts of the channel, over their lifetime. */
const shortsRead: VideosQuery = {
  youtubeChannelId: studioChannelId,
  format: 'short',
  newest: 10,
  window: 'lifetime',
}

describe("reading a format's newest uploads", () => {
  test('the read asks for the newest public uploads of the format, over the window, in a page of that many', async () => {
    const api = fakeApi(channelsReply(), videosReply())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    await product.readVideos(shortsRead)

    expect(api.requests[1]).toMatchObject({
      url: `${origin}/api/channels/channel-1/videos?window=lifetime&format=short&pageSize=10&visibility=public&sort=-publishedAt`,
      method: 'GET',
      credentials: 'include',
    })
  })

  test("a format read and an ids read of the same channel within 30 seconds each reach the API, and neither answers the other's", async () => {
    const shorts = { ...videoAnswer, videos: [] }
    const api = fakeApi(channelsReply(), videosReply(), Response.json(shorts))
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    await product.readVideos(cardRead)
    const read = await product.readVideos(shortsRead)

    expect(api.requests.map(({ url }) => url)).toEqual([
      `${origin}/api/channels`,
      `${origin}/api/channels/channel-1/videos?ids=NDha0z6zDA8&window=lifetime`,
      `${origin}/api/channels/channel-1/videos?window=lifetime&format=short&pageSize=10&visibility=public&sort=-publishedAt`,
    ])
    expect(read).toEqual({ state: 'read', channelId: 'channel-1', answer: shorts })
  })

  test('two formats within 30 seconds each reach the API', async () => {
    const api = fakeApi(channelsReply(), videosReply(), videosReply())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    await product.readVideos(shortsRead)
    await product.readVideos({ ...shortsRead, format: 'live' })

    expect(api.requests.map(({ url }) => url)).toEqual([
      `${origin}/api/channels`,
      `${origin}/api/channels/channel-1/videos?window=lifetime&format=short&pageSize=10&visibility=public&sort=-publishedAt`,
      `${origin}/api/channels/channel-1/videos?window=lifetime&format=live&pageSize=10&visibility=public&sort=-publishedAt`,
    ])
  })

  test('a repeat of the same format read within 30 seconds sends no request', async () => {
    const api = fakeApi(channelsReply(), videosReply())
    const time = clock()
    const product = createProductApi({ origin, fetch: api.fetch, now: time.now })

    await product.readVideos(shortsRead)
    time.advance(29_999)

    expect(await product.readVideos(shortsRead)).toEqual({
      state: 'read',
      channelId: 'channel-1',
      answer: { ...videoAnswer, fromCache: true },
    })
    expect(api.requests).toHaveLength(2)
  })
})

describe("reading a channel's uploads for the public pages", () => {
  /** One page of the uploads list: `ids` with 1,234 engaged views each, of `pageCount` pages. */
  const uploadsPage = (
    page: number,
    pageCount: number,
    ids: string[],
    lastProcessedDay = '2026-10-07',
  ): VideoListAnswer => ({
    ...videoAnswer,
    videos: ids.map((id) => ({ ...(videoAnswer.videos[0] as VideoRow), id, title: id })),
    page,
    pageSize: 50,
    pageCount,
    lastProcessedDay,
  })
  const pageReply = (...page: Parameters<typeof uploadsPage>) => Response.json(uploadsPage(...page))

  const uploadsQuery = (page: number) =>
    `${origin}/api/channels/channel-1/videos?window=lifetime&format=all&visibility=all&includeScheduled=true&sort=-publishedAt&pageSize=50&page=${page}`

  test('the read asks every upload of the channel, lifetime, any format and visibility, scheduled ones included, newest first, in pages of 50', async () => {
    const api = fakeApi(channelsReply(), pageReply(1, 1, ['NDha0z6zDA8']))
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    await product.readUploads(studioChannelId)

    expect(api.requests).toMatchObject([
      { url: `${origin}/api/channels` },
      { url: uploadsQuery(1), method: 'GET', credentials: 'include' },
    ])
  })

  test("the read pages 1 to the first page's pageCount in turn, no more, and answers every upload of them", async () => {
    const api = fakeApi(
      channelsReply(),
      pageReply(1, 3, ['video000001', 'video000002']),
      pageReply(2, 3, ['video000003']),
      pageReply(3, 3, ['video000004']),
      pageReply(4, 3, ['video000005']),
    )
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    const read = await product.readUploads(studioChannelId)

    expect(api.requests.map(({ url }) => url)).toEqual([
      `${origin}/api/channels`,
      uploadsQuery(1),
      uploadsQuery(2),
      uploadsQuery(3),
    ])
    expect(read.state === 'read' && read.videos.map(({ id }) => id)).toEqual([
      'video000001',
      'video000002',
      'video000003',
      'video000004',
    ])
    expect(read).toMatchObject({ state: 'read', channelId: 'channel-1' })
  })

  test.each([
    ['a single page the API read cold', false, [false]],
    ['a single page from the cache', true, [true]],
    ['a cold page after a cached one', false, [true, false]],
    ['a cached page after a cold one', false, [false, true]],
    ['pages all from the cache', true, [true, true, true]],
  ])('%s answers fromCache %s', async (_, fromCache, pagesFromCache) => {
    const pageCount = pagesFromCache.length
    const api = fakeApi(
      channelsReply(),
      ...pagesFromCache.map((cached, index) =>
        Response.json({
          ...uploadsPage(index + 1, pageCount, [`video00000${index + 1}`]),
          fromCache: cached,
        }),
      ),
    )
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.readUploads(studioChannelId)).toMatchObject({ state: 'read', fromCache })
  })

  test('the read answers the oldest last processed day of its pages', async () => {
    const api = fakeApi(
      channelsReply(),
      pageReply(1, 3, ['video000001'], '2026-10-07'),
      pageReply(2, 3, ['video000002'], '2026-10-05'),
      pageReply(3, 3, ['video000003'], '2026-10-06'),
    )
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.readUploads(studioChannelId)).toMatchObject({
      lastProcessedDay: '2026-10-05',
    })
  })

  test('a channel with no uploads, 0 pages, is a read with no videos and one request', async () => {
    const api = fakeApi(channelsReply(), pageReply(1, 0, []))
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.readUploads(studioChannelId)).toEqual({
      state: 'read',
      channelId: 'channel-1',
      videos: [],
      lastProcessedDay: '2026-10-07',
      fromCache: false,
    })
    expect(api.requests).toHaveLength(2)
  })

  test('a channel no listed channel matches is not in Stillstats, and no video request is made', async () => {
    const api = fakeApi(channelsReply())
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    expect(await product.readUploads('UC999')).toEqual({ state: 'channel-not-in-stillstats' })
    expect(api.requests).toHaveLength(1)
  })

  /** The replies before the failing one: none on page 1, page 1 of 2 on page 2. */
  const before = {
    'page 1': () => [channelsReply()],
    'page 2': () => [channelsReply(), pageReply(1, 2, ['video000001'])],
  }

  describe.each(Object.entries(before))('a failure on %s answers no partial list', (_, earlier) => {
    test.each([
      ['a 401', () => new Response(null, { status: 401 }), { state: 'signed-out' }],
      [
        'a quota_reserved refusal',
        () => Response.json({ refusal: 'quota_reserved' }, { status: 503 }),
        { state: 'refused', refusal: 'quota_reserved' },
      ],
      ['a 500', () => Response.json({ error: 'internal' }, { status: 500 }), { state: 'failed' }],
      ['a dropped request', () => new TypeError('Failed to fetch'), { state: 'failed' }],
      ['a body that is not JSON', () => new Response('<html>'), { state: 'failed' }],
      [
        'a body that is not a video list',
        () => Response.json({ error: 'internal' }),
        { state: 'failed' },
      ],
    ] as const)('%s', async (_, reply, read) => {
      const api = fakeApi(...earlier(), reply())
      const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

      expect(await product.readUploads(studioChannelId)).toEqual(read)
    })

    test(
      'a page the API never answers, once the bound passes',
      async () => {
        const product = createProductApi({
          origin,
          fetch: answerThenHang(...earlier()),
          now: clock().now,
          answerWithinMs: shortBoundMs,
        })

        expect(await product.readUploads(studioChannelId)).toEqual({ state: 'failed' })
      },
      hangTestTimeoutMs,
    )
  })

  test('a read within 30 seconds sends no request and answers the same uploads; 30 seconds later it pages again', async () => {
    const api = fakeApi(
      channelsReply(),
      pageReply(1, 1, ['video000001']),
      channelsReply(),
      pageReply(1, 1, ['video000002']),
    )
    const time = clock()
    const product = createProductApi({ origin, fetch: api.fetch, now: time.now })
    const first = await product.readUploads(studioChannelId)

    time.advance(29_999)
    expect(await product.readUploads(studioChannelId)).toEqual({ ...first, fromCache: true })
    expect(api.requests).toHaveLength(2)

    time.advance(1)
    const again = await product.readUploads(studioChannelId)
    expect(again.state === 'read' && again.videos.map(({ id }) => id)).toEqual(['video000002'])
    expect(api.requests).toHaveLength(4)
  })

  test('a read that holds no uploads is not kept', async () => {
    const api = fakeApi(
      channelsReply(),
      Response.json({ error: 'internal' }, { status: 500 }),
      pageReply(1, 1, ['video000001']),
    )
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })
    await product.readUploads(studioChannelId)

    expect(await product.readUploads(studioChannelId)).toMatchObject({ state: 'read' })
    expect(api.requests).toHaveLength(3)
  })

  test("each listed channel's uploads are kept under its own channel", async () => {
    const other: ListedChannel = { ...channel, id: 'channel-2', youtubeChannelId: 'UC999' }
    const api = fakeApi(
      Response.json({ channels: [channel, other] }),
      pageReply(1, 1, ['video000001']),
      pageReply(1, 1, ['video000002']),
    )
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    await product.readUploads(studioChannelId)
    const read = await product.readUploads('UC999')

    expect(api.requests.map(({ url }) => url)).toEqual([
      `${origin}/api/channels`,
      uploadsQuery(1),
      uploadsQuery(1).replace('channel-1', 'channel-2'),
    ])
    expect(read).toMatchObject({ state: 'read', channelId: 'channel-2' })
  })

  test('two reads while one paging is out share it: one set of requests, one answer', async () => {
    const api = fakeApi(
      channelsReply(),
      pageReply(1, 2, ['video000001']),
      pageReply(2, 2, ['video000002']),
    )
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    const [first, second] = await Promise.all([
      product.readUploads(studioChannelId),
      product.readUploads(studioChannelId),
    ])

    expect(api.requests).toHaveLength(3)
    expect(second).toEqual(first)
    expect(first).toMatchObject({ state: 'read' })
  })

  test("a read that shares a paging still out answers the paging's own cache result", async () => {
    const api = fakeApi(
      channelsReply(),
      pageReply(1, 2, ['video000001']),
      pageReply(2, 2, ['video000002']),
    )
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    const [first, second] = await Promise.all([
      product.readUploads(studioChannelId),
      product.readUploads(studioChannelId),
    ])

    expect(first).toMatchObject({ state: 'read', fromCache: false })
    expect(second).toMatchObject({ state: 'read', fromCache: false })
  })

  test('a read the background answers from its own keep is from the cache, though the API read it cold', async () => {
    const api = fakeApi(channelsReply(), pageReply(1, 1, ['video000001']))
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    const first = await product.readUploads(studioChannelId)
    const kept = await product.readUploads(studioChannelId)

    expect(first).toMatchObject({ state: 'read', fromCache: false })
    expect(kept).toMatchObject({ state: 'read', fromCache: true })
    expect(api.requests).toHaveLength(2)
  })

  test('a 401 on an uploads page clears the kept uploads and the kept channels', async () => {
    const other: ListedChannel = { ...channel, id: 'channel-2', youtubeChannelId: 'UC999' }
    const api = fakeApi(
      Response.json({ channels: [channel, other] }),
      pageReply(1, 1, ['video000001']),
      new Response(null, { status: 401 }),
      new Response(null, { status: 401 }),
    )
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })
    await product.readUploads(studioChannelId)
    expect(await product.readUploads('UC999')).toEqual({ state: 'signed-out' })

    expect(await product.readUploads(studioChannelId)).toEqual({ state: 'signed-out' })
    expect(api.requests).toHaveLength(4)
  })

  test('a 401 on a video read clears the kept uploads', async () => {
    const api = fakeApi(
      channelsReply(),
      pageReply(1, 1, ['video000001']),
      new Response(null, { status: 401 }),
      new Response(null, { status: 401 }),
    )
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })
    await product.readUploads(studioChannelId)
    await product.readVideos(cardRead)

    expect(await product.readUploads(studioChannelId)).toEqual({ state: 'signed-out' })
    expect(api.requests).toHaveLength(4)
  })
})

describe('a staging build sends its Access service token on every request', () => {
  const accessHeaders = {
    'CF-Access-Client-Id': 'fake-id.access',
    'CF-Access-Client-Secret': 'fake-secret',
  }
  const carried = { accessClientId: 'fake-id.access', accessClientSecret: 'fake-secret' }
  const onePage = (): VideoListAnswer => ({ ...videoAnswer, page: 1, pageSize: 50, pageCount: 2 })

  test('a channels read, a videos read and an uploads read across pages each carry both headers', async () => {
    const api = fakeApi(
      channelsReply(),
      Response.json(videoAnswer),
      Response.json(onePage()),
      Response.json({ ...onePage(), page: 2 }),
    )
    const product = createProductApi({
      origin,
      fetch: api.fetch,
      now: clock().now,
      headers: accessHeaders,
    })

    await product.readVideos(cardRead)
    await product.readUploads(studioChannelId)

    expect(api.requests).toHaveLength(4)
    expect(api.requests).toEqual(api.requests.map(() => expect.objectContaining(carried)))
  })

  test('an event send carries both headers beside its content type', async () => {
    const api = fakeApi(new Response(null, { status: 204 }))
    const product = createProductApi({
      origin,
      fetch: api.fetch,
      now: clock().now,
      headers: accessHeaders,
    })

    await product.sendEvent({ name: 'extension_popup_sign_in_clicked' })

    expect(api.requests).toMatchObject([{ contentType: 'application/json', ...carried }])
  })

  test('without headers, no read or event send carries either', async () => {
    const api = fakeApi(
      channelsReply(),
      Response.json(videoAnswer),
      Response.json({ ...onePage(), pageCount: 1 }),
      new Response(null, { status: 204 }),
    )
    const product = createProductApi({ origin, fetch: api.fetch, now: clock().now })

    await product.readVideos(cardRead)
    await product.readUploads(studioChannelId)
    await product.sendEvent({ name: 'extension_popup_sign_in_clicked' })

    expect(api.requests).toHaveLength(4)
    expect(api.requests).toEqual(
      api.requests.map(() =>
        expect.objectContaining({ accessClientId: null, accessClientSecret: null }),
      ),
    )
  })
})
