import { hourMs, type ReadDefinition } from '../read-definition.ts'
import { type ChannelRangeRequest, channelMetrics, channelRangeKeyOf } from './channel-metrics.ts'

/** The whole channel's numbers over a range, as YouTube totals them. */
export interface ChannelTotals {
  engagedViews: number
  views: number
  estimatedMinutesWatched: number
}

/** The metrics of `ChannelTotals`, which the channel's daily series asks for each day too. */
export const channelTotalsMetricNames = [
  'engagedViews',
  'views',
  'estimatedMinutesWatched',
] as const satisfies readonly (keyof ChannelTotals)[]

/** The channel's engaged views, views and watch time over the range, or one format's, in one query. */
export const channelTotals: ReadDefinition<ChannelRangeRequest, ChannelTotals> = {
  needs: ['yt-analytics.readonly'],
  // Versioned since the value gained watch time: a value cached in the old shape, with no
  // minutes, is never read as the new one.
  cacheKey: (request) => channelRangeKeyOf('channelTotals:v2', request),
  cacheWindowMs: 6 * hourMs,
  fetch: (google, request) => channelMetrics(google, request, channelTotalsMetricNames),
}
