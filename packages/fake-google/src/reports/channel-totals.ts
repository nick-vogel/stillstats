import type { ChannelNumbers } from '../channel-data.ts'
import {
  acceptsContentTypeFilter,
  asksChannel,
  channelNumbersOf,
  contentTypeFilterOf,
  metricHeader,
  type Report,
} from './report.ts'
import { rowsOf } from './rows.ts'

/** The metric lists the fake answers: the channel's watch time is asked for or left out. */
const totalsMetrics: Record<string, (keyof ChannelNumbers)[]> = {
  'engagedViews,views': ['engagedViews', 'views'],
  'engagedViews,views,estimatedMinutesWatched': [
    'engagedViews',
    'views',
    'estimatedMinutesWatched',
  ],
}

function totalsMetricsOf(query: URLSearchParams): (keyof ChannelNumbers)[] | undefined {
  const metrics = query.get('metrics') ?? ''
  return Object.hasOwn(totalsMetrics, metrics) ? totalsMetrics[metrics] : undefined
}

/**
 * The whole channel's engaged views and views, and its watch time when asked, over a date range, or
 * one format's with a `creatorContentType==` filter: no dimension.
 */
export const channelTotals: Report = {
  matches: (query) =>
    asksChannel(query, null) && acceptsContentTypeFilter(query) && !!totalsMetricsOf(query),
  needsMonetaryScope: () => false,
  answer(asked) {
    const metrics = totalsMetricsOf(asked.query) ?? []
    const totals = channelNumbersOf(asked, contentTypeFilterOf(asked.query))?.totals
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: metrics.map(metricHeader),
      ...rowsOf(totals ? [metrics.map((metric) => totals[metric] ?? 0)] : []),
    }
  },
}
