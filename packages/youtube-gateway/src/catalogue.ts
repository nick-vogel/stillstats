import type { DateRange, ReadDefinition } from './read-definition.ts'
import {
  type BreakdownNumbers,
  channelDevices,
  channelOperatingSystems,
  channelSubscriberSplit,
} from './reads/channel-breakdowns.ts'
import { type CityNumbers, channelCities } from './reads/channel-cities.ts'
import { type CountryNumbers, channelCountries } from './reads/channel-countries.ts'
import { type ChannelDayRevenue, channelDailyRevenue } from './reads/channel-daily-revenue.ts'
import { type ChannelDayTotals, channelDailySeries } from './reads/channel-daily-series.ts'
import type {
  ChannelRangeRequest,
  ChannelRevenueRequest,
  InCurrency,
} from './reads/channel-metrics.ts'
import { channelRevenue, type Revenue } from './reads/channel-revenue.ts'
import { channelRevenueByFormat, type RevenueByFormat } from './reads/channel-revenue-by-format.ts'
import { type ChannelSnippet, channelSnippet } from './reads/channel-snippet.ts'
import { type ChannelTotals, channelTotals } from './reads/channel-totals.ts'
import { channelUsStates, type UsStateNumbers } from './reads/channel-us-states.ts'
import {
  channelAgeGroups,
  channelGenders,
  type ViewerShares,
} from './reads/channel-viewer-shares.ts'
import { lastProcessedDay } from './reads/last-processed-day.ts'
import type { OneVideoRequest } from './reads/one-video.ts'
import { type ChannelUploads, uploads } from './reads/uploads.ts'
import { type ContentTypeByVideo, videoContentTypes } from './reads/video-content-types.ts'
import {
  type DailyRevenueRowsByVideo,
  videoDailyRevenueRows,
} from './reads/video-daily-revenue-rows.ts'
import { type DailyRowsByVideo, videoDailyRows } from './reads/video-daily-rows.ts'
import {
  type VideoMetricsByVideo,
  type VideoRangeRequest,
  videoMetrics,
} from './reads/video-metrics.ts'
import {
  type RevenueByVideo,
  type VideoRevenueRequest,
  videoRevenue,
} from './reads/video-revenue.ts'
import { type VideoSponsorFigures, videoSponsorFigures } from './reads/video-sponsor-figures.ts'
import { type VideoDetailReads, videoDetailCatalogue } from './video-detail-catalogue.ts'

export interface Reads extends VideoDetailReads {
  /** In the request's currency, which Google converts at its daily rate. */
  channelRevenue: { request: ChannelRevenueRequest; value: Revenue }
  /** In the request's currency, which Google converts at its daily rate. */
  channelDailyRevenue: { request: ChannelRevenueRequest; value: ChannelDayRevenue[] }
  /**
   * The revenue YouTube ties to no video or format and the channel's revenue in every format, in
   * the request's currency, which Google converts at its daily rate.
   */
  channelRevenueByFormat: { request: DateRange & InCurrency; value: RevenueByFormat }
  uploads: { request: Record<string, never>; value: ChannelUploads }
  videoMetrics: { request: VideoRangeRequest; value: VideoMetricsByVideo }
  videoContentTypes: { request: VideoRangeRequest; value: ContentTypeByVideo }
  lastProcessedDay: { request: DateRange; value: string | null }
  channelTotals: { request: ChannelRangeRequest; value: ChannelTotals }
  channelDailySeries: { request: ChannelRangeRequest; value: ChannelDayTotals[] }
  channelCountries: { request: ChannelRangeRequest; value: CountryNumbers }
  /** Every format: Google answers wrong numbers to a format filter on this read. */
  channelUsStates: { request: DateRange; value: UsStateNumbers }
  /** Every format, the 250 cities with most views. */
  channelCities: { request: DateRange; value: CityNumbers }
  /** Google's share of signed-in viewers' views by `ageGroup`. */
  channelAgeGroups: { request: ChannelRangeRequest; value: ViewerShares }
  /** Google's share of signed-in viewers' views by `gender`. */
  channelGenders: { request: ChannelRangeRequest; value: ViewerShares }
  /** By Google's `deviceType`. */
  channelDevices: { request: ChannelRangeRequest; value: BreakdownNumbers }
  /** By Google's `operatingSystem`. */
  channelOperatingSystems: { request: ChannelRangeRequest; value: BreakdownNumbers }
  /** By Google's `subscribedStatus`, for the whole channel or one format. */
  channelSubscriberSplit: { request: ChannelRangeRequest; value: BreakdownNumbers }
  channelSnippet: { request: Record<string, never>; value: ChannelSnippet }
  videoDailyRows: { request: VideoRangeRequest; value: DailyRowsByVideo }
  /** In the request's currency, which Google converts at its daily rate. */
  videoRevenue: { request: VideoRevenueRequest; value: RevenueByVideo }
  /** In the request's currency, which Google converts at its daily rate. */
  videoDailyRevenueRows: { request: VideoRevenueRequest; value: DailyRevenueRowsByVideo }
  /** A sponsor report's nine figures of one video, null when Google has no row for it. */
  videoSponsorFigures: { request: OneVideoRequest; value: VideoSponsorFigures | null }
}

export const catalogue: {
  [K in keyof Reads]: ReadDefinition<Reads[K]['request'], Reads[K]['value']>
} = {
  channelRevenue,
  channelDailyRevenue,
  channelRevenueByFormat,
  uploads,
  videoMetrics,
  videoContentTypes,
  lastProcessedDay,
  ...videoDetailCatalogue,
  channelTotals,
  channelDailySeries,
  channelCountries,
  channelUsStates,
  channelCities,
  channelAgeGroups,
  channelGenders,
  channelDevices,
  channelOperatingSystems,
  channelSubscriberSplit,
  channelSnippet,
  videoDailyRows,
  videoRevenue,
  videoDailyRevenueRows,
  videoSponsorFigures,
}
