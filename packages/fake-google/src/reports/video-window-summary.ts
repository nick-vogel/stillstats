import { pacificDayOf } from '@creator-analytics/api-types'
import { channelOf } from '../channel-data.ts'
import { oneVideoIdOf, oneVideoOf } from './one-video.ts'
import {
  asksChannel,
  asksRevenue,
  coversLifetime,
  metricHeader,
  type Report,
  revenueMetricNames,
  videoMetricNames,
  videoReportMetricsOf,
} from './report.ts'
import { rowsOf } from './rows.ts'
import { numbersOverRange } from './video-numbers.ts'

/** A video's numbers, or its revenue sources, the way its detail screen reads them. */
function metricNamesOf(query: URLSearchParams) {
  return videoReportMetricsOf(query, videoMetricNames, revenueMetricNames)
}

/**
 * One video's numbers, or its revenue and its ad and YouTube Premium sources, over a date range: no
 * dimension and a `video==<id>` filter. The fake answers the numbers the video holds for that exact
 * range. Failing that, it answers the video's lifetime numbers to a range that starts on or before
 * its publish day, or for a video with no publish time on or before the channel's creation day,
 * and no row to any other range.
 */
export const videoWindowSummary: Report = {
  matches: (query) => asksChannel(query, null) && !!oneVideoIdOf(query) && !!metricNamesOf(query),
  needsMonetaryScope: asksRevenue,
  answer(asked) {
    const { query } = asked
    const metrics = metricNamesOf(query) ?? []
    const [startDate, endDate] = [query.get('startDate') ?? '', query.get('endDate') ?? '']
    const upload = oneVideoOf(asked)
    const channel = channelOf(asked)
    const lifetime = upload?.publishedAt
      ? startDate <= pacificDayOf(upload.publishedAt)
      : !!channel && coversLifetime(query, channel)
    const numbers = upload && numbersOverRange(upload, startDate, endDate, lifetime)
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: metrics.map(metricHeader),
      ...rowsOf(numbers ? [metrics.map((metric) => numbers[metric] ?? 0)] : []),
    }
  },
}
