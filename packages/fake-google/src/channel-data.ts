/**
 * A video's numbers over a date range, as the Analytics API reports them with `dimensions=video`.
 * Its revenue, each metric 0 when unset, is in the currency a report asks for: the fake converts
 * nothing.
 */
export interface VideoNumbers extends Partial<RevenueNumbers> {
  engagedViews: number
  views: number
  averageViewPercentage: number
  subscribersGained: number
  /** Default 0. */
  estimatedMinutesWatched?: number
  /** Default 0. In seconds, as Google reports it. */
  averageViewDuration?: number
  /** Default 0. */
  likes?: number
  /** Default 0. */
  comments?: number
  /** Default 0. */
  shares?: number
}

/** A video's numbers over one exact date range. */
export interface FakeRangeNumbers {
  /** YYYY-MM-DD. */
  startDate: string
  /** YYYY-MM-DD. */
  endDate: string
  metrics: VideoNumbers
}

/** Engaged views and views under one value of a dimension, such as a traffic source or country. */
export interface EngagedViewsAndViews {
  engagedViews: number
  views: number
}

export interface FakeUpload {
  videoId: string
  title: string
  /** ISO 8601, the playlist item's `contentDetails.videoPublishedAt`. A scheduled video has none. */
  publishedAt?: string
  /** ISO 8601, the video's `status.publishAt`: set only on a private video never published. */
  scheduledFor?: string
  /** The video's `status.privacyStatus`. Absent: `private` for a scheduled upload, else `public`. */
  privacyStatus?: 'public' | 'unlisted' | 'private'
  /** The video's `status.embeddable`. Absent: the fake leaves it out of `status`, as Google may. */
  embeddable?: boolean
  /** The video's `status.madeForKids`. Absent: the fake leaves it out of `status`, as Google may. */
  madeForKids?: boolean
  /**
   * Google's ISO 8601 `contentDetails.duration`, such as `PT4M30S`. Absent: the fake answers no
   * `duration` in `contentDetails`.
   */
  duration?: string
  /**
   * The thumbnail sizes Google answers in the playlist item's `snippet.thumbnails`, by Google's
   * name. Absent: `default`, `medium` and `high`. Google answers `standard` and `maxres` only for
   * some videos.
   */
  thumbnailSizes?: FakeThumbnailSize[]
  /** The video's lifetime numbers. Google omits its row from a lifetime report when it has none. */
  metrics?: VideoNumbers
  /** The video's numbers over set ranges: any range with an entry's exact dates answers them. */
  rangeMetrics?: FakeRangeNumbers[]
  /** The video's numbers by day. Google omits a day with no views. */
  days?: FakeVideoDay[]
  /** The video's audience retention curve, the same for any range. */
  retention?: FakeRetentionPoint[]
  /** The video's engaged views and views by `insightTrafficSourceType`, the same for any range. */
  trafficSources?: Record<string, EngagedViewsAndViews>
  /** The video's engaged views and views by `subscribedStatus`, the same for any range. */
  subscriberNumbers?: { SUBSCRIBED?: EngagedViewsAndViews; UNSUBSCRIBED?: EngagedViewsAndViews }
  /** The Analytics API's `creatorContentType` for the video. Default `videoOnDemand`. */
  creatorContentType?: FakeContentType
  /**
   * The video's lifetime views by content type, for a video Google splits across types. When set,
   * a `dimensions=video,creatorContentType` report answers a row for each entry in place of the
   * single `creatorContentType` row.
   */
  contentTypeViews?: Partial<Record<FakeContentType, number>>
}

/** Google's five thumbnail size names (developers.google.com/youtube/v3/docs/thumbnails). */
export type FakeThumbnailSize = 'default' | 'medium' | 'high' | 'standard' | 'maxres'

/**
 * The Analytics API's `creatorContentType` values, the same as the gateway's `CreatorContentType`,
 * which records where each comes from. The fake keeps its own copy so it does not depend on the
 * gateway it stands in front of. Any other string stands for a value Google has not documented.
 */
export type FakeContentType =
  | 'videoOnDemand'
  | 'shorts'
  | 'liveStream'
  | 'story'
  | 'unspecified'
  | (string & {})

/** A video's numbers on one day. Its revenue, each metric 0 when unset, as in `VideoNumbers`. */
export interface FakeVideoDay extends Partial<RevenueNumbers> {
  /** YYYY-MM-DD. */
  day: string
  engagedViews: number
  views: number
  /** Default 0. */
  subscribersGained?: number
  /** Default 0. */
  estimatedMinutesWatched?: number
}

export interface FakeRetentionPoint {
  elapsedVideoTimeRatio: number
  audienceWatchRatio: number
  relativeRetentionPerformance: number
}

/** The whole channel's numbers, as the Analytics API reports them with no video dimension. */
export interface ChannelNumbers {
  engagedViews: number
  views: number
  /** Default 0. */
  estimatedMinutesWatched?: number
}

/**
 * The `creatorContentType` values Google accepts in a `filters=creatorContentType==` query. A live
 * check on 2026-10-08 refused the uppercase values in Google's docs, such as `SHORTS`.
 */
export const filterContentTypes = ['videoOnDemand', 'shorts', 'liveStream'] as const
export type FilterContentType = (typeof filterContentTypes)[number]

/**
 * Revenue, in the currency a report asks for, as the Analytics API reports it: the total, and two of
 * its sources. The fake converts nothing.
 */
export interface RevenueNumbers {
  estimatedRevenue: number
  /** Default 0. */
  estimatedAdRevenue?: number
  /** YouTube Premium revenue. Default 0. */
  estimatedRedPartnerRevenue?: number
}

/** One format's numbers, as the Analytics API reports them to a `creatorContentType==` filter. */
export interface FakeFormatNumbers extends Partial<RevenueNumbers> {
  /** The format's totals over any date range. Google omits the row when it has none. */
  totals?: ChannelNumbers
  /** The format's numbers by day, YYYY-MM-DD. A filtered report answers these days only. */
  days?: Record<string, ChannelNumbers>
  /**
   * The format's revenue by day, YYYY-MM-DD. A filtered `dimensions=day` revenue report answers
   * these days only. The revenue fields beside it are over any date range.
   */
  revenueDays?: Record<string, RevenueNumbers>
  /**
   * The format's engaged views and views by `country`, ISO 3166-1 alpha-2, `ZZ` for a country
   * YouTube could not identify, over any date range. A report answers every row held, a row of 0
   * engaged views and 0 views included.
   */
  countries?: Record<string, EngagedViewsAndViews>
  /**
   * The format's engaged views and views by Google's `deviceType`, such as `MOBILE`, over any date
   * range. A report answers every row held, a row of 0 engaged views and 0 views included.
   */
  devices?: Record<string, EngagedViewsAndViews>
  /**
   * The format's engaged views and views by Google's `operatingSystem`, such as `IOS`, over any
   * date range. A report answers every row held, a row of 0 engaged views and 0 views included.
   */
  operatingSystems?: Record<string, EngagedViewsAndViews>
  /**
   * The format's engaged views and views by Google's `subscribedStatus`, `SUBSCRIBED` or
   * `UNSUBSCRIBED`, over any date range. A report answers every row held.
   */
  subscribedStatuses?: Record<string, EngagedViewsAndViews>
  /**
   * The format's `viewerPercentage` by Google's `ageGroup`, such as `age18-24`, over any date
   * range. A report answers the rows as held.
   */
  ageGroups?: Record<string, number>
  /**
   * The format's `viewerPercentage` by Google's `gender`, such as `user_specified`, over any date
   * range. A report answers the rows as held.
   */
  genders?: Record<string, number>
}

/** A channel's revenue, in the currency a report asks for, over any date range. */
export interface FakeRevenue extends RevenueNumbers {
  /** By day, YYYY-MM-DD. A `dimensions=day` revenue report answers these days only. */
  days?: Record<string, RevenueNumbers>
  /**
   * The revenue YouTube ties to no video or format: the `creatorContentTypeUnspecified` row, with
   * zero views, of a report by `creatorContentType`. Absent: no such row.
   */
  noFormatRevenue?: number
}

export interface FakeChannel {
  /** ISO 8601, the channel's `snippet.publishedAt`. */
  createdAt: string
  /** The channel's `snippet.title`. Google always answers one; the fake omits it when unset. */
  title?: string
  /** The channel's `snippet.customUrl`, its handle, such as `@nick_vogel`. */
  handle?: string
  /** In the uploads playlist's own order. */
  uploads: FakeUpload[]
  /** The channel's totals over any date range. Google omits the row when the channel has none. */
  totals?: ChannelNumbers
  /**
   * The channel's numbers by day, YYYY-MM-DD. When set, a `dimensions=day` report answers these
   * days only, as Google leaves out a day it has no row for, and every other metric is zero. When
   * unset, it answers every day, each zero.
   */
  days?: Record<string, ChannelNumbers>
  /**
   * The channel's engaged views and views by `country`, ISO 3166-1 alpha-2, `ZZ` for a country
   * YouTube could not identify, over any date range. A report answers every row held, a row of 0
   * engaged views and 0 views included.
   */
  countries?: Record<string, EngagedViewsAndViews>
  /**
   * The channel's engaged views and views by `province`, ISO 3166-2 such as `US-CA`, `US-ZZ` for a
   * state YouTube could not identify, over any date range and every format. A report answers every
   * row held, a row of 0 engaged views and 0 views included.
   */
  usStates?: Record<string, EngagedViewsAndViews>
  /**
   * The channel's engaged views and views by `city`, by the name Google answers, over any date
   * range and every format. A report answers every row held, a row of 0 engaged views and 0 views
   * included, by most views.
   */
  cities?: Record<string, EngagedViewsAndViews>
  /**
   * The channel's engaged views and views by Google's `deviceType`, such as `MOBILE`, over any date
   * range. A report answers every row held, a row of 0 engaged views and 0 views included.
   */
  devices?: Record<string, EngagedViewsAndViews>
  /**
   * The channel's engaged views and views by Google's `operatingSystem`, such as `IOS`, over any
   * date range. A report answers every row held, a row of 0 engaged views and 0 views included.
   */
  operatingSystems?: Record<string, EngagedViewsAndViews>
  /**
   * The channel's engaged views and views by Google's `subscribedStatus`, `SUBSCRIBED` or
   * `UNSUBSCRIBED`, over any date range. A report answers every row held.
   */
  subscribedStatuses?: Record<string, EngagedViewsAndViews>
  /**
   * The channel's `viewerPercentage`, the share of signed-in viewers' views, by Google's
   * `ageGroup`, such as `age18-24`, over any date range. A report answers the rows as held.
   */
  ageGroups?: Record<string, number>
  /**
   * The channel's `viewerPercentage`, the share of signed-in viewers' views, by Google's `gender`,
   * such as `user_specified`, over any date range. A report answers the rows as held.
   */
  genders?: Record<string, number>
  /**
   * The channel's numbers for one format, which a report filtered to its content type answers in
   * place of the channel's own. A filtered report on a format with no entry answers no row.
   */
  formats?: Partial<Record<FilterContentType, FakeFormatNumbers>>
}

/** A Reporting API job as Google answers it. */
export interface FakeReportingJob {
  id: string
  reportTypeId: string
  name: string
  /** RFC 3339, as Google answers it. */
  createTime: string
}

/**
 * One row of a reach report file as the fake writes it. The traffic source detail, operating system
 * and device type are the dimensions the product reduces away; unset, the fake writes an empty
 * detail, `ANDROID` and `MOBILE`.
 */
export interface FakeReachRow {
  videoId: string
  /** The report's numeric traffic source code, such as 5 for YouTube search. */
  trafficSourceType: number
  impressions: number
  /** Clicks over impressions, a ratio Google can write above 1 (#1040). */
  ctr: number
  trafficSourceDetail?: string
  operatingSystem?: string
  deviceType?: string
}

/**
 * A daily reach report of the channel's reach job. A second report for a day already delivered is
 * Google's correction of it: a new id, the same day, a later creation time.
 */
export interface FakeReachReport {
  id: string
  /** YYYY-MM-DD, the Pacific day the report covers. */
  day: string
  /** RFC 3339, as Google answers it. */
  createTime: string
  rows: FakeReachRow[]
}

/** What the fake Google server holds about the channels it serves. */
export interface ChannelData {
  revenue: Map<string, FakeRevenue>
  /**
   * The channels outside the YouTube Partner Program, which the fake answers a 403 to every revenue
   * report of. Google answers such a channel with zeros as often as with a 403 (Nick's walk of
   * 2026-10-10, #119 W21), which a test models with `setRevenue` zeros.
   */
  outsidePartnerProgram: Set<string>
  /**
   * The channels whose revenue reports Google answers with 200 and no rows, as it answered a channel
   * outside the YouTube Partner Program in #119's walk (W21).
   */
  revenueWithoutRows: Set<string>
  channels: Map<string, FakeChannel>
  /** Null: every day up to a report's endDate is processed. */
  lastProcessedDay: string | null
  /** Each channel's Reporting API jobs, by YouTube channel id. */
  reportingJobs: Map<string, FakeReportingJob[]>
  /** Each channel's reach reports, by YouTube channel id, listed under its reach job. */
  reachReports: Map<string, FakeReachReport[]>
}

/** A request as an endpoint or a report receives it. */
export interface Asked {
  query: URLSearchParams
  /** The channel the request's access token reads. Null: its Google user picked none. */
  youtubeChannelId: string | null
  data: ChannelData
}

/** The channel the request reads, when the fake holds it. */
export function channelOf({ youtubeChannelId, data }: Asked): FakeChannel | undefined {
  return youtubeChannelId ? data.channels.get(youtubeChannelId) : undefined
}

/** The uploads playlist id the fake gives a channel. */
export function uploadsPlaylistOf(youtubeChannelId: string): string {
  return `uploads-of-${youtubeChannelId}`
}

/** An HTTP answer, written by the server. */
export interface Answer {
  status: number
  body: unknown
}

/**
 * Google's error body. A `reason` adds the `errors` entry Google's legacy error body carries, whose
 * reason is an identifier such as `forbidden` or `quotaExceeded`.
 */
export function googleError(status: number, message: string, reason?: string): Answer {
  const errors = reason === undefined ? {} : { errors: [{ message, domain: 'global', reason }] }
  return { status, body: { error: { code: status, message, ...errors } } }
}

/** A list parameter, sent comma-separated or repeated. The googleapis client repeats it. */
export function listParameter(query: URLSearchParams, name: string): string[] {
  return query.getAll(name).flatMap((value) => value.split(','))
}
