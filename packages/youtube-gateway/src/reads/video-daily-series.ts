import { type OneVideoRevenueRequest, oneVideoRead } from './one-video.ts'
import { metricsOf } from './result-table.ts'

export interface VideoDayNumbers {
  /** YYYY-MM-DD. */
  day: string
  engagedViews: number
  views: number
  estimatedMinutesWatched: number
}

const dayMetricNames = [
  'engagedViews',
  'views',
  'estimatedMinutesWatched',
] as const satisfies readonly (keyof Omit<VideoDayNumbers, 'day'>)[]

/**
 * In no set order. Google omits a day with no views, and every day after the last processed day.
 */
export const videoDailySeries = oneVideoRead<VideoDayNumbers[]>({
  // Versioned since the value gained watch time: a value cached in the old shape, with no
  // minutes, is never read as the new one.
  cacheKeyPrefix: 'videoDailySeries:v2',
  dimensions: 'day',
  metrics: dayMetricNames.join(','),
  toValue: (records) =>
    records.map((record) => ({ day: String(record.day), ...metricsOf(record, dayMetricNames) })),
})

/** One video's numbers on one day, with its estimated revenue in the request's currency. */
export interface VideoDayNumbersWithRevenue extends VideoDayNumbers {
  estimatedRevenue: number
}

const dayWithRevenueMetricNames = [
  ...dayMetricNames,
  'estimatedRevenue',
] as const satisfies readonly (keyof Omit<VideoDayNumbersWithRevenue, 'day'>)[]

// A live check through the youtube MCP on 2026-10-09 found Google answers `dimensions=day` with a
// one-id `video==` filter and `engagedViews,views,estimatedMinutesWatched,estimatedRevenue`, one row
// a day with views, its revenue 0 on a day with none.
/**
 * The daily series with each day's estimated revenue, in one query, in the request's currency and
 * in no set order. Needs the monetary scope; Google answers a channel outside the YouTube Partner
 * Program with zeros as often as with a 403 (Nick's walk of 2026-10-10).
 */
export const videoDailySeriesWithRevenue = oneVideoRead<
  VideoDayNumbersWithRevenue[],
  OneVideoRevenueRequest
>({
  cacheKeyPrefix: 'videoDailySeriesWithRevenue',
  dimensions: 'day',
  metrics: dayWithRevenueMetricNames.join(','),
  needs: ['yt-analytics-monetary.readonly'],
  toValue: (records) =>
    records.map((record) => ({
      day: String(record.day),
      ...metricsOf(record, dayWithRevenueMetricNames),
    })),
})
