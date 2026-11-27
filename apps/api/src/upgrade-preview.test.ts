// Limits: the pure describe counts over upload dates the tests write, by Google's documented report
// lifetimes (developers.google.com/youtube/reporting/v1/reports, read 2026-11-17): it cannot prove
// how long the live Reporting API keeps a new job's reports, nor that a day's report arrives within
// the 72 hours the newest day allows. The API describe reads the uploads from the fake Google
// server. Nick's walk of Pro on production (creator-analytics#791) covers a real
// subscription's first download against the dates the upgrade screen promised.
import {
  addDays,
  type RefusalAnswer,
  type UpgradeAnswer,
  type VideoRow,
} from '@creator-analytics/api-types'
import {
  memberships,
  reportingJobs,
  type WebDatabase,
  type WorkerDatabase,
} from '@creator-analytics/database'
import { test as apiTest } from '@creator-analytics/database/testing'
import type { FakeUpload } from '@creator-analytics/fake-google'
import { describe, expect, test } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'
import { testBilling } from '../test/stripe.ts'
import {
  comparisonOf,
  historyStartIfSubscribed,
  newestDayIfSubscribed,
  type UpgradeUpload,
} from './upgrade-preview.ts'

type Candidate = Pick<VideoRow, 'privacy' | 'scheduled' | 'format'>

/** An upload published at noon UTC on the day, public, not scheduled and a video unless set. */
function uploadOn(
  id: string,
  publishDay: string,
  candidate: Partial<Candidate> = {},
): UpgradeUpload {
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
  }
}

/** Uploads every `step` days from `from`, `count` of them. */
function everyDays(from: string, step: number, count: number): UpgradeUpload[] {
  return Array.from({ length: count }, (_, index) =>
    uploadOn(`v${index}`, addDays(from, index * step)),
  )
}

// Today is 2026-10-07, so the newest day is 2026-10-03; a job made 2026-07-01 is old at the first
// download, 2026-10-08, so the history starts 60 days before it, on 2026-08-09.
const historyStart = '2026-08-09'
const newestDay = '2026-10-03'

describe('the comparisons a channel would have if it subscribed today', () => {
  test('the history starts 30 days before the job while the job is under 30 days old at the first download, and at the later of the job and 60 days back after', () => {
    expect(historyStartIfSubscribed('2026-10-08', '2026-10-01')).toBe('2026-09-01')
    expect(historyStartIfSubscribed('2026-10-08', '2026-09-01')).toBe('2026-09-01')
    expect(historyStartIfSubscribed('2026-10-08', '2026-07-01')).toBe('2026-08-09')
  })

  test('a channel with no reporting job yet counts one made on the first download day', () => {
    expect(historyStartIfSubscribed('2026-10-08', null)).toBe('2026-09-08')
  })

  test("the newest day is today less 4, past YouTube's 72-hour delay", () => {
    expect(newestDayIfSubscribed('2026-10-07')).toBe('2026-10-03')
  })

  test('a weekly uploader has both comparisons on the first day, each with its count and no date', () => {
    // 2026-08-10 to 2026-09-28; the one before the history start never counts.
    const uploads = [uploadOn('before', '2026-08-02'), ...everyDays('2026-08-10', 7, 8)]

    expect(comparisonOf(uploads, 'all', 'first7', historyStart, newestDay)).toEqual({
      window: 'first7',
      count: 7,
      availableOn: null,
    })
    expect(comparisonOf(uploads, 'all', 'first28', historyStart, newestDay)).toEqual({
      window: 'first28',
      count: 4,
      availableOn: null,
    })
  })

  test("a monthly uploader has the 7-day comparison, and the 28-day one dated the day its second upload's 28 days are past the delay", () => {
    const uploads = [
      uploadOn('july', '2026-07-15'),
      uploadOn('august', '2026-08-15'),
      uploadOn('september', '2026-09-15'),
    ]

    expect(comparisonOf(uploads, 'all', 'first7', historyStart, newestDay)).toEqual({
      window: 'first7',
      count: 2,
      availableOn: null,
    })
    // September's 28th day is 2026-10-12, 4 days back on 2026-10-16.
    expect(comparisonOf(uploads, 'all', 'first28', historyStart, newestDay)).toEqual({
      window: 'first28',
      count: 1,
      availableOn: '2026-10-16',
    })
  })

  test('a channel with no public uploads counts none and has no date: private, unlisted and scheduled ones never count', () => {
    const uploads = [
      uploadOn('private', '2026-08-15', { privacy: 'private' }),
      uploadOn('unlisted', '2026-08-20', { privacy: 'unlisted' }),
      uploadOn('scheduled', '2026-08-25', { scheduled: true }),
      uploadOn('also-private', '2026-09-30', { privacy: 'private' }),
    ]

    expect(comparisonOf(uploads, 'all', 'first7', historyStart, newestDay)).toEqual({
      window: 'first7',
      count: 0,
      availableOn: null,
    })
    expect(comparisonOf([], 'all', 'first28', historyStart, newestDay)).toEqual({
      window: 'first28',
      count: 0,
      availableOn: null,
    })
  })

  test('a channel whose two newest uploads are too young dates the comparison on the second one', () => {
    const uploads = [uploadOn('a', '2026-09-30'), uploadOn('b', '2026-10-02')]

    // b's 7th day is 2026-10-08, 4 days back on 2026-10-12.
    expect(comparisonOf(uploads, 'all', 'first7', historyStart, newestDay)).toEqual({
      window: 'first7',
      count: 0,
      availableOn: '2026-10-12',
    })
  })

  test('12 qualifying uploads count 10, the newest average size', () => {
    expect(
      comparisonOf(everyDays('2026-08-10', 1, 12), 'all', 'first7', historyStart, newestDay).count,
    ).toBe(10)
  })

  test('a Short counts under all, not under video', () => {
    const uploads = [
      uploadOn('video', '2026-08-10'),
      uploadOn('short', '2026-08-11', { format: 'short' }),
    ]

    expect(comparisonOf(uploads, 'all', 'first7', historyStart, newestDay).count).toBe(2)
    expect(comparisonOf(uploads, 'video', 'first7', historyStart, newestDay)).toEqual({
      window: 'first7',
      count: 1,
      availableOn: null,
    })
  })
})

// Emails no other test file signs in with, as channel-summary.test.ts explains.
const owner = { sub: '788001', email: 'upgrade-owner@example.com', name: 'An Owner' }
const member = { sub: '788002', email: 'upgrade-member@example.com', name: 'A Member' }

// Noon on 2026-10-07 in Pacific Time, so today is 2026-10-07.
const noonToday = new Date('2026-10-07T19:00:00Z')

/** A public video published at 08:00 Pacific Time on the day. */
function videoOn(videoId: string, day: string): FakeUpload {
  return {
    videoId,
    title: videoId,
    publishedAt: `${day}T15:00:00Z`,
    creatorContentType: 'videoOnDemand',
    metrics: { engagedViews: 10, views: 10, averageViewPercentage: 50, subscribersGained: 0 },
  }
}

/**
 * The owner's channel, connected and nothing more: before the worker's `ensureReportingJob` has
 * recorded its reporting job, as on the upgrade screen a first visit lands on (creator-analytics#907).
 */
async function justConnectedChannel(api: StartedApi) {
  const browser = await signIn(api, owner)
  api.google.pickChannel('UC-upgrade')
  api.google.setChannel('UC-upgrade', {
    createdAt: '2019-03-01T06:00:00Z',
    uploads: [
      videoOn('july', '2026-07-15'),
      videoOn('august', '2026-08-15'),
      videoOn('september', '2026-09-15'),
    ],
  })
  await connect(browser)
  const [channel] = (await channelsOf(browser)).channels
  if (!channel) throw new Error('The connect flow connected no channel')
  return { browser, channelId: channel.id }
}

async function ownedChannel(api: StartedApi, worker: WorkerDatabase) {
  const { browser, channelId } = await justConnectedChannel(api)
  // The job Google made on 2026-07-01, as the worker's `ensureReportingJob` records it.
  await worker.forChannel(channelId, (tx) =>
    tx.sql.insert(reportingJobs).values({
      channelId,
      jobId: 'job-upgrade',
      createdAt: new Date('2026-07-01T16:00:00Z'),
    }),
  )
  return { browser, channelId }
}

/** A membership with a role other than owner, as checkout.test.ts inserts one. */
async function addMember(
  api: StartedApi,
  web: WebDatabase,
  worker: WorkerDatabase,
  channelId: string,
): Promise<Browser> {
  const browser = await signIn(api, member)
  const userId = await userIdOf(web, member.email)
  await worker.forChannel(channelId, (scope) =>
    scope.sql.insert(memberships).values({ channelId, userId, role: 'member' as 'owner' }),
  )
  return browser
}

function upgradeOf(browser: Browser, channelId: string, query = ''): Promise<Response> {
  return browser.fetch(`/api/channels/${channelId}/upgrade${query}`)
}

// The prices the test API's fake Stripe server holds for `testBilling`'s two price IDs.
const testPrices: UpgradeAnswer['prices'] = {
  monthly: { amount: 700, currency: 'usd' },
  annual: { amount: 7000, currency: 'usd' },
}

// The monthly uploader of the pure describe: the history would run from 2026-08-09 to 2026-10-03.
const monthlyAnswer: UpgradeAnswer = {
  historyStart: '2026-08-09',
  newestDay: '2026-10-03',
  comparisons: [
    { window: 'first7', count: 2, availableOn: null },
    { window: 'first28', count: 1, availableOn: '2026-10-16' },
  ],
  prices: testPrices,
}

/** The price reads the API sent the fake Stripe server, by path. */
function priceReadsOf(api: StartedApi): string[] {
  return (api.fakeStripe?.requests ?? [])
    .filter(({ method, path }) => method === 'GET' && path.startsWith('/v1/prices/'))
    .map(({ path }) => path)
}

describe('seam 1: the upgrade route answers the comparisons a subscription today would have', () => {
  apiTest(
    "the owner's free channel answers each comparison's count and date",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web, { billing: testBilling })
      const { browser, channelId } = await ownedChannel(api, worker)

      const response = await upgradeOf(browser, channelId)

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(monthlyAnswer)
    },
  )

  // creator-analytics#907: a first visit from the homepage's "Subscribe" lands on the upgrade
  // screen moments after the connect, before the worker has recorded the reporting job. The answer
  // counts the channel's uploads, read from YouTube as the free tier reads them, so it waits on no
  // import; it counts as if the job were made at the first download, tomorrow, so its history would
  // start 30 days before that, on 2026-09-08, a day later than once the job is recorded today.
  apiTest(
    "a channel connected moments ago, before its reporting job is recorded, answers its uploads' counts with the history from 30 days before the first download",
    async ({ web, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web, { billing: testBilling })
      const { browser, channelId } = await justConnectedChannel(api)

      const response = await upgradeOf(browser, channelId)

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({
        historyStart: '2026-09-08',
        newestDay: '2026-10-03',
        comparisons: [
          { window: 'first7', count: 1, availableOn: null },
          { window: 'first28', count: 0, availableOn: null },
        ],
        prices: testPrices,
      } satisfies UpgradeAnswer)
    },
  )

  apiTest(
    'a member who does not own the channel gets the same answer',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web, { billing: testBilling })
      const { channelId } = await ownedChannel(api, worker)
      const memberBrowser = await addMember(api, web, worker, channelId)

      const response = await upgradeOf(memberBrowser, channelId)

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(monthlyAnswer)
    },
  )

  apiTest(
    'a user who holds no membership to the channel is refused with not_connected',
    async ({ web, worker }) => {
      const api = await startApi(web, { billing: testBilling })
      const { channelId } = await ownedChannel(api, worker)
      const stranger = await signIn(api, member)

      const response = await upgradeOf(stranger, channelId)

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ refusal: 'not_connected' } satisfies RefusalAnswer)
    },
  )

  apiTest('an unknown format is refused with invalid_format', async ({ web, worker }) => {
    const api = await startApi(web, { billing: testBilling })
    const { browser, channelId } = await ownedChannel(api, worker)

    const response = await upgradeOf(browser, channelId, '?format=podcast')

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_format' })
  })

  // creator-analytics#913: the pricing cards show the amounts Checkout charges, read from the two
  // configured Stripe prices. A price's amount and currency never change in Stripe, so the API
  // reads each one once for the process.
  apiTest(
    "the answer carries each plan's price as Stripe holds it, read once for the process",
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web, { billing: testBilling })
      const { browser, channelId } = await ownedChannel(api, worker)

      const first = (await (await upgradeOf(browser, channelId)).json()) as UpgradeAnswer
      const video = await upgradeOf(browser, channelId, '?format=video')
      const second = (await video.json()) as UpgradeAnswer

      expect([first.prices, second.prices]).toEqual([testPrices, testPrices])
      expect(priceReadsOf(api).toSorted()).toEqual([
        `/v1/prices/${testBilling.prices.annual}`,
        `/v1/prices/${testBilling.prices.monthly}`,
      ])
      expect(api.reporter.reports).toEqual([])
    },
  )

  // A failure Stripe keeps answering, such as a restricted key with no read on Prices or a wrong
  // price ID, is read and reported once a minute at most, not on every view of the screen.
  apiTest(
    'a Stripe that cannot be read answers the comparisons with no prices and reports to GlitchTip once, reads Stripe no more for a minute, then reads it again',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web, { billing: testBilling, clock: clock.now })
      const { browser, channelId } = await ownedChannel(api, worker)
      // A restricted key without the prices' read permission is refused with 403.
      api.fakeStripe?.failAll(403)

      const failed = await upgradeOf(browser, channelId)

      expect(failed.status).toBe(200)
      expect(await failed.json()).toEqual({ ...monthlyAnswer, prices: null })
      expect(api.reporter.reports).toEqual([
        expect.objectContaining({ message: 'Stripe could not read the prices Checkout sells' }),
      ])
      const readsAfterFailure = priceReadsOf(api).length

      clock.advance(59_000)
      const again = (await (await upgradeOf(browser, channelId)).json()) as UpgradeAnswer

      expect(again).toEqual({ ...monthlyAnswer, prices: null })
      expect(priceReadsOf(api)).toHaveLength(readsAfterFailure)
      expect(api.reporter.reports).toHaveLength(1)

      api.fakeStripe?.failAll(null)
      clock.advance(1_000)
      const recovered = (await (await upgradeOf(browser, channelId)).json()) as UpgradeAnswer

      expect(recovered.prices).toEqual(testPrices)
      expect(api.reporter.reports).toHaveLength(1)
    },
  )

  // A hanging Stripe never holds the comparisons: each price read has a deadline of its own and is
  // not retried, so the answer comes with no prices once the deadline passes.
  apiTest(
    'a Stripe that does not answer within the deadline answers the comparisons with no prices and reports to GlitchTip, without waiting on Stripe',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web, { billing: testBilling, stripePriceTimeoutMs: 200 })
      const { browser, channelId } = await ownedChannel(api, worker)
      api.fakeStripe?.delay(10_000)

      const startedAt = performance.now()
      const response = await upgradeOf(browser, channelId)
      const waited = performance.now() - startedAt

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ...monthlyAnswer, prices: null })
      expect(waited).toBeLessThan(2_000)
      expect(priceReadsOf(api).toSorted()).toEqual([
        `/v1/prices/${testBilling.prices.annual}`,
        `/v1/prices/${testBilling.prices.monthly}`,
      ])
      expect(api.reporter.reports).toEqual([
        expect.objectContaining({ message: 'Stripe could not read the prices Checkout sells' }),
      ])
    },
  )

  apiTest(
    'a price with no single amount, such as a tiered one, answers no prices and reports to GlitchTip',
    async ({ web, worker, clock }) => {
      clock.set(noonToday)
      const api = await startApi(web, { billing: testBilling })
      const { browser, channelId } = await ownedChannel(api, worker)
      api.fakeStripe?.addPrice({
        id: testBilling.prices.annual,
        unitAmount: null,
        interval: 'year',
      })

      const response = await upgradeOf(browser, channelId)

      expect(await response.json()).toEqual({ ...monthlyAnswer, prices: null })
      expect(api.reporter.reports).toEqual([
        expect.objectContaining({ message: 'Stripe could not read the prices Checkout sells' }),
      ])
    },
  )

  apiTest(
    'with Pro unset, the route answers 404 as an unknown route does',
    async ({ web, worker }) => {
      const api = await startApi(web)
      const { browser, channelId } = await ownedChannel(api, worker)

      const response = await upgradeOf(browser, channelId)

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'not_found' })
    },
  )
})
