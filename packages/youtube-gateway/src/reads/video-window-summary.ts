import { oneVideoRead } from './one-video.ts'
import { metricsOf } from './result-table.ts'
import { type VideoMetrics, videoMetricNames } from './video-metrics.ts'

/**
 * Null when Google has no row for the video. Unlike the video list's read, it takes the video's own
 * range, so a window after publish has an average percentage viewed.
 */
export const videoWindowSummary = oneVideoRead<VideoMetrics | null>({
  // Versioned since the value gained watch time: a value cached in the old shape, with no
  // minutes, is never read as the new one.
  cacheKeyPrefix: 'videoWindowSummary:v2',
  metrics: videoMetricNames.join(','),
  toValue: ([record]) => (record ? metricsOf(record, videoMetricNames) : null),
})
