import { pacificDayOf } from '@creator-analytics/api-types'
import {
  type Asked,
  channelOf,
  type FakeChannel,
  type FakeFormatNumbers,
  type FakeUpload,
  type FilterContentType,
  filterContentTypes,
  type RevenueNumbers,
  type VideoNumbers,
} from '../channel-data.ts'

/**
 * One Analytics API report the fake answers. The fake answers 400 to a report it does not support,
 * the way Google answers 400 to a query it cannot serve ("The query is not supported", from the
 * Analytics API's channel reports page, checked 2026-10-07). Google serves combinations the fake
 * refuses, such as a video's views and revenue in one query with no dimension, which the gateway
 * never sends.
 */
export interface Report {
  matches(query: URLSearchParams): boolean
  /** Revenue metrics need the monetary scope. */
  needsMonetaryScope(query: URLSearchParams): boolean
  answer(asked: Asked): unknown
}

const date = /^\d{4}-\d{2}-\d{2}$/

/** A query of the signed-in channel over a date range, with these dimensions and no others. */
export function asksChannel(query: URLSearchParams, dimensions: string | null): boolean {
  return (
    query.get('ids') === 'channel==MINE' &&
    query.get('dimensions') === dimensions &&
    date.test(query.get('startDate') ?? '') &&
    date.test(query.get('endDate') ?? '')
  )
}

/** The value Google accepts in the query's `creatorContentType==` filter, or null for none. */
export function contentTypeFilterOf(query: URLSearchParams): FilterContentType | null {
  const contentType = query.get('filters')?.match(/^creatorContentType==(.+)$/)?.[1]
  return filterContentTypes.find((accepted) => accepted === contentType) ?? null
}

/**
 * Whether a channel-wide query has no filter, or a `creatorContentType==` filter of a value Google
 * accepts. Any other filter leaves the query unmatched, so the fake answers 400 as Google does to
 * an uppercase value.
 */
export function acceptsContentTypeFilter(query: URLSearchParams): boolean {
  return !query.has('filters') || contentTypeFilterOf(query) !== null
}

/**
 * The totals, days, countries, devices, operating systems, subscribed statuses, age groups and
 * genders a channel-wide query reads: the channel's own with no filter, and the format's own with a
 * content type filter. Not the channel's revenue, which the fake holds in `data.revenue`, outside
 * the channel's numbers.
 */
export function channelNumbersOf(
  asked: Asked,
  contentType: FilterContentType | null,
):
  | Pick<
      FakeFormatNumbers,
      | 'totals'
      | 'days'
      | 'countries'
      | 'devices'
      | 'operatingSystems'
      | 'subscribedStatuses'
      | 'ageGroups'
      | 'genders'
    >
  | undefined {
  const channel = channelOf(asked)
  return contentType ? channel?.formats?.[contentType] : channel
}

// The filters parameter "can specify up to 500 IDs", from the Analytics API's reports.query page,
// checked 2026-10-07.
const maxVideoIds = 500

/** The ids of a `video==` filter, when it lists no more than Google takes. */
export function videoIdsOf(query: URLSearchParams): string[] | undefined {
  const ids = query
    .get('filters')
    ?.match(/^video==([^;]+)$/)?.[1]
    ?.split(',')
  return ids && ids.length <= maxVideoIds ? ids : undefined
}

/**
 * Whether the query's range covers the channel's lifetime numbers: it starts on or before the
 * channel's creation day.
 */
export function coversLifetime(query: URLSearchParams, channel: FakeChannel): boolean {
  return (query.get('startDate') ?? '') <= pacificDayOf(channel.createdAt)
}

/**
 * The channel's uploads, when the query's range covers their lifetime numbers, and none for any
 * other range.
 */
export function lifetimeUploadsOf(asked: Asked): FakeUpload[] {
  const channel = channelOf(asked)
  return channel && coversLifetime(asked.query, channel) ? channel.uploads : []
}

export type Metric = keyof VideoNumbers | keyof RevenueNumbers | 'viewerPercentage'

// Google's metrics page names no data type for estimatedMinutesWatched or the revenue metrics
// (checked 2026-10-09); the fake answers whole minutes, and revenue with its cents. It names
// viewerPercentage a percentage, which the fake answers with its decimals. Average view duration
// is whole seconds, and likes, comments and shares are counts.
const dataTypes: Record<Metric, 'INTEGER' | 'FLOAT'> = {
  engagedViews: 'INTEGER',
  views: 'INTEGER',
  averageViewPercentage: 'FLOAT',
  subscribersGained: 'INTEGER',
  estimatedMinutesWatched: 'INTEGER',
  averageViewDuration: 'INTEGER',
  likes: 'INTEGER',
  comments: 'INTEGER',
  shares: 'INTEGER',
  estimatedRevenue: 'FLOAT',
  estimatedAdRevenue: 'FLOAT',
  estimatedRedPartnerRevenue: 'FLOAT',
  viewerPercentage: 'FLOAT',
}

/** The revenue metrics the fake answers: the total, then its ad and YouTube Premium sources. */
export const revenueMetricNames = [
  'estimatedRevenue',
  'estimatedAdRevenue',
  'estimatedRedPartnerRevenue',
] as const satisfies readonly (keyof RevenueNumbers)[]

export const videoMetricNames: (keyof VideoNumbers)[] = [
  'engagedViews',
  'views',
  'averageViewPercentage',
  'subscribersGained',
  'estimatedMinutesWatched',
]

/** The query's metrics, when each is one of the video numbers the fake holds. */
export function videoMetricNamesOf(query: URLSearchParams): (keyof VideoNumbers)[] | undefined {
  const metrics = (query.get('metrics') ?? '').split(',')
  const known = metrics.filter((metric): metric is keyof VideoNumbers =>
    (videoMetricNames as string[]).includes(metric),
  )
  return known.length > 0 && known.length === metrics.length ? known : undefined
}

export function metricHeader(metric: Metric) {
  return { name: metric, columnType: 'METRIC', dataType: dataTypes[metric] }
}

/**
 * The query's metrics, when each is one a video report answers: each one of `metrics`, or each one
 * of `revenueMetrics`. A report answers a revenue metric beside the views in one query only when
 * `metrics` names it, as the since publish days do; the others answer a video's views or its
 * revenue apart, as the gateway reads them.
 */
export function videoReportMetricsOf<M extends Metric>(
  query: URLSearchParams,
  metrics: readonly M[],
  revenueMetrics: readonly (keyof RevenueNumbers)[],
): (M | keyof RevenueNumbers)[] | undefined {
  return metricsAmong(query, metrics) ?? metricsAmong(query, revenueMetrics)
}

/** The query's metrics, when each is one of these names. */
function metricsAmong<N extends string>(
  query: URLSearchParams,
  names: readonly N[],
): N[] | undefined {
  const metrics = (query.get('metrics') ?? '').split(',')
  return metrics.every((metric) => (names as readonly string[]).includes(metric))
    ? (metrics as N[])
    : undefined
}

/** Whether any of the query's metrics is a revenue metric, which needs the monetary scope. */
export function asksRevenue(query: URLSearchParams): boolean {
  return (query.get('metrics') ?? '')
    .split(',')
    .some((metric) => (revenueMetricNames as readonly string[]).includes(metric))
}
