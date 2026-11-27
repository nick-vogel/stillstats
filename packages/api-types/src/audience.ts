import type { SummaryWindow } from './channel-summary.ts'
import type { Freshness } from './freshness.ts'
import type { EngagedViewsAndViews, SubscriberSplit } from './video-detail.ts'
import type { CustomRangeQuery, RangeBounds, VideoFormatFilter, WindowChoice } from './videos.ts'

/**
 * The windows the Audience answer covers: the calendar windows, a custom range included. Lifetime
 * is not a calendar window, so the API refuses it with `invalid_window`, and a window after publish
 * with `window_after_publish`, as a channel has no publish day.
 */
export type AudienceWindow = Exclude<SummaryWindow, 'lifetime'>

/** The query of GET /api/channels/:channelId/audience, as text, the way a URL carries it. */
export interface AudienceQuery extends CustomRangeQuery {
  /** A calendar window. Defaults to `defaultVideoWindow`, the last 28 days. */
  window?: AudienceWindow
  /** Narrows every breakdown to one format. Defaults to `all`, which reads every format. */
  format?: VideoFormatFilter
}

/** What an Audience answer covers, parsed from its query: a window with its range, and a format. */
export type AudienceRequest = WindowChoice<Exclude<AudienceWindow, 'custom'>> & {
  format: VideoFormatFilter
}

export interface Country extends EngagedViewsAndViews {
  /** ISO 3166-1 alpha-2, as Google's `country`; `ZZ` when YouTube could not identify it. */
  code: string
}

export interface UsState extends EngagedViewsAndViews {
  /**
   * ISO 3166-2, as Google's `province`, such as `US-CA`; `US-ZZ` when YouTube could not identify
   * the state.
   */
  code: string
}

export interface City extends EngagedViewsAndViews {
  /** The city's name as Google answers it. */
  name: string
}

export interface Device extends EngagedViewsAndViews {
  /**
   * Google's `deviceType`: `DESKTOP`, `MOBILE`, `TABLET`, `TV`, `GAME_CONSOLE`, `AUTOMOTIVE`,
   * `WEARABLE` or `UNKNOWN_PLATFORM`.
   */
  deviceType: string
}

export interface OperatingSystem extends EngagedViewsAndViews {
  /**
   * Google's `operatingSystem`, such as `WINDOWS` or `IOS`. Google answers values its Dimensions
   * page does not list.
   */
  operatingSystem: string
}

export interface AgeGroup {
  /**
   * Google's `ageGroup`: `age13-17`, `age18-24`, `age25-34`, `age35-44`, `age45-54`, `age55-64` or
   * `age65-`.
   */
  ageGroup: string
  /** Google's own share of signed-in viewers' views, 0 to 100. */
  viewerPercentage: number
}

export interface Gender {
  /** Google's `gender`: `female`, `male` or `user_specified`. */
  gender: string
  /** Google's own share of signed-in viewers' views, 0 to 100. */
  viewerPercentage: number
}

/**
 * GET /api/channels/:channelId/audience: who watches the whole channel, or one format of it, over a
 * calendar window. Each breakdown is its own field. A breakdown Google answers no rows for is
 * empty, and a failed read of any breakdown refuses the whole answer. Freshness is that of the
 * oldest read.
 */
export interface AudienceAnswer extends Freshness, RangeBounds {
  window: AudienceWindow
  format: VideoFormatFilter
  /**
   * Most engaged views first, then most views, then by code. A country with 0 engaged views and 0
   * views is absent. Google leaves out countries with few views, so the rows can add up to less
   * than the channel's total.
   */
  countries: Country[]
  /**
   * Most engaged views first, then most views, then by code. A state with 0 engaged views and 0
   * views is absent. Google leaves out states with few views. Read for every format, whatever the
   * answer's `format`: under a format filter Google answered wrong numbers on a live check on
   * 2026-10-19. No rows: `[]`.
   */
  usStates: UsState[]
  /**
   * At most 250 rows, the 250 with most views, as Google caps the city report. Most engaged views
   * first, then most views, then by name. A city with 0 engaged views and 0 views is absent.
   * Google leaves out cities with few views. Read for every format, whatever the answer's
   * `format`, for the reason the US states are. No rows: `[]`.
   */
  cities: City[]
  /**
   * Ordered by Google's value, which is age order. Its own read, so it carries its own shares,
   * which Google does not normalize across combined dimensions. With a format chosen, the shares
   * are that format's. No rows: `[]`.
   */
  ageGroups: AgeGroup[]
  /**
   * Ordered by Google's value. Its own read, so it carries its own shares, which Google does not
   * normalize across combined dimensions. With a format chosen, the shares are that format's. No
   * rows: `[]`.
   */
  genders: Gender[]
  /**
   * Most engaged views first, then most views, then by Google's value. A device type with 0
   * engaged views and 0 views is absent. With a format chosen, that format's. No rows: `[]`.
   */
  devices: Device[]
  /**
   * Most engaged views first, then most views, then by Google's value. An operating system with 0
   * engaged views and 0 views is absent. With a format chosen, that format's. No rows: `[]`.
   */
  operatingSystems: OperatingSystem[]
  /**
   * The channel's engaged views and views from subscribers and from the rest, or the format's.
   * A side Google answers no row for is 0 and 0, as on a video's screen. No row for either: `null`.
   */
  subscriberSplit: SubscriberSplit | null
}
