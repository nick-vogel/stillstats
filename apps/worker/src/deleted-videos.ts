import {
  connectionRoster,
  type JobData,
  jobDataOf,
  reachHistory,
  retentionCurveReads,
  retentionCurves,
  type Scoped,
} from '@creator-analytics/database'
import type { Reporter } from '@creator-analytics/reporter'
import type { YouTubeGateway } from '@creator-analytics/youtube-gateway'
import { and, eq, inArray } from 'drizzle-orm'
import { union } from 'drizzle-orm/pg-core'

export interface DeletedVideoOptions {
  gateway: Pick<YouTubeGateway, 'existingVideos'>
  reporter: Reporter
}

const daySeconds = 24 * 60 * 60

export function deletedVideoCheckData(data: JobData) {
  return jobDataOf('deletedVideoCheck', data, 'channelId')
}

/**
 * The daily deletedVideoCheckRoster job: enqueues a deletedVideoCheck job for each active
 * connection. Each channel's job is throttled to one per UTC day, so a roster job that runs again
 * that day sends none twice.
 */
export async function enqueueDeletedVideoChecks(tx: Scoped<'system'>): Promise<void> {
  for (const { channelId } of await connectionRoster(tx)) {
    await tx.enqueue(
      'deletedVideoCheck',
      { channelId },
      { throttle: { key: channelId, seconds: daySeconds } },
    )
  }
}

/**
 * The deletedVideoCheck job, which Developer Policies III.E.4.b asks for every 30 days: asks Google
 * which videos of the channel's reach history and retention curves still exist, and deletes the
 * history, the curve and the curve's read of every video it does not answer. A channel with
 * neither makes no call. The days the history holds stay held, so its start and the next
 * download's cursor do not move. A failed check deletes nothing and runs again the next day; it is
 * reported, unless the connection is revoked, since that channel is being deleted.
 */
export function checkDeletedVideos({ gateway, reporter }: DeletedVideoOptions) {
  return async (tx: Scoped<'channel'>, { channelId }: { channelId: string }): Promise<void> => {
    // Every video with a curve has a read, so the reads name every video the curves hold.
    const held = (
      await union(
        tx.sql
          .select({ videoId: reachHistory.videoId })
          .from(reachHistory)
          .where(eq(reachHistory.channelId, channelId)),
        tx.sql
          .select({ videoId: retentionCurveReads.videoId })
          .from(retentionCurveReads)
          .where(eq(retentionCurveReads.channelId, channelId)),
      )
    ).map(({ videoId }) => videoId)
    if (held.length === 0) return
    const existing = await gateway.existingVideos(tx, channelId, held)
    if (!existing.ok) {
      if (existing.refusal === 'connection_revoked') return
      reporter.report({ message: "A channel's deleted video check failed", context: { channelId } })
      return
    }
    const deleted = held.filter((videoId) => !existing.videoIds.has(videoId))
    if (deleted.length === 0) return
    await tx.sql
      .delete(reachHistory)
      .where(and(eq(reachHistory.channelId, channelId), inArray(reachHistory.videoId, deleted)))
    await tx.sql
      .delete(retentionCurves)
      .where(
        and(eq(retentionCurves.channelId, channelId), inArray(retentionCurves.videoId, deleted)),
      )
    await tx.sql
      .delete(retentionCurveReads)
      .where(
        and(
          eq(retentionCurveReads.channelId, channelId),
          inArray(retentionCurveReads.videoId, deleted),
        ),
      )
  }
}
