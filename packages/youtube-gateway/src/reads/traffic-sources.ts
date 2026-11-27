import { type EngagedViewsAndViews, oneVideoRead } from './one-video.ts'

/** By Google's `insightTrafficSourceType`, for example `YT_SEARCH`. Google omits a type with no views. */
export type TrafficSourceNumbers = Record<string, EngagedViewsAndViews>

export const trafficSources = oneVideoRead<TrafficSourceNumbers>({
  cacheKeyPrefix: 'trafficSources',
  dimensions: 'insightTrafficSourceType',
  metrics: 'engagedViews,views',
  toValue: (records) =>
    Object.fromEntries(
      records.map((record) => [
        String(record.insightTrafficSourceType),
        { engagedViews: Number(record.engagedViews ?? 0), views: Number(record.views ?? 0) },
      ]),
    ),
})
