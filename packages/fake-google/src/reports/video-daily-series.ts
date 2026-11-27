import { oneVideoIdOf, oneVideoOf } from './one-video.ts'
import {
  asksChannel,
  asksRevenue,
  metricHeader,
  type Report,
  revenueMetricNames,
  videoReportMetricsOf,
} from './report.ts'
import { reportedDays, rowsOf } from './rows.ts'

// Google answers `estimatedRevenue` beside the three in one `dimensions=day` query of one video, as
// the since publish table reads them (a live check through the youtube MCP on 2026-10-09).
const dailyMetrics = [
  'engagedViews',
  'views',
  'estimatedMinutesWatched',
  'estimatedRevenue',
] as const

/**
 * A video's numbers by day, with or without its revenue, or its revenue sources, the way its detail
 * screen reads them.
 */
function dailyMetricNamesOf(query: URLSearchParams) {
  return videoReportMetricsOf(query, dailyMetrics, revenueMetricNames)
}

/**
 * One video's engaged views, views and watch time, with its revenue or not, or its revenue and its
 * ad and YouTube Premium sources, for each day of a range: `dimensions=day` and a `video==<id>`
 * filter. The fake answers the days the video holds, a revenue day of 0 included, where Google
 * leaves out a day with no revenue (a live check through the youtube MCP on 2026-10-09). Both reach
 * the same zero-filled days. Any revenue metric needs the monetary scope.
 */
export const videoDailySeries: Report = {
  matches: (query) =>
    asksChannel(query, 'day') && !!oneVideoIdOf(query) && !!dailyMetricNamesOf(query),
  needsMonetaryScope: asksRevenue,
  answer(asked) {
    const metrics = dailyMetricNamesOf(asked.query) ?? []
    const days = reportedDays(asked, oneVideoOf(asked)?.days ?? [], ({ day }) => day)
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: [
        { name: 'day', columnType: 'DIMENSION', dataType: 'STRING' },
        ...metrics.map(metricHeader),
      ],
      ...rowsOf(days.map((day) => [day.day, ...metrics.map((metric) => day[metric] ?? 0)])),
    }
  },
}
