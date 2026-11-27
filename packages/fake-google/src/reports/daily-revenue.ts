import { revenueCellsOf, revenueMetricsOf, revenueOf } from './estimated-revenue.ts'
import {
  acceptsContentTypeFilter,
  asksChannel,
  metricHeader,
  type Report,
  revenueMetricNames,
} from './report.ts'
import { reportedDays, rowsOf } from './rows.ts'

/**
 * The channel's revenue and its ad and YouTube Premium sources for each day of a range,
 * `dimensions=day`, or one format's with a `creatorContentType==` filter: the days the channel or
 * the format holds revenue for, and no others.
 */
export const dailyRevenue: Report = {
  matches: (query) =>
    asksChannel(query, 'day') &&
    acceptsContentTypeFilter(query) &&
    !!revenueMetricsOf(query, [revenueMetricNames.join(',')]),
  needsMonetaryScope: () => true,
  answer(asked) {
    const heldDays = Object.entries(revenueOf(asked)?.days ?? {})
    const days = reportedDays(asked, heldDays, ([day]) => day)
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: [
        { name: 'day', columnType: 'DIMENSION', dataType: 'STRING' },
        ...revenueMetricNames.map(metricHeader),
      ],
      ...rowsOf(
        days.map(([day, revenue]) => [day, ...revenueCellsOf(revenue, [...revenueMetricNames])]),
      ),
    }
  },
}
