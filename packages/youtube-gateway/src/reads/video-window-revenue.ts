import { type Revenue, revenueMetricNames } from './channel-revenue.ts'
import { type OneVideoRevenueRequest, oneVideoRead } from './one-video.ts'
import { metricsOf } from './result-table.ts'

// A live check through the youtube MCP on 2026-10-09 found Google answers a query with no dimension,
// a one-id `video==` filter and the three revenue metrics, one row.
/**
 * One video's revenue and its ad and YouTube Premium sources over the range, in the request's
 * currency, and zeros when Google answers no row. Needs the monetary scope; Google answers a channel
 * outside the YouTube Partner Program with zeros as often as with a 403 (Nick's walk of 2026-10-10).
 */
export const videoWindowRevenue = oneVideoRead<Revenue, OneVideoRevenueRequest>({
  cacheKeyPrefix: 'videoWindowRevenue',
  metrics: revenueMetricNames.join(','),
  needs: ['yt-analytics-monetary.readonly'],
  toValue: ([record]) => metricsOf(record, revenueMetricNames),
})
