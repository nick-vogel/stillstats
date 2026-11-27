import type { FilterContentType } from './channel-metrics.ts'
import { listedVideosRead } from './video-metrics.ts'

/**
 * The Analytics API's `creatorContentType`, as Google names it. A live check on 2026-10-07
 * answered `videoOnDemand`, `shorts` and `liveStream` per video. Google documents `story` and
 * `unspecified` as well, and the channel-wide report also answered `posts`, so any other string
 * stays possible.
 */
export type CreatorContentType = FilterContentType | 'story' | 'unspecified' | (string & {})

/**
 * Each video's content type over the range, by video id. A video Google has no row for, one with
 * no views in the range, is absent.
 */
export type ContentTypeByVideo = Record<string, CreatorContentType>

export const videoContentTypes = listedVideosRead<ContentTypeByVideo>({
  readName: 'video content types',
  cacheKeyPrefix: 'videoContentTypes',
  dimensions: 'video,creatorContentType',
  metrics: 'views',
  toValue(records) {
    const best = new Map<string, { contentType: CreatorContentType; views: number }>()
    for (const record of records) {
      const videoId = String(record.video)
      const views = Number(record.views ?? 0)
      // The live check answered one row a video. Should Google split a video across content types,
      // the type with the most views names it.
      if ((best.get(videoId)?.views ?? -1) < views) {
        best.set(videoId, { contentType: String(record.creatorContentType), views })
      }
    }
    return Object.fromEntries([...best].map(([videoId, { contentType }]) => [videoId, contentType]))
  },
})
