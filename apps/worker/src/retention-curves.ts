import {
  connectionRoster,
  type JobData,
  jobDataOf,
  retentionCurveReads,
  retentionCurves,
  type Scoped,
  type WorkerDatabase,
} from '@creator-analytics/database'
import { entitlementOf } from '@creator-analytics/entitlements'
import type { Reporter } from '@creator-analytics/reporter'
import { reportingDayOf, type YouTubeGateway } from '@creator-analytics/youtube-gateway'
import { and, eq } from 'drizzle-orm'

export interface RetentionCurveOptions {
  gateway: Pick<YouTubeGateway, 'read'>
  reporter: Reporter
}

const daySeconds = 24 * 60 * 60
const dayMs = daySeconds * 1000

/** A video younger than this is read again each UTC day, an older one monthly. */
const dailyAgeMs = 28 * dayMs
/** How old an older video's last read is when it is read again. */
const monthlyReadAgeMs = 30 * dayMs
/**
 * The fewest curves one run may read, one Analytics query each, so a channel's backfill spreads
 * across days: a channel of 390 uploads fills in 4.
 */
export const curveReadsPerRun = 100

export function retentionCurveRefreshData(data: JobData) {
  return jobDataOf('retentionCurveRefresh', data, 'channelId')
}

/**
 * The daily retentionCurveRoster job: enqueues a retentionCurveRefresh job for each active
 * connection. Each channel's job is throttled to one per UTC day, so a roster job that runs again
 * that day sends none twice.
 */
export async function enqueueRetentionCurveRefreshes(tx: Scoped<'system'>): Promise<void> {
  for (const { channelId } of await connectionRoster(tx)) {
    await tx.enqueue(
      'retentionCurveRefresh',
      { channelId },
      { throttle: { key: channelId, seconds: daySeconds } },
    )
  }
}

interface Candidate {
  videoId: string
  publishedAt: Date
  lastReadAt: Date | null
}

function utcDayOf(time: Date): string {
  return time.toISOString().slice(0, 10)
}

/**
 * The videos due a read, in the order they are read: a video under 28 days old last read on an
 * earlier UTC day, oldest read first; then each video never read, newest publish first, the
 * backfill; then an older video last read 30 days ago or more, oldest read first.
 */
function isYoung(candidate: Candidate, now: Date): boolean {
  return now.getTime() - candidate.publishedAt.getTime() < dailyAgeMs
}

function dueVideos(candidates: Candidate[], now: Date): Candidate[] {
  const byLastRead = (a: Candidate, b: Candidate) =>
    (a.lastReadAt?.getTime() ?? 0) - (b.lastReadAt?.getTime() ?? 0)
  const young = (c: Candidate) => isYoung(c, now)
  const daily = candidates
    .filter((c) => c.lastReadAt && young(c) && utcDayOf(c.lastReadAt) < utcDayOf(now))
    .sort(byLastRead)
  const neverRead = candidates
    .filter((c) => !c.lastReadAt)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
  const monthly = candidates
    .filter(
      (c) =>
        c.lastReadAt && !young(c) && now.getTime() - c.lastReadAt.getTime() >= monthlyReadAgeMs,
    )
    .sort(byLastRead)
  return [...daily, ...neverRead, ...monthly]
}

/**
 * The curves one run reads: one for each video under 28 days, and a 30th of the older ones, so each
 * older video is read again within its month however many the channel holds. Never fewer than
 * `curveReadsPerRun`.
 */
function readsPerRun(candidates: Candidate[], now: Date): number {
  const young = candidates.filter((c) => isYoung(c, now)).length
  const older = candidates.length - young
  return Math.max(curveReadsPerRun, young + Math.ceil(older / (monthlyReadAgeMs / dayMs)))
}

/**
 * The retentionCurveRefresh job: a paid channel reads the audience retention curve of each video
 * that is due, up to `readsPerRun`, over the video's lifetime, and stores it in place of the
 * one it held. A video Google answers no curve for is recorded as read, with no points. A free
 * channel reads nothing, an ended one in its purge window included, and keeps what it holds. The
 * run is planned in one scope, then each video's read and what it stores commit in a scope of their
 * own, so the run holds the quota row every channel shares for one read at a time. Any refusal ends
 * the run, and every video read before it stays stored. A Google failure is reported, naming only
 * the channel; a reserved quota and a refused connection are not, since the next day runs again and
 * a revoked channel is being deleted.
 */
export function refreshRetentionCurves({ gateway, reporter }: RetentionCurveOptions) {
  return async (worker: WorkerDatabase, { channelId }: { channelId: string }): Promise<void> => {
    const refused = (refusal: string) => {
      if (refusal !== 'google_failed') return
      reporter.report({
        message: "A channel's retention curve refresh failed",
        context: { channelId },
      })
    }

    const plan = await worker.forChannel(
      channelId,
      async (tx): Promise<{ due: Candidate[] } | { refusal: string }> => {
        if ((await entitlementOf(tx, channelId)).tier !== 'paid') return { due: [] }
        const channel = await gateway.read(tx, channelId, 'uploads', {})
        if (!channel.ok) return { refusal: channel.refusal }
        const lastReads = new Map(
          (
            await tx.sql
              .select({ videoId: retentionCurveReads.videoId, readAt: retentionCurveReads.readAt })
              .from(retentionCurveReads)
              .where(eq(retentionCurveReads.channelId, channelId))
          ).map(({ videoId, readAt }) => [videoId, readAt]),
        )
        // A scheduled or unpublished video has no publish time, and no curve yet.
        const candidates = channel.value.uploads.flatMap(({ videoId, publishedAt }) =>
          publishedAt === null
            ? []
            : [
                {
                  videoId,
                  publishedAt: new Date(publishedAt),
                  lastReadAt: lastReads.get(videoId) ?? null,
                },
              ],
        )
        return { due: dueVideos(candidates, tx.now).slice(0, readsPerRun(candidates, tx.now)) }
      },
    )
    if ('refusal' in plan) return refused(plan.refusal)

    for (const { videoId, publishedAt } of plan.due) {
      const refusal = await worker.forChannel(channelId, async (tx) => {
        const read = await gateway.read(tx, channelId, 'audienceRetention', {
          videoId,
          startDate: reportingDayOf(publishedAt),
          endDate: reportingDayOf(tx.now),
        })
        if (!read.ok) return read.refusal
        const readAt = read.fetchedAt
        await tx.sql
          .delete(retentionCurves)
          .where(
            and(eq(retentionCurves.channelId, channelId), eq(retentionCurves.videoId, videoId)),
          )
        if (read.value.length > 0) {
          await tx.sql.insert(retentionCurves).values(
            read.value.map(({ elapsedVideoTimeRatio, audienceWatchRatio }) => ({
              channelId,
              videoId,
              elapsedVideoTimeRatio,
              audienceWatchRatio,
              readAt,
            })),
          )
        }
        await tx.sql
          .insert(retentionCurveReads)
          .values({ channelId, videoId, readAt })
          .onConflictDoUpdate({
            target: [retentionCurveReads.channelId, retentionCurveReads.videoId],
            set: { readAt },
          })
        return null
      })
      if (refusal) return refused(refusal)
    }
  }
}
