import { pacificDayOf } from '@creator-analytics/api-types'
import type { VideoNumbers } from '../channel-data.ts'
import { oneVideoIdOf, oneVideoOf } from './one-video.ts'
import { asksChannel, metricHeader, type Report } from './report.ts'
import { rowsOf } from './rows.ts'
import { numbersOverRange } from './video-numbers.ts'

/**
 * The nine numbers a sponsor report reads of one video. Google lists them as supported together in
 * its "Video reports" basic stats (channel reports page, checked 2026-11-20). None is a revenue
 * metric, so a query naming one beside them is unmatched and the fake answers 400.
 */
const sponsorMetricNames = [
  'views',
  'engagedViews',
  'estimatedMinutesWatched',
  'averageViewDuration',
  'averageViewPercentage',
  'likes',
  'comments',
  'shares',
  'subscribersGained',
] as const satisfies readonly (keyof VideoNumbers)[]

type SponsorMetric = (typeof sponsorMetricNames)[number]

/** The query's metrics, when each is one of the nine. */
function metricNamesOf(query: URLSearchParams): SponsorMetric[] | undefined {
  const metrics = (query.get('metrics') ?? '').split(',')
  return metrics.every((metric) => (sponsorMetricNames as readonly string[]).includes(metric))
    ? (metrics as SponsorMetric[])
    : undefined
}

/**
 * One video's sponsor report numbers over a date range: no dimension, a `video==<id>` filter, and
 * metrics all among the nine. The fake answers the numbers the video holds for that exact range,
 * else its lifetime numbers to a range that starts on or before its publish day, and no row to any
 * other range, as `videoWindowSummary` does. A number the video does not hold is 0.
 */
export const videoSponsorFigures: Report = {
  matches: (query) => asksChannel(query, null) && !!oneVideoIdOf(query) && !!metricNamesOf(query),
  needsMonetaryScope: () => false,
  answer(asked) {
    const { query } = asked
    const metrics = metricNamesOf(query) ?? []
    const [startDate, endDate] = [query.get('startDate') ?? '', query.get('endDate') ?? '']
    const upload = oneVideoOf(asked)
    const lifetime = !!upload?.publishedAt && startDate <= pacificDayOf(upload.publishedAt)
    const numbers = upload && numbersOverRange(upload, startDate, endDate, lifetime)
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: metrics.map(metricHeader),
      ...rowsOf(numbers ? [metrics.map((metric) => numbers[metric] ?? 0)] : []),
    }
  },
}
