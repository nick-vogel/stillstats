// Limits: these tests write the curves straight into their two tables, as the worker's refresh
// stores them (apps/worker/src/retention-curves.ts), and read the uploads from the fake Google
// server. They cannot prove a real curve's shape against Studio's; the refresh's own tests cover
// what it stores.
import type { RetentionCurvesAnswer, VideoListAnswer } from '@creator-analytics/api-types'
import {
  retentionCurveReads,
  retentionCurves,
  subscriptions,
  type WorkerDatabase,
} from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import type { FakeUpload } from '@creator-analytics/fake-google'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'

// Emails no other test file signs in with, as video-detail.test.ts explains.
const creator = { sub: '951001', email: 'curve-reader@example.com', name: 'A Curve Reader' }
const otherCreator = {
  sub: '951002',
  email: 'other-curve-reader@example.com',
  name: 'Another Curve Reader',
}

// Noon on 2026-10-07 in Pacific Time.
const noonToday = new Date('2026-10-07T19:00:00Z')

/** A public video published at 08:00 Pacific Time on the day, 4 minutes 30 long. */
function videoOn(videoId: string, day: string): FakeUpload {
  return {
    videoId,
    title: `Title of ${videoId}`,
    publishedAt: `${day}T15:00:00Z`,
    duration: 'PT4M30S',
  }
}

// Six published uploads and one scheduled, which has no curve to read.
const channelUploads: FakeUpload[] = [
  videoOn('v1', '2026-09-01'),
  videoOn('v2', '2026-09-08'),
  videoOn('v3', '2026-09-15'),
  videoOn('v4', '2026-09-22'),
  videoOn('v5', '2026-09-29'),
  videoOn('v6', '2026-10-01'),
  { videoId: 'v-scheduled', title: 'Scheduled', scheduledFor: '2026-10-20T15:00:00Z' },
]

async function connectedCreator(api: StartedApi) {
  const browser = await signIn(api, creator)
  api.google.pickChannel('UC-retention-curves')
  api.google.setChannel('UC-retention-curves', {
    createdAt: '2019-03-01T06:00:00Z',
    uploads: channelUploads,
  })
  await connect(browser)
  const { channels } = await channelsOf(browser)
  const channelId = channels[0]?.id
  if (!channelId) throw new Error('The creator has no connected channel')
  return { browser, channelId }
}

async function subscribe(
  worker: WorkerDatabase,
  channelId: string,
  { status = 'active', purgeAfter = null }: { status?: string; purgeAfter?: Date | null } = {},
): Promise<void> {
  await worker.forChannel(channelId, (tx) =>
    tx.sql.insert(subscriptions).values({
      channelId,
      stripeCustomerId: 'cus_retention_curves',
      stripeSubscriptionId: 'sub_retention_curves',
      status,
      purgeAfter,
      updatedAt: tx.now,
    }),
  )
}

const readOfV1 = new Date('2026-10-06T09:00:05Z')
const readOfV2 = new Date('2026-10-07T09:00:07Z')
const readOfV3 = new Date('2026-10-05T09:00:03Z')

/**
 * The curves the refresh would store: v1's and v2's, out of order to show the read orders them,
 * and v3 read with no curve. v4, v5 and v6 are not read yet.
 */
async function storeCurves(worker: WorkerDatabase, channelId: string): Promise<void> {
  await worker.forChannel(channelId, async (tx) => {
    await tx.sql.insert(retentionCurves).values(
      (
        [
          ['v1', 1, 0.2, readOfV1],
          ['v1', 0.01, 1.05, readOfV1],
          ['v1', 0.5, 0.45, readOfV1],
          ['v2', 0.5, 0.6, readOfV2],
          ['v2', 0.02, 0.9, readOfV2],
        ] as const
      ).map(([videoId, elapsedVideoTimeRatio, audienceWatchRatio, readAt]) => ({
        channelId,
        videoId,
        elapsedVideoTimeRatio,
        audienceWatchRatio,
        readAt,
      })),
    )
    await tx.sql.insert(retentionCurveReads).values([
      { channelId, videoId: 'v1', readAt: readOfV1 },
      { channelId, videoId: 'v2', readAt: readOfV2 },
      { channelId, videoId: 'v3', readAt: readOfV3 },
    ])
  })
}

async function curvesOf(
  browser: Browser,
  channelId: string,
  query: Record<string, string> | [string, string][] = {},
) {
  const search = new URLSearchParams(query)
  const response = await browser.fetch(`/api/channels/${channelId}/retention-curves?${search}`)
  return { status: response.status, body: (await response.json()) as RetentionCurvesAnswer }
}

const video = (id: string, day: string) => ({
  id,
  title: `Title of ${id}`,
  durationSeconds: 270,
  publishedAt: new Date(`${day}T15:00:00Z`).toISOString(),
})

describe("seam 2: a Pro channel's stored retention curves", () => {
  test('answers each listed video with its curve and its read date, in the order the ids list them, each point its two numbers alone, earliest first', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)
    await storeCurves(worker, channelId)

    const read = await curvesOf(browser, channelId, { ids: 'v2,v1' })

    expect(read.status).toBe(200)
    expect(read.body.curves).toStrictEqual([
      {
        video: video('v2', '2026-09-08'),
        readAt: readOfV2.toISOString(),
        points: [
          { elapsedVideoTimeRatio: 0.02, audienceWatchRatio: 0.9 },
          { elapsedVideoTimeRatio: 0.5, audienceWatchRatio: 0.6 },
        ],
      },
      {
        video: video('v1', '2026-09-01'),
        readAt: readOfV1.toISOString(),
        points: [
          { elapsedVideoTimeRatio: 0.01, audienceWatchRatio: 1.05 },
          { elapsedVideoTimeRatio: 0.5, audienceWatchRatio: 0.45 },
          { elapsedVideoTimeRatio: 1, audienceWatchRatio: 0.2 },
        ],
      },
    ])
  })

  test('answers a video read with no curve with its read date and no point', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)
    await storeCurves(worker, channelId)

    const read = await curvesOf(browser, channelId, { ids: 'v3' })

    expect(read.body.curves).toStrictEqual([
      { video: video('v3', '2026-09-15'), readAt: readOfV3.toISOString(), points: [] },
    ])
  })

  test('answers a video the refresh has not read yet with no read date, and counts the published uploads never read, a scheduled one aside', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)
    await storeCurves(worker, channelId)

    const read = await curvesOf(browser, channelId, { ids: 'v6' })

    expect(read.body).toStrictEqual({
      curves: [{ video: video('v6', '2026-10-01'), readAt: null, points: [] }],
      unread: 3,
    })
  })

  test('with no ids, answers no curve and the count of uploads never read, which is 0 once every one is', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)

    expect((await curvesOf(browser, channelId)).body).toStrictEqual({ curves: [], unread: 6 })

    await worker.forChannel(channelId, (tx) =>
      tx.sql.insert(retentionCurveReads).values(
        ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map((videoId) => ({
          channelId,
          videoId,
          readAt: tx.now,
        })),
      ),
    )

    expect((await curvesOf(browser, channelId)).body).toStrictEqual({ curves: [], unread: 0 })
  })

  test('answers 5 ids, and a repeated id once, and spends no Analytics query', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)
    await storeCurves(worker, channelId)

    const five = await curvesOf(browser, channelId, { ids: 'v1,v2,v3,v4,v5' })
    const repeated = await curvesOf(browser, channelId, { ids: 'v1,v1' })

    expect(five.status).toBe(200)
    expect(five.body.curves.map(({ video }) => video.id)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5'])
    expect(repeated.body.curves.map(({ video }) => video.id)).toEqual(['v1'])
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('refuses a sixth id, duplicates counted, an empty or malformed list, and ids sent twice, with invalid_ids before any read', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)
    const before = api.google.dataApiRequests.length

    const refused = []
    for (const query of [
      { ids: 'v1,v2,v3,v4,v5,v6' },
      { ids: 'v1,v1,v1,v1,v1,v1' },
      { ids: '' },
      { ids: 'v1,' },
      { ids: 'v1;country==US' },
      [
        ['ids', 'v1'],
        ['ids', 'v2'],
      ] as [string, string][],
    ]) {
      refused.push(await curvesOf(browser, channelId, query))
    }

    expect(refused).toEqual(
      Array.from({ length: 6 }, () => ({ status: 400, body: { error: 'invalid_ids' } })),
    )
    expect(api.google.dataApiRequests).toHaveLength(before)
  })

  test("refuses a video the channel doesn't hold with video_not_found", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)
    await storeCurves(worker, channelId)

    const read = await curvesOf(browser, channelId, { ids: 'v1,elsewhere' })

    expect(read).toEqual({ status: 404, body: { refusal: 'video_not_found' } })
  })
})

describe('seam 2: a channel whose history is not readable gets no curve', () => {
  const purgeAfter = new Date('2026-11-06T01:00:00Z')

  test('a free channel is refused 403 sort_without_history, the refusal Pro sorts use, with no Google request, whatever is stored', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await storeCurves(worker, channelId)
    const before = api.google.dataApiRequests.length

    const refused = [
      await curvesOf(browser, channelId, { ids: 'v1' }),
      await curvesOf(browser, channelId),
    ]

    expect(refused).toEqual(
      Array.from({ length: 2 }, () => ({ status: 403, body: { error: 'sort_without_history' } })),
    )
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('an ended channel reads its curves until its purge date, and is refused past it', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId, { status: 'canceled', purgeAfter })
    await storeCurves(worker, channelId)

    const ended = await curvesOf(browser, channelId, { ids: 'v1' })
    clock.set(new Date(purgeAfter.getTime() + 1000))
    const purged = await curvesOf(browser, channelId, { ids: 'v1' })

    expect(ended.status).toBe(200)
    expect(ended.body.curves[0]?.points).toHaveLength(3)
    expect(purged).toEqual({ status: 403, body: { error: 'sort_without_history' } })
  })

  test("an ended channel's answer has no unread count, since the daily refresh no longer reads it", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId, { status: 'canceled', purgeAfter })
    await storeCurves(worker, channelId)

    const ended = await curvesOf(browser, channelId, { ids: 'v4' })

    expect(ended.status).toBe(200)
    expect(ended.body.unread).toBeNull()
    expect(ended.body.curves.map(({ readAt }) => readAt)).toEqual([null])
  })

  test("another user's channel, and a malformed channel id, answer not_connected", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)
    await storeCurves(worker, channelId)
    const other = await signIn(api, otherCreator)

    expect(await curvesOf(other, channelId, { ids: 'v1' })).toEqual({
      status: 404,
      body: { refusal: 'not_connected' },
    })
    expect(await curvesOf(other, 'not-a-uuid', { ids: 'v1' })).toEqual({
      status: 404,
      body: { refusal: 'not_connected' },
    })
  })
})

async function listOf(browser: Browser, channelId: string, query: Record<string, string>) {
  const search = new URLSearchParams(query)
  const response = await browser.fetch(`/api/channels/${channelId}/videos?${search}`)
  return { status: response.status, body: (await response.json()) as VideoListAnswer }
}

// creator-analytics#1044: the retention comparison's picker offers only the videos its chart can
// draw, so the video list filters to the videos with a stored curve that has points.
describe('seam 1: the video list lists only the videos with a stored retention curve', () => {
  test("a Pro channel's list holds only the videos with curve points, before the sort and paging, and another user's curve of the same video id adds none", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)
    await storeCurves(worker, channelId)
    const other = await signIn(api, otherCreator)
    api.google.pickChannel('UC-other-curves')
    api.google.setChannel('UC-other-curves', {
      createdAt: '2019-03-01T06:00:00Z',
      uploads: channelUploads,
    })
    await connect(other)
    const otherChannelId = (await channelsOf(other)).channels[0]?.id
    if (!otherChannelId) throw new Error('The other creator has no connected channel')
    await worker.forChannel(otherChannelId, async (tx) => {
      await tx.sql.insert(retentionCurves).values({
        channelId: otherChannelId,
        videoId: 'v4',
        elapsedVideoTimeRatio: 0.5,
        audienceWatchRatio: 0.5,
        readAt: readOfV1,
      })
      await tx.sql
        .insert(retentionCurveReads)
        .values({ channelId: otherChannelId, videoId: 'v4', readAt: readOfV1 })
    })
    const drawable = { window: 'lifetime', withRetentionCurve: 'true', pageSize: '1' }

    const first = await listOf(browser, channelId, drawable)
    const second = await listOf(browser, channelId, { ...drawable, page: '2' })
    const unfiltered = await listOf(browser, channelId, { window: 'lifetime' })

    expect([first.status, second.status]).toEqual([200, 200])
    expect([...first.body.videos, ...second.body.videos].map(({ id }) => id)).toEqual(['v2', 'v1'])
    expect(first.body.pageCount).toBe(2)
    expect(unfiltered.body.videos.map(({ id }) => id)).toEqual(['v6', 'v5', 'v4', 'v3', 'v2', 'v1'])
  })

  test('a channel whose history is not readable is refused 403 filter_without_history, free or ended past its purge date', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await storeCurves(worker, channelId)
    const drawable = { window: 'lifetime', withRetentionCurve: 'true' }

    const free = await listOf(browser, channelId, drawable)
    const purgeAfter = new Date('2026-11-06T01:00:00Z')
    await subscribe(worker, channelId, { status: 'canceled', purgeAfter })
    const ended = await listOf(browser, channelId, drawable)
    clock.set(new Date(purgeAfter.getTime() + 1000))
    const purged = await listOf(browser, channelId, drawable)

    expect(free).toEqual({ status: 403, body: { error: 'filter_without_history' } })
    expect(ended.body.videos.map(({ id }) => id)).toEqual(['v2', 'v1'])
    expect(purged).toEqual({ status: 403, body: { error: 'filter_without_history' } })
  })

  test('a value other than true or false, or the filter sent twice, is refused with invalid_query', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)

    const answers = []
    for (const search of [
      'withRetentionCurve=yes',
      'withRetentionCurve=true&withRetentionCurve=true',
    ]) {
      const response = await browser.fetch(`/api/channels/${channelId}/videos?${search}`)
      answers.push({ status: response.status, body: await response.json() })
    }

    expect(answers).toEqual(
      Array.from({ length: 2 }, () => ({ status: 400, body: { error: 'invalid_query' } })),
    )
  })
})
