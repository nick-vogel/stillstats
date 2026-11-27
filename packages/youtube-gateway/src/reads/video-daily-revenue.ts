import { type Revenue, revenueMetricNames } from './channel-revenue.ts'
import { type OneVideoRevenueRequest, oneVideoRead } from './one-video.ts'
import { metricsOf } from './result-table.ts'

/** One video's revenue on one day. */
export interface VideoDayRevenue extends Revenue {
  /** YYYY-MM-DD. */
  day: string
}

// A live check through the youtube MCP on 2026-10-09 found Google answers `dimensions=day` with a
// one-id `video==` filter and the three revenue metrics, one row a day with revenue.
/**
 * One video's revenue and its ad and YouTube Premium sources for each day of the range, in the
 * request's currency, in no set order. Google omits a day with no revenue, and every day after the
 * last processed day. Needs the monetary scope; Google answers a channel outside the YouTube
 * Partner Program with zeros as often as with a 403 (Nick's walk of 2026-10-10).
 */
export const videoDailyRevenue = oneVideoRead<VideoDayRevenue[], OneVideoRevenueRequest>({
  cacheKeyPrefix: 'videoDailyRevenue',
  dimensions: 'day',
  metrics: revenueMetricNames.join(','),
  needs: ['yt-analytics-monetary.readonly'],
  toValue: (records) =>
    records.map((record) => ({
      day: String(record.day),
      ...metricsOf(record, revenueMetricNames),
    })),
})
