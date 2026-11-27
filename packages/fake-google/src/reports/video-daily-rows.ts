import { channelOf } from '../channel-data.ts'
import {
  asksChannel,
  asksRevenue,
  metricHeader,
  type Report,
  revenueMetricNames,
  videoIdsOf,
  videoReportMetricsOf,
} from './report.ts'
import { reportedDays, rowsOf } from './rows.ts'

const dailyMetrics = [
  'engagedViews',
  'views',
  'subscribersGained',
  'estimatedMinutesWatched',
] as const

/** A video's numbers by day, or its revenue and its sources, the way the video list reads them. */
function dailyMetricNamesOf(query: URLSearchParams) {
  return videoReportMetricsOf(query, dailyMetrics, revenueMetricNames)
}

/**
 * Each listed video's numbers, or its revenue and its sources, for each day of a range:
 * `dimensions=video,day` with a `video==` filter. The fake answers the days each video holds, and
 * a revenue report leaves out a day with no revenue, as Google does (a live check through the
 * youtube MCP on 2026-10-09), so a video that earned nothing in the range answers no day.
 */
export const videoDailyRows: Report = {
  matches: (query) =>
    asksChannel(query, 'video,day') && !!videoIdsOf(query) && !!dailyMetricNamesOf(query),
  needsMonetaryScope: asksRevenue,
  answer(asked) {
    const metrics = dailyMetricNamesOf(asked.query) ?? []
    const ids = new Set(videoIdsOf(asked.query))
    const revenue = asksRevenue(asked.query)
    const rows = (channelOf(asked)?.uploads ?? [])
      .filter((upload) => ids.has(upload.videoId))
      .flatMap((upload) =>
        reportedDays(asked, upload.days ?? [], ({ day }) => day)
          .map((day) => ({ day: day.day, values: metrics.map((metric) => day[metric] ?? 0) }))
          .filter(({ values }) => !revenue || values.some((value) => value !== 0))
          .map(({ day, values }) => [upload.videoId, day, ...values]),
      )
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: [
        { name: 'video', columnType: 'DIMENSION', dataType: 'STRING' },
        { name: 'day', columnType: 'DIMENSION', dataType: 'STRING' },
        ...metrics.map(metricHeader),
      ],
      ...rowsOf(rows),
    }
  },
}
