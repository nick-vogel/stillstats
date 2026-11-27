// Limits: Google is the fake Google server, which leaves out of a `videos.list` answer every id the
// channel does not upload. The Data API's page does not say whether Google answers a deleted
// video's id that way or with a 404 `videoNotFound`, so these tests cannot prove that a video
// deleted on YouTube loses its history; a deleted video on Nick's walk of a paid channel on
// production (#791) covers it. They run each handler the way `work` does, inside the test's
// transaction; pg-boss's cron pass sending the roster job at 05:00 UTC is outside them, and the
// schedules test reads back the stored schedule.
import {
  connections,
  quotaUsage,
  reachHistory,
  reachHistoryDays,
  retentionCurveReads,
  retentionCurves,
  type WorkerDatabase,
} from '@creator-analytics/database'
import type { FakeGoogle, FakeUpload } from '@creator-analytics/fake-google'
import { quotaDayOf } from '@creator-analytics/youtube-gateway'
import { asc } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { connectedChannel, test } from './reporting-harness.ts'

const days = ['2026-11-14', '2026-11-15']

/** The channel's history holds each video on each of `days`, from YouTube search and from browse. */
async function seedHistory(
  worker: WorkerDatabase,
  channelId: string,
  videoIds: string[],
): Promise<void> {
  await worker.forChannel(channelId, async (tx) => {
    await tx.sql
      .insert(reachHistoryDays)
      .values(
        days.map((day) => ({ channelId, day, reportCreatedAt: new Date(`${day}T10:00:00Z`) })),
      )
    await tx.sql.insert(reachHistory).values(
      videoIds.flatMap((videoId) =>
        days.flatMap((day) =>
          [3, 5].map((trafficSourceType) => ({
            channelId,
            videoId,
            day,
            trafficSourceType,
            impressions: 100,
            ctr: 0.05,
          })),
        ),
      ),
    )
  })
}

/** The video ids the channel's history holds, each with how many rows it holds. */
function storedVideos(worker: WorkerDatabase, channelId: string) {
  return worker.forChannel(channelId, async (tx) => {
    const rows = await tx.sql
      .select({ videoId: reachHistory.videoId })
      .from(reachHistory)
      .orderBy(asc(reachHistory.videoId))
    const counts: Record<string, number> = {}
    for (const { videoId } of rows) counts[videoId] = (counts[videoId] ?? 0) + 1
    return counts
  })
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

/** The channel holds a retention curve of each video, two points each, and its read. */
async function seedCurves(
  worker: WorkerDatabase,
  channelId: string,
  videoIds: string[],
): Promise<void> {
  await worker.forChannel(channelId, async (tx) => {
    const readAt = new Date('2026-11-15T10:00:00Z')
    await tx.sql
      .insert(retentionCurveReads)
      .values(videoIds.map((videoId) => ({ channelId, videoId, readAt })))
    await tx.sql.insert(retentionCurves).values(
      videoIds.flatMap((videoId) =>
        [0.5, 1].map((elapsedVideoTimeRatio) => ({
          channelId,
          videoId,
          elapsedVideoTimeRatio,
          audienceWatchRatio: 0.4,
          readAt,
        })),
      ),
    )
  })
}

/** The video ids the channel's curves hold, each with how many points, and the reads it holds. */
function storedCurves(worker: WorkerDatabase, channelId: string) {
  return worker.forChannel(channelId, async (tx) => {
    const points: Record<string, number> = {}
    for (const { videoId } of await tx.sql
      .select({ videoId: retentionCurves.videoId })
      .from(retentionCurves)) {
      points[videoId] = (points[videoId] ?? 0) + 1
    }
    const reads = (
      await tx.sql
        .select({ videoId: retentionCurveReads.videoId })
        .from(retentionCurveReads)
        .orderBy(asc(retentionCurveReads.videoId))
    ).map(({ videoId }) => videoId)
    return { points, reads }
  })
}

function uploadsAt(google: FakeGoogle, youtubeChannelId: string, uploads: FakeUpload[]): void {
  google.setChannel(youtubeChannelId, { createdAt: '2020-01-01T00:00:00Z', uploads })
}

/** `count` video ids, more than one `videos.list` call of 50 ids can ask. */
function manyVideoIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `video-${String(i).padStart(3, '0')}`)
}

/** The ids each recorded `videos.list` call asked, one list per call. */
function askedVideoIds(google: FakeGoogle): string[][] {
  return google.dataApiRequests
    .filter((url) => url.pathname === '/youtube/v3/videos')
    .map((url) => url.searchParams.getAll('id').flatMap((ids) => ids.split(',')))
}

describe('seam 2: the daily check for videos deleted on YouTube', () => {
  test('a video missing from Google loses its history, every day and traffic source of it, and a public, a private and an unlisted video keep theirs', async ({
    web,
    worker,
    google,
    keys,
    handlers,
  }) => {
    const channelId = await connectedChannel(web, google, keys, 'deleted-a', 'UC-deleted-a')
    uploadsAt(google, 'UC-deleted-a', [
      { videoId: 'public', title: 'Public' },
      { videoId: 'private', title: 'Private', privacyStatus: 'private' },
      { videoId: 'unlisted', title: 'Unlisted', privacyStatus: 'unlisted' },
    ])
    await seedHistory(worker, channelId, ['public', 'private', 'unlisted', 'deleted'])

    await handlers.deletedVideoCheck(worker, { channelId })

    expect(await storedVideos(worker, channelId)).toEqual({ private: 4, public: 4, unlisted: 4 })
    expect(await storedDays(worker, channelId)).toEqual(days)
  })

  test("another channel's history is untouched, a video its own uploads lack included, when only the first channel's check runs", async ({
    web,
    worker,
    google,
    keys,
    handlers,
  }) => {
    const checked = await connectedChannel(web, google, keys, 'deleted-b', 'UC-deleted-b')
    const other = await connectedChannel(web, google, keys, 'deleted-c', 'UC-deleted-c')
    uploadsAt(google, 'UC-deleted-b', [{ videoId: 'kept', title: 'Kept' }])
    uploadsAt(google, 'UC-deleted-c', [{ videoId: 'kept', title: 'Kept' }])
    await seedHistory(worker, checked, ['kept', 'deleted'])
    await seedHistory(worker, other, ['kept', 'deleted'])

    await handlers.deletedVideoCheck(worker, { channelId: checked })

    expect({
      checked: await storedVideos(worker, checked),
      other: await storedVideos(worker, other),
    }).toEqual({ checked: { kept: 4 }, other: { deleted: 4, kept: 4 } })
  })

  // Only the system scope reads the connection roster, and only a channel's own scope reads and
  // deletes its history, so a roster or a check run in any other scope deletes nothing.
  test('the daily roster job checks every connected channel, each in its own scope, and none with a revoked connection', async ({
    web,
    worker,
    findJobs,
    google,
    keys,
    handlers,
  }) => {
    const first = await connectedChannel(web, google, keys, 'deleted-roster-a', 'UC-roster-a')
    const second = await connectedChannel(web, google, keys, 'deleted-roster-b', 'UC-roster-b')
    const revoked = await connectedChannel(web, google, keys, 'deleted-roster-c', 'UC-roster-c')
    for (const id of ['UC-roster-a', 'UC-roster-b', 'UC-roster-c']) {
      uploadsAt(google, id, [{ videoId: 'kept', title: 'Kept' }])
    }
    for (const channelId of [first, second, revoked]) {
      await seedHistory(worker, channelId, ['kept', 'deleted'])
    }
    await worker.forChannel(revoked, (tx) => tx.sql.update(connections).set({ status: 'revoked' }))

    // A scheduled job carries no data.
    await handlers.deletedVideoCheckRoster(worker, {})
    for (const job of await findJobs('deletedVideoCheck')) {
      await handlers.deletedVideoCheck(worker, job.data)
    }

    expect({
      first: await storedVideos(worker, first),
      second: await storedVideos(worker, second),
      revoked: await storedVideos(worker, revoked),
    }).toEqual({ first: { kept: 4 }, second: { kept: 4 }, revoked: { deleted: 4, kept: 4 } })
  })

  test('a roster job run twice in a UTC day sends each channel one check', async ({
    web,
    worker,
    findJobs,
    google,
    keys,
    handlers,
  }) => {
    await connectedChannel(web, google, keys, 'deleted-twice', 'UC-deleted-twice')

    await handlers.deletedVideoCheckRoster(worker, {})
    await handlers.deletedVideoCheckRoster(worker, {})

    expect(await findJobs('deletedVideoCheck')).toHaveLength(1)
  })

  test('a history of more videos than one call asks keeps every video Google answers, asking each id once in calls of 50', async ({
    web,
    worker,
    google,
    keys,
    handlers,
  }) => {
    const channelId = await connectedChannel(web, google, keys, 'deleted-many', 'UC-deleted-many')
    const videoIds = manyVideoIds(101)
    uploadsAt(
      google,
      'UC-deleted-many',
      videoIds.map((videoId) => ({ videoId, title: videoId })),
    )
    await seedHistory(worker, channelId, videoIds)

    await handlers.deletedVideoCheck(worker, { channelId })

    expect(await storedVideos(worker, channelId)).toEqual(
      Object.fromEntries(videoIds.map((videoId) => [videoId, 4])),
    )
    const asked = askedVideoIds(google)
    expect(asked.map((ids) => ids.length).sort((a, b) => b - a)).toEqual([50, 50, 1])
    expect(asked.flat().sort()).toEqual(videoIds)
  })

  // The data API's usable quota is 9,000 units, 90% of 10,000, and each call costs 1, so 8,999
  // units spent leave room for the first call only.
  test('a check refused after its first call of 50 ids deletes nothing, a video Google no longer holds included', async ({
    web,
    worker,
    google,
    keys,
    reporter,
    handlers,
  }) => {
    const channelId = await connectedChannel(web, google, keys, 'deleted-cut', 'UC-deleted-cut')
    const videoIds = manyVideoIds(60)
    uploadsAt(
      google,
      'UC-deleted-cut',
      videoIds.slice(1).map((videoId) => ({ videoId, title: videoId })),
    )
    await seedHistory(worker, channelId, videoIds)
    await worker.forChannel(channelId, async (tx) => {
      await tx.sql
        .insert(quotaUsage)
        .values({ api: 'data', quotaDay: quotaDayOf(tx.now), units: 8_999 })
        .onConflictDoUpdate({
          target: [quotaUsage.api, quotaUsage.quotaDay],
          set: { units: 8_999 },
        })
    })

    await handlers.deletedVideoCheck(worker, { channelId })

    expect(askedVideoIds(google)).toHaveLength(1)
    expect(await storedVideos(worker, channelId)).toEqual(
      Object.fromEntries(videoIds.map((videoId) => [videoId, 4])),
    )
    expect(reporter.reports).toEqual([
      { message: "A channel's deleted video check failed", context: { channelId } },
    ])
  })

  test('a channel with no history makes no Data API call', async ({
    web,
    worker,
    google,
    keys,
    handlers,
  }) => {
    const channelId = await connectedChannel(web, google, keys, 'deleted-free', 'UC-deleted-free')
    uploadsAt(google, 'UC-deleted-free', [{ videoId: 'kept', title: 'Kept' }])
    const before = google.dataApiRequests.length

    await handlers.deletedVideoCheck(worker, { channelId })

    expect(google.dataApiRequests.slice(before)).toEqual([])
  })

  test('a Data API outage deletes nothing, and reports the failed check once, naming only the channel', async ({
    web,
    worker,
    google,
    keys,
    reporter,
    handlers,
  }) => {
    const channelId = await connectedChannel(web, google, keys, 'deleted-down', 'UC-deleted-down')
    uploadsAt(google, 'UC-deleted-down', [{ videoId: 'kept', title: 'Kept' }])
    await seedHistory(worker, channelId, ['kept', 'deleted'])
    google.dropDataApi('/youtube/v3/videos')

    await handlers.deletedVideoCheck(worker, { channelId })

    expect(await storedVideos(worker, channelId)).toEqual({ deleted: 4, kept: 4 })
    expect(reporter.reports).toEqual([
      { message: "A channel's deleted video check failed", context: { channelId } },
    ])
  })

  test('a video held only in the retention curves is asked about, and loses its curve and its read once deleted, while one that still exists keeps them', async ({
    web,
    worker,
    google,
    keys,
    handlers,
  }) => {
    const channelId = await connectedChannel(web, google, keys, 'deleted-curves', 'UC-del-curves')
    uploadsAt(google, 'UC-del-curves', [
      { videoId: 'kept', title: 'Kept' },
      { videoId: 'small', title: 'Small' },
    ])
    await seedHistory(worker, channelId, ['kept'])
    await seedCurves(worker, channelId, ['kept', 'deleted'])
    // A video too small for a curve has its read and no points.
    await worker.forChannel(channelId, (tx) =>
      tx.sql
        .insert(retentionCurveReads)
        .values({ channelId, videoId: 'small', readAt: new Date('2026-11-15T10:00:00Z') }),
    )

    await handlers.deletedVideoCheck(worker, { channelId })

    expect(askedVideoIds(google).flat().sort()).toEqual(['deleted', 'kept', 'small'])
    expect(await storedCurves(worker, channelId)).toEqual({
      points: { kept: 2 },
      reads: ['kept', 'small'],
    })
    expect(await storedVideos(worker, channelId)).toEqual({ kept: 4 })
  })

  test('a channel with curves and no reach history still has its deleted videos checked', async ({
    web,
    worker,
    google,
    keys,
    handlers,
  }) => {
    const channelId = await connectedChannel(web, google, keys, 'deleted-only', 'UC-del-only')
    uploadsAt(google, 'UC-del-only', [{ videoId: 'kept', title: 'Kept' }])
    await seedCurves(worker, channelId, ['kept', 'deleted'])

    await handlers.deletedVideoCheck(worker, { channelId })

    expect(await storedCurves(worker, channelId)).toEqual({
      points: { kept: 2 },
      reads: ['kept'],
    })
  })
})
