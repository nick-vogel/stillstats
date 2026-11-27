import { createHash } from 'node:crypto'
import type { ScopeName } from '@creator-analytics/token-vault'
import { type DateRange, hourMs, type ReadDefinition } from '../read-definition.ts'
import { currencyParamOf, type InCurrency } from './channel-metrics.ts'
import { metricsOf, recordsOf } from './result-table.ts'

export interface VideoMetrics {
  engagedViews: number
  views: number
  averageViewPercentage: number
  subscribersGained: number
  estimatedMinutesWatched: number
}

export const videoMetricNames = [
  'engagedViews',
  'views',
  'averageViewPercentage',
  'subscribersGained',
  'estimatedMinutesWatched',
] as const satisfies readonly (keyof VideoMetrics)[]

// The filters parameter "can specify up to 500 IDs", from the Analytics API's reports.query page,
// checked 2026-10-07.
export const maxVideosPerQuery = 500

export interface VideoRangeRequest extends DateRange {
  /** At most `maxVideosPerQuery`. */
  videoIds: string[]
}

/**
 * The ids as a cache key part, in any order. Hashed: 500 ids run past the 2,704 bytes Postgres
 * allows a btree index entry, and the cache's key is indexed.
 */
export function videoIdsKeyOf(videoIds: string[]): string {
  return createHash('sha256')
    .update([...videoIds].sort().join(','))
    .digest('base64url')
}

/** Each video's numbers over the range, by video id. A video Google has no row for is absent. */
export type VideoMetricsByVideo = Record<string, VideoMetrics>

/**
 * A read that makes one Analytics query of the request's videos over the request's range, a
 * `video==` filter of at most `maxVideosPerQuery` ids. A request with a currency sends it, and its
 * cache key ends with it, so each currency keeps its own entry.
 */
export function listedVideosRead<V, R extends VideoRangeRequest = VideoRangeRequest>({
  readName,
  cacheKeyPrefix,
  dimensions,
  metrics,
  needs = ['yt-analytics.readonly'],
  toValue,
}: {
  /** Names the read in the error a request of too many videos throws. */
  readName: string
  cacheKeyPrefix: string
  dimensions: string
  metrics: string
  /** The scopes the read needs. Default: the Analytics scope, which reads no revenue. */
  needs?: ScopeName[]
  toValue(records: Record<string, unknown>[]): V
}): ReadDefinition<R, V> {
  return {
    needs,
    cacheKey: (request: R & Partial<InCurrency>) => {
      const { startDate, endDate, videoIds, currency } = request
      const key = `${cacheKeyPrefix}:${startDate}:${endDate}:${videoIdsKeyOf(videoIds)}`
      return currency === undefined ? key : `${key}:${currency}`
    },
    cacheWindowMs: 6 * hourMs,
    async fetch(google, request: R & Partial<InCurrency>) {
      const { startDate, endDate, videoIds } = request
      if (videoIds.length > maxVideosPerQuery) {
        throw new Error(`A ${readName} read takes at most ${maxVideosPerQuery} videos`)
      }
      const response = await google.analytics((api) =>
        api.reports.query({
          ids: 'channel==MINE',
          startDate,
          endDate,
          dimensions,
          filters: `video==${videoIds.join(',')}`,
          metrics,
          ...currencyParamOf(request),
        }),
      )
      return toValue(recordsOf(response.data))
    },
  }
}

export const videoMetrics = listedVideosRead<VideoMetricsByVideo>({
  readName: 'video metrics',
  // Versioned since the value gained watch time: a value cached in the old shape, with no
  // minutes, is never read as the new one.
  cacheKeyPrefix: 'videoMetrics:v2',
  dimensions: 'video',
  metrics: videoMetricNames.join(','),
  toValue(records) {
    const byVideo: VideoMetricsByVideo = {}
    for (const record of records) {
      byVideo[String(record.video)] = metricsOf(record, videoMetricNames)
    }
    return byVideo
  },
})
