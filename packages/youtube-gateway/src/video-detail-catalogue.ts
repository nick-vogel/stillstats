import type { ReadDefinition } from './read-definition.ts'
import { type AudienceRetentionRow, audienceRetention } from './reads/audience-retention.ts'
import type { Revenue } from './reads/channel-revenue.ts'
import type { OneVideoRequest, OneVideoRevenueRequest } from './reads/one-video.ts'
import { type SubscriberSplitNumbers, subscriberSplit } from './reads/subscriber-split.ts'
import { type TrafficSourceNumbers, trafficSources } from './reads/traffic-sources.ts'
import { type VideoDayRevenue, videoDailyRevenue } from './reads/video-daily-revenue.ts'
import {
  type VideoDayNumbers,
  type VideoDayNumbersWithRevenue,
  videoDailySeries,
  videoDailySeriesWithRevenue,
} from './reads/video-daily-series.ts'
import type { VideoMetrics } from './reads/video-metrics.ts'
import { videoWindowRevenue } from './reads/video-window-revenue.ts'
import { videoWindowSummary } from './reads/video-window-summary.ts'

/** The reads of a video's detail screen, one Analytics query each. */
export interface VideoDetailReads {
  videoWindowSummary: { request: OneVideoRequest; value: VideoMetrics | null }
  videoDailySeries: { request: OneVideoRequest; value: VideoDayNumbers[] }
  audienceRetention: { request: OneVideoRequest; value: AudienceRetentionRow[] }
  trafficSources: { request: OneVideoRequest; value: TrafficSourceNumbers }
  subscriberSplit: { request: OneVideoRequest; value: SubscriberSplitNumbers }
  /** In the request's currency, which Google converts at its daily rate. */
  videoWindowRevenue: { request: OneVideoRevenueRequest; value: Revenue }
  /** In the request's currency, which Google converts at its daily rate. */
  videoDailyRevenue: { request: OneVideoRevenueRequest; value: VideoDayRevenue[] }
  /** In the request's currency, which Google converts at its daily rate. */
  videoDailySeriesWithRevenue: {
    request: OneVideoRevenueRequest
    value: VideoDayNumbersWithRevenue[]
  }
}

export const videoDetailCatalogue: {
  [K in keyof VideoDetailReads]: ReadDefinition<
    VideoDetailReads[K]['request'],
    VideoDetailReads[K]['value']
  >
} = {
  videoWindowSummary,
  videoDailySeries,
  audienceRetention,
  trafficSources,
  subscriberSplit,
  videoWindowRevenue,
  videoDailyRevenue,
  videoDailySeriesWithRevenue,
}
