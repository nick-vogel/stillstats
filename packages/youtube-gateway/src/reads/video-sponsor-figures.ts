import { type SponsorFigure, sponsorFigures } from '@creator-analytics/api-types'
import { oneVideoRead } from './one-video.ts'
import { metricsOf } from './result-table.ts'

/** A video's nine sponsor report numbers over a range, as Google reports them. */
export type VideoSponsorFigures = Record<SponsorFigure, number>

/**
 * Null when Google has no row for the video. It always asks for all nine figures, so one cache
 * entry serves a range whatever figures a report shows, and it needs only the Analytics scope, so
 * it can never ask for revenue.
 */
export const videoSponsorFigures = oneVideoRead<VideoSponsorFigures | null>({
  cacheKeyPrefix: 'videoSponsorFigures:v1',
  metrics: sponsorFigures.join(','),
  toValue: ([record]) => (record ? metricsOf(record, sponsorFigures) : null),
})
