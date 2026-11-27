import type { InCurrency } from './channel-metrics.ts'
import { type Revenue, revenueMetricNames } from './channel-revenue.ts'
import { metricsOf } from './result-table.ts'
import { listedVideosRead, type VideoRangeRequest } from './video-metrics.ts'

/** A request for each listed video's revenue over the range, in a currency. */
export type VideoRevenueRequest = VideoRangeRequest & InCurrency

/**
 * Each video's estimated revenue and its ad and YouTube Premium sources over the range, in the
 * request's currency, by video id. A video Google has no row for is absent.
 */
export type RevenueByVideo = Record<string, Revenue>

// A live check through the youtube MCP on 2026-10-09 found Google answers `dimensions=video` with a
// `video==` filter of three ids and `metrics=estimatedRevenue`, one row a video. The detail reads
// the same three revenue metrics in one query of one video, so the sources cost no extra query.
/**
 * Each listed video's estimated revenue and its sources over the range: one query,
 * `dimensions=video` with a `video==` filter, in the request's currency. Needs the monetary scope.
 * Google answers a channel outside the YouTube Partner Program with zeros as often as with a 403
 * (Nick's walk of 2026-10-10).
 */
export const videoRevenue = listedVideosRead<RevenueByVideo, VideoRevenueRequest>({
  readName: 'video revenue',
  // Versioned since the value gained the sources: a value cached in the old shape, a number a
  // video, is never read as the new one.
  cacheKeyPrefix: 'videoRevenue:v2',
  dimensions: 'video',
  metrics: revenueMetricNames.join(','),
  needs: ['yt-analytics-monetary.readonly'],
  toValue(records) {
    const byVideo: RevenueByVideo = {}
    for (const record of records) {
      byVideo[String(record.video)] = metricsOf(record, revenueMetricNames)
    }
    return byVideo
  },
})
