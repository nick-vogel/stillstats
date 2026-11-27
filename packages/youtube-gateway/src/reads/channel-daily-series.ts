import { hourMs, type ReadDefinition } from '../read-definition.ts'
import {
  type ChannelRangeRequest,
  channelDailyMetrics,
  channelRangeKeyOf,
} from './channel-metrics.ts'
import { type ChannelTotals, channelTotalsMetricNames } from './channel-totals.ts'

/** The whole channel's numbers on one day. */
export interface ChannelDayTotals extends ChannelTotals {
  /** YYYY-MM-DD, a reporting day in Pacific Time. */
  day: string
}

/**
 * The channel's engaged views, views and watch time for each day of the range, or one format's, oldest first:
 * one query, `dimensions=day`. A day Google has no row for is absent.
 */
export const channelDailySeries: ReadDefinition<ChannelRangeRequest, ChannelDayTotals[]> = {
  needs: ['yt-analytics.readonly'],
  // Versioned since the value gained watch time: a value cached in the old shape, with no
  // minutes, is never read as the new one.
  cacheKey: (request) => channelRangeKeyOf('channelDailySeries:v2', request),
  cacheWindowMs: 6 * hourMs,
  fetch: (google, request) => channelDailyMetrics(google, request, channelTotalsMetricNames),
}
