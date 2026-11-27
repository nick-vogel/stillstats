import type { RevenueAmounts, RevenueRefusal, WindowAfterPublish } from './channel-summary.ts'
import type { RevenueCurrency } from './currencies.ts'
import type { Freshness } from './freshness.ts'
import type {
  CustomRangeQuery,
  NewestHistoryAverage,
  PartialWindow,
  RangeBounds,
  VideoRow,
  VideoRowNumbers,
  VideoWindow,
} from './videos.ts'

/** The query of GET /api/channels/:channelId/videos/:videoId, as text, the way a URL carries it. */
export interface VideoDetailQuery extends CustomRangeQuery {
  /** Defaults to `defaultVideoWindow`, the last 28 days. */
  window?: VideoWindow
}

/**
 * The video's numbers on one day. The revenue fields are on every day exactly when the detail's
 * `revenue` answered, a zero on a day YouTube reports no revenue for.
 */
export interface VideoDay extends Partial<RevenueAmounts> {
  /** YYYY-MM-DD, a reporting day in Pacific Time. */
  day: string
  /** In a window after publish: the day's place in it, 1 on the publish day. */
  dayAfterPublish?: number
  engagedViews: number
  views: number
  estimatedMinutesWatched: number
}

/** One point of the audience retention curve, as Google reports it. */
export interface AudienceRetentionPoint {
  /** How far into the video, from 0.01 to 1. */
  elapsedVideoTimeRatio: number
  /** The viewers watching at this point, as a share of the video's views. Can exceed 1. */
  audienceWatchRatio: number
  /**
   * Google's comparison of this point with videos of similar length on YouTube, from 0 to 1, where
   * 0.5 is the median. Passed through unchanged, for the screen to draw beside the absolute curve.
   */
  relativeRetentionPerformance: number
}

/**
 * Engaged views and views under one value of a breakdown: a traffic source, one side of the
 * subscriber split, or a country.
 */
export interface EngagedViewsAndViews {
  engagedViews: number
  views: number
}

export interface TrafficSource extends EngagedViewsAndViews {
  /** Google's `insightTrafficSourceType`, for example `YT_SEARCH` or `RELATED_VIDEO`. */
  type: string
  /**
   * The type's thumbnail impressions over the video's range, from a paid channel's stored history.
   * On every source exactly when the detail carries `history`.
   */
  impressions?: number
  /** The type's impressions click-through rate, from 0 to 1, null with no impressions. */
  ctr?: number | null
}

/** One traffic source type's average impressions and CTR among the newest uploads. */
export interface NewestTrafficSourceAverage {
  /** Google's `insightTrafficSourceType`, as `TrafficSource.type` names it. */
  type: string
  /** The counted uploads' impressions of this type, added and divided by the average's `count`. */
  impressions: number
  /** Their impressions times CTR of this type, over those impressions. Null with none. */
  ctr: number | null
}

/**
 * The average impressions and CTR of the newest uploads of the video's own format over the same
 * window after publish, by the rule of the video list's `newestHistoryAverage`, and per traffic
 * source type over the same uploads.
 */
export interface NewestVideoHistoryAverage extends NewestHistoryAverage {
  /**
   * One entry per traffic source type any counted upload has impressions of, most impressions
   * first. An upload with none of a type counts as 0 for it.
   */
  trafficSources: NewestTrafficSourceAverage[]
}

/** A paid channel's impressions and CTR history for one video over its range. */
export interface VideoHistory {
  /** The video's impressions over its range. */
  impressions: number
  /** Its CTR over its range, from 0 to 1 (ADR 0013). Null with no impressions. */
  ctr: number | null
  /** YYYY-MM-DD, the first day the history holds. */
  firstDay: string
  /** YYYY-MM-DD, the newest day the history holds (ADR 0017). */
  newestDay: string
  /** The days of the video's range the history holds, when it does not hold them all. */
  partial?: PartialWindow
  /**
   * In a window after publish only: the newest uploads' average. Absent when fewer than 2
   * qualify.
   */
  newestAverage?: NewestVideoHistoryAverage
}

/**
 * The video's engaged views and views by Google's `subscribedStatus`: viewers subscribed to the
 * channel, and the rest.
 */
export interface SubscriberSplit {
  subscribed: EngagedViewsAndViews
  unsubscribed: EngagedViewsAndViews
}

/**
 * The video's own revenue over its range, YouTube's own totals, never a sum of `days`. The videos'
 * revenue does not add up to the channel's, as YouTube ties some revenue to no video.
 */
export interface VideoRevenue extends RevenueAmounts {
  /** The creator's saved currency, which every amount here and every day's revenue is in. */
  currency: RevenueCurrency
  /**
   * Never present, so `refusal` tells this from a `RevenueRefusal`: a plain union lets an answer
   * carry a refusal and a currency together, as TypeScript checks a literal's extra properties
   * against every member of a union with no discriminant.
   */
  refusal?: never
}

/** A stage of the video's life since publish: a window after publish, or its whole lifetime. */
export type SincePublishStage = WindowAfterPublish | 'lifetime'

/** The video's numbers over one stage since publish. */
export interface SincePublishRow {
  stage: SincePublishStage
  engagedViews: number
  views: number
  estimatedMinutesWatched: number
  /** On every row exactly when `SincePublish.revenueCurrency` is set, in that currency. */
  estimatedRevenue?: number
  /**
   * In a window after publish, when the video is younger than the stage or Google has not processed
   * it to the stage's end: the days it has. Lifetime has none.
   */
  partial?: PartialWindow
}

/**
 * The video's stages since publish, the same in every window. Each window after publish is the sum
 * of the video's own days in it (ADR 0013), read in one query from the publish day to the last
 * processed day; lifetime is YouTube's own total, never a sum.
 */
export interface SincePublish {
  /** The publish day, the first 7, 28, 90 and 365 days, then lifetime, in that order. */
  rows: SincePublishRow[]
  /** The creator's saved currency, which every row's revenue is in. Absent: no row carries revenue. */
  revenueCurrency?: RevenueCurrency
  /**
   * The video's age in days, the publish day as day 1, up to the last processed day, as the stages
   * count their days. Absent when Google has processed no day of the video.
   */
  daysSincePublish?: number
}

/**
 * GET /api/channels/:channelId/videos/:videoId: one video over a window, counted from the later of
 * the window's first day and the video's publish day. A window after publish counts the video's own
 * days from its publish day, up to today, and no day for a video with no publish day. Freshness is
 * that of the oldest read.
 */
export interface VideoDetailAnswer extends Freshness, RangeBounds {
  /**
   * The video. Its `format` is its lifetime one, read as the video list reads it, null when Google
   * gives it none, as for a video awaiting processing.
   */
  video: Pick<
    VideoRow,
    | 'id'
    | 'title'
    | 'thumbnailUrl'
    | 'thumbnails'
    | 'durationSeconds'
    | 'publishedAt'
    | 'scheduled'
    | 'format'
    | 'privacy'
  > & {
    /**
     * Google's `status.embeddable`: whether the video plays in an embedded player. True when Google
     * leaves it out.
     */
    embeddable: boolean
    /** Google's `status.madeForKids`. False when Google leaves it out. */
    madeForKids: boolean
  }
  window: VideoWindow
  /** Google's own totals over the video's range, average percentage viewed in every window. */
  totals: Required<VideoRowNumbers>
  /**
   * Every day from the first counted day to the last processed day, oldest first. A day Google has
   * no row for has zeros.
   */
  days: VideoDay[]
  /** Earliest point in the video first. Empty when Google has too few views to draw the curve. */
  audienceRetention: AudienceRetentionPoint[]
  /**
   * Most engaged views first, then most views, then by type. A type with no views is absent, unless
   * the history holds impressions of it: it then follows those with views, most impressions first.
   */
  trafficSources: TrafficSource[]
  subscriberSplit: SubscriberSplit
  /**
   * The video's revenue over its range, or why it carries none. Absent for a video with no day to
   * count in the window, such as one not yet published or one published after a custom range ends,
   * and, in every window, for a video Google has processed no day of since publish.
   */
  revenue?: VideoRevenue | RevenueRefusal
  /** The video's stages since publish, which do not depend on the window. */
  sincePublish: SincePublish
  /**
   * True when Google has processed no day since the video was published, a scheduled video
   * included. Its numbers are not in yet, so the screen says so instead of showing zeros.
   */
  awaitingProcessing: boolean
  /** In a window after publish, when Google has not processed the whole window for the video. */
  partial?: PartialWindow
  /**
   * A paid or ended channel's impressions and CTR history for the video, present only for a paid
   * channel, or an ended one before its purge date, whose history holds a day, and then every
   * traffic source carries `impressions` and `ctr`.
   */
  history?: VideoHistory
}
