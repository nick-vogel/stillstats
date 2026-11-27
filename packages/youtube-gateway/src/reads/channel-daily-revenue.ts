import { hourMs, type ReadDefinition } from '../read-definition.ts'
import { type ChannelRevenueRequest, channelDailyMetrics, revenueKeyOf } from './channel-metrics.ts'
import { type Revenue, revenueMetricNames } from './channel-revenue.ts'

/** The channel's revenue on one day. */
export interface ChannelDayRevenue extends Revenue {
  /** YYYY-MM-DD, a reporting day in Pacific Time. */
  day: string
}

/**
 * The channel's revenue and its ad and YouTube Premium sources for each day of the range, or one
 * format's, oldest first, in the request's currency: one query, `dimensions=day`. A day Google has
 * no row for is absent.
 */
export const channelDailyRevenue: ReadDefinition<ChannelRevenueRequest, ChannelDayRevenue[]> = {
  needs: ['yt-analytics-monetary.readonly'],
  cacheKey: (request) => revenueKeyOf('channelDailyRevenue', request),
  cacheWindowMs: 6 * hourMs,
  fetch: (google, request) => channelDailyMetrics(google, request, revenueMetricNames),
}
