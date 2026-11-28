// Limits: Google is the fake Google server, whose report files are written from the Reporting API's
// documentation, so these tests cannot prove that a real `channel_reach_combined_a1` file reads the
// same, nor its CTR scale or date format. Nick's walk of a paid channel on production (#791), a
// real file downloaded and its days shown, covers them. Nor can they show which rows a real file
// holds that the parser refuses or reads past (a CTR above 1): Nick's staging check of #1040, every
// day Google still holds stored after the deploy, covers that. Nor can they show Google's real rate
// limit on downloads, its window, or whether its 429 carries a Retry-After: the fake's
// `limitReportDownloads` models a per-minute limit from Google Cloud's quota documentation. Nick's
// staging check of #1043, a new Pro channel's whole history stored within minutes of Checkout with
// no hand-queued run, covers that. They run the daily ensureReportingJob handler the way `work`
// does, inside the test's transaction, and a re-queued job at its start time, which pg-boss's
// fetch honouring `startAfter` is outside.
import {
  reachHistory,
  reachHistoryDays,
  reportingJobs,
  type WorkerDatabase,
} from '@creator-analytics/database'
import { type FindJobs, subscribeOwner, type TestClock } from '@creator-analytics/database/testing'
import { purgeDateOf } from '@creator-analytics/entitlements'
import type { FakeGoogle, FakeReachRow } from '@creator-analytics/fake-google'
import { asc, sql } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import type { jobHandlers } from '../src/jobs.ts'
import { ensureReportingJob } from '../src/reporting-jobs.ts'
import { connectedChannel, subscribe, test } from './reporting-harness.ts'

type Handlers = ReturnType<typeof jobHandlers>

function storedRows(worker: WorkerDatabase, channelId: string) {
  return worker.forChannel(channelId, (tx) =>
    tx.sql
      .select({
        videoId: reachHistory.videoId,
        day: reachHistory.day,
        trafficSourceType: reachHistory.trafficSourceType,
        impressions: reachHistory.impressions,
        ctr: reachHistory.ctr,
      })
      .from(reachHistory)
      .orderBy(asc(reachHistory.day), asc(reachHistory.videoId)),
  )
}

function storedDays(worker: WorkerDatabase, channelId: string) {
  return worker.forChannel(channelId, async (tx) =>
    (
      await tx.sql
        .select({ day: reachHistoryDays.day })
        .from(reachHistoryDays)
        .orderBy(asc(reachHistoryDays.day))
    ).map(({ day }) => day),
  )
}

/** A day's report at the fake, unless given its rows one video's 100 impressions from YouTube
 * search at a 5% CTR. */
function addDay(
  google: FakeGoogle,
  youtubeChannelId: string,
  day: string,
  createTime: string,
  rows: FakeReachRow[] = [{ videoId: 'v1', trafficSourceType: 5, impressions: 100, ctr: 0.05 }],
) {
  return google.addReachReport(youtubeChannelId, { day, createTime, rows })
}

/** The rows of a file the parser refuses: one row's impressions are below 0. */
const unreadableRows: FakeReachRow[] = [
  { videoId: 'v1', trafficSourceType: 5, impressions: -1, ctr: 0.05 },
]

const today = new Date('2026-11-17T12:00:00.000Z')

function failingSince(worker: WorkerDatabase, channelId: string) {
  return worker.forChannel(channelId, async (tx) => {
    const [job] = await tx.sql
      .select({ since: reportingJobs.downloadsFailingSince })
      .from(reportingJobs)
    return job?.since
  })
}

/**
 * Runs every ensureReportingJob job not run yet, each at its start time on both clocks, until none
 * is left, and returns the jobs it ran in that order. More than 20 throws, so a re-queue with no cap
 * fails the test instead of hanging it.
 */
async function runQueuedJobs(
  {
    findJobs,
    clock,
    google,
    handlers,
    worker,
  }: {
    findJobs: FindJobs
    clock: TestClock
    google: FakeGoogle
    handlers: Handlers
    worker: WorkerDatabase
  },
  alreadyRun: string[] = [],
) {
  const ran: Awaited<ReturnType<FindJobs>> = []
  for (;;) {
    const ranIds = new Set([...alreadyRun, ...ran.map((job) => job.id)])
    const [next] = (await findJobs('ensureReportingJob'))
      .filter((job) => !ranIds.has(job.id))
      .sort((a, b) => a.startAfter.getTime() - b.startAfter.getTime())
    if (!next) return ran
    if (ran.length === 20) throw new Error('More than 20 queued jobs ran')
    ran.push(next)
    clock.set(next.startAfter)
    google.setNow(next.startAfter)
    await handlers.ensureReportingJob(worker, next.data)
  }
}

const minuteMs = 60 * 1000

describe('seam 2: the daily download of a paid channel reach history', () => {
  test('a free channel downloads no report, whatever its job holds', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-free', 'UC-reach-free')
    addDay(google, 'UC-reach-free', '2026-11-15', '2026-11-16T10:00:00Z')

    await handlers.ensureReportingJob(worker, { channelId })

    expect(google.reportDownloads).toEqual([])
    expect(await storedDays(worker, channelId)).toEqual([])
  })

  test('an ended channel, its purge date ahead, downloads no report', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-ended', 'UC-reach-ended')
    await subscribeOwner(web, worker, channelId, {
      status: 'canceled',
      purgeAfter: new Date('2026-12-17T12:00:00.000Z'),
    })
    addDay(google, 'UC-reach-ended', '2026-11-15', '2026-11-16T10:00:00Z')

    await handlers.ensureReportingJob(worker, { channelId })

    expect(google.reportDownloads).toEqual([])
    expect(await storedDays(worker, channelId)).toEqual([])
  })

  test('a new paid channel downloads every report still at Google, and stores each day', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-new', 'UC-reach-new')
    await subscribe(web, worker, channelId)
    // Created 61 days before today, so Google no longer holds it.
    addDay(google, 'UC-reach-new', '2026-09-16', '2026-09-17T10:00:00Z')
    const kept = [
      addDay(google, 'UC-reach-new', '2026-09-20', '2026-09-21T10:00:00Z'),
      addDay(google, 'UC-reach-new', '2026-11-15', '2026-11-16T10:00:00Z'),
    ]

    await handlers.ensureReportingJob(worker, { channelId })

    expect(google.reportDownloads).toEqual(kept)
    expect(await storedDays(worker, channelId)).toEqual(['2026-09-20', '2026-11-15'])
  })

  test('a later run downloads only the reports created since the newest one stored', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-later', 'UC-reach-later')
    await subscribe(web, worker, channelId)
    addDay(google, 'UC-reach-later', '2026-11-14', '2026-11-15T10:00:00Z')
    await handlers.ensureReportingJob(worker, { channelId })
    const newer = addDay(google, 'UC-reach-later', '2026-11-15', '2026-11-16T10:00:00Z')
    const before = google.reportDownloads.length

    await handlers.ensureReportingJob(worker, { channelId })

    expect(google.reportDownloads.slice(before)).toEqual([newer])
    expect(await storedDays(worker, channelId)).toEqual(['2026-11-14', '2026-11-15'])
  })

  test('a report created at the same time as the newest one stored is still stored on a later run', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-tie', 'UC-reach-tie')
    await subscribe(web, worker, channelId)
    addDay(google, 'UC-reach-tie', '2026-11-14', '2026-11-16T10:00:00Z')
    await handlers.ensureReportingJob(worker, { channelId })
    const tied = addDay(google, 'UC-reach-tie', '2026-11-15', '2026-11-16T10:00:00Z')
    const before = google.reportDownloads.length

    await handlers.ensureReportingJob(worker, { channelId })

    expect(google.reportDownloads.slice(before)).toEqual([tied])
    expect(await storedDays(worker, channelId)).toEqual(['2026-11-14', '2026-11-15'])
  })

  test('a channel that subscribes again on day 20 after its subscription ended downloads every day it missed, and its history has no hole', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    const dayMs = 24 * 60 * 60 * 1000
    const day0 = new Date('2026-10-20T12:00:00.000Z')
    const dayAt = (n: number) => new Date(day0.getTime() + n * dayMs)
    const dateOf = (n: number) => dayAt(n).toISOString().slice(0, 10)
    // The report of the UTC date `n` days after day 0, created at 10:00 UTC the day after it.
    const addReport = (n: number) =>
      addDay(google, 'UC-reach-return', dateOf(n), `${dateOf(n + 1)}T10:00:00Z`)
    // The channel's purge date is on its pro_ends row, which a turn to paid deletes.
    const setSubscription = ({ status, purgeAfter }: { status: string; purgeAfter: Date | null }) =>
      subscribeOwner(web, worker, channelId, { status, purgeAfter })
    const runAt = async (n: number) => {
      clock.set(dayAt(n))
      google.setNow(dayAt(n))
      await handlers.ensureReportingJob(worker, { channelId })
    }

    clock.set(day0)
    google.setNow(day0)
    const channelId = await connectedChannel(web, google, keys, 'reach-return', 'UC-reach-return')
    await subscribe(web, worker, channelId)
    for (const n of [-3, -2, -1]) addReport(n)
    await runAt(0)
    // The `deleted` webhook ends the subscription on day 0.
    await setSubscription({ status: 'canceled', purgeAfter: purgeDateOf(day0) })

    // The reports YouTube creates while the channel is ended, on days 1 to 19.
    const gap: string[] = []
    for (let n = 0; n < 9; n++) gap.push(addReport(n))
    const beforeEnded = google.reportDownloads.length
    await runAt(10)
    expect(google.reportDownloads.length).toBe(beforeEnded)
    for (let n = 9; n < 19; n++) gap.push(addReport(n))

    // A return before the purge date: record_subscription makes it paid and clears the date.
    await setSubscription({ status: 'active', purgeAfter: null })
    await runAt(20)

    expect(google.reportDownloads.slice(beforeEnded)).toEqual(gap)
    expect(await storedDays(worker, channelId)).toEqual(
      Array.from({ length: 22 }, (_, i) => dateOf(i - 3)),
    )
  })

  test("a correction replaces its day's rows, and a correction holding no row empties the day", async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-fix', 'UC-reach-fix')
    await subscribe(web, worker, channelId)
    addDay(google, 'UC-reach-fix', '2026-11-14', '2026-11-15T10:00:00Z')
    addDay(google, 'UC-reach-fix', '2026-11-15', '2026-11-16T10:00:00Z')
    await handlers.ensureReportingJob(worker, { channelId })
    google.addReachReport('UC-reach-fix', {
      day: '2026-11-14',
      createTime: '2026-11-17T09:00:00Z',
      rows: [{ videoId: 'v2', trafficSourceType: 3, impressions: 40, ctr: 0.1 }],
    })
    google.addReachReport('UC-reach-fix', {
      day: '2026-11-15',
      createTime: '2026-11-17T10:00:00Z',
      rows: [],
    })

    await handlers.ensureReportingJob(worker, { channelId })

    expect(await storedRows(worker, channelId)).toEqual([
      { videoId: 'v2', day: '2026-11-14', trafficSourceType: 3, impressions: 40, ctr: 0.1 },
    ])
    expect(await storedDays(worker, channelId)).toEqual(['2026-11-14', '2026-11-15'])
  })

  test('the stored history holds only the video, day, traffic source type, impressions and CTR, reduced from the rows Google splits by detail, device and operating system', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-cols', 'UC-reach-cols')
    await subscribe(web, worker, channelId)
    google.addReachReport('UC-reach-cols', {
      day: '2026-11-15',
      createTime: '2026-11-16T10:00:00Z',
      rows: [
        {
          videoId: 'v1',
          trafficSourceType: 5,
          trafficSourceDetail: 'a search, with a comma',
          operatingSystem: 'IOS',
          deviceType: 'MOBILE',
          impressions: 100,
          ctr: 0.1,
        },
        {
          videoId: 'v1',
          trafficSourceType: 5,
          trafficSourceDetail: 'another search',
          operatingSystem: 'WINDOWS',
          deviceType: 'DESKTOP',
          impressions: 300,
          ctr: 0.02,
        },
      ],
    })

    await handlers.ensureReportingJob(worker, { channelId })

    const columns = await worker.forChannel(channelId, async (tx) =>
      (
        await tx.sql.execute<{ column_name: string }>(
          sql`select column_name from information_schema.columns where table_name = 'reach_history' order by column_name`,
        )
      ).rows.map((row) => row.column_name),
    )
    expect(columns).toEqual([
      'channel_id',
      'ctr',
      'day',
      'impressions',
      'traffic_source_type',
      'video_id',
    ])
    // (100 x 0.1 + 300 x 0.02) / 400
    expect(await storedRows(worker, channelId)).toEqual([
      { videoId: 'v1', day: '2026-11-15', trafficSourceType: 5, impressions: 400, ctr: 0.04 },
    ])
  })

  test('a failed download is retried on the next run', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-retry', 'UC-reach-retry')
    await subscribe(web, worker, channelId)
    const report = addDay(google, 'UC-reach-retry', '2026-11-15', '2026-11-16T10:00:00Z')
    google.failReportDownloads(503)
    await handlers.ensureReportingJob(worker, { channelId })
    const afterFailure = await storedDays(worker, channelId)
    google.failReportDownloads(null)

    await handlers.ensureReportingJob(worker, { channelId })

    expect(afterFailure).toEqual([])
    expect(google.reportDownloads).toEqual([report, report])
    expect(await storedDays(worker, channelId)).toEqual(['2026-11-15'])
  })

  test('a report with a row whose CTR is above 1 stores its day, the CTR of its group capped at 1', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-clicks', 'UC-reach-clicks')
    await subscribe(web, worker, channelId)
    addDay(google, 'UC-reach-clicks', '2026-11-15', '2026-11-16T10:00:00Z', [
      { videoId: 'v1', trafficSourceType: 5, impressions: 4, ctr: 1.25 },
    ])

    await handlers.ensureReportingJob(worker, { channelId })

    expect(await storedRows(worker, channelId)).toEqual([
      { videoId: 'v1', day: '2026-11-15', trafficSourceType: 5, impressions: 4, ctr: 1 },
    ])
  })

  test('a report the parser refuses, between two it reads, is skipped: both read days are stored, and no later run downloads any of the three again', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-skip', 'UC-reach-skip')
    await subscribe(web, worker, channelId)
    const reports = [
      addDay(google, 'UC-reach-skip', '2026-11-13', '2026-11-14T10:00:00Z'),
      addDay(google, 'UC-reach-skip', '2026-11-14', '2026-11-15T10:00:00Z', unreadableRows),
      addDay(google, 'UC-reach-skip', '2026-11-15', '2026-11-16T10:00:00Z'),
    ]
    await handlers.ensureReportingJob(worker, { channelId })
    const firstRun = [...google.reportDownloads]

    await handlers.ensureReportingJob(worker, { channelId })

    expect(firstRun).toEqual(reports)
    expect(google.reportDownloads).toEqual(reports)
    expect(await storedDays(worker, channelId)).toEqual(['2026-11-13', '2026-11-15'])
  })

  test('a refused report listed last is downloaded again on each run until a later report is stored, and then never again', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-last', 'UC-reach-last')
    await subscribe(web, worker, channelId)
    const read = addDay(google, 'UC-reach-last', '2026-11-14', '2026-11-15T10:00:00Z')
    const refused = addDay(
      google,
      'UC-reach-last',
      '2026-11-15',
      '2026-11-16T10:00:00Z',
      unreadableRows,
    )
    await handlers.ensureReportingJob(worker, { channelId })
    await handlers.ensureReportingJob(worker, { channelId })
    const later = addDay(google, 'UC-reach-last', '2026-11-16', '2026-11-17T10:00:00Z')
    await handlers.ensureReportingJob(worker, { channelId })

    await handlers.ensureReportingJob(worker, { channelId })

    expect(google.reportDownloads).toEqual([read, refused, refused, refused, later])
    expect(await storedDays(worker, channelId)).toEqual(['2026-11-14', '2026-11-16'])
  })

  test('a refused report logs one line, which names the rule its row broke', async ({
    web,
    worker,
    clock,
    google,
    keys,
    logs,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-log', 'UC-reach-log')
    await subscribe(web, worker, channelId)
    addDay(google, 'UC-reach-log', '2026-11-15', '2026-11-16T10:00:00Z', unreadableRows)

    await handlers.ensureReportingJob(worker, { channelId })

    expect(logs.map((line) => JSON.parse(line))).toEqual([
      {
        level: 'error',
        message:
          'A reach report file could not be read: A reach report row has impressions below zero in video_thumbnail_impressions',
      },
    ])
  })

  test('a Google error on a download ends the run there, so no report after it is downloaded', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-stop', 'UC-reach-stop')
    await subscribe(web, worker, channelId)
    const first = addDay(google, 'UC-reach-stop', '2026-11-14', '2026-11-15T10:00:00Z')
    addDay(google, 'UC-reach-stop', '2026-11-15', '2026-11-16T10:00:00Z')
    google.failReportDownloads(503)

    await handlers.ensureReportingJob(worker, { channelId })

    expect(google.reportDownloads).toEqual([first])
    expect(await storedDays(worker, channelId)).toEqual([])
  })

  test('a skipped report counts as a failed download even when the run stores others, so a channel with a refused report every day for 3 days raises the error report', async ({
    web,
    worker,
    clock,
    google,
    keys,
    reporter,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-skips', 'UC-reach-skips')
    await subscribe(web, worker, channelId)
    const dayMs = 24 * 60 * 60 * 1000
    const hoursBefore = (hours: number) =>
      new Date(clock.now().getTime() - hours * 60 * 60 * 1000).toISOString()
    const errorReportsAfterRun = async (ms: number, refusedDay: string, readDay: string) => {
      clock.advance(ms)
      addDay(google, 'UC-reach-skips', refusedDay, hoursBefore(2), unreadableRows)
      addDay(google, 'UC-reach-skips', readDay, hoursBefore(1))
      await handlers.ensureReportingJob(worker, { channelId })
      return reporter.reports.length
    }

    const counts = [
      await errorReportsAfterRun(0, '2026-11-15', '2026-11-16'),
      await errorReportsAfterRun(2 * dayMs, '2026-11-17', '2026-11-18'),
      await errorReportsAfterRun(dayMs, '2026-11-19', '2026-11-20'),
    ]

    expect(await storedDays(worker, channelId)).toEqual(['2026-11-16', '2026-11-18', '2026-11-20'])
    expect(counts).toEqual([0, 0, 1])
  })

  test('a paid channel whose downloads have failed for 3 days raises an error report naming only its id, and one failing for 2 days does not', async ({
    web,
    worker,
    clock,
    google,
    keys,
    reporter,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-alarm', 'UC-reach-alarm')
    await subscribe(web, worker, channelId)
    addDay(google, 'UC-reach-alarm', '2026-11-15', '2026-11-16T10:00:00Z')
    google.failReportDownloads(503)
    const errorReportsAfterRun = async (ms: number) => {
      clock.advance(ms)
      await handlers.ensureReportingJob(worker, { channelId })
      return reporter.reports.length
    }
    const dayMs = 24 * 60 * 60 * 1000

    const counts = [
      await errorReportsAfterRun(0),
      await errorReportsAfterRun(2 * dayMs),
      await errorReportsAfterRun(dayMs),
    ]

    expect(counts).toEqual([0, 0, 1])
    expect(reporter.reports).toEqual([
      {
        message: 'A paid channel has failed to download its reach reports for 3 days',
        context: { channelId },
      },
    ])
  })
})

describe("seam 2: a history download Google's 429 cuts short", () => {
  test('a first download Google rate limits part way queues its job again a minute later, and the re-queues store every report, each answered once', async ({
    web,
    worker,
    findJobs,
    clock,
    google,
    keys,
    logs,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-429', 'UC-reach-429')
    await subscribe(web, worker, channelId)
    const days = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']
    const [r1, r2, r3, r4, r5] = days.map((day, i) =>
      addDay(google, 'UC-reach-429', day, `2026-11-1${i}T10:00:00Z`),
    )
    google.limitReportDownloads(2)

    await handlers.ensureReportingJob(worker, { channelId })
    const requeues = await runQueuedJobs({ findJobs, clock, google, handlers, worker })

    expect(requeues.map((job) => job.startAfter)).toEqual([
      new Date(today.getTime() + minuteMs),
      new Date(today.getTime() + 2 * minuteMs),
    ])
    // Each refused download is the first of the next run, and no answered one is asked again.
    expect(google.reportDownloads).toEqual([r1, r2, r3, r3, r4, r5, r5])
    expect(await storedDays(worker, channelId)).toEqual(days)
    expect(await failingSince(worker, channelId)).toBeNull()
    expect(
      logs.map((line) => JSON.parse(line)).filter((line) => line.context?.status === '429'),
    ).toHaveLength(2)
  })

  test('the wait before a re-queue runs from the 429, not from the start of a run that downloaded for a while before it', async ({
    web,
    worker,
    findJobs,
    clock,
    google,
    keys,
    gateway,
    reporter,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-slow', 'UC-reach-slow')
    await subscribe(web, worker, channelId)
    addDay(google, 'UC-reach-slow', '2026-11-13', '2026-11-14T10:00:00Z')
    addDay(google, 'UC-reach-slow', '2026-11-14', '2026-11-15T10:00:00Z')
    addDay(google, 'UC-reach-slow', '2026-11-15', '2026-11-16T10:00:00Z')
    google.limitReportDownloads(2)
    // Each download takes 40 seconds on the clock the job reads, so the third, which Google
    // refuses, ends 2 minutes into the run.
    const slowDownloads = ensureReportingJob({
      gateway: {
        ...gateway,
        downloadReachReport: (...call) => {
          clock.advance(40 * 1000)
          return gateway.downloadReachReport(...call)
        },
      },
      reporter,
    })

    await worker.forChannel(channelId, (tx) => slowDownloads(tx, { channelId }))

    const [requeue] = await findJobs('ensureReportingJob')
    expect(requeue?.startAfter).toEqual(new Date(today.getTime() + 3 * minuteMs))
  })

  test("the wait before a re-queue is Google's Retry-After in seconds when it is longer than a minute, and a minute otherwise", async ({
    web,
    worker,
    findJobs,
    clock,
    google,
    keys,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-wait', 'UC-reach-wait')
    await subscribe(web, worker, channelId)
    addDay(google, 'UC-reach-wait', '2026-11-15', '2026-11-16T10:00:00Z')
    const ran: string[] = []
    /** Runs the job under a 429 with this Retry-After, and returns the job the run queued. */
    const queuedAfterRun = async (
      retryAfter: string,
      job: { data: Record<string, string>; startAfter: Date },
    ) => {
      google.limitReportDownloads(0, { retryAfter })
      clock.set(job.startAfter)
      google.setNow(job.startAfter)
      await handlers.ensureReportingJob(worker, job.data)
      const [queued] = (await findJobs('ensureReportingJob')).filter((j) => !ran.includes(j.id))
      if (!queued) throw new Error('The run queued no job')
      ran.push(queued.id)
      return queued
    }

    const inSeconds = await queuedAfterRun('300', { data: { channelId }, startAfter: today })
    const underAMinute = await queuedAfterRun('5', inSeconds)
    const asADate = await queuedAfterRun('Wed, 18 Nov 2026 12:00:00 GMT', underAMinute)

    expect([inSeconds, underAMinute, asADate].map((job) => job.startAfter)).toEqual([
      new Date(today.getTime() + 5 * minuteMs),
      new Date(today.getTime() + 6 * minuteMs),
      new Date(today.getTime() + 7 * minuteMs),
    ])
  })

  test('a download Google rate limits on every run queues itself again 10 times at most, then reports the cap and counts as a failed download', async ({
    web,
    worker,
    findJobs,
    clock,
    google,
    keys,
    reporter,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-cap', 'UC-reach-cap')
    await subscribe(web, worker, channelId)
    addDay(google, 'UC-reach-cap', '2026-11-15', '2026-11-16T10:00:00Z')
    google.limitReportDownloads(0)

    await handlers.ensureReportingJob(worker, { channelId })
    const requeues = await runQueuedJobs({ findJobs, clock, google, handlers, worker })

    expect(requeues).toHaveLength(10)
    expect(reporter.reports).toEqual([
      {
        message:
          "A paid channel's history download was still rate limited when its re-queues ran out",
        context: { channelId, requeues: '10' },
      },
    ])
    expect(await failingSince(worker, channelId)).toEqual(requeues.at(-1)?.startAfter)
  })

  test("a rate-limited run that queues itself again neither starts nor ends the channel's failing period, and raises no alarm, and the run that stores the rest ends it", async ({
    web,
    worker,
    findJobs,
    clock,
    google,
    keys,
    reporter,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'reach-limited', 'UC-reach-limited')
    await subscribe(web, worker, channelId)
    addDay(google, 'UC-reach-limited', '2026-11-14', '2026-11-15T10:00:00Z')
    addDay(google, 'UC-reach-limited', '2026-11-15', '2026-11-16T10:00:00Z')
    google.failReportDownloads(503)
    await handlers.ensureReportingJob(worker, { channelId })
    google.failReportDownloads(null)
    google.limitReportDownloads(1)
    clock.advance(3 * 24 * 60 * minuteMs)
    google.setNow(clock.now())

    await handlers.ensureReportingJob(worker, { channelId })
    const whileLimited = {
      since: await failingSince(worker, channelId),
      reports: reporter.reports.length,
    }
    await runQueuedJobs({ findJobs, clock, google, handlers, worker })

    expect(whileLimited).toEqual({ since: today, reports: 0 })
    expect(await storedDays(worker, channelId)).toEqual(['2026-11-14', '2026-11-15'])
    expect(await failingSince(worker, channelId)).toBeNull()
    expect(reporter.reports).toEqual([])
  })

  test('a list of reports Google rate limits queues the job again a minute later, and the re-queue stores every report', async ({
    web,
    worker,
    findJobs,
    clock,
    google,
    keys,
    reporter,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'list-429', 'UC-list-429')
    await subscribe(web, worker, channelId)
    addDay(google, 'UC-list-429', '2026-11-14', '2026-11-15T10:00:00Z')
    addDay(google, 'UC-list-429', '2026-11-15', '2026-11-16T10:00:00Z')
    google.limitReportLists(0)
    await handlers.ensureReportingJob(worker, { channelId })
    const downloadsWhileLimited = [...google.reportDownloads]
    google.limitReportLists(10)

    const requeues = await runQueuedJobs({ findJobs, clock, google, handlers, worker })

    expect(downloadsWhileLimited).toEqual([])
    expect(requeues.map((job) => job.startAfter)).toEqual([new Date(today.getTime() + minuteMs)])
    expect(await storedDays(worker, channelId)).toEqual(['2026-11-14', '2026-11-15'])
    expect(await failingSince(worker, channelId)).toBeNull()
    expect(reporter.reports).toEqual([])
  })

  test('a list of reports Google rate limits on every run queues the job again 10 times at most, then reports the cap and counts as a failed download', async ({
    web,
    worker,
    findJobs,
    clock,
    google,
    keys,
    reporter,
    handlers,
  }) => {
    clock.set(today)
    google.setNow(today)
    const channelId = await connectedChannel(web, google, keys, 'list-cap', 'UC-list-cap')
    await subscribe(web, worker, channelId)
    addDay(google, 'UC-list-cap', '2026-11-15', '2026-11-16T10:00:00Z')
    google.limitReportLists(0)

    await handlers.ensureReportingJob(worker, { channelId })
    const requeues = await runQueuedJobs({ findJobs, clock, google, handlers, worker })

    expect(requeues).toHaveLength(10)
    expect(reporter.reports).toEqual([
      {
        message:
          "A paid channel's history download was still rate limited when its re-queues ran out",
        context: { channelId, requeues: '10' },
      },
    ])
    expect(await failingSince(worker, channelId)).toEqual(requeues.at(-1)?.startAfter)
  })
})
