import type { RetentionCurvesAnswer, StoredRetentionCurve } from '@creator-analytics/api-types'
import { retentionCurveReads, retentionCurves, type Scoped } from '@creator-analytics/database'
import { entitlementOf, historyReadable } from '@creator-analytics/entitlements'
import type { ReadRefusal, YouTubeGateway } from '@creator-analytics/youtube-gateway'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { publishTimeOf } from './uploads.ts'

/** Why a curves read is refused: the gateway's refusals, or a video the channel does not hold. */
export type RetentionCurvesRefusal = ReadRefusal | 'video_not_found'

/**
 * The stored audience retention curves of the listed videos, in the order `ids` lists them, with
 * when each was read, and how many of the channel's published uploads the daily refresh has never
 * read (`unread`), null for an ended channel, which the refresh no longer reads. The stored curves are history, so a channel whose history is not readable, free
 * or ended past its purge date, is refused with `sort_without_history`, the refusal Pro sorts use.
 * The connection is checked first, so another user's channel is `not_connected`, and the check and
 * the refusal spend no Google request. The uploads read is the only Google read, cached as the video
 * list's: it names each video, and refuses one the channel does not hold with `video_not_found`.
 * No Analytics query: the curves come from the two tables the refresh writes.
 */
export async function readRetentionCurves(
  gateway: Pick<YouTubeGateway, 'read' | 'connectionRefusal'>,
  tx: Scoped<'user'>,
  channelId: string,
  ids: readonly string[],
): Promise<
  | { ok: true; answer: RetentionCurvesAnswer }
  | { ok: false; refusal: RetentionCurvesRefusal }
  | { ok: false; error: 'sort_without_history' }
> {
  const connection = await gateway.connectionRefusal(tx, channelId, 'uploads')
  if (connection) return { ok: false, refusal: connection }
  const entitlement = await entitlementOf(tx, channelId)
  if (!historyReadable(entitlement)) {
    return { ok: false, error: 'sort_without_history' }
  }

  const channel = await gateway.read(tx, channelId, 'uploads', {})
  if (!channel.ok) return channel
  const uploads = new Map(channel.value.uploads.map((upload) => [upload.videoId, upload]))
  if (ids.some((id) => !uploads.has(id))) return { ok: false, refusal: 'video_not_found' }

  const reads = await tx.sql
    .select({ videoId: retentionCurveReads.videoId, readAt: retentionCurveReads.readAt })
    .from(retentionCurveReads)
    .where(eq(retentionCurveReads.channelId, channelId))
  const readAtOf = new Map(reads.map(({ videoId, readAt }) => [videoId, readAt]))
  const points =
    ids.length === 0
      ? []
      : await tx.sql
          .select({
            videoId: retentionCurves.videoId,
            elapsedVideoTimeRatio: retentionCurves.elapsedVideoTimeRatio,
            audienceWatchRatio: retentionCurves.audienceWatchRatio,
          })
          .from(retentionCurves)
          .where(
            and(
              eq(retentionCurves.channelId, channelId),
              inArray(retentionCurves.videoId, [...ids]),
            ),
          )
          .orderBy(asc(retentionCurves.elapsedVideoTimeRatio))

  const curves = ids.flatMap((id): StoredRetentionCurve[] => {
    const upload = uploads.get(id)
    if (!upload) return []
    return [
      {
        video: {
          id,
          title: upload.title,
          durationSeconds: upload.durationSeconds,
          publishedAt: publishTimeOf(upload),
        },
        readAt: readAtOf.get(id)?.toISOString() ?? null,
        points: points
          .filter(({ videoId }) => videoId === id)
          .map(({ elapsedVideoTimeRatio, audienceWatchRatio }) => ({
            elapsedVideoTimeRatio,
            audienceWatchRatio,
          })),
      },
    ]
  })
  // As the refresh reads: a paid channel only, and a scheduled or unpublished upload has no curve.
  const unread =
    entitlement.tier === 'paid'
      ? channel.value.uploads.filter(
          ({ videoId, publishedAt }) => publishedAt !== null && !readAtOf.has(videoId),
        ).length
      : null
  return { ok: true, answer: { curves, unread } }
}

/** The ids of the channel's videos with a stored curve that has points: those a comparison draws. */
export async function drawableVideoIdsOf(
  tx: Scoped<'user'>,
  channelId: string,
): Promise<ReadonlySet<string>> {
  const rows = await tx.sql
    .selectDistinct({ videoId: retentionCurves.videoId })
    .from(retentionCurves)
    .where(eq(retentionCurves.channelId, channelId))
  return new Set(rows.map(({ videoId }) => videoId))
}
