import { metricsOf } from './result-table.ts'
import { listedVideosRead } from './video-metrics.ts'

/** One video's numbers on one day. */
export interface VideoDailyRow {
  /** YYYY-MM-DD. */
  day: string
  engagedViews: number
  views: number
  subscribersGained: number
  estimatedMinutesWatched: number
}

const dailyRowMetricNames = [
  'engagedViews',
  'views',
  'subscribersGained',
  'estimatedMinutesWatched',
] as const satisfies readonly (keyof Omit<VideoDailyRow, 'day'>)[]

/**
 * Each video's days over the range, by video id, in no set order. Google omits a day with no
 * numbers, and every day after the last processed day, so a video with no day is absent.
 */
export type DailyRowsByVideo = Record<string, VideoDailyRow[]>

// A live check through the youtube MCP on 2026-10-07 found Google answers `dimensions=video,day`
// with a `video==` filter of 50 ids over 1,131 days, 56,550 videos times days. The channel reports
// page documents a 50,000 videos-times-days limit for the traffic source report only (checked
// 2026-10-07), and this report did not refuse past it.
export const videoDailyRows = listedVideosRead<DailyRowsByVideo>({
  readName: 'video daily rows',
  // Versioned since the value gained watch time: a value cached in the old shape, with no
  // minutes, is never read as the new one.
  cacheKeyPrefix: 'videoDailyRows:v2',
  dimensions: 'video,day',
  metrics: dailyRowMetricNames.join(','),
  toValue(records) {
    const byVideo: DailyRowsByVideo = {}
    for (const record of records) {
      const videoId = String(record.video)
      byVideo[videoId] ??= []
      byVideo[videoId].push({ day: String(record.day), ...metricsOf(record, dailyRowMetricNames) })
    }
    return byVideo
  },
})
