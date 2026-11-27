import { hourMs, type ReadDefinition } from '../read-definition.ts'
import { type ChannelRevenueRequest, channelMetrics, revenueKeyOf } from './channel-metrics.ts'

/**
 * Revenue in the request's currency, which Google converts at its daily exchange rate, as the
 * Analytics API's metrics page defines it (checked 2026-10-09): the total from every advertising and
 * non-advertising source, the part from Google-sold advertising, and the part from YouTube Premium
 * subscriptions.
 */
export interface Revenue {
  estimatedRevenue: number
  estimatedAdRevenue: number
  estimatedRedPartnerRevenue: number
}

/** The metrics of `Revenue`, which the channel's daily revenue asks for each day too. */
export const revenueMetricNames = [
  'estimatedRevenue',
  'estimatedAdRevenue',
  'estimatedRedPartnerRevenue',
] as const satisfies readonly (keyof Revenue)[]

/** The channel's revenue and its ad and YouTube Premium sources over the range, or one format's. */
export const channelRevenue: ReadDefinition<ChannelRevenueRequest, Revenue> = {
  needs: ['yt-analytics-monetary.readonly'],
  cacheKey: (request) => revenueKeyOf('channelRevenue', request),
  cacheWindowMs: 6 * hourMs,
  fetch: (google, request) => channelMetrics(google, request, revenueMetricNames),
}
