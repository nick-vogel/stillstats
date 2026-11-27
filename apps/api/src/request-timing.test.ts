// Limits: these tests read from the fake Google server on this machine, so they show which reads a
// request made and how they were answered, never how long Google or main-box's Postgres takes. No
// test bounds a measured duration's size: a timing bound in CI would fail on a slow runner and pass
// on a fast one. The one exact split runs on a stubbed clock. The baseline (#1056) reads the real
// durations on production.
import { randomUUID } from 'node:crypto'
import { subscriptions, type WorkerDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import type { FakeUpload } from '@creator-analytics/fake-google'
import { describe, expect, vi } from 'vitest'
import { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'

// Emails no other test file signs in with, as video-list.test.ts explains.
const creator = { sub: '1051001', email: 'timed-reader@example.com', name: 'A Timed Reader' }

const youtubeChannelId = 'UC-timed-reader'
const videoId = 'timedvideo1'

// Noon on 2026-10-07 in Pacific Time.
const noonToday = new Date('2026-10-07T19:00:00Z')

const uploads: FakeUpload[] = [
  {
    videoId,
    title: 'A timed upload',
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
      stripeCustomerId: 'cus_request_timing',
      stripeSubscriptionId: 'sub_request_timing',
      status: 'active',
      purgeAfter: null,
      updatedAt: tx.now,
    }),
  )
}

interface TimingEntry {
  name: string
  description: string | undefined
  durationMs: number
}

/** The response's `Server-Timing` entries, in their order, as a user agent reads them. */
function serverTimingOf(response: Response): TimingEntry[] {
  const header = response.headers.get('server-timing')
  if (header === null) return []
  return header.split(',').map((entry) => {
    const [name = '', ...parameters] = entry.trim().split(';')
    const parameter = (key: string) =>
      parameters.find((part) => part.startsWith(`${key}=`))?.slice(key.length + 1)
    return {
      name,
      description: parameter('desc')?.replace(/^"|"$/g, ''),
      durationMs: Number(parameter('dur')),
    }
  })
}

interface HeaderRead {
  name: string
  cache: string
  googleMs: number
  databaseMs: number
}

/** Each read the header names, from its Google entry and its database entry. */
function headerReadsOf(entries: TimingEntry[]): HeaderRead[] {
  const reads: HeaderRead[] = []
  for (const entry of entries.filter(({ name }) => name.endsWith('-google'))) {
    const [name = '', cache = ''] = (entry.description ?? '').split(' ')
    const database = entries.find(
      ({ name: other }) => other === entry.name.replace(/-google$/, '-db'),
    )
    expect(database?.description).toBe(`${name} ${cache} database`)
    reads.push({ name, cache, googleMs: entry.durationMs, databaseMs: database?.durationMs ?? NaN })
  }
  return reads
}

interface LoggedRequest {
  method: string
  route: string
  status: number
  totalMs: number
  channelId?: string
  reads: { name: string; cache: 'hit' | 'miss'; googleMs: number; databaseMs: number }[]
}

/** Every request line the API logged, in order. */
function requestLinesOf(api: StartedApi): LoggedRequest[] {
  return api.logs
    .map((line) => JSON.parse(line) as { message: string; request?: LoggedRequest })
    .filter(({ message }) => message === 'API request')
    .map(({ request }) => request as LoggedRequest)
}

const isDuration = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

/**
 * Fetches the path and reads back its timing: the answer's status, its header's total and reads,
 * and the one request line it logged.
 */
async function timed(api: StartedApi, browser: Browser, path: string) {
  const before = requestLinesOf(api).length
  const response = await browser.fetch(path)
  const header = response.headers.get('server-timing')
  const entries = serverTimingOf(response)
  const lines = requestLinesOf(api).slice(before)
  expect(lines).toHaveLength(1)
  const line = lines[0] as LoggedRequest
  return {
    status: response.status,
    header,
    total: entries[0],
    headerReads: headerReadsOf(entries),
    line,
  }
}

/**
 * The header and the line agree: the total first, each duration a number at or above 0, and the
 * same reads with the same cache results in the same order.
 */
function expectOneBreakdown({ total, headerReads, line }: Awaited<ReturnType<typeof timed>>) {
  expect(total?.name).toBe('total')
  expect(isDuration(total?.durationMs)).toBe(true)
  expect(isDuration(line.totalMs)).toBe(true)
  for (const read of [...headerReads, ...line.reads]) {
    expect(isDuration(read.googleMs) && isDuration(read.databaseMs)).toBe(true)
  }
  expect(line.reads.map(({ name, cache }) => ({ name, cache }))).toEqual(
    headerReads.map(({ name, cache }) => ({ name, cache })),
  )
}

const namesOf = (reads: readonly { name: string }[]) => reads.map(({ name }) => name)

describe('seam 1: a budget screen read reports where its time went', () => {
  test('the video list answers its total and each read in Server-Timing, and logs one line with its route, status, total and the same reads', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    const read = await timed(api, browser, `/api/channels/${channelId}/videos?window=lifetime`)

    expect(read.status).toBe(200)
    expectOneBreakdown(read)
    expect(namesOf(read.headerReads)).toEqual(expect.arrayContaining(['uploads', 'videoMetrics']))
    expect(read.line).toMatchObject({
      method: 'GET',
      route: '/api/channels/:channelId/videos',
      status: 200,
      channelId,
    })
  })

  test("the channel summary reports its totals' and series' reads", async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    const read = await timed(api, browser, `/api/channels/${channelId}/summary?window=last28`)

    expect(read.status).toBe(200)
    expectOneBreakdown(read)
    expect(namesOf(read.line.reads)).toEqual(
      expect.arrayContaining(['channelTotals', 'channelDailySeries']),
    )
    expect(read.line).toMatchObject({ route: '/api/channels/:channelId/summary', status: 200 })
  })

  test("a video's detail reports its reads", async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    const read = await timed(
      api,
      browser,
      `/api/channels/${channelId}/videos/${videoId}?window=lifetime`,
    )

    expect(read.status).toBe(200)
    expectOneBreakdown(read)
    expect(read.line.reads.length).toBeGreaterThan(0)
    expect(read.line).toMatchObject({
      route: '/api/channels/:channelId/videos/:videoId',
      status: 200,
    })
  })

  test('the Audience reports each breakdown read', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    const read = await timed(api, browser, `/api/channels/${channelId}/audience?window=last28`)

    expect(read.status).toBe(200)
    expectOneBreakdown(read)
    expect(namesOf(read.line.reads)).toEqual(
      expect.arrayContaining(['channelCountries', 'channelAgeGroups', 'channelDevices']),
    )
    expect(read.line).toMatchObject({ route: '/api/channels/:channelId/audience', status: 200 })
  })

  test('the retention comparison reports its uploads read, which it makes on the gateway itself', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)

    const read = await timed(
      api,
      browser,
      `/api/channels/${channelId}/retention-curves?ids=${videoId}`,
    )

    expect(read.status).toBe(200)
    expectOneBreakdown(read)
    expect(namesOf(read.line.reads)).toContain('uploads')
    expect(read.line).toMatchObject({
      route: '/api/channels/:channelId/retention-curves',
      status: 200,
    })
  })
})

describe('seam 2: a cold read and a warm read differ in their cache result', () => {
  test('the same list twice reads from Google first, then from the cache with no Google time, in the header and the line', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const path = `/api/channels/${channelId}/videos?window=lifetime`

    const cold = await timed(api, browser, path)
    const warm = await timed(api, browser, path)

    expectOneBreakdown(cold)
    expectOneBreakdown(warm)
    expect(namesOf(warm.line.reads)).toEqual(namesOf(cold.line.reads))
    // The list's revenue read is refused before the cache, as the channel gave no revenue consent,
    // so it is a miss both times; every read Google answered is a hit the second time.
    const answered = ['uploads', 'lastProcessedDay', 'videoMetrics', 'videoContentTypes']
    for (const reads of [cold.headerReads, cold.line.reads]) {
      expect(reads.filter(({ name }) => answered.includes(name))).toEqual(
        answered.map((name) => expect.objectContaining({ name, cache: 'miss' })),
      )
    }
    for (const reads of [warm.headerReads, warm.line.reads]) {
      expect(reads.filter(({ name }) => answered.includes(name))).toEqual(
        answered.map((name) => expect.objectContaining({ name, cache: 'hit', googleMs: 0 })),
      )
    }
    // The split itself, not a size: a read Google answered spent time there, and every read spent
    // time in the database, as a round trip is never 0 at performance.now()'s resolution.
    for (const read of cold.line.reads.filter(({ name }) => answered.includes(name))) {
      expect({ name: read.name, google: read.googleMs > 0 }).toEqual({
        name: read.name,
        google: true,
      })
    }
    for (const read of [...cold.line.reads, ...warm.line.reads]) {
      expect({ name: read.name, database: read.databaseMs > 0 }).toEqual({
        name: read.name,
        database: true,
      })
    }
  })
})

describe("the split: a read's database time leaves out its Google time", () => {
  test('on a clock that moves only while Google answers, each read is all Google time and no database time, in the header and the line', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    // Each YouTube API call moves the stubbed clock by one step, and nothing else moves it, so the
    // request's whole time is its reads' Google time.
    const stepMs = 7
    let now = 0
    let calls = 0
    const stubbed = vi.spyOn(performance, 'now').mockImplementation(() => now)
    api.google.onYouTubeApiRequest(() => {
      calls += 1
      now += stepMs
    })
    const read = await timed(
      api,
      browser,
      `/api/channels/${channelId}/videos?window=lifetime`,
    ).finally(() => {
      api.google.onYouTubeApiRequest(null)
      stubbed.mockRestore()
    })

    expect(read.status).toBe(200)
    expect(calls).toBeGreaterThan(0)
    expect(read.line.totalMs).toBe(calls * stepMs)
    for (const reads of [read.headerReads, read.line.reads]) {
      expect(reads.reduce((sum, { googleMs }) => sum + googleMs, 0)).toBe(calls * stepMs)
      expect(reads.map(({ name, databaseMs }) => ({ name, databaseMs }))).toEqual(
        reads.map(({ name }) => ({ name, databaseMs: 0 })),
      )
    }
  })
})

describe('seam 3: the header carries no ID', () => {
  test("no budget screen's header holds the channel's ID, its YouTube ID, a video's ID or the user's ID, though the line holds the channel's", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await subscribe(worker, channelId)
    const userId = await userIdOf(web, creator.email)

    const reads = await Promise.all(
      [
        `/api/channels/${channelId}/summary?window=last28`,
        `/api/channels/${channelId}/videos?window=lifetime`,
        `/api/channels/${channelId}/videos/${videoId}?window=lifetime`,
        `/api/channels/${channelId}/audience?window=last28`,
        `/api/channels/${channelId}/retention-curves?ids=${videoId}`,
      ].map((path) => browser.fetch(path)),
    )

    for (const response of reads) {
      expect(response.status).toBe(200)
      const header = response.headers.get('server-timing') ?? ''
      expect(header).toMatch(/^total;dur=/)
      for (const id of [channelId, youtubeChannelId, videoId, userId]) {
        expect(header).not.toContain(id)
      }
    }
    expect(requestLinesOf(api).filter((line) => line.channelId === channelId)).toHaveLength(5)
  })
})

describe('seam 4: a refusal and an error answer are timed too', () => {
  test('a channel the user does not hold is refused not_connected, with the header and the line', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser } = await connectedCreator(api)

    const read = await timed(api, browser, `/api/channels/${randomUUID()}/videos?window=lifetime`)

    expect(read.status).toBe(404)
    expectOneBreakdown(read)
    expect(read.line).toMatchObject({ route: '/api/channels/:channelId/videos', status: 404 })
  })

  test('a read Google answers with an error gets google_failed, with the header and the line, its read a miss', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    api.google.failAnalytics(500)

    const read = await timed(api, browser, `/api/channels/${channelId}/videos?window=lifetime`)

    expect(read.status).toBe(502)
    expectOneBreakdown(read)
    expect(read.line.reads.length).toBeGreaterThan(0)
    expect(read.line.reads.at(-1)?.cache).toBe('miss')
    expect(read.line).toMatchObject({ route: '/api/channels/:channelId/videos', status: 502 })
  })

  test('a window the summary does not offer is refused invalid_window, with the header and the line', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    const read = await timed(api, browser, `/api/channels/${channelId}/summary?window=last9`)

    expect(read.status).toBe(400)
    expectOneBreakdown(read)
    expect(read.line).toMatchObject({
      route: '/api/channels/:channelId/summary',
      status: 400,
      reads: [],
    })
  })

  test('a signed-out request is refused 401, with the header and a line under the signed-in routes', async ({
    web,
  }) => {
    const api = await startApi(web)

    const read = await timed(
      api,
      new Browser(api.origin),
      `/api/channels/${randomUUID()}/videos?window=lifetime`,
    )

    expect(read.status).toBe(401)
    expectOneBreakdown(read)
    expect(read.line).toMatchObject({ method: 'GET', route: '/api/*', status: 401, reads: [] })
  })
})

describe('seam 5: only API requests are timed', () => {
  test("an API request is timed, and the web app's entry page and /health carry no header and log no line", async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = new Browser(api.origin)

    const [settings, ...others] = await Promise.all(
      ['/api/client-settings', '/app/', '/health'].map((path) => browser.fetch(path)),
    )

    expect(settings?.status).toBe(200)
    expect(settings?.headers.get('server-timing')).toMatch(/^total;dur=/)
    for (const response of others) {
      expect(response.status).toBe(200)
      expect(response.headers.get('server-timing')).toBeNull()
    }
    expect(requestLinesOf(api)).toEqual([
      expect.objectContaining({ route: '/api/client-settings', status: 200, reads: [] }),
    ])
  })
})
