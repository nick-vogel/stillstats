import { type Asked, channelOf, type FakeRevenue, type RevenueNumbers } from '../channel-data.ts'
import {
  acceptsContentTypeFilter,
  asksChannel,
  contentTypeFilterOf,
  metricHeader,
  type Report,
  revenueMetricNames,
} from './report.ts'
import { rowsOf } from './rows.ts'

/** The metric lists the fake answers: the total alone, or with its sources. */
const revenueMetricLists = ['estimatedRevenue', revenueMetricNames.join(',')]

/** The query's revenue metrics, when it asks for a list the fake answers. */
export function revenueMetricsOf(
  query: URLSearchParams,
  lists: string[] = revenueMetricLists,
): (keyof RevenueNumbers)[] | undefined {
  const metrics = query.get('metrics') ?? ''
  return lists.includes(metrics) ? (metrics.split(',') as (keyof RevenueNumbers)[]) : undefined
}

/** A revenue figure of each metric, a zero for a source left unset. */
export function revenueCellsOf(
  revenue: RevenueNumbers,
  metrics: (keyof RevenueNumbers)[],
): number[] {
  return metrics.map((metric) => revenue[metric] ?? 0)
}

/**
 * The revenue a channel-wide query reads: the channel's own with no filter, and the format's own
 * with a `creatorContentType==` filter, its days as `days` either way.
 */
export function revenueOf(asked: Asked): Partial<FakeRevenue> | undefined {
  const contentType = contentTypeFilterOf(asked.query)
  if (!contentType) {
    return asked.youtubeChannelId ? asked.data.revenue.get(asked.youtubeChannelId) : undefined
  }
  // Not the format itself: its `days` are its views by day.
  const {
    revenueDays,
    totals: _totals,
    days: _days,
    ...revenue
  } = channelOf(asked)?.formats?.[contentType] ?? {}
  return { ...revenue, ...(revenueDays ? { days: revenueDays } : {}) }
}

/**
 * The whole channel's estimated revenue over a date range, in the currency the report asks for,
 * alone or with its ad and YouTube Premium sources, or one format's with a `creatorContentType==`
 * filter.
 */
export const estimatedRevenue: Report = {
  matches: (query) =>
    asksChannel(query, null) && acceptsContentTypeFilter(query) && !!revenueMetricsOf(query),
  needsMonetaryScope: () => true,
  answer(asked) {
    const metrics = revenueMetricsOf(asked.query) ?? []
    const revenue = revenueOf(asked)
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: metrics.map(metricHeader),
      ...rowsOf(
        revenue?.estimatedRevenue === undefined
          ? []
          : [revenueCellsOf({ ...revenue, estimatedRevenue: revenue.estimatedRevenue }, metrics)],
      ),
    }
  },
}
