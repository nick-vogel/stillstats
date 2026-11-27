import type { VideoFormat, VideoFormatFilter } from '@creator-analytics/api-types'
import type {
  CreatorContentType,
  DateRange,
  ReadRefusal,
  Upload,
} from '@creator-analytics/youtube-gateway'
import type { ReadChannel } from './freshness.ts'
import { uploadBatchesOf } from './uploads.ts'

// Any other content type, such as Google's documented `story` and `unspecified`, gives no format,
// so the video lists under `all` only (the epic's story 12).
const formatOfContentType: Partial<Record<CreatorContentType, VideoFormat>> = {
  videoOnDemand: 'video',
  shorts: 'short',
  liveStream: 'live',
}

export function formatOf(contentType: CreatorContentType | undefined): VideoFormat | null {
  return contentType === undefined ? null : (formatOfContentType[contentType] ?? null)
}

/** Whether a video of the format passes the filter: `all` passes every one, none included. */
export function isOfFormat(videoFormat: VideoFormat | null, filter: VideoFormatFilter): boolean {
  return filter === 'all' || videoFormat === filter
}

/**
 * One video's lifetime format, read as the video list reads it: the content types of the list's
 * batch that holds the video, over the same lifetime range, so the read shares the list's cache
 * entry and a detail opened from the list costs no query. Null when Google answers the video no
 * content type row, or one that gives no format.
 */
export async function readVideoFormat(
  readChannel: ReadChannel,
  uploads: Upload[],
  videoId: string,
  lifetime: DateRange,
): Promise<{ ok: true; format: VideoFormat | null } | { ok: false; refusal: ReadRefusal }> {
  const videoIds = uploadBatchesOf(uploads).find((batch) => batch.includes(videoId))
  if (!videoIds) return { ok: true, format: null }
  const contentTypes = await readChannel('videoContentTypes', { ...lifetime, videoIds })
  if (!contentTypes.ok) return contentTypes
  return { ok: true, format: formatOf(contentTypes.value[videoId]) }
}
