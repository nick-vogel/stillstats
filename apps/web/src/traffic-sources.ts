import {
  type NewestTrafficSourceAverage,
  type ReachTrafficSourceType,
  reachTrafficSourceTypes,
  type TrafficSource,
} from '@creator-analytics/api-types'
import { ctrTextOf } from './history.ts'
import type { Option } from './ListSelect.tsx'
import { shareLabelOf, shareOf } from './share.ts'

// The names are approved word for word in creator-analytics#55. Change them only with Nick. The
// first seventeen are YouTube Studio's, from YouTube Help's traffic source page
// (support.google.com/youtube/answer/9314355), checked 2026-10-08; it names no other type, so the
// last five are the product's own.
const trafficSourceNames = new Map(
  Object.entries({
    ADVERTISING: 'YouTube advertising',
    ANNOTATION: 'Video cards',
    CAMPAIGN_CARD: 'Campaign cards',
    END_SCREEN: 'End screens',
    EXT_URL: 'External sources',
    NO_LINK_OTHER: 'Direct or unknown sources',
    NOTIFICATION: 'Notifications',
    PLAYLIST: 'Playlists',
    PRODUCT_PAGE: 'Product pages',
    RELATED_VIDEO: 'Suggested videos',
    SHORTS: 'Shorts',
    SOUND_PAGE: 'Sound pages',
    SUBSCRIBER: 'Browse features',
    YT_CHANNEL: 'Channel pages',
    YT_OTHER_PAGE: 'Other YouTube features',
    YT_SEARCH: 'YouTube search',
    VIDEO_REMIXES: 'Remixed video',
    HASHTAGS: 'Hashtag pages',
    LIVE_REDIRECT: 'Live redirects',
    NO_LINK_EMBEDDED: 'Embedded players',
    PROMOTED: 'YouTube promotions',
    WATCH_WITH: 'Watch With streams',
    // Drafted for creator-analytics#785, approved by Nick word for word on 2026-11-19: the Reporting API's
    // traffic source codes with no Analytics API type (`trafficSourceTypeOf` in the API), named
    // from the Reporting API's own dimension page.
    REPORTING_18: 'Playlist pages',
    REPORTING_23: 'Stories',
    REPORTING_29: 'Podcasts',
    REPORTING_31: 'Vertical live feed',
    REPORTING_32: 'Related video',
  }),
)

/** A traffic source type's name, as the traffic sources view shows it, else Google's code. */
export function trafficSourceNameOf(type: string): string {
  return trafficSourceNames.get(type) ?? type
}

/** The traffic source filter's value for every source, the list's default. */
export const allTrafficSources = 'all'

// Proposed in creator-analytics#944, for Nick's word for word approval on the epic's PR.
export const trafficSourceLabel = 'Traffic source'

/**
 * The video list's traffic source filter: All sources first, then each source the list filters
 * by, named as the traffic sources view names it, by name.
 */
export const trafficSourceOptions: Option<ReachTrafficSourceType | typeof allTrafficSources>[] = [
  // Proposed in creator-analytics#944, for Nick's word for word approval on the epic's PR.
  { value: allTrafficSources, label: 'All sources' },
  ...reachTrafficSourceTypes
    .map((type) => ({ value: type, label: trafficSourceNameOf(type) }))
    .toSorted((a, b) => a.label.localeCompare(b.label, 'en')),
]

/** Impressions and a click-through rate as text. */
export interface ReachText {
  impressions: string
  /** A percentage with one decimal place, or "" with no impressions. */
  ctr: string
}

export interface TrafficSourceBar {
  type: string
  name: string
  engagedViews: string
  /** The source's share of the engaged views of all the video's sources, such as "(26%)". */
  share: string
  /** The bar's length, as a percentage of the longest. */
  width: number
}

/**
 * One bar per traffic source, in the API's order, each as long as its engaged views, with its share
 * of the engaged views of all the sources. A type Google adds after the names were approved shows
 * as Google's code.
 */
export function trafficSourceBarsOf(sources: TrafficSource[], locale?: string): TrafficSourceBar[] {
  const sourcesEngagedViews = sources.map(({ engagedViews }) => engagedViews)
  const most = Math.max(0, ...sourcesEngagedViews)
  const allEngagedViews = sourcesEngagedViews.reduce((sum, engagedViews) => sum + engagedViews, 0)
  return sources.map(({ type, engagedViews }) => ({
    type,
    name: trafficSourceNameOf(type),
    engagedViews: engagedViews.toLocaleString(locale),
    share: shareLabelOf(engagedViews, allEngagedViews),
    width: shareOf(engagedViews, most),
  }))
}

/**
 * The sources by impressions, most first, so those at 0 come last, and sources with as many in the
 * API's order, as `toSorted` is stable.
 */
function sourcesByImpressionsOf(sources: TrafficSource[]): TrafficSource[] {
  return sources.toSorted((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
}

/** A row of the video screen's impressions table, from a paid channel's history. */
export interface TrafficSourceReachRow extends ReachText {
  type: string
  name: string
  /** In a window after publish, the newest uploads' average for this source, when it has one. */
  average?: ReachText
}

/**
 * One row per traffic source, by impressions (`sourcesByImpressionsOf`), each with its impressions
 * and CTR as text, and with the newest average's sources (`averages`), that average for its type.
 */
export function trafficSourceReachRowsOf(
  sources: TrafficSource[],
  locale?: string,
  averages?: NewestTrafficSourceAverage[],
): TrafficSourceReachRow[] {
  return sourcesByImpressionsOf(sources).map(({ type, impressions, ctr }) => {
    const average = averages?.find((each) => each.type === type)
    return {
      type,
      name: trafficSourceNameOf(type),
      impressions: impressions === undefined ? '' : impressions.toLocaleString(locale),
      ctr: ctrTextOf(ctr ?? null, locale),
      ...(average
        ? {
            average: {
              impressions: Math.round(average.impressions).toLocaleString(locale),
              ctr: ctrTextOf(average.ctr, locale),
            },
          }
        : {}),
    }
  })
}
