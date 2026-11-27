// Limits: these tests read from the fake Google server, so they cannot prove Google's real revenue
// for a video, which days and videos it leaves out, or how it converts a currency. A read-only check
// through the youtube MCP on 2026-10-09 against Nick's channel found Google answers the video
// detail's two shapes, `dimensions=day` and no dimension, each with a one-id filter and the three
// revenue metrics. It found Google answers the video list's `dimensions=video` with a three-id
// filter and `dimensions=video,day` with a two-id filter only with `estimatedRevenue` alone; the
// list asks both with the three revenue metrics, a shape no live check has covered, so these
// tests show only that the fake answers it. Nick reading his own videos on the deployed product
// covers the numbers.
import { createHash } from 'node:crypto'
import type { VideoDetailAnswer, VideoListAnswer } from '@creator-analytics/api-types'
import { readCache } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import type { FakeUpload, VideoNumbers } from '@creator-analytics/fake-google'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { channelsOf, connect, giveRevenueConsent, savePreferences, signIn } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'

// An email no other test file signs in with. Test files run in parallel against one database, and
// two files that sign in the same emails in a different order deadlock on the unique email index.
const creator = { sub: '307080', email: 'video-earner@example.com', name: 'A Video Earner' }

const createdAt = '2019-03-01T06:00:00Z'

// Noon on 2026-10-07 in Pacific Time, so today is 2026-10-07.
const noonToday = new Date('2026-10-07T19:00:00Z')

/** Numbers that name the video they belong to, with no revenue. */
function numbers(n: number): VideoNumbers {
  return {
    engagedViews: n * 10,
    views: n * 20,
    averageViewPercentage: 40 + n,
    subscribersGained: n,
    estimatedMinutesWatched: n * 30,
  }
}

/** The nth upload, published on the day given in Pacific Time, earning `revenue` over its lifetime. */
function upload(
  n: number,
  publishDay: string,
  revenue: number,
  overrides: Partial<FakeUpload> = {},
): FakeUpload {
  return {
    videoId: `video-${n}`,
    title: `Upload ${n}`,
    publishedAt: `${publishDay}T15:00:00Z`,
    metrics: { ...numbers(n), estimatedRevenue: revenue },
    ...overrides,
  }
}

/** Signs the creator in and connects their channel, which holds these uploads. */
async function connectedCreator(api: StartedApi, uploads: FakeUpload[]) {
  const browser = await signIn(api, creator)
  api.google.pickChannel('UC-video-earner')
  api.google.setChannel('UC-video-earner', { createdAt, uploads })
  await connect(browser)
  const { channels } = await channelsOf(browser)
  const channelId = channels[0]?.id
  if (!channelId) throw new Error('The creator has no connected channel')
  return { browser, channelId }
}

/** A creator with revenue consent, whose channel holds these uploads. */
async function earningCreator(api: StartedApi, uploads: FakeUpload[]) {
  const connected = await connectedCreator(api, uploads)
  await giveRevenueConsent(connected.browser, connected.channelId)
  return connected
}

async function listVideos(browser: Browser, channelId: string, query: Record<string, string>) {
  const response = await browser.fetch(
    `/api/channels/${channelId}/videos?${new URLSearchParams(query)}`,
  )
  return { status: response.status, body: (await response.json()) as VideoListAnswer }
}

async function videoDetail(
  browser: Browser,
  channelId: string,
  videoId: string,
  query: Record<string, string> = {},
) {
  const response = await browser.fetch(
    `/api/channels/${channelId}/videos/${videoId}?${new URLSearchParams(query)}`,
  )
  return { status: response.status, body: (await response.json()) as VideoDetailAnswer }
}

/** The Analytics queries that asked for revenue, in the order they went. */
function revenueQueriesOf(api: StartedApi) {
  return api.google.analyticsRequests.filter((query) =>
    query.get('metrics')?.includes('estimatedRevenue'),
  )
}

function revenueOf(answer: VideoListAnswer) {
  return answer.videos.map(({ id, estimatedRevenue }) => [id, estimatedRevenue])
}

const sixHours = 6 * 60 * 60 * 1000

describe('seam 1: revenue in the video list', () => {
  test("with revenue consent, each lifetime row carries the video's own revenue, 0 for a video YouTube reports none for, and the list names its currency", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { metrics: _, ...unwatched } = upload(3, '2026-09-03', 0)
    const { browser, channelId } = await earningCreator(api, [
      upload(1, '2026-09-01', 12.5),
      upload(2, '2026-09-02', 3.25),
      unwatched,
    ])

    const listed = await listVideos(browser, channelId, { window: 'lifetime' })

    expect(listed.status).toBe(200)
    expect(revenueOf(listed.body)).toEqual([
      ['video-3', 0],
      ['video-2', 3.25],
      ['video-1', 12.5],
    ])
    expect(listed.body.revenue).toEqual({ currency: 'USD', reported: true })
    expect(
      revenueQueriesOf(api).map((query) => [
        query.get('dimensions'),
        query.get('startDate'),
        query.get('currency'),
      ]),
    ).toEqual([['video', '2019-02-28', 'USD']])
  })

  test("in a calendar window, each row carries the video's revenue over the window, in the saved currency", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const last28 = { startDate: '2026-09-10', endDate: '2026-10-07' }
    const { browser, channelId } = await earningCreator(api, [
      upload(1, '2026-09-01', 12.5, {
        rangeMetrics: [{ ...last28, metrics: { ...numbers(1), estimatedRevenue: 4.75 } }],
      }),
    ])
    await savePreferences(browser, { currency: 'EUR' })

    const listed = await listVideos(browser, channelId, { window: 'last28' })

    expect(revenueOf(listed.body)).toEqual([['video-1', 4.75]])
    expect(listed.body.revenue).toEqual({ currency: 'EUR', reported: true })
    expect(
      revenueQueriesOf(api).map((query) => [
        query.get('startDate'),
        query.get('endDate'),
        query.get('currency'),
      ]),
    ).toEqual([['2026-09-10', '2026-10-07', 'EUR']])
  })

  test("in a window after publish, each row carries the video's own revenue days inside its window added up", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api, [
      upload(1, '2026-09-01', 99, {
        days: [
          { day: '2026-09-01', engagedViews: 1, views: 2, estimatedRevenue: 1.5 },
          { day: '2026-09-07', engagedViews: 1, views: 2, estimatedRevenue: 0.25 },
          { day: '2026-09-08', engagedViews: 1, views: 2, estimatedRevenue: 50 },
        ],
      }),
      upload(2, '2026-09-05', 99, {
        days: [
          { day: '2026-09-05', engagedViews: 1, views: 2, estimatedRevenue: 2 },
          { day: '2026-09-11', engagedViews: 1, views: 2, estimatedRevenue: 0.5 },
        ],
      }),
      upload(3, '2026-09-03', 99),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const listed = await listVideos(browser, channelId, { window: 'first7' })

    expect(revenueOf(listed.body)).toEqual([
      ['video-2', 2.5],
      ['video-3', 0],
      ['video-1', 1.75],
    ])
    expect(listed.body.revenue).toEqual({ currency: 'USD', reported: true })
    // Over the same queries as the videos' other numbers by day.
    const daysOf = (metrics: string) =>
      api.google.analyticsRequests
        .filter((query) => query.get('dimensions') === 'video,day')
        .filter((query) => query.get('metrics') === metrics)
        .map((query) => [query.get('startDate'), query.get('endDate'), query.get('filters')])
    expect(daysOf('estimatedRevenue,estimatedAdRevenue,estimatedRedPartnerRevenue')).toEqual(
      daysOf('engagedViews,views,subscribersGained,estimatedMinutesWatched'),
    )
  })

  test.for(['lifetime', 'last28', 'first28'] as const)(
    'a %s list sorts by revenue in either direction, ties newest first',
    async (window, { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const revenue = (n: number, amount: number) =>
        upload(n, `2025-0${n}-01`, amount, {
          rangeMetrics: [
            {
              startDate: '2026-09-07',
              endDate: '2026-10-04',
              metrics: { ...numbers(n), estimatedRevenue: amount },
            },
          ],
          days: [{ day: `2025-0${n}-02`, engagedViews: 1, views: 1, estimatedRevenue: amount }],
        })
      const { browser, channelId } = await earningCreator(api, [
        revenue(1, 5),
        revenue(2, 9),
        revenue(3, 5),
        revenue(4, 1),
      ])
      api.google.setLastProcessedDay('2026-10-04')

      const highest = await listVideos(browser, channelId, { window, sort: '-estimatedRevenue' })
      const lowest = await listVideos(browser, channelId, { window, sort: 'estimatedRevenue' })

      expect(highest.body.videos.map(({ id }) => id)).toEqual([
        'video-2',
        'video-3',
        'video-1',
        'video-4',
      ])
      expect(lowest.body.videos.map(({ id }) => id)).toEqual([
        'video-4',
        'video-3',
        'video-1',
        'video-2',
      ])
    },
  )

  test('in a window after publish, a revenue sort puts a partial video after every complete one, in either direction', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api, [
      upload(1, '2026-08-01', 0, {
        days: [{ day: '2026-08-01', engagedViews: 1, views: 1, estimatedRevenue: 1 }],
      }),
      upload(2, '2026-08-02', 0, {
        days: [{ day: '2026-08-02', engagedViews: 1, views: 1, estimatedRevenue: 3 }],
      }),
      // Published 2026-09-20, so 15 of its first 28 days are processed by 2026-10-04.
      upload(3, '2026-09-20', 0, {
        days: [{ day: '2026-09-20', engagedViews: 1, views: 1, estimatedRevenue: 9 }],
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const highest = await listVideos(browser, channelId, {
      window: 'first28',
      sort: '-estimatedRevenue',
    })
    const lowest = await listVideos(browser, channelId, {
      window: 'first28',
      sort: 'estimatedRevenue',
    })

    expect(revenueOf(highest.body)).toEqual([
      ['video-2', 3],
      ['video-1', 1],
      ['video-3', 9],
    ])
    expect(highest.body.videos[2]?.partial).toEqual({ days: 15, of: 28 })
    expect(revenueOf(lowest.body)).toEqual([
      ['video-1', 1],
      ['video-2', 3],
      ['video-3', 9],
    ])
  })

  test.for(['lifetime', 'last28', 'first7'] as const)(
    "a %s list carries each video's ad and YouTube Premium revenue next to its estimated revenue, from one revenue query",
    async (window, { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const sources = {
        estimatedRevenue: 12.5,
        estimatedAdRevenue: 9,
        estimatedRedPartnerRevenue: 1.5,
      }
      const { browser, channelId } = await earningCreator(api, [
        upload(1, '2026-09-01', 0, {
          metrics: { ...numbers(1), ...sources },
          rangeMetrics: [
            {
              startDate: '2026-09-10',
              endDate: '2026-10-07',
              metrics: { ...numbers(1), ...sources },
            },
          ],
          days: [
            {
              day: '2026-09-01',
              engagedViews: 1,
              views: 1,
              estimatedRevenue: 10,
              estimatedAdRevenue: 7,
              estimatedRedPartnerRevenue: 1,
            },
            {
              day: '2026-09-02',
              engagedViews: 1,
              views: 1,
              estimatedRevenue: 2.5,
              estimatedAdRevenue: 2,
              estimatedRedPartnerRevenue: 0.5,
            },
          ],
        }),
      ])

      const listed = await listVideos(browser, channelId, { window })

      expect(listed.body.videos[0]).toMatchObject(sources)
      expect(revenueQueriesOf(api)).toHaveLength(1)
    },
  )

  // Each video's other sources is its estimated revenue less ads and YouTube Premium: 3, 0.5, 2
  // and 7.
  const bySource = [
    upload(1, '2026-01-01', 0, {
      metrics: {
        ...numbers(1),
        estimatedRevenue: 10,
        estimatedAdRevenue: 6,
        estimatedRedPartnerRevenue: 1,
      },
    }),
    upload(2, '2026-02-01', 0, {
      metrics: {
        ...numbers(2),
        estimatedRevenue: 8,
        estimatedAdRevenue: 7,
        estimatedRedPartnerRevenue: 0.5,
      },
    }),
    upload(3, '2026-03-01', 0, {
      metrics: {
        ...numbers(3),
        estimatedRevenue: 5,
        estimatedAdRevenue: 1,
        estimatedRedPartnerRevenue: 2,
      },
    }),
    upload(4, '2026-04-01', 0, {
      metrics: {
        ...numbers(4),
        estimatedRevenue: 12,
        estimatedAdRevenue: 2,
        estimatedRedPartnerRevenue: 3,
      },
    }),
  ]

  test.for([
    ['estimatedAdRevenue', [2, 1, 4, 3]],
    ['estimatedRedPartnerRevenue', [4, 3, 1, 2]],
    ['otherSources', [4, 1, 3, 2]],
  ] as const)(
    'a list sorts by %s in either direction',
    async ([key, highestFirst], { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await earningCreator(api, bySource)

      const highest = await listVideos(browser, channelId, { window: 'lifetime', sort: `-${key}` })
      const lowest = await listVideos(browser, channelId, { window: 'lifetime', sort: key })

      expect(highest.body.videos.map(({ id }) => id)).toEqual(highestFirst.map((n) => `video-${n}`))
      expect(lowest.body.videos.map(({ id }) => id)).toEqual(
        highestFirst.toReversed().map((n) => `video-${n}`),
      )
    },
  )

  test('without revenue consent, a sort by a revenue source is refused with consent_missing, in either direction, and spends no Analytics query', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, bySource)
    const callsBefore = api.google.analyticsRequests.length

    const refused = []
    for (const key of ['estimatedAdRevenue', 'estimatedRedPartnerRevenue', 'otherSources']) {
      for (const sort of [key, `-${key}`])
        refused.push(await listVideos(browser, channelId, { sort }))
    }

    expect(refused).toEqual(
      Array.from({ length: 6 }, () => ({ status: 403, body: { refusal: 'consent_missing' } })),
    )
    expect(api.google.analyticsRequests.slice(callsBefore)).toEqual([])
  })

  // The key the list's revenue read was cached under before it carried the sources: the read's
  // name, the range, the hash of the sorted video ids, and the currency.
  test('a list revenue read cached before it carried the sources is read again from Google', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const sources = {
      estimatedRevenue: 12.5,
      estimatedAdRevenue: 9,
      estimatedRedPartnerRevenue: 1.5,
    }
    const { browser, channelId } = await earningCreator(api, [
      upload(1, '2026-09-01', 0, { metrics: { ...numbers(1), ...sources } }),
    ])
    const videoIds = createHash('sha256').update('video-1').digest('base64url')
    await worker.forChannel(channelId, (tx) =>
      tx.sql.insert(readCache).values({
        channelId,
        key: `videoRevenue:2019-02-28:2026-10-07:${videoIds}:USD`,
        payload: { value: { 'video-1': 99 } },
        fetchedAt: tx.now,
        expiresAt: new Date(tx.now.getTime() + sixHours),
      }),
    )

    const listed = await listVideos(browser, channelId, { window: 'lifetime' })

    expect(listed.body.videos[0]).toMatchObject(sources)
    expect(revenueQueriesOf(api)).toHaveLength(1)
  })

  // The key the list's daily revenue read was cached under before it carried the sources: the
  // read's name, the range, the hash of the sorted video ids, and the currency.
  test('a list daily revenue read cached before it carried the sources is read again from Google', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api, [
      upload(1, '2026-09-01', 0, {
        days: [
          {
            day: '2026-09-01',
            engagedViews: 1,
            views: 1,
            estimatedRevenue: 10,
            estimatedAdRevenue: 7,
            estimatedRedPartnerRevenue: 1,
          },
        ],
      }),
    ])
    const videoIds = createHash('sha256').update('video-1').digest('base64url')
    await worker.forChannel(channelId, (tx) =>
      tx.sql.insert(readCache).values({
        channelId,
        key: `videoDailyRevenueRows:2026-09-01:2026-09-07:${videoIds}:USD`,
        payload: { value: { 'video-1': [{ day: '2026-09-01', estimatedRevenue: 99 }] } },
        fetchedAt: tx.now,
        expiresAt: new Date(tx.now.getTime() + sixHours),
      }),
    )

    const listed = await listVideos(browser, channelId, { window: 'first7' })

    expect(listed.body.videos[0]).toMatchObject({
      estimatedRevenue: 10,
      estimatedAdRevenue: 7,
      estimatedRedPartnerRevenue: 1,
    })
    expect(revenueQueriesOf(api)).toHaveLength(1)
  })

  test('without revenue consent, the rows carry no revenue, the list says why, and no revenue query reaches Google', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload(1, '2026-09-01', 12.5)])

    const lifetime = await listVideos(browser, channelId, { window: 'lifetime' })
    const first7 = await listVideos(browser, channelId, { window: 'first7' })

    for (const listed of [lifetime, first7]) {
      expect(listed.status).toBe(200)
      expect(listed.body.revenue).toEqual({ refusal: 'consent_missing' })
      expect(listed.body.videos[0]).not.toHaveProperty('estimatedRevenue')
    }
    expect(revenueQueriesOf(api)).toEqual([])
  })

  test('without revenue consent, a revenue sort is refused with consent_missing, in either direction, and spends no Analytics query', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload(1, '2026-09-01', 12.5)])
    const callsBefore = api.google.analyticsRequests.length

    const refused = [
      await listVideos(browser, channelId, { sort: '-estimatedRevenue' }),
      await listVideos(browser, channelId, { window: 'first7', sort: 'estimatedRevenue' }),
    ]

    expect(refused).toEqual([
      { status: 403, body: { refusal: 'consent_missing' } },
      { status: 403, body: { refusal: 'consent_missing' } },
    ])
    expect(api.google.analyticsRequests.slice(callsBefore)).toEqual([])
  })

  /**
   * The nth upload, earning `revenue` over `engaged` engaged views in every window: lifetime, the
   * last 28 days through 2026-10-04, and its first 28 days.
   */
  function rated(n: number, revenue: number, engaged: number): FakeUpload {
    const metrics = { ...numbers(n), engagedViews: engaged, estimatedRevenue: revenue }
    return upload(n, `2025-0${n}-01`, revenue, {
      metrics,
      rangeMetrics: [{ startDate: '2026-09-07', endDate: '2026-10-04', metrics }],
      days: [
        { day: `2025-0${n}-02`, engagedViews: engaged, views: engaged, estimatedRevenue: revenue },
      ],
    })
  }

  test.for(['lifetime', 'last28', 'first28'] as const)(
    'a %s list sorts by RPM in either direction, not by revenue, ties newest first, and zero engaged views last',
    async (window, { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      // RPMs 4, 1, 10, none, 3 and 4; by revenue the order is 2, 1, 5, 6, 3, 4.
      const { browser, channelId } = await earningCreator(api, [
        rated(1, 4, 1000),
        rated(2, 9, 9000),
        rated(3, 2, 200),
        rated(4, 1, 0),
        rated(5, 3, 1000),
        rated(6, 2, 500),
      ])
      api.google.setLastProcessedDay('2026-10-04')

      const highest = await listVideos(browser, channelId, { window, sort: '-rpm' })
      const lowest = await listVideos(browser, channelId, { window, sort: 'rpm' })

      expect(highest.status).toBe(200)
      expect(highest.body.videos.map(({ id }) => id)).toEqual(
        [3, 6, 1, 5, 2, 4].map((n) => `video-${n}`),
      )
      expect(lowest.body.videos.map(({ id }) => id)).toEqual(
        [2, 5, 6, 1, 3, 4].map((n) => `video-${n}`),
      )
    },
  )

  /**
   * The nth upload, earning `revenue` over `engaged` engaged views in every window, `ads` of it
   * from ads and `premium` from YouTube Premium, the rest from other sources.
   */
  function sourced(
    n: number,
    revenue: number,
    ads: number,
    premium: number,
    engaged: number,
  ): FakeUpload {
    const amounts = {
      estimatedRevenue: revenue,
      estimatedAdRevenue: ads,
      estimatedRedPartnerRevenue: premium,
    }
    const metrics = { ...numbers(n), engagedViews: engaged, ...amounts }
    return upload(n, `2025-0${n}-01`, revenue, {
      metrics,
      rangeMetrics: [{ startDate: '2026-09-07', endDate: '2026-10-04', metrics }],
      days: [{ day: `2025-0${n}-02`, engagedViews: engaged, views: engaged, ...amounts }],
    })
  }

  test.for(['lifetime', 'last28', 'first28'] as const)(
    'with the RPM switch on, a %s list sorts by the ads and YouTube Premium RPM in either direction, zero engaged views last (creator-analytics#357)',
    async (window, { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      // Over 1,000 engaged views each but the 4th, which has none. RPMs with the switch off are
      // 10, 6, 8, none and 3; with it on, ads plus YouTube Premium, 2, 6, 4, none and 3.
      const { browser, channelId } = await earningCreator(api, [
        sourced(1, 10, 1.5, 0.5, 1000),
        sourced(2, 6, 5, 1, 1000),
        sourced(3, 8, 3, 1, 1000),
        sourced(4, 5, 4, 1, 0),
        sourced(5, 3, 2, 1, 1000),
      ])
      api.google.setLastProcessedDay('2026-10-04')
      const orderOf = async (sort: string) =>
        (await listVideos(browser, channelId, { window, sort })).body.videos.map(({ id }) => id)
      const ids = (order: number[]) => order.map((n) => `video-${n}`)

      await savePreferences(browser, { rpmAdsAndPremiumOnly: true })
      const onHighest = await orderOf('-rpm')
      const onLowest = await orderOf('rpm')
      // The same uploads with the switch saved off keep the order of the whole estimated revenue,
      // so the switch is what changes it.
      await savePreferences(browser, { rpmAdsAndPremiumOnly: false })
      const offHighest = await orderOf('-rpm')
      const offLowest = await orderOf('rpm')

      expect(onHighest).toEqual(ids([2, 3, 5, 1, 4]))
      expect(onLowest).toEqual(ids([1, 5, 3, 2, 4]))
      expect(offHighest).toEqual(ids([1, 3, 2, 5, 4]))
      expect(offLowest).toEqual(ids([5, 2, 3, 1, 4]))
    },
  )

  test('in a window after publish, an RPM sort puts a partial video after every complete one, and zero engaged views after the others of each, in either direction', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const day = (date: string, engagedViews: number, estimatedRevenue: number) => ({
      days: [{ day: date, engagedViews, views: engagedViews, estimatedRevenue }],
    })
    const { browser, channelId } = await earningCreator(api, [
      upload(1, '2026-08-01', 0, day('2026-08-01', 1000, 2)),
      upload(2, '2026-08-02', 0, day('2026-08-02', 1000, 5)),
      upload(3, '2026-08-03', 0, day('2026-08-03', 0, 1)),
      // Published 2026-09-20 and 2026-09-21, so fewer than 28 days are processed by 2026-10-04.
      upload(4, '2026-09-20', 0, day('2026-09-20', 100, 9)),
      upload(5, '2026-09-21', 0, day('2026-09-21', 0, 1)),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const highest = await listVideos(browser, channelId, { window: 'first28', sort: '-rpm' })
    const lowest = await listVideos(browser, channelId, { window: 'first28', sort: 'rpm' })

    expect(highest.body.videos.map(({ id }) => id)).toEqual(
      [2, 1, 3, 4, 5].map((n) => `video-${n}`),
    )
    expect(highest.body.videos.map(({ partial }) => !!partial)).toEqual([
      false,
      false,
      false,
      true,
      true,
    ])
    expect(lowest.body.videos.map(({ id }) => id)).toEqual([1, 2, 3, 4, 5].map((n) => `video-${n}`))
  })

  test('without revenue consent, an RPM sort is refused with consent_missing, in either direction, and spends no Analytics query', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload(1, '2026-09-01', 12.5)])
    const callsBefore = api.google.analyticsRequests.length

    const refused = [
      await listVideos(browser, channelId, { sort: '-rpm' }),
      await listVideos(browser, channelId, { window: 'first7', sort: 'rpm' }),
    ]

    expect(refused).toEqual([
      { status: 403, body: { refusal: 'consent_missing' } },
      { status: 403, body: { refusal: 'consent_missing' } },
    ])
    expect(api.google.analyticsRequests.slice(callsBefore)).toEqual([])
  })

  test('a channel outside the YouTube Partner Program sorted by RPM runs newest first in either direction, zero engaged views last', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api, [
      upload(1, '2026-09-01', 12.5),
      upload(2, '2026-09-02', 3.25),
      upload(3, '2026-09-03', 1, { metrics: { ...numbers(3), engagedViews: 0 } }),
    ])
    api.google.setPartnerProgram('UC-video-earner', false)

    const sorted = [
      await listVideos(browser, channelId, { window: 'lifetime', sort: '-rpm' }),
      await listVideos(browser, channelId, { window: 'lifetime', sort: 'rpm' }),
    ]

    for (const listed of sorted) {
      expect(listed.body.revenue).toEqual({ refusal: 'not_monetized' })
      expect(listed.body.videos.map(({ id }) => id)).toEqual(['video-2', 'video-1', 'video-3'])
    }
  })

  test('a channel outside the YouTube Partner Program gets its list with not_monetized in place of revenue, and a revenue sort runs newest first', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api, [
      upload(1, '2026-09-01', 12.5),
      upload(2, '2026-09-02', 3.25),
    ])
    api.google.setPartnerProgram('UC-video-earner', false)

    const listed = await listVideos(browser, channelId, {
      window: 'lifetime',
      sort: '-estimatedRevenue',
    })

    expect(listed.status).toBe(200)
    expect(listed.body.revenue).toEqual({ refusal: 'not_monetized' })
    expect(listed.body.videos.map(({ id, engagedViews }) => [id, engagedViews])).toEqual([
      ['video-2', 20],
      ['video-1', 10],
    ])
    expect(listed.body.videos[0]).not.toHaveProperty('estimatedRevenue')
  })

  test('not_monetized is cached for 6 hours, and after them a channel that joined the YouTube Partner Program lists its revenue', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api, [upload(1, '2026-09-01', 12.5)])
    api.google.setPartnerProgram('UC-video-earner', false)
    await listVideos(browser, channelId, { window: 'lifetime' })
    const calls = api.google.analyticsRequests.length
    api.google.setPartnerProgram('UC-video-earner', true)

    clock.set(new Date(noonToday.getTime() + sixHours - 60_000))
    const cached = await listVideos(browser, channelId, { window: 'lifetime' })
    const callsWhileCached = api.google.analyticsRequests.length
    clock.set(new Date(noonToday.getTime() + sixHours + 60_000))
    const joined = await listVideos(browser, channelId, { window: 'lifetime' })

    expect(cached.body).toMatchObject({ revenue: { refusal: 'not_monetized' }, fromCache: true })
    expect(callsWhileCached).toBe(calls)
    expect(joined.body.revenue).toEqual({ currency: 'USD', reported: true })
    expect(revenueOf(joined.body)).toEqual([['video-1', 12.5]])
  })

  test.for(['lifetime', 'last28', 'first7'] as const)(
    'in %s, a channel Google answers no revenue row for gets its list with revenue reported false, its other numbers, and 0 revenue on each row',
    async (window, { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await earningCreator(api, [
        upload(1, '2026-09-01', 12.5, {
          rangeMetrics: [
            {
              startDate: '2026-09-10',
              endDate: '2026-10-07',
              metrics: { ...numbers(1), estimatedRevenue: 4.75 },
            },
          ],
          days: [{ day: '2026-09-01', engagedViews: 10, views: 20, estimatedRevenue: 1.5 }],
        }),
      ])
      api.google.setRevenueRows('UC-video-earner', false)

      const listed = await listVideos(browser, channelId, { window })

      expect(listed.status).toBe(200)
      expect(listed.body.revenue).toEqual({ currency: 'USD', reported: false })
      expect(
        listed.body.videos.map(({ id, engagedViews, estimatedRevenue }) => [
          id,
          engagedViews,
          estimatedRevenue,
        ]),
      ).toEqual([['video-1', 10, 0]])
    },
  )

  // In a window after publish, Google leaves each day with no revenue out of the daily revenue
  // rows, so a channel whose videos earned nothing answers none there; its videos' totals over the
  // same days answer a row of 0 each.
  test.for(['lifetime', 'first7'] as const)(
    'in %s, a monetized channel whose videos earned nothing gets its list with revenue reported true and 0 revenue on each row',
    async (window, { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const earnedNothing = (n: number, publishDay: string) =>
        upload(n, publishDay, 0, {
          rangeMetrics: [
            {
              startDate: '2026-09-01',
              endDate: '2026-09-08',
              metrics: { ...numbers(n), estimatedRevenue: 0 },
            },
          ],
          days: [{ day: publishDay, engagedViews: n * 10, views: n * 20, estimatedRevenue: 0 }],
        })
      const { browser, channelId } = await earningCreator(api, [
        earnedNothing(1, '2026-09-01'),
        earnedNothing(2, '2026-09-02'),
      ])

      const listed = await listVideos(browser, channelId, { window })

      expect(listed.body.revenue).toEqual({ currency: 'USD', reported: true })
      expect(revenueOf(listed.body)).toEqual([
        ['video-2', 0],
        ['video-1', 0],
      ])
    },
  )

  test("the list's revenue reported is the channel's over the window, not the listed page's: a Short's revenue row reports revenue for a list of videos only", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api, [
      upload(1, '2026-09-01', 0, {
        creatorContentType: 'shorts',
        rangeMetrics: [
          {
            startDate: '2026-09-10',
            endDate: '2026-10-07',
            metrics: { ...numbers(1), estimatedRevenue: 0.5 },
          },
        ],
      }),
      upload(2, '2026-09-02', 0),
    ])

    const listed = await listVideos(browser, channelId, { window: 'last28', format: 'video' })

    expect(revenueOf(listed.body)).toEqual([['video-2', 0]])
    expect(listed.body.revenue).toEqual({ currency: 'USD', reported: true })
  })
})

/** A video published on 2026-09-01, earning on two of its first days, and over its first 7 days. */
const earningVideo = upload(1, '2026-09-01', 0, {
  metrics: {
    ...numbers(1),
    estimatedRevenue: 12.5,
    estimatedAdRevenue: 9,
    estimatedRedPartnerRevenue: 1.5,
  },
  rangeMetrics: [
    {
      startDate: '2026-09-01',
      endDate: '2026-09-07',
      metrics: {
        ...numbers(1),
        estimatedRevenue: 2.5,
        estimatedAdRevenue: 2,
        estimatedRedPartnerRevenue: 0.25,
      },
    },
  ],
  days: [
    {
      day: '2026-09-01',
      engagedViews: 4,
      views: 5,
      estimatedRevenue: 1.5,
      estimatedAdRevenue: 1,
      estimatedRedPartnerRevenue: 0.25,
    },
    { day: '2026-09-03', engagedViews: 2, views: 3, estimatedRevenue: 1 },
  ],
})

const noRevenue = { estimatedRevenue: 0, estimatedAdRevenue: 0, estimatedRedPartnerRevenue: 0 }

describe('seam 1: revenue on the video detail', () => {
  test("with revenue consent, the lifetime detail carries the video's revenue and its two sources, and each day carries its own, zeros for a day with none", async ({
    web,
    clock,
  }) => {
    // Noon on 2026-09-06 in Pacific Time, so four days before today is 2026-09-02; the last
    // processed day set below is what puts the processed-through day at 2026-09-04.
    clock.set(new Date('2026-09-06T19:00:00Z'))
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api, [earningVideo])
    api.google.setLastProcessedDay('2026-09-04')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'lifetime' })

    expect(detail.status).toBe(200)
    expect(detail.body.revenue).toEqual({
      estimatedRevenue: 12.5,
      estimatedAdRevenue: 9,
      estimatedRedPartnerRevenue: 1.5,
      currency: 'USD',
    })
    expect(detail.body.days).toEqual([
      {
        day: '2026-09-01',
        engagedViews: 4,
        views: 5,
        estimatedMinutesWatched: 0,
        estimatedRevenue: 1.5,
        estimatedAdRevenue: 1,
        estimatedRedPartnerRevenue: 0.25,
      },
      { day: '2026-09-02', engagedViews: 0, views: 0, estimatedMinutesWatched: 0, ...noRevenue },
      {
        day: '2026-09-03',
        engagedViews: 2,
        views: 3,
        estimatedMinutesWatched: 0,
        estimatedRevenue: 1,
        estimatedAdRevenue: 0,
        estimatedRedPartnerRevenue: 0,
      },
      { day: '2026-09-04', engagedViews: 0, views: 0, estimatedMinutesWatched: 0, ...noRevenue },
    ])
    const queries = revenueQueriesOf(api).map((query) => [
      query.get('dimensions'),
      query.get('filters'),
      query.get('startDate'),
      query.get('endDate'),
      query.get('currency'),
    ])
    expect(queries).toEqual(
      expect.arrayContaining([
        [null, 'video==video-1', '2026-09-01', '2026-09-06', 'USD'],
        ['day', 'video==video-1', '2026-09-01', '2026-09-06', 'USD'],
        ['day', 'video==video-1', '2026-09-01', '2026-09-04', 'USD'],
      ]),
    )
  })

  test("in a calendar window, the detail carries the video's revenue over the window and each day of it carries its own, in the saved currency", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    // Published before the window opens, so the window keeps its own first day. Google has
    // processed up to 2026-10-05, so last7 runs from 2026-09-29 to that day.
    const last7 = { startDate: '2026-09-29', endDate: '2026-10-05' }
    const { browser, channelId } = await earningCreator(api, [
      upload(1, '2026-09-25', 99, {
        rangeMetrics: [
          {
            ...last7,
            metrics: {
              ...numbers(1),
              estimatedRevenue: 4.75,
              estimatedAdRevenue: 3,
              estimatedRedPartnerRevenue: 0.5,
            },
          },
        ],
        days: [
          { day: '2026-09-28', engagedViews: 9, views: 9, estimatedRevenue: 50 },
          {
            day: '2026-09-29',
            engagedViews: 4,
            views: 5,
            estimatedRevenue: 1.5,
            estimatedAdRevenue: 1,
            estimatedRedPartnerRevenue: 0.25,
          },
        ],
      }),
    ])
    await savePreferences(browser, { currency: 'EUR' })
    api.google.setLastProcessedDay('2026-10-05')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'last7' })

    expect(detail.status).toBe(200)
    expect(detail.body.revenue).toEqual({
      estimatedRevenue: 4.75,
      estimatedAdRevenue: 3,
      estimatedRedPartnerRevenue: 0.5,
      currency: 'EUR',
    })
    const zeroDay = { engagedViews: 0, views: 0, estimatedMinutesWatched: 0, ...noRevenue }
    expect(detail.body.days).toEqual([
      {
        day: '2026-09-29',
        engagedViews: 4,
        views: 5,
        estimatedMinutesWatched: 0,
        estimatedRevenue: 1.5,
        estimatedAdRevenue: 1,
        estimatedRedPartnerRevenue: 0.25,
      },
      { day: '2026-09-30', ...zeroDay },
      ...['01', '02', '03', '04', '05'].map((day) => ({ day: `2026-10-${day}`, ...zeroDay })),
    ])
    const queries = revenueQueriesOf(api).map((query) => [
      query.get('dimensions'),
      query.get('startDate'),
      query.get('endDate'),
      query.get('currency'),
    ])
    expect(queries).toEqual(
      expect.arrayContaining([
        [null, '2026-09-29', '2026-10-05', 'EUR'],
        ['day', '2026-09-29', '2026-10-05', 'EUR'],
        ['day', '2026-09-25', '2026-10-05', 'EUR'],
        [null, '2026-09-25', '2026-10-07', 'EUR'],
      ]),
    )
  })

  test('in a window after publish, the detail carries its revenue over the window and each day its revenue with its day after publish, in the saved currency', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api, [earningVideo])
    await savePreferences(browser, { currency: 'GBP' })
    api.google.setLastProcessedDay('2026-10-04')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'first7' })

    expect(detail.body.revenue).toEqual({
      estimatedRevenue: 2.5,
      estimatedAdRevenue: 2,
      estimatedRedPartnerRevenue: 0.25,
      currency: 'GBP',
    })
    expect(detail.body.days).toHaveLength(7)
    expect(detail.body.days.slice(0, 3)).toEqual([
      {
        day: '2026-09-01',
        dayAfterPublish: 1,
        engagedViews: 4,
        views: 5,
        estimatedMinutesWatched: 0,
        estimatedRevenue: 1.5,
        estimatedAdRevenue: 1,
        estimatedRedPartnerRevenue: 0.25,
      },
      {
        day: '2026-09-02',
        dayAfterPublish: 2,
        engagedViews: 0,
        views: 0,
        estimatedMinutesWatched: 0,
        ...noRevenue,
      },
      {
        day: '2026-09-03',
        dayAfterPublish: 3,
        engagedViews: 2,
        views: 3,
        estimatedMinutesWatched: 0,
        estimatedRevenue: 1,
        estimatedAdRevenue: 0,
        estimatedRedPartnerRevenue: 0,
      },
    ])
    expect(new Set(revenueQueriesOf(api).map((query) => query.get('currency')))).toEqual(
      new Set(['GBP']),
    )
  })

  test('without revenue consent, the detail says so in place of revenue, its days carry none, and it makes no revenue call', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [earningVideo])
    api.google.setLastProcessedDay('2026-09-04')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'lifetime' })

    expect(detail.status).toBe(200)
    expect(detail.body.revenue).toEqual({ refusal: 'consent_missing' })
    expect(detail.body.days[0]).not.toHaveProperty('estimatedRevenue')
    expect(revenueQueriesOf(api)).toEqual([])
  })

  test('a channel outside the YouTube Partner Program gets its other numbers and not_monetized for its revenue, after one revenue call', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api, [earningVideo])
    api.google.setPartnerProgram('UC-video-earner', false)
    api.google.setLastProcessedDay('2026-09-04')

    const detail = await videoDetail(browser, channelId, 'video-1', { window: 'lifetime' })

    expect(detail.status).toBe(200)
    expect(detail.body).toMatchObject({
      totals: { engagedViews: 10, views: 20 },
      revenue: { refusal: 'not_monetized' },
    })
    expect(detail.body.days[0]).toMatchObject({ engagedViews: 4, views: 5 })
    expect(detail.body.days[0]).not.toHaveProperty('estimatedRevenue')
    expect(revenueQueriesOf(api)).toHaveLength(1)
  })

  test('a video Google has processed no day of since publish carries no revenue, on the detail or its since publish rows, in a calendar, a first-N, a lifetime and a custom window, and makes no revenue call', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api, [upload(1, '2026-10-06', 3)])
    // Published the day after the last processed day: last7 and the custom range end before it,
    // first7 and lifetime run from it to today.
    api.google.setLastProcessedDay('2026-10-05')

    const details = []
    for (const query of [
      { window: 'last7' },
      { window: 'first7' },
      { window: 'lifetime' },
      { window: 'custom', from: '2026-09-01', to: '2026-10-05' },
    ]) {
      details.push(await videoDetail(browser, channelId, 'video-1', query))
    }

    const [first, ...others] = details
    for (const detail of details) {
      expect(detail.status).toBe(200)
      expect(detail.body).not.toHaveProperty('revenue')
      expect(detail.body.sincePublish).not.toHaveProperty('revenueCurrency')
      for (const row of detail.body.sincePublish.rows) {
        expect(row).not.toHaveProperty('estimatedRevenue')
      }
    }
    for (const detail of others) {
      expect(detail.body.sincePublish).toEqual(first?.body.sincePublish)
    }
    expect(revenueQueriesOf(api)).toEqual([])
  })

  test('a video with no publish day answers the same since publish rows, with no revenue, in a calendar, a first-N, a lifetime and a custom window, and makes no revenue call', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    // A private draft never published and never scheduled: Google may give it no publish time.
    const draft: FakeUpload = {
      videoId: 'video-1',
      title: 'Draft',
      privacyStatus: 'private',
      metrics: { ...numbers(1), estimatedRevenue: 3 },
    }
    const { browser, channelId } = await earningCreator(api, [draft])
    api.google.setLastProcessedDay('2026-10-04')

    const details = []
    for (const query of [
      { window: 'last28' },
      { window: 'first28' },
      { window: 'lifetime' },
      { window: 'custom', from: '2026-09-01', to: '2026-10-04' },
    ]) {
      details.push(await videoDetail(browser, channelId, 'video-1', query))
    }

    for (const detail of details) {
      expect(detail.status).toBe(200)
      expect(detail.body).not.toHaveProperty('revenue')
      expect(detail.body.sincePublish).toEqual(details[0]?.body.sincePublish)
      expect(detail.body.sincePublish).not.toHaveProperty('revenueCurrency')
      for (const row of detail.body.sincePublish.rows) {
        expect(row).not.toHaveProperty('estimatedRevenue')
      }
    }
    expect(revenueQueriesOf(api)).toEqual([])
  })

  test('a scheduled video carries no revenue and makes no revenue call, where a published video of the same channel does', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await earningCreator(api, [
      earningVideo,
      {
        videoId: 'video-9',
        title: 'Upload 9',
        scheduledFor: '2026-10-20T15:00:00Z',
      },
    ])

    const scheduled = await videoDetail(browser, channelId, 'video-9', { window: 'lifetime' })
    const callsForScheduled = revenueQueriesOf(api).length
    const published = await videoDetail(browser, channelId, 'video-1', { window: 'lifetime' })

    expect(scheduled.status).toBe(200)
    expect(scheduled.body).not.toHaveProperty('revenue')
    expect(callsForScheduled).toBe(0)
    expect(published.body.revenue).toMatchObject({ estimatedRevenue: 12.5 })
    expect(revenueQueriesOf(api).length).toBeGreaterThan(0)
  })
})
