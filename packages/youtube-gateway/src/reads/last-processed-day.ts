import { type DateRange, hourMs, type ReadDefinition } from '../read-definition.ts'
import { videoMetricNames } from './video-metrics.ts'

/**
 * The latest day of the range whose numbers Google has processed, or null when it has none. Google
 * says the answer "contains data up until the last day for which all metrics in the query are
 * available at the time of the query" (reports.query page, checked 2026-10-07), and it answers
 * which day that is only as a row. So this asks the video list's own metrics by day, and the
 * latest day with a row is the last day those metrics are processed.
 */
export const lastProcessedDay: ReadDefinition<DateRange, string | null> = {
  needs: ['yt-analytics.readonly'],
  cacheKey: ({ startDate, endDate }) => `lastProcessedDay:${startDate}:${endDate}`,
  cacheWindowMs: 6 * hourMs,
  async fetch(google, { startDate, endDate }) {
    const response = await google.analytics((api) =>
      api.reports.query({
        ids: 'channel==MINE',
        startDate,
        endDate,
        dimensions: 'day',
        metrics: videoMetricNames.join(','),
      }),
    )
    // The latest day, not the last row. Google documents no row order without `sort`, whose
    // dimensions or metrics "determine the sort order" (reports.query page, checked 2026-10-07).
    const days = (response.data.rows ?? []).map(([day]) => String(day)).sort()
    return days.at(-1) ?? null
  },
}
