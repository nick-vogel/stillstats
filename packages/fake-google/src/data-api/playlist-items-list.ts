import {
  type Answer,
  type Asked,
  channelOf,
  type FakeThumbnailSize,
  type FakeUpload,
  googleError,
  uploadsPlaylistOf,
} from '../channel-data.ts'

// Each size's file name, width and height, from developers.google.com/youtube/v3/docs/thumbnails.
const thumbnailFiles: Record<FakeThumbnailSize, [name: string, width: number, height: number]> = {
  default: ['default', 120, 90],
  medium: ['mqdefault', 320, 180],
  high: ['hqdefault', 480, 360],
  standard: ['sddefault', 640, 480],
  maxres: ['maxresdefault', 1280, 720],
}

function thumbnails({ videoId, thumbnailSizes = ['default', 'medium', 'high'] }: FakeUpload) {
  return Object.fromEntries(
    thumbnailSizes.map((size) => {
      const [name, width, height] = thumbnailFiles[size]
      return [size, { url: `https://i.ytimg.com/vi/${videoId}/${name}.jpg`, width, height }]
    }),
  )
}

function playlistItem(upload: FakeUpload) {
  return {
    kind: 'youtube#playlistItem',
    id: `item-${upload.videoId}`,
    snippet: {
      title: upload.title,
      thumbnails: thumbnails(upload),
      resourceId: { kind: 'youtube#video', videoId: upload.videoId },
    },
    contentDetails: {
      videoId: upload.videoId,
      ...(upload.publishedAt ? { videoPublishedAt: upload.publishedAt } : {}),
    },
  }
}

/**
 * `playlistItems.list` of the signed-in channel's uploads playlist, a page at a time. The page
 * token is the offset of the page's first item.
 */
export function playlistItemsList(asked: Asked): Answer {
  const { query, youtubeChannelId } = asked
  if (!youtubeChannelId || query.get('playlistId') !== uploadsPlaylistOf(youtubeChannelId)) {
    return googleError(404, 'The fake knows the signed-in channel uploads playlist only')
  }
  // Google's documented range for maxResults is 0 to 50, with 5 as the default.
  const pageSize = Number(query.get('maxResults') ?? '5')
  if (!Number.isInteger(pageSize) || pageSize < 0 || pageSize > 50) {
    return googleError(400, 'maxResults is out of range')
  }
  const uploads = channelOf(asked)?.uploads ?? []
  const offset = Number(query.get('pageToken') ?? '0')
  const next = offset + pageSize
  return {
    status: 200,
    body: {
      kind: 'youtube#playlistItemListResponse',
      items: uploads.slice(offset, next).map(playlistItem),
      ...(next < uploads.length ? { nextPageToken: String(next) } : {}),
      pageInfo: { totalResults: uploads.length, resultsPerPage: pageSize },
    },
  }
}
