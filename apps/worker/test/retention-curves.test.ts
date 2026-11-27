// Limits: Google is the fake Google server, whose retention curve is the same for any range, so
// these tests cannot prove that a real curve read over a video's lifetime answers the curve the
// video page shows, nor that Google answers no rows for a video too small to draw one. Nick's walk
// of a paid channel on production covers them. They run each handler the way `work` does, inside
// the test's transaction; that transaction holds every scope's locks to its end, and a scope opened
// inside another becomes a savepoint, so these tests cannot show a run releasing the quota rows
// every channel shares between reads. The scope count test holds the shape that releases them, and
// the repro in `docs/reviews/creator-analytics-936/repro/quota-row-lock.test.ts` shows the release
// on separate connections. pg-boss's cron pass sending the roster job at 09:00 UTC is outside them,
// and the schedules test reads back the stored schedule.
import {
  connections,
  quotaUsage,
  retentionCurveReads,
  retentionCurves,
  subscriptions,
  type WorkerDatabase,
} from '@creator-analytics/database'
import type { FakeGoogle, FakeUpload } from '@creator-analytics/fake-google'
import { quotaDayOf } from '@creator-analytics/youtube-gateway'
import { asc, eq, sql } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { connectedChannel, subscribe, test } from './reporting-harness.ts'

type FakeRetentionPoint = NonNullable<FakeUpload['retention']>[number]

const dayMs = 24 * 60 * 60 * 1000
const today = new Date('2026-11-17T12:00:00.000Z')

function daysBefore(days: number, from: Date = today): Date {
  return new Date(from.getTime() - days * dayMs)
}

function daysAfter(days: number, from: Date = today): Date {
  return new Date(from.getTime() + days * dayMs)
}

/** A curve of three points, its watch ratios starting at `start`. */
function curve(start: number): FakeRetentionPoint[] {
  return [
    { elapsedVideoTimeRatio: 0.01, audienceWatchRatio: start, relativeRetentionPerformance: 0.5 },
    {
      elapsedVideoTimeRatio: 0.5,
      audienceWatchRatio: start / 2,
      relativeRetentionPerformance: 0.5,
    },
    { elapsedVideoTimeRatio: 1, audienceWatchRatio: start / 4, relativeRetentionPerformance: 0.5 },
  ]
}

/** The points `curve(start)` stores. */
function storedCurve(start: number) {
  return [
    { elapsedVideoTimeRatio: 0.01, audienceWatchRatio: start },
    { elapsedVideoTimeRatio: 0.5, audienceWatchRatio: start / 2 },
    { elapsedVideoTimeRatio: 1, audienceWatchRatio: start / 4 },
  ]
}

function uploadsAt(google: FakeGoogle, youtubeChannelId: string, uploads: FakeUpload[]): void {
  google.setChannel(youtubeChannelId, { createdAt: '2020-01-01T00:00:00Z', uploads })
}

/** An upload published at the time, with a curve. */
function published(videoId: string, at: Date, start = 1): FakeUpload {
  return { videoId, title: videoId, publishedAt: at.toISOString(), retention: curve(start) }
}

/** Sets the clock of every scope and of the fake Google server. */
function setNow(clock: { set(now: Date): void }, google: FakeGoogle, now: Date): void {
  clock.set(now)
  google.setNow(now)
}

/** Each video's stored points, in order along the video. */
function storedCurves(worker: WorkerDatabase, channelId: string) {
  return worker.forChannel(channelId, async (tx) => {
    const rows = await tx.sql
      .select({
        videoId: retentionCurves.videoId,
        elapsedVideoTimeRatio: retentionCurves.elapsedVideoTimeRatio,
        audienceWatchRatio: retentionCurves.audienceWatchRatio,
        readAt: retentionCurves.readAt,
      })
      .from(retentionCurves)
      .orderBy(asc(retentionCurves.videoId), asc(retentionCurves.elapsedVideoTimeRatio))
    const curves: Record<string, { elapsedVideoTimeRatio: number; audienceWatchRatio: number }[]> =
      {}
    for (const { videoId, elapsedVideoTimeRatio, audienceWatchRatio } of rows) {
      curves[videoId] = [...(curves[videoId] ?? []), { elapsedVideoTimeRatio, audienceWatchRatio }]
    }
    return { curves, readAts: [...new Set(rows.map(({ readAt }) => readAt.toISOString()))] }
  })
}

/** When each video of the channel was last read, curve or none. */
function storedReads(worker: WorkerDatabase, channelId: string) {
  return worker.forChannel(channelId, async (tx) =>
    Object.fromEntries(
      (
        await tx.sql
          .select({ videoId: retentionCurveReads.videoId, readAt: retentionCurveReads.readAt })
          .from(retentionCurveReads)
          .orderBy(asc(retentionCurveReads.videoId))
      ).map(({ videoId, readAt }) => [videoId, readAt.toISOString()]),
    ),
  )
}

/** The Analytics units spent on the quota day of the scope's clock. */
function analyticsUnits(worker: WorkerDatabase, channelId: string) {
  return worker.forChannel(channelId, async (tx) => {
    const [row] = await tx.sql
      .select({ units: quotaUsage.units })
      .from(quotaUsage)
      .where(
        sql`${quotaUsage.api} = 'analytics' and ${quotaUsage.quotaDay} = ${quotaDayOf(tx.now)}`,
      )
    return row?.units ?? 0
  })
}

/** The video each recorded Analytics request filtered on, in order. */
function readVideos(google: FakeGoogle): string[] {
  return google.analyticsRequests.map((query) =>
    (query.get('filters') ?? '').replace(/^video==/, ''),
  )
}

/** The channel already holds a read of the video at the time, with the curve's points. */
async function seedRead(
  worker: WorkerDatabase,
  channelId: string,
  videoId: string,
  readAt: Date,
  points = storedCurve(0.9),
): Promise<void> {
  await worker.forChannel(channelId, async (tx) => {
    await tx.sql.insert(retentionCurveReads).values({ channelId, videoId, readAt })
    if (points.length === 0) return
    await tx.sql
      .insert(retentionCurves)
      .values(points.map((point) => ({ channelId, videoId, readAt, ...point })))
  })
}

describe('seam 2: the daily retention curve refresh of a paid channel', () => {
  // Only the system scope reads the connection roster, and only a channel's own scope reads and
  // writes its curves.
  test('the daily roster job refreshes every connected channel, each in its own scope, and none with a revoked connection', async ({
    web,
    worker,
    clock,
    findJobs,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const first = await connectedChannel(web, google, keys, 'curves-roster-a', 'UC-curves-a')
    const second = await connectedChannel(web, google, keys, 'curves-roster-b', 'UC-curves-b')
    const revoked = await connectedChannel(web, google, keys, 'curves-roster-c', 'UC-curves-c')
    for (const [channelId, youtubeChannelId] of [
      [first, 'UC-curves-a'],
      [second, 'UC-curves-b'],
      [revoked, 'UC-curves-c'],
    ] as const) {
      uploadsAt(google, youtubeChannelId, [published('v1', daysBefore(3))])
      await subscribe(worker, channelId)
    }
    await worker.forChannel(revoked, (tx) => tx.sql.update(connections).set({ status: 'revoked' }))

    // A scheduled job carries no data.
    await handlers.retentionCurveRoster(worker, {})
    for (const job of await findJobs('retentionCurveRefresh')) {
      await handlers.retentionCurveRefresh(worker, job.data)
    }

    expect({
      first: await storedReads(worker, first),
      second: await storedReads(worker, second),
      revoked: await storedReads(worker, revoked),
    }).toEqual({
      first: { v1: today.toISOString() },
      second: { v1: today.toISOString() },
      revoked: {},
    })
  })

  test('a roster job run twice in a UTC day sends each channel one refresh', async ({
    web,
    worker,
    clock,
    findJobs,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    await connectedChannel(web, google, keys, 'curves-twice', 'UC-curves-twice')

    await handlers.retentionCurveRoster(worker, {})
    await handlers.retentionCurveRoster(worker, {})

    expect(await findJobs('retentionCurveRefresh')).toHaveLength(1)
  })

  test('a channel with more uploads than a run reads stores its 100 newest curves on the first day and the rest on the next, reading each video once', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-backfill', 'UC-backfill')
    await subscribe(worker, channelId)
    // 101 videos, published a day apart, the newest 40 days ago: none of them under 28 days.
    const videoIds = Array.from({ length: 101 }, (_, i) => `video-${String(i).padStart(3, '0')}`)
    uploadsAt(
      google,
      'UC-backfill',
      videoIds.map((videoId, i) => published(videoId, daysBefore(140 - i))),
    )

    await handlers.retentionCurveRefresh(worker, { channelId })
    const firstDay = {
      reads: Object.keys(await storedReads(worker, channelId)),
      units: await analyticsUnits(worker, channelId),
    }
    setNow(clock, google, daysAfter(1))
    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(firstDay).toEqual({ reads: videoIds.slice(1), units: 100 })
    expect(await analyticsUnits(worker, channelId)).toBe(1)
    expect(Object.keys(await storedReads(worker, channelId))).toEqual(videoIds)
    const { curves } = await storedCurves(worker, channelId)
    expect(Object.keys(curves)).toEqual(videoIds)
    expect(curves['video-000']).toEqual(storedCurve(1))
    expect(readVideos(google).toSorted()).toEqual(videoIds)
  })

  test('a video under 28 days old read yesterday is read again today, its points and read time replaced', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-daily', 'UC-curves-daily')
    await subscribe(worker, channelId)
    uploadsAt(google, 'UC-curves-daily', [published('young', daysBefore(5), 0.8)])
    await seedRead(worker, channelId, 'young', daysBefore(1))

    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(await storedCurves(worker, channelId)).toEqual({
      curves: { young: storedCurve(0.8) },
      readAts: [today.toISOString()],
    })
    expect(await storedReads(worker, channelId)).toEqual({ young: today.toISOString() })
  })

  test('a video under 28 days old read earlier today is not read again', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-today', 'UC-curves-today')
    await subscribe(worker, channelId)
    uploadsAt(google, 'UC-curves-today', [published('young', daysBefore(5), 0.8)])
    const earlier = new Date('2026-11-17T01:00:00.000Z')
    await seedRead(worker, channelId, 'young', earlier)

    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(google.analyticsRequests).toEqual([])
    expect(await storedCurves(worker, channelId)).toEqual({
      curves: { young: storedCurve(0.9) },
      readAts: [earlier.toISOString()],
    })
  })

  test('a video 28 days old or more is read again once its last read is 30 days old, not before', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-monthly', 'UC-monthly')
    await subscribe(worker, channelId)
    uploadsAt(google, 'UC-monthly', [
      published('read-29-days-ago', daysBefore(60)),
      published('read-30-days-ago', daysBefore(60)),
    ])
    await seedRead(worker, channelId, 'read-29-days-ago', daysBefore(29))
    await seedRead(worker, channelId, 'read-30-days-ago', daysBefore(30))

    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(readVideos(google)).toEqual(['read-30-days-ago'])
    expect(await storedReads(worker, channelId)).toEqual({
      'read-29-days-ago': daysBefore(29).toISOString(),
      'read-30-days-ago': today.toISOString(),
    })
  })

  test('a channel of 3,030 older videos, read in an even spread over the last 30 days, reads again every one whose last read is 30 days old', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-large', 'UC-curves-large')
    await subscribe(worker, channelId)
    // 101 videos last read on each of the 30 days before today, so 101 are due today.
    const videos = Array.from({ length: 3030 }, (_, i) => ({
      videoId: `video-${String(i).padStart(4, '0')}`,
      readAt: daysBefore(30 - Math.floor(i / 101)),
    }))
    uploadsAt(
      google,
      'UC-curves-large',
      videos.map(({ videoId }) => published(videoId, daysBefore(60))),
    )
    await worker.forChannel(channelId, (tx) =>
      tx.sql
        .insert(retentionCurveReads)
        .values(videos.map(({ videoId, readAt }) => ({ channelId, videoId, readAt }))),
    )

    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(readVideos(google).toSorted()).toEqual(
      videos.filter(({ readAt }) => readAt <= daysBefore(30)).map(({ videoId }) => videoId),
    )
  })

  test('a channel with 100 videos under 28 days old still reads an older video whose last read is 30 days old', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-busy', 'UC-curves-busy')
    await subscribe(worker, channelId)
    const youngIds = Array.from({ length: 100 }, (_, i) => `young-${String(i).padStart(3, '0')}`)
    uploadsAt(google, 'UC-curves-busy', [
      ...youngIds.map((videoId, i) => published(videoId, daysBefore(2 + i / 4))),
      published('older', daysBefore(60)),
    ])
    await worker.forChannel(channelId, (tx) =>
      tx.sql
        .insert(retentionCurveReads)
        .values([
          ...youngIds.map((videoId) => ({ channelId, videoId, readAt: daysBefore(1) })),
          { channelId, videoId: 'older', readAt: daysBefore(30) },
        ]),
    )

    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(readVideos(google).toSorted()).toEqual([...youngIds, 'older'].toSorted())
  })

  test('a run with more videos due than it reads takes the daily reads first, oldest read first, then the never-read videos newest first, and leaves the monthly reads', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-order', 'UC-curves-order')
    await subscribe(worker, channelId)
    // 60 videos under 28 days and 120 older ones: the run reads 100 of the 180 due.
    const ids = (group: string) =>
      Array.from({ length: 60 }, (_, i) => `${group}-${String(i).padStart(2, '0')}`)
    const daily = ids('daily')
    const neverRead = ids('never')
    const monthly = ids('monthly')
    uploadsAt(google, 'UC-curves-order', [
      ...daily.map((videoId, i) => published(videoId, daysBefore(2 + i / 4))),
      ...neverRead.map((videoId, i) => published(videoId, daysBefore(40 + i))),
      ...monthly.map((videoId) => published(videoId, daysBefore(100))),
    ])
    await worker.forChannel(channelId, (tx) =>
      tx.sql.insert(retentionCurveReads).values([
        // Read yesterday, a minute apart, daily-00 first.
        ...daily.map((videoId, i) => ({
          channelId,
          videoId,
          readAt: new Date(daysBefore(1).getTime() + i * 60_000),
        })),
        ...monthly.map((videoId, i) => ({ channelId, videoId, readAt: daysBefore(30 + i) })),
      ]),
    )

    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(readVideos(google)).toEqual([...daily, ...neverRead.slice(0, 40)])
  })

  test('a video read daily while under 28 days old is not read the day it passes 28 days', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-cross', 'UC-curves-cross')
    await subscribe(worker, channelId)
    // 26 days and 18 hours old today, 27 days and 18 hours tomorrow, 28 days and 18 hours after.
    const publishedAt = new Date('2026-10-21T18:00:00.000Z')
    uploadsAt(google, 'UC-curves-cross', [published('crossing', publishedAt)])
    await seedRead(worker, channelId, 'crossing', daysBefore(1))

    await handlers.retentionCurveRefresh(worker, { channelId })
    setNow(clock, google, daysAfter(1))
    await handlers.retentionCurveRefresh(worker, { channelId })
    setNow(clock, google, daysAfter(2))
    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(readVideos(google)).toEqual(['crossing', 'crossing'])
    expect(await storedReads(worker, channelId)).toEqual({
      crossing: daysAfter(1).toISOString(),
    })
  })

  test('a free channel reads and stores no curve', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-free', 'UC-curves-free')
    uploadsAt(google, 'UC-curves-free', [published('v1', daysBefore(3))])
    const dataCalls = google.dataApiRequests.length

    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(google.dataApiRequests.slice(dataCalls)).toEqual([])
    expect(google.analyticsRequests).toEqual([])
    expect(await analyticsUnits(worker, channelId)).toBe(0)
    expect(await storedReads(worker, channelId)).toEqual({})
  })

  test('an ended channel, its purge date ahead, reads no curve and keeps the ones it holds', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-ended', 'UC-curves-ended')
    await worker.forChannel(channelId, (tx) =>
      tx.sql.insert(subscriptions).values({
        channelId,
        stripeCustomerId: `cus_${channelId}`,
        stripeSubscriptionId: `sub_${channelId}`,
        status: 'canceled',
        purgeAfter: daysAfter(30),
        updatedAt: tx.now,
      }),
    )
    uploadsAt(google, 'UC-curves-ended', [published('v1', daysBefore(3))])
    await seedRead(worker, channelId, 'v1', daysBefore(1))

    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(google.analyticsRequests).toEqual([])
    expect(await storedCurves(worker, channelId)).toEqual({
      curves: { v1: storedCurve(0.9) },
      readAts: [daysBefore(1).toISOString()],
    })
  })

  test('a video Google answers no curve for is recorded as read with no points, and is not read again that day', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-none', 'UC-curves-none')
    await subscribe(worker, channelId)
    uploadsAt(google, 'UC-curves-none', [
      { videoId: 'small', title: 'Small', publishedAt: daysBefore(3).toISOString() },
    ])

    await handlers.retentionCurveRefresh(worker, { channelId })
    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(readVideos(google)).toEqual(['small'])
    expect(await storedReads(worker, channelId)).toEqual({ small: today.toISOString() })
    expect(await storedCurves(worker, channelId)).toEqual({ curves: {}, readAts: [] })
  })

  test('a scheduled video is not read, and a private one is', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-sched', 'UC-curves-sched')
    await subscribe(worker, channelId)
    uploadsAt(google, 'UC-curves-sched', [
      { videoId: 'scheduled', title: 'Scheduled', scheduledFor: daysAfter(2).toISOString() },
      { ...published('private', daysBefore(3)), privacyStatus: 'private' },
    ])

    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(readVideos(google)).toEqual(['private'])
  })

  // The Analytics API's usable quota is 90,000 queries, 90% of 100,000, and each read costs 1, so
  // 89,999 spent leave room for the first read only.
  test('a reserved quota ends the run, keeps the curves read before it, and reports nothing', async ({
    web,
    worker,
    clock,
    google,
    keys,
    reporter,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-quota', 'UC-curves-quota')
    await subscribe(worker, channelId)
    uploadsAt(google, 'UC-curves-quota', [
      published('newest', daysBefore(40)),
      published('older', daysBefore(50)),
      published('oldest', daysBefore(60)),
    ])
    await worker.forChannel(channelId, (tx) =>
      tx.sql
        .insert(quotaUsage)
        .values({ api: 'analytics', quotaDay: quotaDayOf(tx.now), units: 89_999 })
        .onConflictDoUpdate({
          target: [quotaUsage.api, quotaUsage.quotaDay],
          set: { units: 89_999 },
        }),
    )

    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(await storedReads(worker, channelId)).toEqual({ newest: today.toISOString() })
    expect(Object.keys((await storedCurves(worker, channelId)).curves)).toEqual(['newest'])
    expect(reporter.reports).toEqual([])
  })

  test('a revoked connection reads nothing and reports nothing', async ({
    web,
    worker,
    clock,
    google,
    keys,
    reporter,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-revoked', 'UC-revoked')
    await subscribe(worker, channelId)
    uploadsAt(google, 'UC-revoked', [published('v1', daysBefore(3))])
    await worker.forChannel(channelId, (tx) =>
      tx.sql
        .update(connections)
        .set({ status: 'revoked' })
        .where(eq(connections.channelId, channelId)),
    )

    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(google.analyticsRequests).toEqual([])
    expect(await storedReads(worker, channelId)).toEqual({})
    expect(reporter.reports).toEqual([])
  })

  test('an Analytics outage keeps what is stored, and reports the failed refresh once, naming only the channel', async ({
    web,
    worker,
    clock,
    google,
    keys,
    reporter,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-down', 'UC-curves-down')
    await subscribe(worker, channelId)
    uploadsAt(google, 'UC-curves-down', [
      published('newer', daysBefore(2)),
      published('older', daysBefore(3)),
    ])
    await seedRead(worker, channelId, 'newer', daysBefore(1))
    await seedRead(worker, channelId, 'older', daysBefore(1))
    google.dropAnalyticsApi()

    await handlers.retentionCurveRefresh(worker, { channelId })

    expect(await storedCurves(worker, channelId)).toEqual({
      curves: { newer: storedCurve(0.9), older: storedCurve(0.9) },
      readAts: [daysBefore(1).toISOString()],
    })
    expect(reporter.reports).toEqual([
      { message: "A channel's retention curve refresh failed", context: { channelId } },
    ])
  })

  // A curve that repeats a point breaks the unique point index, a database error the gateway does
  // not turn into a refusal.
  test('a database error storing one curve keeps the curves read before it, and reaches the job runner', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-dberror', 'UC-dberror')
    await subscribe(worker, channelId)
    const repeated = curve(1)[0] as FakeRetentionPoint
    uploadsAt(google, 'UC-dberror', [
      published('newest', daysBefore(40)),
      published('older', daysBefore(50)),
      { ...published('oldest', daysBefore(60)), retention: [repeated, repeated] },
    ])

    await expect(handlers.retentionCurveRefresh(worker, { channelId })).rejects.toThrow()

    expect(await storedReads(worker, channelId)).toEqual({
      newest: today.toISOString(),
      older: today.toISOString(),
    })
    expect(Object.keys((await storedCurves(worker, channelId)).curves)).toEqual(['newest', 'older'])
  })

  test('a run opens one scope to plan and one per read, never one inside another', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-scopes', 'UC-scopes')
    await subscribe(worker, channelId)
    uploadsAt(google, 'UC-scopes', [
      published('newest', daysBefore(40)),
      published('older', daysBefore(50)),
    ])
    let open = 0
    const openAtEntry: number[] = []
    const counted: WorkerDatabase = {
      forChannel: async (id, work) => {
        open += 1
        openAtEntry.push(open)
        try {
          return await worker.forChannel(id, work)
        } finally {
          open -= 1
        }
      },
      asSystem: (work) => worker.asSystem(work),
    }

    await handlers.retentionCurveRefresh(counted, { channelId })

    expect(openAtEntry).toEqual([1, 1, 1])
    expect(Object.keys(await storedReads(worker, channelId)).sort()).toEqual(['newest', 'older'])
  })

  test('a stored curve holds only the video, its point, the watch ratio and the read time', async ({
    web,
    worker,
    clock,
    google,
    keys,
    handlers,
  }) => {
    setNow(clock, google, today)
    const channelId = await connectedChannel(web, google, keys, 'curves-cols', 'UC-curves-cols')
    await subscribe(worker, channelId)
    uploadsAt(google, 'UC-curves-cols', [published('v1', daysBefore(3))])

    await handlers.retentionCurveRefresh(worker, { channelId })

    const columns = await worker.forChannel(channelId, async (tx) =>
      (
        await tx.sql.execute<{ column_name: string }>(
          sql`select column_name from information_schema.columns where table_name = 'retention_curves' order by column_name`,
        )
      ).rows.map((row) => row.column_name),
    )
    expect(columns).toEqual([
      'audience_watch_ratio',
      'channel_id',
      'elapsed_video_time_ratio',
      'read_at',
      'video_id',
    ])
    expect((await storedCurves(worker, channelId)).curves).toEqual({ v1: storedCurve(1) })
  })
})
