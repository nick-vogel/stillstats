import { audienceRetention } from './audience-retention.ts'
import type { Report } from './report.ts'
import { subscriberSplit } from './subscriber-split.ts'
import { trafficSources } from './traffic-sources.ts'
import { videoDailySeries } from './video-daily-series.ts'
import { videoSponsorFigures } from './video-sponsor-figures.ts'
import { videoWindowSummary } from './video-window-summary.ts'

/** The reports a video's detail screen and its sponsor report read, one video per query. */
export const videoDetailReports: Report[] = [
  videoWindowSummary,
  videoDailySeries,
  audienceRetention,
  trafficSources,
  subscriberSplit,
  videoSponsorFigures,
]
