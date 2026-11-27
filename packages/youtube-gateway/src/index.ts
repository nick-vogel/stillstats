export type { Reads } from './catalogue.ts'
export type { ReachRow } from './reach-report.ts'
export type { DateRange } from './read-definition.ts'
export type { ChannelDayRevenue } from './reads/channel-daily-revenue.ts'
export type { ChannelDayTotals } from './reads/channel-daily-series.ts'
export type {
  ChannelRangeRequest,
  ChannelRevenueRequest,
  FilterContentType,
  InCurrency,
} from './reads/channel-metrics.ts'
export type { Revenue } from './reads/channel-revenue.ts'
export type { ChannelSnippet } from './reads/channel-snippet.ts'
export type { ChannelTotals } from './reads/channel-totals.ts'
export type { OneVideoRequest, OneVideoRevenueRequest } from './reads/one-video.ts'
export type { ChannelUploads, Upload } from './reads/uploads.ts'
export type { ContentTypeByVideo, CreatorContentType } from './reads/video-content-types.ts'
export type { VideoDayRevenue } from './reads/video-daily-revenue.ts'
export type {
  DailyRevenueRowsByVideo,
  VideoDayRevenueRow,
} from './reads/video-daily-revenue-rows.ts'
export type { DailyRowsByVideo, VideoDailyRow } from './reads/video-daily-rows.ts'
export type {
  VideoDayNumbers,
  VideoDayNumbersWithRevenue,
} from './reads/video-daily-series.ts'
export {
  maxVideosPerQuery,
  type VideoMetrics,
  type VideoMetricsByVideo,
  type VideoRangeRequest,
} from './reads/video-metrics.ts'
export type { RevenueByVideo, VideoRevenueRequest } from './reads/video-revenue.ts'
export type { VideoSponsorFigures } from './reads/video-sponsor-figures.ts'
export type { ReachReport } from './reporting-job.ts'
export {
  createYouTubeGateway,
  type ExistingVideosResult,
  type IdentifyRefusal,
  quotaDayOf,
  type RateLimit,
  type ReachDownloadResult,
  type ReachReportsResult,
  type ReadRefusal,
  type ReadResult,
  type ReadTiming,
  type ReportingJobResult,
  reportingDayOf,
  sweepExpiredCache,
  type YouTubeApi,
  type YouTubeGateway,
  type YouTubeGatewayOptions,
  youtubeRootUrls,
} from './youtube-gateway.ts'
