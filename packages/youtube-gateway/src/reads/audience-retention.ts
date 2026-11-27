import { oneVideoRead } from './one-video.ts'

export interface AudienceRetentionRow {
  /** From 0.01 to 1. */
  elapsedVideoTimeRatio: number
  audienceWatchRatio: number
  relativeRetentionPerformance: number
}

/**
 * In no set order. Google takes one video id per query for this report, and answers no rows when
 * the video has too few views to draw the curve.
 */
export const audienceRetention = oneVideoRead<AudienceRetentionRow[]>({
  cacheKeyPrefix: 'audienceRetention',
  dimensions: 'elapsedVideoTimeRatio',
  metrics: 'audienceWatchRatio,relativeRetentionPerformance',
  toValue: (records) =>
    records.map((record) => ({
      elapsedVideoTimeRatio: Number(record.elapsedVideoTimeRatio),
      audienceWatchRatio: Number(record.audienceWatchRatio ?? 0),
      relativeRetentionPerformance: Number(record.relativeRetentionPerformance ?? 0),
    })),
})
