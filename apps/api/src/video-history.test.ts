// Limits: the pure describe covers the history's arithmetic over rows the tests write. The API
// describe writes the history straight into its tables, as the worker's download stores it, and
// reads the rest from the fake Google server. Neither can prove a real report's numbers or the
// Reporting API's traffic source codes against Studio's; Nick's walk of a paid channel on
// production (#791) covers them.
import {
  addDays,
  reachTrafficSourceTypes,
  type VideoDetailAnswer,
  type VideoListAnswer,
  type VideoRow,
} from '@creator-analytics/api-types'
import { reachHistory, reachHistoryDays, type WorkerDatabase } from '@creator-analytics/database'
import { test as apiTest, subscribeOwner } from '@creator-analytics/database/testing'
import type { FakeUpload } from '@creator-analytics/fake-google'
import { describe, expect, test } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'
import {
  historyPartialOf,
  newestHistoryAverageOf,
  reachOfSources,
  trafficSourceTypeOf,
  type UploadReach,
  videoReachOf,
} from './video-history.ts'

/** Every day from `from` for `count` days. */
function daysFrom(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(from, index))
}

type Candidate = Pick<VideoRow, 'privacy' | 'scheduled' | 'format'>

/**
 * An upload published on `publishDay` at noon UTC, public, not scheduled and a video unless set,
 * with `impressions` at `ctr` from YouTube search.
 */
function uploadOf(
  id: string,
  publishDay: string,
  impressions: number,
  ctr: number,
  candidate: Partial<Candidate> = {},
): UploadReach {
  return {
    video: {
      id,
      publishedAt: `${publishDay}T12:00:00.000Z`,
      privacy: 'public',
      scheduled: false,
      format: 'video',
      ...candidate,
    },
    publishDay,
    sources: [{ type: 'YT_SEARCH', impressions, clicks: impressions * ctr }],
  }
}

// The history holds every day from 2026-09-01 to 2026-10-04.
const held = new Set(daysFrom('2026-09-01', 34))

describe('the history arithmetic', () => {
  test("a video's impressions are its sources' added, and its CTR their clicks over them, not a mean of the CTRs", () => {
    expect(
      reachOfSources([
        { type: 'YT_SEARCH', impressions: 100, clicks: 10 },
        { type: 'RELATED_VIDEO', impressions: 300, clicks: 6 },
      ]),
    ).toEqual({ impressions: 400, ctr: 0.04 })
    expect(reachOfSources([])).toEqual({ impressions: 0, ctr: null })
  })

  test("the Reporting API's traffic source codes map onto the Analytics API's types, and a code with no counterpart is its own", () => {
    expect(
      [0, 1, 3, 4, 5, 7, 8, 9, 11, 14, 17, 19, 20, 24, 25, 26, 27, 28, 30].map(trafficSourceTypeOf),
    ).toEqual([
      'NO_LINK_OTHER',
      'ADVERTISING',
      'SUBSCRIBER',
      'YT_CHANNEL',
      'YT_SEARCH',
      'RELATED_VIDEO',
      'YT_OTHER_PAGE',
      'EXT_URL',
      'ANNOTATION',
      'PLAYLIST',
      'NOTIFICATION',
      'CAMPAIGN_CARD',
      'END_SCREEN',
      'SHORTS',
      'PRODUCT_PAGE',
      'HASHTAGS',
      'SOUND_PAGE',
      'LIVE_REDIRECT',
      'VIDEO_REMIXES',
    ])
    expect([18, 23, 29, 31, 32, 99].map(trafficSourceTypeOf)).toEqual([
      'REPORTING_18',
      'REPORTING_23',
      'REPORTING_29',
      'REPORTING_31',
      'REPORTING_32',
      'REPORTING_99',
    ])
  })

  test('the traffic sources the video list filters by are exactly the types the stored codes map onto', () => {
    const mapped = [0, 1, 3, 4, 5, 7, 8, 9, 11, 14, 17, 19, 20, 24, 25, 26, 27, 28, 30]
    // The codes with no Analytics API type that the web app names.
    const named = [18, 23, 29, 31, 32]

    expect([...mapped, ...named].map(trafficSourceTypeOf).toSorted()).toEqual(
      [...reachTrafficSourceTypes].toSorted(),
    )
  })

  test('counted days that start before the history start are partial, the held days of them all; days from the start are not', () => {
    const history = new Set(daysFrom('2026-10-03', 2))

    expect(
      historyPartialOf({ startDate: '2026-10-01', endDate: '2026-10-04' }, '2026-10-04', history),
    ).toEqual({ days: 2, of: 4 })
    expect(
      historyPartialOf({ startDate: '2026-10-03', endDate: '2026-10-04' }, '2026-10-04', history),
    ).toBeUndefined()
    expect(
      historyPartialOf({ startDate: '2026-10-05', endDate: '2026-10-04' }, '2026-10-04', history),
    ).toBeUndefined()
  })

  test('a day missing inside the history makes counted days from the history start partial, the held days of them all; days after its newest day alone do not', () => {
    const gapped = new Set([...held].filter((day) => day !== '2026-09-20'))
    const history = {
      firstDay: '2026-09-01',
      newestDay: '2026-10-04',
      sourcesByVideo: new Map(),
    }
    const counted = { startDate: '2026-09-15', endDate: '2026-10-12' }

    expect(videoReachOf({ ...history, held: gapped }, 'v', counted).historyPartial).toEqual({
      days: 19,
      of: 28,
    })
    expect(videoReachOf({ ...history, held }, 'v', counted).historyPartial).toBeUndefined()
  })

  test('counted days that all fall after the history newest day are partial, none of them held', () => {
    const history = new Set(daysFrom('2026-10-01', 4))

    expect(
      historyPartialOf({ startDate: '2026-10-05', endDate: '2026-10-11' }, '2026-10-04', history),
    ).toEqual({ days: 0, of: 7 })
    expect(
      historyPartialOf({ startDate: '2026-10-05', endDate: '2026-10-05' }, '2026-10-04', history),
    ).toEqual({ days: 0, of: 1 })
  })
})

describe("the newest uploads' average impressions and CTR", () => {
  test('averages the impressions over the count, and weights the CTR by the impressions, not a mean of the CTRs', () => {
    const average = newestHistoryAverageOf(
      [uploadOf('a', '2026-09-20', 100, 0.1), uploadOf('b', '2026-09-21', 300, 0.02)],
      'all',
      'first7',
      held,
    )

    // (100 x 0.1 + 300 x 0.02) / 400 = 0.04, where a mean of the CTRs is 0.06.
    expect(average).toMatchObject({ format: 'all', count: 2, impressions: 200 })
    expect(average?.ctr).toBeCloseTo(0.04, 10)
  })

  test('leaves out an upload whose window the history holds all but one day of, though Google has processed it', () => {
    const gap = new Set([...held].filter((day) => day !== '2026-09-23'))

    const average = newestHistoryAverageOf(
      [
        uploadOf('a', '2026-09-10', 100, 0.1),
        uploadOf('b', '2026-09-11', 100, 0.1),
        uploadOf('gap', '2026-09-20', 900, 0.1),
      ],
      'all',
      'first7',
      gap,
    )

    expect(average).toMatchObject({ count: 2, impressions: 100 })
  })

  test('leaves out an upload younger than the window, whose window the history cannot hold yet', () => {
    const average = newestHistoryAverageOf(
      [
        uploadOf('a', '2026-09-10', 100, 0.1),
        uploadOf('b', '2026-09-11', 100, 0.1),
        uploadOf('young', '2026-10-01', 900, 0.1),
      ],
      'all',
      'first7',
      held,
    )

    expect(average).toMatchObject({ count: 2, impressions: 100 })
  })

  test('counts only the format asked for: a Short among videos counts under all, not under video', () => {
    const uploads = [
      uploadOf('a', '2026-09-10', 100, 0.1),
      uploadOf('b', '2026-09-11', 100, 0.1),
      uploadOf('short', '2026-09-12', 400, 0.1, { format: 'short' }),
    ]

    expect(newestHistoryAverageOf(uploads, 'video', 'first7', held)).toMatchObject({
      format: 'video',
      count: 2,
      impressions: 100,
    })
    expect(newestHistoryAverageOf(uploads, 'all', 'first7', held)).toMatchObject({
      format: 'all',
      count: 3,
      impressions: 200,
    })
  })

  test('3 qualifying uploads give a count of 3, and 12 the newest 10', () => {
    const three = daysFrom('2026-09-01', 3).map((day, index) =>
      uploadOf(`v${index}`, day, 100, 0.1),
    )
    // The two oldest have 10,000 impressions each, which the newest 10 leave out.
    const twelve = daysFrom('2026-09-01', 12).map((day, index) =>
      uploadOf(`v${index}`, day, index < 2 ? 10_000 : 100, 0.1),
    )

    expect(newestHistoryAverageOf(three, 'all', 'first7', held)?.count).toBe(3)
    expect(newestHistoryAverageOf(twelve, 'all', 'first7', held)).toMatchObject({
      count: 10,
      impressions: 100,
    })
  })

  test('1 qualifying upload gives no average', () => {
    expect(
      newestHistoryAverageOf([uploadOf('a', '2026-09-10', 100, 0.1)], 'all', 'first7', held),
    ).toBeUndefined()
  })

  test('never counts a private, unlisted or scheduled upload', () => {
    const average = newestHistoryAverageOf(
      [
        uploadOf('a', '2026-09-10', 100, 0.1),
        uploadOf('b', '2026-09-11', 100, 0.1),
        uploadOf('private', '2026-09-12', 900, 0.1, { privacy: 'private' }),
        uploadOf('unlisted', '2026-09-13', 900, 0.1, { privacy: 'unlisted' }),
        uploadOf('scheduled', '2026-09-14', 900, 0.1, { scheduled: true }),
      ],
      'all',
      'first7',
      held,
    )

    expect(average).toMatchObject({ count: 2, impressions: 100 })
  })

  test('averages each traffic source type over the whole count, an upload with none of a type counting 0 for it', () => {
    const a = uploadOf('a', '2026-09-10', 100, 0.1)
    const b: UploadReach = {
      ...uploadOf('b', '2026-09-11', 300, 0.02),
      sources: [
        { type: 'YT_SEARCH', impressions: 300, clicks: 6 },
        { type: 'RELATED_VIDEO', impressions: 50, clicks: 5 },
      ],
    }

    const average = newestHistoryAverageOf([a, b], 'all', 'first7', held)

    expect(average?.trafficSources).toEqual([
      { type: 'YT_SEARCH', impressions: 200, ctr: 0.04 },
      { type: 'RELATED_VIDEO', impressions: 25, ctr: 0.1 },
    ])
  })
})

// An email no other test file signs in with, as channel-summary.test.ts explains.
const creator = { sub: '785001', email: 'video-history-reader@example.com', name: 'A Reader' }

// Noon on 2026-10-07 in Pacific Time, so today is 2026-10-07, and Google has processed 2026-10-04.
const noonToday = new Date('2026-10-07T19:00:00Z')

/** A public video published at 08:00 Pacific Time on the day, with its engaged views on that day. */
function videoOn(
  videoId: string,
  day: string,
  engagedViews: number,
  extra: Partial<FakeUpload> = {},
) {
  return {
    videoId,
    title: videoId,
    publishedAt: `${day}T15:00:00Z`,
    creatorContentType: 'videoOnDemand',
    metrics: { engagedViews, views: engagedViews, averageViewPercentage: 50, subscribersGained: 0 },
    days: [{ day, engagedViews, views: engagedViews }],
    ...extra,
  } satisfies FakeUpload
}

// v-old is published before the history start, 2026-09-10; v1 and v2 after it, with every day of
// their first 7 held; v3's first 7 miss 2026-09-22, which the history does not hold.
const channelUploads: FakeUpload[] = [
  videoOn('v-old', '2026-09-01', 10),
  videoOn('v1', '2026-09-12', 10),
  videoOn('v2', '2026-09-15', 20, {
    trafficSources: { YT_SEARCH: { engagedViews: 50, views: 60 } },
  }),
  videoOn('v3', '2026-09-20', 30),
]

async function connectedCreator(api: StartedApi) {
  const browser = await signIn(api, creator)
  api.google.pickChannel('UC-video-history')
  api.google.setChannel('UC-video-history', {
    createdAt: '2019-03-01T06:00:00Z',
    uploads: channelUploads,
  })
  api.google.setLastProcessedDay('2026-10-04')
  await connect(browser)
  const { channels } = await channelsOf(browser)
  const channelId = channels[0]?.id
  if (!channelId) throw new Error('The creator has no connected channel')
  return { browser, channelId }
}

/**
 * The history the worker would store, every day from 2026-09-10 to 2026-10-04 but 2026-09-22, with
 * code 5 (YouTube search) and 7 (suggested videos). v1's row on 2026-09-19 is its 8th day.
 */
async function storeHistory(worker: WorkerDatabase, channelId: string): Promise<void> {
  const search = 5
  const suggested = 7
  await worker.forChannel(channelId, async (tx) => {
    await tx.sql.insert(reachHistory).values(
      (
        [
          ['v-old', '2026-09-10', search, 100, 0.1],
          ['v1', '2026-09-12', search, 100, 0.1],
          ['v1', '2026-09-13', suggested, 100, 0.3],
          ['v1', '2026-09-19', search, 800, 0.02],
          ['v2', '2026-09-16', search, 300, 0.02],
          ['v2', '2026-09-17', suggested, 100, 0.04],
          ['v3', '2026-09-20', search, 200, 0.05],
        ] as const
      ).map(([videoId, day, trafficSourceType, impressions, ctr]) => ({
        channelId,
        videoId,
        day,
        trafficSourceType,
        impressions,
        ctr,
      })),
    )
    await tx.sql.insert(reachHistoryDays).values(
      daysFrom('2026-09-10', 25)
        .filter((day) => day !== '2026-09-22')
        .map((day) => ({ channelId, day, reportCreatedAt: tx.now })),
    )
  })
}

async function listOf(browser: Browser, channelId: string, query: Record<string, string>) {
  const search = new URLSearchParams(query)
  const response = await browser.fetch(`/api/channels/${channelId}/videos?${search}`)
  return (await response.json()) as VideoListAnswer
}

async function detailOf(
  browser: Browser,
  channelId: string,
  videoId: string,
  query: Record<string, string>,
) {
  const search = new URLSearchParams(query)
  const response = await browser.fetch(`/api/channels/${channelId}/videos/${videoId}?${search}`)
  return (await response.json()) as VideoDetailAnswer
}

function reachOfRows({ videos }: VideoListAnswer) {
  return Object.fromEntries(
    videos.map(({ id, impressions, ctr, historyPartial }) => [
      id,
      { impressions, ctr, historyPartial },
    ]),
  )
}

describe("seam 1: a paid channel's video list and video screen carry its impressions and CTR history", () => {
  apiTest(
    "a paid channel's list in the last 28 days carries each row's impressions and CTR over its days, the history's two ends, and the held days of a row whose days start before the history",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      await storeHistory(worker, channelId)

      const list = await listOf(browser, channelId, { window: 'last28' })

      // The 28 days run from 2026-09-07 to 2026-10-04: v-old's start before the history, which
      // holds 24 of them; v1's, v2's and v3's run from their publish days, after the history
      // start, and each misses 2026-09-22, which the history does not hold.
      expect(list.history).toEqual({ firstDay: '2026-09-10', newestDay: '2026-10-04' })
      expect(reachOfRows(list)).toEqual({
        'v-old': { impressions: 100, ctr: 0.1, historyPartial: { days: 24, of: 28 } },
        // (100 x 0.1 + 100 x 0.3 + 800 x 0.02) / 1,000
        v1: { impressions: 1000, ctr: 0.056, historyPartial: { days: 22, of: 23 } },
        v2: { impressions: 400, ctr: 0.025, historyPartial: { days: 19, of: 20 } },
        v3: { impressions: 200, ctr: 0.05, historyPartial: { days: 14, of: 15 } },
      })
      expect(list).not.toHaveProperty('newestHistoryAverage')
    },
  )

  apiTest(
    'in the first 7 days, each row counts its own 7 days, and the newest average counts the uploads whose whole 7 the history holds, beside an unchanged engaged views average',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      await storeHistory(worker, channelId)

      const list = await listOf(browser, channelId, { window: 'first7' })

      // v1's 8th day, 800 impressions, is outside its first 7.
      expect(reachOfRows(list).v1).toEqual({
        impressions: 200,
        ctr: 0.2,
        historyPartial: undefined,
      })
      expect(reachOfRows(list)['v-old']?.historyPartial).toEqual({ days: 0, of: 7 })
      // v1 and v2 only: v-old's first 7 are before the history, and v3's miss a day.
      expect(list.newestHistoryAverage).toMatchObject({ format: 'all', count: 2, impressions: 300 })
      // (200 x 0.2 + 400 x 0.025) / 600
      expect(list.newestHistoryAverage?.ctr).toBeCloseTo(50 / 600, 10)
      expect(list.newestAverage).toEqual({ format: 'all', count: 4, engagedViews: 17.5 })
    },
  )

  apiTest(
    "the video screen's traffic sources carry impressions and CTR by the Analytics API's type, a type with impressions and no views after the rest, and in the first 7 days the newest average per type",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      await storeHistory(worker, channelId)

      const detail = await detailOf(browser, channelId, 'v2', { window: 'first7' })

      expect(detail.trafficSources).toEqual([
        { type: 'YT_SEARCH', engagedViews: 50, views: 60, impressions: 300, ctr: 0.02 },
        { type: 'RELATED_VIDEO', engagedViews: 0, views: 0, impressions: 100, ctr: 0.04 },
      ])
      expect(detail.history).toMatchObject({
        impressions: 400,
        ctr: 0.025,
        firstDay: '2026-09-10',
        newestDay: '2026-10-04',
      })
      expect(detail.history).not.toHaveProperty('partial')
      const average = detail.history?.newestAverage
      expect(average).toMatchObject({ format: 'video', count: 2, impressions: 300 })
      // v1's 100 at 10% and v2's 300 at 2% from search, v1's 100 at 30% and v2's 100 at 4%
      // suggested.
      expect(average?.trafficSources).toEqual([
        { type: 'YT_SEARCH', impressions: 200, ctr: 0.04 },
        { type: 'RELATED_VIDEO', impressions: 100, ctr: 0.17 },
      ])
    },
  )

  apiTest(
    'the video screen of a video published before the history start carries the held days of its range, and no newest average in a calendar window',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      await storeHistory(worker, channelId)

      const detail = await detailOf(browser, channelId, 'v-old', { window: 'last28' })

      expect(detail.history).toEqual({
        impressions: 100,
        ctr: 0.1,
        firstDay: '2026-09-10',
        newestDay: '2026-10-04',
        partial: { days: 24, of: 28 },
      })
    },
  )

  apiTest(
    "a free channel's list and video screen carry no impressions, no history and no newest average, whatever is stored",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await storeHistory(worker, channelId)

      const list = await listOf(browser, channelId, { window: 'first7' })
      const detail = await detailOf(browser, channelId, 'v2', { window: 'first7' })

      expect(list).not.toHaveProperty('history')
      expect(list).not.toHaveProperty('newestHistoryAverage')
      expect(list.videos.filter((video) => 'impressions' in video || 'ctr' in video)).toEqual([])
      expect(detail).not.toHaveProperty('history')
      expect(detail.trafficSources).toEqual([{ type: 'YT_SEARCH', engagedViews: 50, views: 60 }])
    },
  )
})

describe("seam 1: an ended channel's video list and video screen read its history until its purge date", () => {
  const purgeAfter = new Date('2026-11-06T01:00:00Z')

  apiTest(
    "an ended channel's list and video screen carry its history, as its summary does",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId, { status: 'canceled', purgeAfter })
      await storeHistory(worker, channelId)

      const list = await listOf(browser, channelId, { window: 'first7' })
      const detail = await detailOf(browser, channelId, 'v2', { window: 'first7' })

      expect(list.history).toEqual({ firstDay: '2026-09-10', newestDay: '2026-10-04' })
      expect(reachOfRows(list).v1?.impressions).toBe(200)
      expect(detail.history).toMatchObject({ firstDay: '2026-09-10', newestDay: '2026-10-04' })
    },
  )

  apiTest(
    "past its purge date, an ended channel's list and video screen carry no history, though its rows are still stored",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId, { status: 'canceled', purgeAfter })
      await storeHistory(worker, channelId)
      clock.set(new Date(purgeAfter.getTime() + 1000))

      const list = await listOf(browser, channelId, { window: 'first7' })
      const detail = await detailOf(browser, channelId, 'v2', { window: 'first7' })

      expect(list).not.toHaveProperty('history')
      expect(list.videos.filter((video) => 'impressions' in video || 'ctr' in video)).toEqual([])
      expect(detail).not.toHaveProperty('history')
    },
  )
})

async function answerOf(browser: Browser, channelId: string, query: Record<string, string>) {
  const search = new URLSearchParams(query)
  const response = await browser.fetch(`/api/channels/${channelId}/videos?${search}`)
  return { status: response.status, body: (await response.json()) as unknown }
}

const historySorts = ['ctr', '-ctr', 'impressions', '-impressions']

describe('seam 1: the video list sorts by impressions and CTR only for a channel whose history is readable', () => {
  apiTest(
    "a free channel's CTR and impressions sorts are refused with sort_without_history, in either direction, and spend no Analytics query",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await storeHistory(worker, channelId)
      const callsBefore = api.google.analyticsRequests.length

      const refused = []
      for (const sort of historySorts) refused.push(await answerOf(browser, channelId, { sort }))

      expect(refused).toEqual(
        Array.from({ length: 4 }, () => ({ status: 403, body: { error: 'sort_without_history' } })),
      )
      expect(api.google.analyticsRequests.slice(callsBefore)).toEqual([])
    },
  )

  apiTest(
    "past its purge date, an ended channel's CTR and impressions sorts are refused with sort_without_history",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      const purgeAfter = new Date('2026-11-06T01:00:00Z')
      await subscribeOwner(web, worker, channelId, { status: 'canceled', purgeAfter })
      await storeHistory(worker, channelId)
      clock.set(new Date(purgeAfter.getTime() + 1000))

      const refused = []
      for (const sort of historySorts) refused.push(await answerOf(browser, channelId, { sort }))

      expect(refused).toEqual(
        Array.from({ length: 4 }, () => ({ status: 403, body: { error: 'sort_without_history' } })),
      )
    },
  )
})

/**
 * Stores each row, from YouTube search (code 5) unless it names another code, and holds every day
 * from `firstDay` to 2026-10-04 but `missing`, so a test sets `historyPartial` only where it wants
 * it.
 */
async function storeReach(
  worker: WorkerDatabase,
  channelId: string,
  rows: readonly (readonly [
    videoId: string,
    day: string,
    impressions: number,
    ctr: number,
    code?: number,
  ])[],
  { firstDay = '2026-09-01', missing = [] }: { firstDay?: string; missing?: string[] } = {},
): Promise<void> {
  await worker.forChannel(channelId, async (tx) => {
    if (rows.length > 0) {
      await tx.sql.insert(reachHistory).values(
        rows.map(([videoId, day, impressions, ctr, code = 5]) => ({
          channelId,
          videoId,
          day,
          trafficSourceType: code,
          impressions,
          ctr,
        })),
      )
    }
    const days: string[] = []
    for (let day = firstDay; day <= '2026-10-04'; day = addDays(day, 1)) {
      if (!missing.includes(day)) days.push(day)
    }
    await tx.sql
      .insert(reachHistoryDays)
      .values(days.map((day) => ({ channelId, day, reportCreatedAt: tx.now })))
  })
}

/** The ids of every page of the list in the sort, two videos a page. */
async function idsAcrossPages(
  browser: Browser,
  channelId: string,
  query: Record<string, string>,
): Promise<string[]> {
  const first = await listOf(browser, channelId, { ...query, pageSize: '2', page: '1' })
  const second = await listOf(browser, channelId, { ...query, pageSize: '2', page: '2' })
  return [...first.videos, ...second.videos].map(({ id }) => id)
}

// Over the last 28 days, with every day held: impressions run v-old 100, v3 200, v2 300, v1 400,
// and CTR runs v1 5%, v-old 10%, v3 15%, v2 20%.
const distinctReach = [
  ['v-old', '2026-09-20', 100, 0.1],
  ['v1', '2026-09-20', 400, 0.05],
  ['v2', '2026-09-20', 300, 0.2],
  ['v3', '2026-09-21', 200, 0.15],
] as const

async function historySortOrders(browser: Browser, channelId: string) {
  const orders: Record<string, string[]> = {}
  for (const sort of historySorts) {
    orders[sort] = await idsAcrossPages(browser, channelId, { window: 'last28', sort })
  }
  return orders
}

const distinctOrders = {
  impressions: ['v-old', 'v3', 'v2', 'v1'],
  '-impressions': ['v1', 'v2', 'v3', 'v-old'],
  ctr: ['v1', 'v-old', 'v3', 'v2'],
  '-ctr': ['v2', 'v3', 'v-old', 'v1'],
}

describe('seam 1: the video list sorted by impressions or CTR', () => {
  apiTest(
    "a paid channel's list sorted by impressions or CTR, in either direction, runs in that order across pages",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      await storeReach(worker, channelId, distinctReach)

      expect(await historySortOrders(browser, channelId)).toEqual(distinctOrders)
    },
  )

  apiTest(
    "an ended channel's list before its purge date sorts by impressions or CTR, in either direction",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId, {
        status: 'canceled',
        purgeAfter: new Date('2026-11-06T01:00:00Z'),
      })
      await storeReach(worker, channelId, distinctReach)

      expect(await historySortOrders(browser, channelId)).toEqual(distinctOrders)
    },
  )

  apiTest(
    'a video whose counted days the history does not hold whole follows every complete one, in either direction',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      // In the first 7 days the history, from 2026-09-10, holds none of v-old's (0 impressions)
      // and misses 2026-09-25 of v3's, which has the most; v1's and v2's are held whole.
      await storeReach(
        worker,
        channelId,
        [
          ['v1', '2026-09-12', 100, 0.1],
          ['v2', '2026-09-15', 300, 0.1],
          ['v3', '2026-09-20', 900, 0.1],
        ],
        { firstDay: '2026-09-10', missing: ['2026-09-25'] },
      )

      const ascending = await idsAcrossPages(browser, channelId, {
        window: 'first7',
        sort: 'impressions',
      })
      const descending = await idsAcrossPages(browser, channelId, {
        window: 'first7',
        sort: '-impressions',
      })

      expect(ascending).toEqual(['v1', 'v2', 'v-old', 'v3'])
      expect(descending).toEqual(['v2', 'v1', 'v3', 'v-old'])
    },
  )

  apiTest(
    'videos that tie on impressions and CTR run newest first, in either direction',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      await storeReach(worker, channelId, [
        ['v-old', '2026-09-20', 100, 0.1],
        ['v1', '2026-09-20', 100, 0.1],
        ['v2', '2026-09-20', 100, 0.1],
        ['v3', '2026-09-21', 100, 0.1],
      ])

      expect(await historySortOrders(browser, channelId)).toEqual(
        Object.fromEntries(historySorts.map((sort) => [sort, ['v3', 'v2', 'v1', 'v-old']])),
      )
    },
  )

  apiTest(
    'a video with no impressions has no CTR, and follows the others in a CTR sort, in either direction',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      await storeReach(worker, channelId, [
        ['v-old', '2026-09-20', 100, 0.1],
        ['v1', '2026-09-20', 400, 0.05],
        ['v2', '2026-09-20', 300, 0.2],
      ])

      const orders = await historySortOrders(browser, channelId)

      expect(orders.ctr).toEqual(['v1', 'v-old', 'v2', 'v3'])
      expect(orders['-ctr']).toEqual(['v2', 'v-old', 'v1', 'v3'])
    },
  )

  apiTest(
    'in a window after publish, the sort counts each video its own days',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      // v1's 8th day, 2026-09-19, is outside its first 7, and gives it the most in the last 28.
      await storeReach(worker, channelId, [
        ['v-old', '2026-09-03', 100, 0.1],
        ['v1', '2026-09-12', 200, 0.1],
        ['v1', '2026-09-19', 5000, 0.5],
        ['v2', '2026-09-15', 300, 0.3],
        ['v3', '2026-09-20', 400, 0.2],
      ])

      const first7 = await idsAcrossPages(browser, channelId, {
        window: 'first7',
        sort: '-impressions',
      })
      const first7Ctr = await idsAcrossPages(browser, channelId, { window: 'first7', sort: '-ctr' })
      const last28 = await idsAcrossPages(browser, channelId, {
        window: 'last28',
        sort: '-impressions',
      })

      expect(first7).toEqual(['v3', 'v2', 'v1', 'v-old'])
      expect(first7Ctr).toEqual(['v2', 'v3', 'v1', 'v-old'])
      // v-old's 2026-09-03 is before the last 28 days, so it has none of them.
      expect(last28).toEqual(['v1', 'v3', 'v2', 'v-old'])
    },
  )
})

const historyFilters = [{ trafficSource: 'YT_SEARCH' }, { minImpressions: '100' }]

describe('seam 1: the video list filters by traffic source and minimum impressions only for a channel whose history is readable', () => {
  apiTest(
    "a free channel's traffic source and minimum impressions are refused with filter_without_history, and spend no Analytics query",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await storeHistory(worker, channelId)
      const callsBefore = api.google.analyticsRequests.length

      const refused = []
      for (const filter of historyFilters) refused.push(await answerOf(browser, channelId, filter))

      expect(refused).toEqual(
        Array.from({ length: 2 }, () => ({
          status: 403,
          body: { error: 'filter_without_history' },
        })),
      )
      expect(api.google.analyticsRequests.slice(callsBefore)).toEqual([])
    },
  )

  apiTest(
    "past its purge date, an ended channel's traffic source and minimum impressions are refused with filter_without_history",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      const purgeAfter = new Date('2026-11-06T01:00:00Z')
      await subscribeOwner(web, worker, channelId, { status: 'canceled', purgeAfter })
      await storeHistory(worker, channelId)
      clock.set(new Date(purgeAfter.getTime() + 1000))

      const refused = []
      for (const filter of historyFilters) refused.push(await answerOf(browser, channelId, filter))

      expect(refused).toEqual(
        Array.from({ length: 2 }, () => ({
          status: 403,
          body: { error: 'filter_without_history' },
        })),
      )
    },
  )
  apiTest(
    'an unknown traffic source, a minimum that is not a whole number from 1, and either sent twice, are refused with their own codes',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      await storeHistory(worker, channelId)

      const answers = []
      for (const search of [
        'trafficSource=NEW_SOURCE',
        'trafficSource=YT_SEARCH&trafficSource=YT_SEARCH',
        'minImpressions=0',
        'minImpressions=-1',
        'minImpressions=1.5',
        'minImpressions=abc',
        'minImpressions=100&minImpressions=100',
      ]) {
        const response = await browser.fetch(`/api/channels/${channelId}/videos?${search}`)
        answers.push({ status: response.status, body: await response.json() })
      }

      const refusal = (error: string) => ({ status: 400, body: { error } })
      expect(answers).toEqual([
        refusal('invalid_traffic_source'),
        refusal('invalid_traffic_source'),
        ...Array.from({ length: 5 }, () => refusal('invalid_min_impressions')),
      ])
    },
  )
})

// From YouTube search (5) and suggested videos (7), on days inside each video's first 7 and the last
// 28. All sources: v-old 1,000 at 46%, v1 500 at 24.4%, v2 300 at 20%, v3 400 at 15%. Search
// alone: v-old 100 at 10%, v1 400 at 30%, v2 none, v3 200 at 20%.
const searchAndSuggested = [
  ['v-old', '2026-09-07', 100, 0.1, 5],
  ['v-old', '2026-09-07', 900, 0.5, 7],
  ['v1', '2026-09-14', 400, 0.3, 5],
  ['v1', '2026-09-14', 100, 0.02, 7],
  ['v2', '2026-09-16', 300, 0.2, 7],
  ['v3', '2026-09-20', 200, 0.2, 5],
  ['v3', '2026-09-21', 200, 0.1, 7],
] as const

/** Each row without its impressions and CTR. */
function otherNumbersOf({ videos }: VideoListAnswer) {
  return videos.map(({ impressions: _impressions, ctr: _ctr, ...rest }) => rest)
}

describe('seam 1: the video list counts one traffic source in impressions and CTR', () => {
  apiTest(
    "with a traffic source, each row's impressions and CTR are that source's alone, a video with none of it has 0 and no CTR, and its other numbers and held days are unchanged",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      await storeReach(worker, channelId, searchAndSuggested, { missing: ['2026-09-25'] })

      const allSources = await listOf(browser, channelId, { window: 'last28' })
      const search = await listOf(browser, channelId, {
        window: 'last28',
        trafficSource: 'YT_SEARCH',
      })

      expect(reachOfRows(search)).toEqual({
        'v-old': { impressions: 100, ctr: 0.1, historyPartial: { days: 27, of: 28 } },
        v1: { impressions: 400, ctr: 0.3, historyPartial: { days: 22, of: 23 } },
        v2: { impressions: 0, ctr: null, historyPartial: { days: 19, of: 20 } },
        v3: { impressions: 200, ctr: 0.2, historyPartial: { days: 14, of: 15 } },
      })
      expect(otherNumbersOf(search)).toEqual(otherNumbersOf(allSources))
      expect(reachOfRows(allSources).v1?.impressions).toBe(500)
    },
  )

  apiTest(
    'the CTR sort follows the traffic source, an order that differs from every source together',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      await storeReach(worker, channelId, searchAndSuggested)

      const allSources = await idsAcrossPages(browser, channelId, {
        window: 'last28',
        sort: '-ctr',
      })
      const search = await idsAcrossPages(browser, channelId, {
        window: 'last28',
        sort: '-ctr',
        trafficSource: 'YT_SEARCH',
      })

      expect(allSources).toEqual(['v-old', 'v1', 'v2', 'v3'])
      // v2 has no search impressions, so no CTR, and follows the others.
      expect(search).toEqual(['v1', 'v3', 'v-old', 'v2'])
    },
  )

  apiTest(
    "in the first 7 days, the newest uploads' average impressions and CTR still count every source",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      await storeReach(worker, channelId, searchAndSuggested)

      const search = await listOf(browser, channelId, {
        window: 'first7',
        trafficSource: 'YT_SEARCH',
      })

      // Every source of the four: 2,200 impressions over 4, at (460 + 122 + 60 + 60) / 2,200.
      expect(search.newestHistoryAverage).toMatchObject({ count: 4, impressions: 550 })
      expect(search.newestHistoryAverage?.ctr).toBeCloseTo(702 / 2200, 10)
      expect(reachOfRows(search).v1?.impressions).toBe(400)
    },
  )
})

describe('seam 1: the video list hides videos under a minimum of impressions before the sort and paging', () => {
  apiTest(
    'videos under the minimum leave the list before paging, so the page count counts the others, and a video exactly at it stays',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      await storeReach(worker, channelId, distinctReach)

      const list = await listOf(browser, channelId, {
        window: 'last28',
        sort: 'ctr',
        minImpressions: '300',
        pageSize: '2',
      })

      // v-old's 100 and v3's 200 are under it; v2 has exactly 300.
      expect(list.pageCount).toBe(1)
      expect(list.videos.map(({ id }) => id)).toEqual(['v1', 'v2'])
    },
  )

  apiTest(
    "with a traffic source, the minimum counts that source's impressions",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      await storeReach(worker, channelId, searchAndSuggested)

      const allSources = await listOf(browser, channelId, {
        window: 'last28',
        minImpressions: '300',
      })
      const search = await listOf(browser, channelId, {
        window: 'last28',
        minImpressions: '300',
        trafficSource: 'YT_SEARCH',
      })

      expect(allSources.videos.map(({ id }) => id)).toEqual(['v3', 'v2', 'v1', 'v-old'])
      // v-old has 1,000 impressions from every source and 100 from search.
      expect(search.videos.map(({ id }) => id)).toEqual(['v1'])
      expect(search.pageCount).toBe(1)
    },
  )

  apiTest(
    'the publish day top still names a video the minimum hides',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)
      await storeReach(worker, channelId, distinctReach)

      const list = await listOf(browser, channelId, { window: 'first7', minImpressions: '250' })

      // In their first 7 days, only v2 has 250 impressions or more.
      expect(list.videos.map(({ id }) => id)).toEqual(['v2'])
      expect(list.publishDayTop?.map(({ id }) => id)).toEqual(['v3', 'v2', 'v1', 'v-old'])
    },
  )

  apiTest(
    'a paid channel whose history holds no day yet hides no video for the minimum',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api)
      await subscribeOwner(web, worker, channelId)

      const list = await listOf(browser, channelId, { window: 'last28', minImpressions: '100' })

      expect(list).not.toHaveProperty('history')
      expect(list.videos.map(({ id }) => id)).toEqual(['v3', 'v2', 'v1', 'v-old'])
    },
  )
})
