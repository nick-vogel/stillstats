import type { youtube_v3 } from '@googleapis/youtube'
import { hourMs, type ReadDefinition } from '../read-definition.ts'
import { durationSecondsOf } from '../video-duration.ts'

/** Google's documented `status.privacyStatus` values for a video. */
const uploadPrivacies = ['public', 'unlisted', 'private'] as const
export type UploadPrivacy = (typeof uploadPrivacies)[number]

/** One size of a video's thumbnail: its URL, on one of YouTube's ytimg.com image hosts, and width. */
export interface ThumbnailSize {
  url: string
  /** In pixels. */
  width: number
}

export interface Upload {
  videoId: string
  title: string
  /** The medium thumbnail, 320 by 180 pixels, on one of YouTube's ytimg.com image hosts. */
  thumbnailUrl: string | null
  /**
   * Every size of the thumbnail Google answers, narrowest first. Google answers `standard` (640
   * wide) and `maxres` (1280) only for some videos (developers.google.com/youtube/v3/docs/thumbnails).
   */
  thumbnails: ThumbnailSize[]
  /** ISO 8601, when the video was published. Null for a video not yet published. */
  publishedAt: string | null
  /** ISO 8601, when a scheduled video publishes. Null for every other video. */
  scheduledFor: string | null
  /** The video's length in whole seconds. Null when Google gives none or zero. */
  durationSeconds: number | null
  /**
   * Google's privacy status for the video. `private` when Google answers none, one it has not
   * documented, or no video at all, so an upload of unknown privacy never lists as public.
   */
  privacy: UploadPrivacy
  /** Google's `status.embeddable`: whether the video plays in an embedded player. */
  embeddable: boolean
  /** Google's `status.madeForKids`. */
  madeForKids: boolean
}

export interface ChannelUploads {
  /** ISO 8601, when the channel was created. */
  createdAt: string | null
  /** In the uploads playlist's order, which says nothing about publish dates. */
  uploads: Upload[]
}

// A playlistItems.list page takes a maxResults of "0 to 50, inclusive" (playlistItems.list page,
// checked 2026-10-07). A videos.list call by id documents no maximum, and its maxResults, 1 to 50,
// "is not supported for use in conjunction with the id parameter" (videos.list page, checked
// 2026-10-07), so 50 ids a call is an assumption that page size holds for ids too.
const maxItemsPerCall = 50

/** Each size in a playlist item's `snippet.thumbnails` with a URL and a positive whole width. */
function thumbnailSizesOf(
  thumbnails: youtube_v3.Schema$ThumbnailDetails | undefined,
): ThumbnailSize[] {
  return Object.values(thumbnails ?? {})
    .flatMap((size: youtube_v3.Schema$Thumbnail | undefined) => {
      const { url, width } = size ?? {}
      return url && typeof width === 'number' && Number.isInteger(width) && width > 0
        ? [{ url, width }]
        : []
    })
    .sort((a, b) => a.width - b.width)
}

/**
 * Whether the video embeds and whether it is made for kids. Google's defaults stand when it leaves
 * either out: a missing `embeddable` is true and a missing `madeForKids` false (videos resource
 * page, developers.google.com/youtube/v3/docs/videos, checked 2026-11-11).
 */
function playabilityOf(status: youtube_v3.Schema$VideoStatus | undefined): {
  embeddable: boolean
  madeForKids: boolean
} {
  return { embeddable: status?.embeddable ?? true, madeForKids: status?.madeForKids ?? false }
}

function isUploadPrivacy(value: string | null | undefined): value is UploadPrivacy {
  return (uploadPrivacies as readonly (string | null | undefined)[]).includes(value)
}

/**
 * Every upload of the channel, with its privacy, its scheduled time when it has one and its
 * duration. One channels.list call, one playlistItems.list call for each 50 playlist items (more
 * items than uploads when the playlist answers a video twice) and one videos.list call for each 50
 * uploads, each 1 unit, from the Data API's method pages, checked 2026-10-07. The videos.list call asks the
 * `status` part for the privacy, the schedule, whether the video embeds and whether it is made for
 * kids, and the `contentDetails` part beside it for the duration, at no extra unit.
 */
export const uploads: ReadDefinition<Record<string, never>, ChannelUploads> = {
  needs: ['youtube.readonly'],
  // Versioned since an upload gained its duration, then its privacy, then every thumbnail size, then
  // whether it embeds and whether it is made for kids: a value cached in an older shape is never
  // read as the new one.
  cacheKey: () => 'uploads:v5',
  cacheWindowMs: 6 * hourMs,
  async fetch(google) {
    const channel = await google.data(1, async (api) => {
      const response = await api.channels.list({ part: ['snippet', 'contentDetails'], mine: true })
      return response.data.items?.[0]
    })
    const createdAt = channel?.snippet?.publishedAt ?? null
    const playlistId = channel?.contentDetails?.relatedPlaylists?.uploads
    if (!playlistId) return { createdAt, uploads: [] }

    // The uploads playlist can answer one video twice: on 2026-10-08 Nick's channel answered 398
    // items for its 390 uploads, 8 of them twice. Only the first item for each video counts, so
    // each upload is listed once.
    // Either item would do: both items for one video carried the same title and publish time in
    // that read, and the first keeps the playlist's own order.
    const items = new Map<string, youtube_v3.Schema$PlaylistItem>()
    let pageToken: string | undefined
    do {
      const page = await google.data(1, async (api) => {
        const response = await api.playlistItems.list({
          part: ['snippet', 'contentDetails'],
          playlistId,
          maxResults: maxItemsPerCall,
          ...(pageToken ? { pageToken } : {}),
        })
        return response.data
      })
      for (const item of page.items ?? []) {
        const videoId = item.contentDetails?.videoId
        if (videoId && !items.has(videoId)) items.set(videoId, item)
      }
      pageToken = page.nextPageToken ?? undefined
    } while (pageToken)

    // A playlist item does not say a video is scheduled. Only the video's status does: private,
    // with a publishAt, which "can only be set if the video's privacy status is private and the
    // video has never been published" (videos resource page, checked 2026-10-07).
    const videoIds = [...items.keys()]
    const scheduled = new Map<string, string>()
    const privacies = new Map<string, UploadPrivacy>()
    const durations = new Map<string, number | null>()
    const playability = new Map<string, { embeddable: boolean; madeForKids: boolean }>()
    for (let start = 0; start < videoIds.length; start += maxItemsPerCall) {
      const videos = await google.data(1, async (api) => {
        const response = await api.videos.list({
          part: ['status', 'contentDetails'],
          id: videoIds.slice(start, start + maxItemsPerCall),
        })
        return response.data.items ?? []
      })
      for (const { id, status, contentDetails } of videos) {
        if (!id) continue
        const privacy = status?.privacyStatus
        if (isUploadPrivacy(privacy)) privacies.set(id, privacy)
        if (privacy === 'private' && status?.publishAt) {
          scheduled.set(id, status.publishAt)
        }
        durations.set(id, durationSecondsOf(contentDetails?.duration))
        playability.set(id, playabilityOf(status))
      }
    }

    return {
      createdAt,
      uploads: [...items].map(([videoId, { snippet, contentDetails }]) => ({
        videoId,
        title: snippet?.title ?? '',
        thumbnailUrl: snippet?.thumbnails?.medium?.url ?? null,
        thumbnails: thumbnailSizesOf(snippet?.thumbnails),
        publishedAt: contentDetails?.videoPublishedAt ?? null,
        scheduledFor: scheduled.get(videoId) ?? null,
        durationSeconds: durations.get(videoId) ?? null,
        privacy: privacies.get(videoId) ?? 'private',
        ...(playability.get(videoId) ?? playabilityOf(undefined)),
      })),
    }
  },
}
