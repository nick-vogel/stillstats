// Limits: the history here is written straight into its tables, as the worker's download stores
// it, and the rest of the summary is read from the fake Google server. These tests cannot prove a
// real report's numbers; Nick's walk of a paid channel on production (#791) covers them.
import type { ChannelSummaryAnswer } from '@creator-analytics/api-types'
import {
  proEnds,
  reachHistory,
  reachHistoryDays,
  subscriptions,
  type WorkerDatabase,
} from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import type { FakeChannel } from '@creator-analytics/fake-google'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'

// An email no other test file signs in with, as channel-summary.test.ts explains.
const creator = { sub: '305983', email: 'history-reader@example.com', name: 'A History Reader' }

// Noon on 2026-10-07 in Pacific Time, so today is 2026-10-07.
const noonToday = new Date('2026-10-07T19:00:00Z')

// Google answers a video's content type only when it has views.
const metrics = { engagedViews: 10, views: 10, averageViewPercentage: 50, subscribersGained: 0 }

const channel: FakeChannel = {
  createdAt: '2019-03-01T06:00:00Z',
  uploads: [
    {
      videoId: 'v-video',
      title: 'A video',
      publishedAt: '2026-01-01T12:00:00Z',
      creatorContentType: 'videoOnDemand',
      metrics,
    },
    {
      videoId: 'v-short',
      title: 'A short',
      publishedAt: '2026-01-02T12:00:00Z',
      creatorContentType: 'shorts',
      metrics,
    },
  ],
  totals: { engagedViews: 1200, views: 3400, estimatedMinutesWatched: 4500 },
}

async function connectedCreator(api: StartedApi) {
  const browser = await signIn(api, creator)
  api.google.pickChannel('UC-history-reader')
  api.google.setChannel('UC-history-reader', channel)
  api.google.setLastProcessedDay('2026-10-04')
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
  await worker.forChannel(channelId, async (tx) => {
    await tx.sql.insert(subscriptions).values({
      channelId,
      stripeCustomerId: 'cus_history',
      stripeSubscriptionId: 'sub_history',
      status,
      updatedAt: tx.now,
    })
    // The channel's own purge date, 30 days after it stopped being Pro.
    if (purgeAfter) {
      const endedAt = new Date(purgeAfter.getTime() - 30 * 24 * 60 * 60 * 1000)
      await tx.sql.insert(proEnds).values({ channelId, endedAt, purgeAfter })
    }
  })
}

/**
 * The history the worker would store: 2026-10-02 with the video's 100 impressions at 10% and the
 * short's 300 at 2%, 2026-10-03 held with no impression, and 2026-10-04 with the video's 100 at 5%.
 */
async function storeHistory(worker: WorkerDatabase, channelId: string): Promise<void> {
  await worker.forChannel(channelId, async (tx) => {
    const row = { channelId, trafficSourceType: 5 }
    await tx.sql.insert(reachHistory).values([
      { ...row, videoId: 'v-video', day: '2026-10-02', impressions: 100, ctr: 0.1 },
      { ...row, videoId: 'v-short', day: '2026-10-02', impressions: 300, ctr: 0.02 },
      { ...row, videoId: 'v-video', day: '2026-10-04', impressions: 100, ctr: 0.05 },
    ])
    await tx.sql.insert(reachHistoryDays).values(
      ['2026-10-02', '2026-10-03', '2026-10-04'].map((day) => ({
        channelId,
        day,
        reportCreatedAt: tx.now,
      })),
    )
  })
}

async function readSummary(browser: Browser, channelId: string, query: Record<string, string>) {
  const search = new URLSearchParams({
    window: 'custom',
    from: '2026-10-01',
    to: '2026-10-04',
    ...query,
  })
  const response = await browser.fetch(`/api/channels/${channelId}/summary?${search}`)
  return { status: response.status, body: (await response.json()) as ChannelSummaryAnswer }
}

function historyDaysOf({ daily }: ChannelSummaryAnswer) {
  return daily.map(({ day, impressions, ctr }) => ({ day, impressions, ctr }))
}

describe('seam 1: the channel summary of a paid channel carries its impressions and CTR history', () => {
  test("a paid channel's summary answers the range's impressions, the channel CTR, the history's first and newest day, and each held day's numbers", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)
    await storeHistory(worker, channelId)

    const summary = await readSummary(browser, channelId, {})

    expect(summary.status).toBe(200)
    // (100 x 0.1 + 300 x 0.02 + 100 x 0.05) / 500
    expect(summary.body.history).toEqual({
      impressions: 500,
      ctr: 0.042,
      firstDay: '2026-10-02',
      newestDay: '2026-10-04',
    })
    expect(historyDaysOf(summary.body)).toEqual([
      { day: '2026-10-01', impressions: undefined, ctr: undefined },
      { day: '2026-10-02', impressions: 400, ctr: 0.04 },
      { day: '2026-10-03', impressions: 0, ctr: null },
      { day: '2026-10-04', impressions: 100, ctr: 0.05 },
    ])
  })

  test("one format's summary counts only the history of that format's videos", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)
    await storeHistory(worker, channelId)

    const shorts = await readSummary(browser, channelId, { format: 'short' })

    expect(shorts.body.history).toMatchObject({ impressions: 300, ctr: 0.02 })
    expect(historyDaysOf(shorts.body).map(({ impressions }) => impressions)).toEqual([
      undefined,
      300,
      0,
      0,
    ])
  })

  test("a free channel's summary carries no history and no day's history numbers, whatever is stored", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await storeHistory(worker, channelId)

    const summary = await readSummary(browser, channelId, {})

    expect(summary.status).toBe(200)
    expect(summary.body.history).toBeUndefined()
    expect(summary.body.daily.filter((day) => 'impressions' in day || 'ctr' in day)).toEqual([])
  })
})

describe('seam 1: an ended channel still reads its history until its purge date', () => {
  // An hour past midnight UTC, so its day is the UTC day, not Pacific Time's 2026-11-05.
  const purgeAfter = new Date('2026-11-06T01:00:00Z')

  test("an ended channel's summary answers its history and the UTC day of its purge date", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId, { status: 'canceled', purgeAfter })
    await storeHistory(worker, channelId)

    const summary = await readSummary(browser, channelId, {})

    expect(summary.status).toBe(200)
    expect(summary.body.history).toEqual({
      impressions: 500,
      ctr: 0.042,
      firstDay: '2026-10-02',
      newestDay: '2026-10-04',
      purgeDate: '2026-11-06',
    })
    expect(historyDaysOf(summary.body).map(({ impressions }) => impressions)).toEqual([
      undefined,
      400,
      0,
      100,
    ])
  })

  test('past its purge date, an ended channel reads no history, though its rows are still stored', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId, { status: 'canceled', purgeAfter })
    await storeHistory(worker, channelId)
    clock.set(new Date(purgeAfter.getTime() + 1000))

    const summary = await readSummary(browser, channelId, {})

    expect(summary.status).toBe(200)
    expect(summary.body.history).toBeUndefined()
    expect(summary.body.daily.filter((day) => 'impressions' in day || 'ctr' in day)).toEqual([])
  })

  test("a paid channel's history carries no purge date", async ({ web, worker, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)
    await storeHistory(worker, channelId)

    const summary = await readSummary(browser, channelId, {})

    expect(summary.body.history).not.toHaveProperty('purgeDate')
  })
})
