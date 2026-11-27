import type { VideoRow } from '@creator-analytics/api-types'
import {
  maxVideosPerQuery,
  type ReadRefusal,
  type ReadResult,
  reportingDayOf,
  type Upload,
  type VideoMetrics,
} from '@creator-analytics/youtube-gateway'

/** The metrics of a video with no row in Google's answer: it had no views in the range. */
export const noMetrics: VideoMetrics = {
  engagedViews: 0,
  views: 0,
  averageViewPercentage: 0,
  subscribersGained: 0,
  estimatedMinutesWatched: 0,
}

/**
 * The metrics of a video with no day in Google's answer in a window after publish, where each
 * video's days are added and a percentage does not add.
 */
export const noAddedMetrics: Omit<VideoMetrics, 'averageViewPercentage'> = {
  engagedViews: 0,
  views: 0,
  subscribersGained: 0,
  estimatedMinutesWatched: 0,
}

/**
 * The uploads' video ids as the per-video reads batch them: `maxVideosPerQuery` a query, in the
 * uploads playlist's order. One video's read of the same batch shares the whole list's cache entry.
 */
export function uploadBatchesOf(uploads: Upload[]): string[][] {
  const batches: string[][] = []
  for (let start = 0; start < uploads.length; start += maxVideosPerQuery) {
    batches.push(uploads.slice(start, start + maxVideosPerQuery).map(({ videoId }) => videoId))
  }
  return batches
}

/**
 * A read of every upload, a query a batch of `uploadBatchesOf`, as one map by video id. A video Google answers no row for is absent.
 */
export async function readEveryUpload<V>(
  uploads: Upload[],
  readBatch: (videoIds: string[]) => Promise<ReadResult<Record<string, V>>>,
): Promise<{ ok: true; byVideo: Map<string, V> } | { ok: false; refusal: ReadRefusal }> {
  const byVideo = new Map<string, V>()
  for (const videoIds of uploadBatchesOf(uploads)) {
    const batch = await readBatch(videoIds)
    if (!batch.ok) return batch
    for (const [videoId, value] of Object.entries(batch.value)) byVideo.set(videoId, value)
  }
  return { ok: true, byVideo }
}

/** ISO 8601: when the upload was published, or when a scheduled upload will be. */
export function publishTimeOf(upload: Upload): string | null {
  const time = upload.scheduledFor ?? upload.publishedAt
  return time ? new Date(time).toISOString() : null
}

/** YYYY-MM-DD in Pacific Time: the day the upload was published, or the day it is scheduled for. */
export function publishDayOf(upload: Upload): string | null {
  const time = publishTimeOf(upload)
  return time ? reportingDayOf(new Date(time)) : null
}

/** The video as an answer names it, without its numbers. */
export function videoOf(
  upload: Upload,
): Pick<
  VideoRow,
  'id' | 'title' | 'thumbnailUrl' | 'thumbnails' | 'durationSeconds' | 'publishedAt' | 'scheduled'
> {
  return {
    id: upload.videoId,
    title: upload.title,
    thumbnailUrl: upload.thumbnailUrl,
    thumbnails: upload.thumbnails,
    durationSeconds: upload.durationSeconds,
    publishedAt: publishTimeOf(upload),
    scheduled: upload.scheduledFor !== null,
  }
}

/** What a publish time order reads of a video: its id and its publish time. */
type Published = Pick<VideoRow, 'id' | 'publishedAt'>

/**
 * By the publish time the API reads itself: the uploads playlist's order is not a publish order.
 * Equal times run by id, and a video with no publish time goes last either way.
 */
export function byPublishTime(direction: 1 | -1): (a: Published, b: Published) => number {
  return (a, b) =>
    Number(a.publishedAt === null) - Number(b.publishedAt === null) ||
    direction * (a.publishedAt ?? '').localeCompare(b.publishedAt ?? '') ||
    a.id.localeCompare(b.id)
}

/** Newest first by publish time, ties by id: the list's default order. */
export const newestFirst = byPublishTime(-1)
