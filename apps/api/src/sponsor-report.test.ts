// Limits: these tests read from the fake Google server, so they cannot prove Google's real
// numbers, that Google answers the nine sponsor report metrics together in one query for a real
// video (its channel reports page lists them as supported together for a video report, read
// 2026-11-20), or how late its last processed day runs. The impressions and CTR history is written
// by the tests straight into its tables, as the worker's download stores it, so they cannot prove a
// real report's numbers against Studio's. Nick opening a sponsor report of one of his own videos
// on staging, on a free channel and on a Pro one, covers those.
import {
  addDays,
  type EntitlementsAnswer,
  type SponsorChoiceAnswer,
  type SponsorReportAnswer,
  sponsorFigures,
  sponsorReportFigures,
  sponsorRevenueFigures,
} from '@creator-analytics/api-types'
import {
  memberships,
  reachHistory,
  reachHistoryDays,
  type WebDatabase,
  type WorkerDatabase,
} from '@creator-analytics/database'
import { subscribeOwner, test } from '@creator-analytics/database/testing'
import type { FakeUpload, VideoNumbers } from '@creator-analytics/fake-google'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { channelsOf, connect, giveRevenueConsent, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'

// Emails no other test file signs in with. Test files run in parallel against one database, and
// two files that sign in the same emails in a different order deadlock on the unique email index.
const creator = { sub: '306956', email: 'sponsor-reporter@example.com', name: 'A Sponsor Reporter' }
const otherCreator = {
  sub: '406956',
  email: 'other-sponsor-reporter@example.com',
  name: 'Another Sponsor Reporter',
}
const channelMember = {
  sub: '506957',
  email: 'sponsor-report-member@example.com',
  name: 'A Sponsor Report Member',
}

const createdAt = '2019-03-01T06:00:00Z'

// Noon on 2026-10-07 in Pacific Time, so today is 2026-10-07.
const noonToday = new Date('2026-10-07T19:00:00Z')

/** The nine figures, each naming the range they belong to. */
function figuresOf(n: number) {
  return {
    views: n + 1,
    engagedViews: n,
    estimatedMinutesWatched: n + 3,
    averageViewDuration: n + 4,
    averageViewPercentage: n + 0.5,
    likes: n + 5,
    comments: n + 6,
    shares: n + 7,
    subscribersGained: n + 2,
  } satisfies VideoNumbers
}

const zeros = Object.fromEntries(sponsorFigures.map((figure) => [figure, 0]))

/** An upload published on 2026-09-01 in Pacific Time. */
function upload(overrides: Partial<FakeUpload> = {}): FakeUpload {
  return {
    videoId: 'video-1',
    title: 'Upload 1',
    publishedAt: '2026-09-01T15:00:00Z',
    ...overrides,
  }
}

/** The video holds these numbers over these exact ranges. */
function rangeMetricsOf(ranges: [startDate: string, endDate: string, n: number][]) {
  return ranges.map(([startDate, endDate, n]) => ({ startDate, endDate, metrics: figuresOf(n) }))
}

/** Signs the creator in and connects their channel, which holds these uploads. */
async function connectedCreator(api: StartedApi, channelUploads: FakeUpload[]) {
  const browser = await signIn(api, creator)
  api.google.pickChannel('UC-sponsored')
  api.google.setChannel('UC-sponsored', { createdAt, uploads: channelUploads })
  await connect(browser)
  const { channels } = await channelsOf(browser)
  const channelId = channels[0]?.id
  if (!channelId) throw new Error('The creator has no connected channel')
  return { browser, channelId }
}

async function sponsorReport(
  browser: Browser,
  channelId: string,
  videoId: string,
  query: Record<string, string> | [string, string][] = {},
) {
  const search = new URLSearchParams(query)
  const response = await browser.fetch(
    `/api/channels/${channelId}/videos/${videoId}/sponsor-report?${search}`,
  )
  return { status: response.status, body: (await response.json()) as SponsorReportAnswer }
}

/** The Analytics queries of the one video's numbers, the sponsor report's own read. */
function videoQueriesOf(api: StartedApi, videoId = 'video-1'): URLSearchParams[] {
  return api.google.analyticsRequests.filter(
    (query) => query.get('filters') === `video==${videoId}`,
  )
}

describe("seam 1: a sponsor report of one video's first 7, 14 and 30 days", () => {
  test("an old video's report answers each window from its exact range, the nine figures, and the last processed day", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        rangeMetrics: rangeMetricsOf([
          ['2026-09-01', '2026-09-07', 700],
          ['2026-09-01', '2026-09-14', 1400],
          ['2026-09-01', '2026-09-30', 3000],
        ]),
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const report = await sponsorReport(browser, channelId, 'video-1')

    expect(report.status).toBe(200)
    expect(report.body).toMatchObject({
      video: {
        id: 'video-1',
        title: 'Upload 1',
        publishedAt: '2026-09-01T15:00:00.000Z',
        scheduled: false,
      },
      figures: [...sponsorFigures],
      windows: [
        { days: 7, numbers: figuresOf(700) },
        { days: 14, numbers: figuresOf(1400) },
        { days: 30, numbers: figuresOf(3000) },
      ],
      lastProcessedDay: '2026-10-04',
      awaitingProcessing: false,
      fromCache: false,
    })
    for (const window of report.body.windows) expect(window).not.toHaveProperty('partial')
    expect(
      videoQueriesOf(api).map((query) => [query.get('startDate'), query.get('endDate')]),
    ).toEqual([
      ['2026-09-01', '2026-09-07'],
      ['2026-09-01', '2026-09-14'],
      ['2026-09-01', '2026-09-30'],
    ])
  })

  test('a 10-day-old video has a whole first 7 days, and 10 of 14 and 10 of 30 days, both read up to the last processed day', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        publishedAt: '2026-09-25T15:00:00Z',
        rangeMetrics: rangeMetricsOf([
          ['2026-09-25', '2026-10-01', 7],
          ['2026-09-25', '2026-10-04', 10],
        ]),
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const report = await sponsorReport(browser, channelId, 'video-1')

    expect(report.body.windows).toEqual([
      { days: 7, numbers: figuresOf(7) },
      { days: 14, numbers: figuresOf(10), partial: { days: 10, of: 14 } },
      { days: 30, numbers: figuresOf(10), partial: { days: 10, of: 30 } },
    ])
    expect(videoQueriesOf(api)).toHaveLength(2)
  })

  test('a 5-day-old video makes one Analytics query for its three windows', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({
        publishedAt: '2026-09-30T15:00:00Z',
        rangeMetrics: rangeMetricsOf([['2026-09-30', '2026-10-04', 5]]),
      }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const report = await sponsorReport(browser, channelId, 'video-1')

    expect(report.body.windows).toEqual([
      { days: 7, numbers: figuresOf(5), partial: { days: 5, of: 7 } },
      { days: 14, numbers: figuresOf(5), partial: { days: 5, of: 14 } },
      { days: 30, numbers: figuresOf(5), partial: { days: 5, of: 30 } },
    ])
    expect(videoQueriesOf(api)).toHaveLength(1)
  })

  test('a range Google answers no row for is zeros', async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    api.google.setLastProcessedDay('2026-10-04')

    const report = await sponsorReport(browser, channelId, 'video-1')

    expect(report.body.windows.map(({ numbers }) => numbers)).toEqual([zeros, zeros, zeros])
  })

  test('a video awaiting processing, and a scheduled one, answer zeros and 0 days in every window, with no Analytics query of the video', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    // The fake holds lifetime numbers for both, so any read of them would show.
    const { browser, channelId } = await connectedCreator(api, [
      upload({ publishedAt: '2026-10-05T15:00:00Z', metrics: figuresOf(5) }),
      {
        videoId: 'video-2',
        title: 'Upload 2',
        scheduledFor: '2026-10-20T15:00:00Z',
        metrics: figuresOf(9),
      },
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const awaiting = await sponsorReport(browser, channelId, 'video-1')
    const scheduled = await sponsorReport(browser, channelId, 'video-2')

    for (const report of [awaiting, scheduled]) {
      expect(report.status).toBe(200)
      expect(report.body).toMatchObject({
        awaitingProcessing: true,
        lastProcessedDay: '2026-10-04',
        windows: [
          { days: 7, numbers: zeros, partial: { days: 0, of: 7 } },
          { days: 14, numbers: zeros, partial: { days: 0, of: 14 } },
          { days: 30, numbers: zeros, partial: { days: 0, of: 30 } },
        ],
      })
    }
    expect(scheduled.body.video).toMatchObject({ id: 'video-2', scheduled: true })
    expect([...videoQueriesOf(api), ...videoQueriesOf(api, 'video-2')]).toEqual([])
  })

  test('figures=likes,views answers only those figures, in report order', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ rangeMetrics: rangeMetricsOf([['2026-09-01', '2026-09-07', 700]]) }),
    ])
    api.google.setLastProcessedDay('2026-10-04')

    const report = await sponsorReport(browser, channelId, 'video-1', { figures: 'likes,views' })

    expect(report.status).toBe(200)
    expect(report.body.figures).toEqual(['views', 'likes'])
    expect(report.body.windows[0]?.numbers).toEqual({ views: 701, likes: 705 })
    expect(report.body.windows[2]?.numbers).toEqual({ views: 0, likes: 0 })
  })

  test("a free channel's creator gets the report, no paid plan needed", async ({ web, clock }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    const entitlements = (await (
      await browser.fetch('/api/me/entitlements')
    ).json()) as EntitlementsAnswer

    const report = await sponsorReport(browser, channelId, 'video-1')

    expect(entitlements.channels).toMatchObject([{ channelId, tier: 'free' }])
    expect(report.status).toBe(200)
  })

  test('a second read inside the cache window spends no quota, whatever figures it shows', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    await sponsorReport(browser, channelId, 'video-1')
    const asked = api.google.analyticsRequests.length

    const second = await sponsorReport(browser, channelId, 'video-1', { figures: 'shares' })

    expect(second.body).toMatchObject({ figures: ['shares'], fromCache: true })
    expect(api.google.analyticsRequests).toHaveLength(asked)
  })
})

describe('seam 1: the sponsor report carries no revenue', () => {
  test.for([...sponsorRevenueFigures])(
    'figures naming %s is refused with revenue_figure before any Google call, even with revenue consent',
    async (revenueFigure, { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, [upload()])
      await giveRevenueConsent(browser, channelId)
      const before = {
        analytics: api.google.analyticsRequests.length,
        dataApi: api.google.dataApiRequests.length,
      }

      const refused = await sponsorReport(browser, channelId, 'video-1', {
        figures: `views,${revenueFigure}`,
      })

      expect(refused).toEqual({ status: 400, body: { error: 'revenue_figure' } })
      expect({
        analytics: api.google.analyticsRequests.length,
        dataApi: api.google.dataApiRequests.length,
      }).toEqual(before)
    },
  )

  test('no Analytics query a report makes names a revenue metric, for a channel with revenue consent', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    await giveRevenueConsent(browser, channelId)
    const before = api.google.analyticsRequests.length

    const report = await sponsorReport(browser, channelId, 'video-1')

    expect(report.status).toBe(200)
    const metrics = api.google.analyticsRequests
      .slice(before)
      .flatMap((query) => (query.get('metrics') ?? '').split(','))
    expect(metrics.length).toBeGreaterThan(0)
    expect(
      metrics.filter((metric) => (sponsorRevenueFigures as readonly string[]).includes(metric)),
    ).toEqual([])
    for (const query of videoQueriesOf(api)) {
      expect(query.get('metrics')).toBe(sponsorFigures.join(','))
    }
  })
})

describe('seam 1: the sponsor report refuses what it cannot answer', () => {
  test.for(['impressionz', 'views,', ''])(
    'figures=%s is refused with invalid_figure before any Google call',
    async (figures, { web }) => {
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, [upload()])
      const before = api.google.dataApiRequests.length

      const refused = await sponsorReport(browser, channelId, 'video-1', { figures })

      expect(refused).toEqual({ status: 400, body: { error: 'invalid_figure' } })
      expect(api.google.dataApiRequests).toHaveLength(before)
      expect(api.google.analyticsRequests).toHaveLength(0)
    },
  )

  test('figures sent twice is refused with invalid_figure before any Google call', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    const before = api.google.dataApiRequests.length

    const refused = await sponsorReport(browser, channelId, 'video-1', [
      ['figures', 'views'],
      ['figures', 'likes'],
    ])

    expect(refused).toEqual({ status: 400, body: { error: 'invalid_figure' } })
    expect(api.google.dataApiRequests).toHaveLength(before)
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test("a video id not among the channel's uploads gets video_not_found before any Analytics query", async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])

    const refused = await Promise.all(
      ['video-2', 'video-1,video-2'].map((videoId) =>
        sponsorReport(browser, channelId, encodeURIComponent(videoId)),
      ),
    )

    expect(refused).toEqual(
      Array.from({ length: 2 }, () => ({ status: 404, body: { refusal: 'video_not_found' } })),
    )
    expect(api.google.analyticsRequests).toHaveLength(0)
  })

  test('another creator gets not_connected for a channel they are no member of', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    expect((await sponsorReport(browser, channelId, 'video-1')).status).toBe(200)
    const other = await signIn(api, otherCreator)

    const read = await sponsorReport(other, channelId, 'video-1')

    expect(read).toEqual({ status: 404, body: { refusal: 'not_connected' } })
  })

  test('a signed-out request answers 401', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [upload()])
    await browser.postJson('/api/auth/sign-out', {})

    const read = await sponsorReport(browser, channelId, 'video-1')

    expect(read).toEqual({ status: 401, body: { error: 'unauthenticated' } })
  })
})

async function putChoice(browser: Browser, channelId: string, body: unknown) {
  const response = await browser.fetch(`/api/channels/${channelId}/sponsor-figures`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json()) as SponsorChoiceAnswer }
}

/** An old video and a second one, each with its first 7 days' numbers. */
const twoUploads = [
  upload({ rangeMetrics: rangeMetricsOf([['2026-09-01', '2026-09-07', 700]]) }),
  upload({
    videoId: 'video-2',
    title: 'Upload 2',
    publishedAt: '2026-09-03T15:00:00Z',
    rangeMetrics: rangeMetricsOf([['2026-09-03', '2026-09-09', 20]]),
  }),
]

/**
 * A membership with a role other than owner. The role column has no database check, so the test
 * inserts one as the worker would, as checkout.test.ts does.
 */
async function addMember(
  web: WebDatabase,
  worker: WorkerDatabase,
  channelId: string,
  email: string,
): Promise<void> {
  const userId = await userIdOf(web, email)
  await worker.forChannel(channelId, (scope) =>
    scope.sql.insert(memberships).values({ channelId, userId, role: 'member' as 'owner' }),
  )
}

describe("seam 1: the sponsor report's figure choice, stored for the channel", () => {
  test("a stored choice answers in report order, and the channel's next reports open with it, for any of its videos", async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, twoUploads)
    api.google.setLastProcessedDay('2026-10-04')

    const saved = await putChoice(browser, channelId, { figures: ['likes', 'views'] })
    const first = await sponsorReport(browser, channelId, 'video-1')
    const second = await sponsorReport(browser, channelId, 'video-2')

    expect(saved).toEqual({ status: 200, body: { figures: ['views', 'likes'] } })
    expect(first.body.figures).toEqual(['views', 'likes'])
    expect(first.body.windows[0]?.numbers).toEqual({ views: 701, likes: 705 })
    expect(second.body.figures).toEqual(['views', 'likes'])
    expect(second.body.windows[0]?.numbers).toEqual({ views: 21, likes: 25 })
  })

  test('figures sent with the read override the stored choice for that read only', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, twoUploads)
    await putChoice(browser, channelId, { figures: ['likes', 'views'] })

    const overridden = await sponsorReport(browser, channelId, 'video-1', { figures: 'shares' })
    const next = await sponsorReport(browser, channelId, 'video-1')

    expect(overridden.body.figures).toEqual(['shares'])
    expect(next.body.figures).toEqual(['views', 'likes'])
  })

  test("a channel's other member writes the choice, and the owner's next report opens with it", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, twoUploads)
    const member = await signIn(api, channelMember)
    await addMember(web, worker, channelId, channelMember.email)

    const saved = await putChoice(member, channelId, { figures: ['comments'] })
    const report = await sponsorReport(browser, channelId, 'video-1')

    expect(saved).toEqual({ status: 200, body: { figures: ['comments'] } })
    expect(report.body.figures).toEqual(['comments'])
  })

  test('a creator who is no member of the channel gets not_connected and changes nothing', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, twoUploads)
    const other = await signIn(api, otherCreator)

    const refused = await putChoice(other, channelId, { figures: ['comments'] })
    const malformed = await putChoice(other, 'not-a-channel', { figures: ['comments'] })
    const report = await sponsorReport(browser, channelId, 'video-1')

    expect(refused).toEqual({ status: 404, body: { refusal: 'not_connected' } })
    expect(malformed).toEqual({ status: 404, body: { refusal: 'not_connected' } })
    expect(report.body.figures).toEqual([...sponsorFigures])
  })

  test('a signed-out PUT answers 401', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, twoUploads)
    await browser.postJson('/api/auth/sign-out', {})

    const refused = await putChoice(browser, channelId, { figures: ['comments'] })

    expect(refused).toEqual({ status: 401, body: { error: 'unauthenticated' } })
  })

  test.for([...sponsorRevenueFigures])(
    'a choice naming %s is refused with revenue_figure, and nothing is stored',
    async (revenueFigure, { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, twoUploads)

      const refused = await putChoice(browser, channelId, { figures: ['views', revenueFigure] })
      const report = await sponsorReport(browser, channelId, 'video-1')

      expect(refused).toEqual({ status: 400, body: { error: 'revenue_figure' } })
      expect(report.body.figures).toEqual([...sponsorFigures])
    },
  )

  test.for([
    ['an empty list', { figures: [] }],
    ['an unknown name', { figures: ['views', 'impressionz'] }],
    ['an extra key', { figures: ['views'], videoId: 'video-1' }],
    ['malformed JSON', '{"figures": ["views"'],
  ] as const)(
    'a choice with %s is refused with invalid_figure, and nothing is stored',
    async ([, body], { web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, twoUploads)

      const refused = await putChoice(browser, channelId, body)
      const report = await sponsorReport(browser, channelId, 'video-1')

      expect(refused).toEqual({ status: 400, body: { error: 'invalid_figure' } })
      expect(report.body.figures).toEqual([...sponsorFigures])
    },
  )

  test('a choice of every figure the types allow is stored, so the database holds the same set', async ({
    web,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, twoUploads)

    const saved = await putChoice(browser, channelId, { figures: [...sponsorReportFigures] })
    const replaced = await putChoice(browser, channelId, { figures: ['shares'] })

    expect(saved).toEqual({ status: 200, body: { figures: [...sponsorReportFigures] } })
    expect(replaced).toEqual({ status: 200, body: { figures: ['shares'] } })
  })
})

/** The days from `first` to `last`, both included. */
function daysBetween(first: string, last: string): string[] {
  const days: string[] = []
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day)
  return days
}

/**
 * The history the worker would store for video-1, published 2026-09-01, with code 5 (YouTube
 * search) and 7 (suggested videos), and a row of another video's inside its windows. Its days run
 * from `firstDay` to 2026-10-04, but any in `missing`. Over the first 7 days video-1 has 400
 * impressions and 62.5 clicks, over 14 days 800 and 87.5, and over 30 days 1000 and 137.5; its row
 * on 2026-10-02 falls after its 30 days.
 */
async function storeHistory(
  worker: WorkerDatabase,
  channelId: string,
  { firstDay = '2026-09-01', missing = [] }: { firstDay?: string; missing?: string[] } = {},
): Promise<void> {
  const search = 5
  const suggested = 7
  await worker.forChannel(channelId, async (tx) => {
    await tx.sql.insert(reachHistory).values(
      (
        [
          ['video-1', '2026-09-02', search, 100, 0.25],
          ['video-1', '2026-09-05', suggested, 300, 0.125],
          ['video-1', '2026-09-10', search, 400, 0.0625],
          ['video-1', '2026-09-20', search, 200, 0.25],
          ['video-1', '2026-10-02', search, 1000, 0.5],
          ['video-2', '2026-09-03', search, 999, 0.5],
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
      daysBetween(firstDay, '2026-10-04')
        .filter((day) => !missing.includes(day))
        .map((day) => ({ channelId, day, reportCreatedAt: tx.now })),
    )
  })
}

/** An old video, published 2026-09-01, with Google's numbers for its three windows. */
const oldUpload = upload({
  rangeMetrics: rangeMetricsOf([
    ['2026-09-01', '2026-09-07', 700],
    ['2026-09-01', '2026-09-14', 1400],
    ['2026-09-01', '2026-09-30', 3000],
  ]),
})

describe("seam 1: impressions and CTR from a Pro channel's stored history", () => {
  test("a paid channel whose history holds every day of the three windows answers its history and each window's impressions and CTR, when chosen", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [oldUpload])
    api.google.setLastProcessedDay('2026-10-04')
    await subscribeOwner(web, worker, channelId)
    await storeHistory(worker, channelId)

    const report = await sponsorReport(browser, channelId, 'video-1', {
      figures: 'views,impressions,ctr',
    })

    expect(report.status).toBe(200)
    expect(report.body).toMatchObject({
      figures: ['views', 'impressions', 'ctr'],
      history: { firstDay: '2026-09-01', newestDay: '2026-10-04' },
      windows: [
        { days: 7, numbers: { views: 701, impressions: 400, ctr: 0.15625 } },
        { days: 14, numbers: { views: 1401, impressions: 800, ctr: 0.109375 } },
        { days: 30, numbers: { views: 3001, impressions: 1000, ctr: 0.1375 } },
      ],
    })
    for (const window of report.body.windows) expect(window).not.toHaveProperty('historyPartial')
  })

  test('a paid channel with no history figure chosen still answers its history, and no impressions or CTR', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [oldUpload])
    api.google.setLastProcessedDay('2026-10-04')
    await subscribeOwner(web, worker, channelId)
    await storeHistory(worker, channelId)

    const report = await sponsorReport(browser, channelId, 'video-1')

    expect(report.body.figures).toEqual([...sponsorFigures])
    expect(report.body.history).toEqual({ firstDay: '2026-09-01', newestDay: '2026-10-04' })
    expect(report.body.windows.map(({ numbers }) => numbers)).toEqual([
      figuresOf(700),
      figuresOf(1400),
      figuresOf(3000),
    ])
  })

  test("a stored choice of impressions and CTR opens a paid channel's report with them", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [oldUpload])
    api.google.setLastProcessedDay('2026-10-04')
    await subscribeOwner(web, worker, channelId)
    await storeHistory(worker, channelId)
    await putChoice(browser, channelId, { figures: ['ctr', 'impressions'] })

    const report = await sponsorReport(browser, channelId, 'video-1')

    expect(report.body.figures).toEqual(['impressions', 'ctr'])
    expect(report.body.windows[0]?.numbers).toEqual({ impressions: 400, ctr: 0.15625 })
  })

  test('a window the history misses a day of carries the days it holds and no impressions or CTR, beside a covered window that carries them', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [oldUpload])
    api.google.setLastProcessedDay('2026-10-04')
    await subscribeOwner(web, worker, channelId)
    await storeHistory(worker, channelId, { missing: ['2026-09-10'] })

    const report = await sponsorReport(browser, channelId, 'video-1', {
      figures: 'views,impressions,ctr',
    })

    expect(report.body.windows).toEqual([
      { days: 7, numbers: { views: 701, impressions: 400, ctr: 0.15625 } },
      { days: 14, numbers: { views: 1401 }, historyPartial: { days: 13, of: 14 } },
      { days: 30, numbers: { views: 3001 }, historyPartial: { days: 29, of: 30 } },
    ])
  })

  test('a history that starts after the publish day covers no window', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [oldUpload])
    api.google.setLastProcessedDay('2026-10-04')
    await subscribeOwner(web, worker, channelId)
    await storeHistory(worker, channelId, { firstDay: '2026-09-05' })

    const report = await sponsorReport(browser, channelId, 'video-1', { figures: 'impressions' })

    expect(report.body).toMatchObject({
      figures: ['impressions'],
      history: { firstDay: '2026-09-05', newestDay: '2026-10-04' },
      windows: [
        { days: 7, numbers: {}, historyPartial: { days: 3, of: 7 } },
        { days: 14, numbers: {}, historyPartial: { days: 10, of: 14 } },
        { days: 30, numbers: {}, historyPartial: { days: 26, of: 30 } },
      ],
    })
  })

  test("a 10-day-old video's windows count only its days up to the last processed day", async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ publishedAt: '2026-09-25T15:00:00Z' }),
    ])
    api.google.setLastProcessedDay('2026-10-04')
    await subscribeOwner(web, worker, channelId)
    await storeHistory(worker, channelId)

    const report = await sponsorReport(browser, channelId, 'video-1', { figures: 'impressions' })

    // video-1's rows on or after 2026-09-25 are only the one on 2026-10-02.
    expect(report.body.windows).toEqual([
      { days: 7, numbers: { impressions: 0 } },
      { days: 14, numbers: { impressions: 1000 }, partial: { days: 10, of: 14 } },
      { days: 30, numbers: { impressions: 1000 }, partial: { days: 10, of: 30 } },
    ])
  })

  test('a video awaiting processing carries no history figure and no history days', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [
      upload({ publishedAt: '2026-10-05T15:00:00Z' }),
    ])
    api.google.setLastProcessedDay('2026-10-04')
    await subscribeOwner(web, worker, channelId)
    await storeHistory(worker, channelId)

    const report = await sponsorReport(browser, channelId, 'video-1', {
      figures: 'views,impressions,ctr',
    })

    expect(report.body).toMatchObject({
      awaitingProcessing: true,
      figures: ['views', 'impressions', 'ctr'],
      history: { firstDay: '2026-09-01', newestDay: '2026-10-04' },
    })
    expect(report.body.windows).toEqual([
      { days: 7, numbers: { views: 0 }, partial: { days: 0, of: 7 } },
      { days: 14, numbers: { views: 0 }, partial: { days: 0, of: 14 } },
      { days: 30, numbers: { views: 0 }, partial: { days: 0, of: 30 } },
    ])
  })

  test('an ended channel before its purge date still answers them', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [oldUpload])
    api.google.setLastProcessedDay('2026-10-04')
    await subscribeOwner(web, worker, channelId, {
      status: 'canceled',
      purgeAfter: new Date('2026-10-20T00:00:00Z'),
    })
    await storeHistory(worker, channelId)

    const report = await sponsorReport(browser, channelId, 'video-1', { figures: 'impressions' })

    expect(report.body.history).toEqual({ firstDay: '2026-09-01', newestDay: '2026-10-04' })
    expect(report.body.windows[2]?.numbers).toEqual({ impressions: 1000 })
  })

  test.for([
    ['a free channel', undefined],
    ['an ended channel past its purge date', new Date('2026-10-06T00:00:00Z')],
  ] as const)(
    '%s answers no history, and leaves impressions and CTR out of a stored choice and of the query',
    async ([, purgeAfter], { web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, [oldUpload])
      api.google.setLastProcessedDay('2026-10-04')
      if (purgeAfter)
        await subscribeOwner(web, worker, channelId, { status: 'canceled', purgeAfter })
      await storeHistory(worker, channelId)

      const saved = await putChoice(browser, channelId, {
        figures: ['views', 'impressions', 'ctr'],
      })
      const stored = await sponsorReport(browser, channelId, 'video-1')
      const asked = await sponsorReport(browser, channelId, 'video-1', {
        figures: 'likes,impressions,ctr',
      })

      expect(saved.body.figures).toEqual(['views', 'impressions', 'ctr'])
      expect(stored.body).not.toHaveProperty('history')
      expect(stored.body.figures).toEqual(['views'])
      expect(stored.body.windows.map(({ numbers }) => numbers)).toEqual([
        { views: 701 },
        { views: 1401 },
        { views: 3001 },
      ])
      expect(asked.body.figures).toEqual(['likes'])
      for (const window of [...stored.body.windows, ...asked.body.windows]) {
        expect(window).not.toHaveProperty('historyPartial')
      }
    },
  )

  test.for([
    ['a free channel', undefined],
    ['an ended channel past its purge date', new Date('2026-10-06T00:00:00Z')],
  ] as const)(
    '%s with only impressions and CTR stored or asked answers the nine figures, never an empty report',
    async ([, purgeAfter], { web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web)
      const { browser, channelId } = await connectedCreator(api, [oldUpload])
      api.google.setLastProcessedDay('2026-10-04')
      if (purgeAfter)
        await subscribeOwner(web, worker, channelId, { status: 'canceled', purgeAfter })
      await storeHistory(worker, channelId)

      await putChoice(browser, channelId, { figures: ['impressions'] })
      const stored = await sponsorReport(browser, channelId, 'video-1')
      const asked = await sponsorReport(browser, channelId, 'video-1', {
        figures: 'impressions,ctr',
      })

      for (const report of [stored, asked]) {
        expect(report.status).toBe(200)
        expect(report.body).not.toHaveProperty('history')
        expect(report.body.figures).toEqual([...sponsorFigures])
        expect(report.body.windows.map(({ numbers }) => numbers)).toEqual([
          figuresOf(700),
          figuresOf(1400),
          figuresOf(3000),
        ])
      }
    },
  )

  test('impressions and CTR make no Analytics query beyond the nine-figure read', async ({
    web,
    worker,
    clock,
  }) => {
    clock.set(noonToday)
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api, [oldUpload])
    api.google.setLastProcessedDay('2026-10-04')
    await subscribeOwner(web, worker, channelId)
    await storeHistory(worker, channelId)

    await sponsorReport(browser, channelId, 'video-1', { figures: 'impressions,ctr' })

    expect(videoQueriesOf(api)).toHaveLength(3)
    for (const query of videoQueriesOf(api)) {
      expect(query.get('metrics')).toBe(sponsorFigures.join(','))
    }
  })
})
