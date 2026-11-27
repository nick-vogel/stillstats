// Limits: the recording transport stands where the SDK's HTTP transport would, so these tests read
// what would leave the process, never what GlitchTip makes of it. A trace reaching the live project
// is checked by hand when the baseline (#1056) sets the rate on production. The SDK is global per
// test worker and its client spans are set up at its first start, so this file starts it once, at
// a rate of 1.0, and traces-off.test.ts holds the API with no rate.
import { subscriptions, type WorkerDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import type { FakeUpload } from '@creator-analytics/fake-google'
import { initErrorTracking } from '@creator-analytics/reporter'
import {
  closeErrorTracking,
  flushErrorTracking,
  recordingTransport,
  sentTransactions,
} from '@creator-analytics/reporter/testing'
import { afterAll, beforeAll, describe, expect } from 'vitest'
import { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'

// Emails no other test file signs in with, as video-list.test.ts explains.
const creator = { sub: '1052001', email: 'traced-reader@example.com', name: 'A Traced Reader' }

const youtubeChannelId = 'UC-traced-reader-channel'
const videoId = 'tracedvide1'

// Noon on 2026-10-07 in Pacific Time.
const noonToday = new Date('2026-10-07T19:00:00Z')

const uploads: FakeUpload[] = [
  {
    videoId,
    title: 'A traced upload',
    publishedAt: '2026-09-01T15:00:00Z',
    duration: 'PT4M30S',
    metrics: {
      engagedViews: 10,
      views: 20,
      averageViewPercentage: 41,
      subscribersGained: 1,
      estimatedMinutesWatched: 30,
    },
  },
]

const { envelopes, transport } = recordingTransport()

beforeAll(() => {
  initErrorTracking({
    dsn: 'https://publickey@glitchtip.example.com/1',
    transport,
    tracesSampleRate: 1,
  })
})

afterAll(async () => {
  await closeErrorTracking()
})

async function connectedCreator(api: StartedApi) {
  const browser = await signIn(api, creator)
  api.google.pickChannel(youtubeChannelId)
  api.google.setChannel(youtubeChannelId, { createdAt: '2019-03-01T06:00:00Z', uploads })
  await connect(browser)
  const { channels } = await channelsOf(browser)
  const channelId = channels[0]?.id
  if (!channelId) throw new Error('The creator has no connected channel')
  return { browser, channelId }
}

/** Makes the channel Pro, as retention-curves.test.ts does. */
async function subscribe(worker: WorkerDatabase, channelId: string): Promise<void> {
  await worker.forChannel(channelId, (tx) =>
    tx.sql.insert(subscriptions).values({
      channelId,
      stripeCustomerId: 'cus_request_trace',
      stripeSubscriptionId: 'sub_request_trace',
      status: 'active',
      purgeAfter: null,
      updatedAt: tx.now,
    }),
  )
}

/** Fetches each path in turn, and answers the envelopes and the traces the requests sent. */
async function traced(browser: Browser, paths: readonly string[]) {
  await flushErrorTracking()
  const before = envelopes.length
  for (const path of paths) {
    const response = await browser.fetch(path)
    expect({ path, status: response.status }).toEqual({ path, status: 200 })
  }
  await flushErrorTracking()
  const sent = envelopes.slice(before)
  return { text: sent.join('\n'), traces: sentTransactions(sent) }
}

describe('with a rate of 1.0', () => {
  test('each budget screen read sends one trace, named by its route pattern, with no channel, video or user ID and no email', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)
    const userId = await userIdOf(web, creator.email)

    const { text, traces } = await traced(browser, [
      `/api/channels/${channelId}/summary?window=last28`,
      `/api/channels/${channelId}/videos?window=lifetime&format=short&sort=-views`,
      `/api/channels/${channelId}/videos/${videoId}?window=lifetime`,
      `/api/channels/${channelId}/audience?window=last28`,
      `/api/channels/${channelId}/retention-curves?ids=${videoId}`,
    ])

    expect(traces.map(({ transaction }) => transaction)).toEqual([
      'GET /api/channels/:channelId/summary',
      'GET /api/channels/:channelId/videos',
      'GET /api/channels/:channelId/videos/:videoId',
      'GET /api/channels/:channelId/audience',
      'GET /api/channels/:channelId/retention-curves',
    ])
    // Each read called fake Google, so a trace's spans held its addresses before the scrub.
    expect(traces.flatMap(({ spans }) => spans ?? []).length).toBeGreaterThan(0)
    for (const id of [channelId, youtubeChannelId, videoId, userId, creator.email]) {
      expect({ id, leaked: text.includes(id) }).toEqual({ id, leaked: false })
    }
    expect(api.reporter.reports).toEqual([])
  })

  test('a trace keeps the window, the names of the filters sent and never their values, and the cache result', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    const { traces } = await traced(browser, [
      `/api/channels/${channelId}/videos?window=last90&sort=-views&format=short&unknown=${channelId}`,
      `/api/channels/${channelId}/summary`,
    ])

    expect(traces.map(({ contexts }) => contexts?.trace?.data)).toEqual([
      expect.objectContaining({
        window: 'last90',
        filters: 'format,sort',
        cache: 'miss',
        'http.request.method': 'GET',
        'http.response.status_code': 200,
      }),
      expect.not.objectContaining({ window: expect.anything(), filters: expect.anything() }),
    ])
    expect(JSON.stringify(traces)).not.toContain('-views')
    expect(JSON.stringify(traces)).not.toContain('unknown')
  })

  test('a cold read then the same read warm differ in their cache result, miss then hit', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)
    // The retention comparison makes one read, the uploads, which the connect did not make.
    const path = `/api/channels/${channelId}/retention-curves?ids=${videoId}`

    const { traces } = await traced(browser, [path, path])

    expect(traces.map(({ contexts }) => contexts?.trace?.data?.cache)).toEqual(['miss', 'hit'])
  })

  test('a read that comes partly from the cache is mixed, and a read with no gateway read carries no cache result', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    // The connect read the channel's snippet, so the Audience's first read of it is a hit and its
    // breakdowns are misses.
    const { traces } = await traced(browser, [
      `/api/channels/${channelId}/audience?window=last28`,
      '/api/me',
    ])

    expect(
      traces.map(({ transaction, contexts }) => [transaction, contexts?.trace?.data?.cache]),
    ).toEqual([
      ['GET /api/channels/:channelId/audience', 'mixed'],
      ['GET /api/me', undefined],
    ])
  })

  test("a caller's unsampled sentry-trace header neither stops its request's trace nor joins it to the caller's trace", async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    const callersTraceId = '0123456789abcdef0123456789abcdef'
    await flushErrorTracking()
    const before = envelopes.length

    const response = await browser.fetch('/api/me', {
      headers: { 'sentry-trace': `${callersTraceId}-0123456789abcdef-0` },
    })
    await flushErrorTracking()

    expect(response.status).toBe(200)
    const traces = sentTransactions(envelopes.slice(before))
    expect(traces.map(({ transaction }) => transaction)).toEqual(['GET /api/me'])
    expect(traces[0]?.contexts?.trace?.trace_id).not.toBe(callersTraceId)
  })

  test("a request outside the API, the web app's page or /health, sends no trace", async ({
    web,
  }) => {
    const api = await startApi(web)

    const { traces } = await traced(new Browser(api.origin), ['/app/', '/health'])

    expect(traces).toEqual([])
  })
})
