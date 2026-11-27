import { type Revenue, revenueMetricNames } from './channel-revenue.ts'
import { metricsOf } from './result-table.ts'
import { listedVideosRead } from './video-metrics.ts'
import type { VideoRevenueRequest } from './video-revenue.ts'

/** One video's estimated revenue and its ad and YouTube Premium sources on one day. */
export interface VideoDayRevenueRow extends Revenue {
  /** YYYY-MM-DD. */
  day: string
}

/**
 * Each video's revenue days over the range, by video id, in no set order. Google omits a day with
 * no revenue, and every day after the last processed day, so a video with no such day is absent.
 */
export type DailyRevenueRowsByVideo = Record<string, VideoDayRevenueRow[]>

// A live check through the youtube MCP on 2026-10-09 found Google answers `dimensions=video,day`
// with a two-id `video==` filter and `metrics=estimatedRevenue`, rows per video per day, leaving out
// the days with no revenue. The read asks the three revenue metrics in that shape, which no live
// check has covered.
/**
 * Each listed video's estimated revenue and its sources on each day of the range, which a window
 * after publish adds up as it adds the video's other numbers: one query, `dimensions=video,day`
 * with a `video==` filter, in the request's currency. Needs the monetary scope. Google answers a
 * channel outside the YouTube Partner Program with zeros as often as with a 403 (Nick's walk of
 * 2026-10-10).
 */
export const videoDailyRevenueRows = listedVideosRead<DailyRevenueRowsByVideo, VideoRevenueRequest>(
  {
    readName: 'video daily revenue',
    // Versioned since the value gained the sources: a value cached in the old shape, with no
    // sources, is never read as the new one.
    cacheKeyPrefix: 'videoDailyRevenueRows:v2',
    dimensions: 'video,day',
    metrics: revenueMetricNames.join(','),
    needs: ['yt-analytics-monetary.readonly'],
    toValue(records) {
      const byVideo: DailyRevenueRowsByVideo = {}
      for (const record of records) {
        const videoId = String(record.video)
        byVideo[videoId] ??= []
        byVideo[videoId].push({ day: String(record.day), ...metricsOf(record, revenueMetricNames) })
      }
      return byVideo
    },
  },
)
