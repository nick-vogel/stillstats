import { reportingDayOf } from '@creator-analytics/youtube-gateway'
import { lastProcessedDaySearch } from '../src/calendar-range.ts'
import type { StartedApi } from './start-api.ts'

// A custom range's queries that are bad before any read, in the order the issue lists the causes:
// `from` or `to` without window=custom, window=custom without both, a day that does not parse, an
// end before the start, and a repeated `from` or `to`.
export const badRangeQueries: [string, string][][] = [
  [['from', '2026-09-01']],
  [
    ['window', 'last28'],
    ['to', '2026-09-30'],
  ],
  [
    ['window', 'custom'],
    ['from', '2026-09-01'],
  ],
  [
    ['window', 'custom'],
    ['to', '2026-09-30'],
  ],
  [['window', 'custom']],
  [
    ['window', 'custom'],
    ['from', '2026-02-30'],
    ['to', '2026-03-02'],
  ],
  [
    ['window', 'custom'],
    ['from', 'yesterday'],
    ['to', '2026-09-30'],
  ],
  [
    ['window', 'custom'],
    ['from', '2026-09-30'],
    ['to', '2026-09-29'],
  ],
  [
    ['window', 'custom'],
    ['from', '2026-09-01'],
    ['from', '2026-09-02'],
    ['to', '2026-09-30'],
  ],
  [
    ['window', 'custom'],
    ['from', '2026-09-01'],
    ['to', '2026-09-30'],
    ['to', '2026-09-29'],
  ],
]

/**
 * The Analytics queries other than the last processed day's search, which a custom range's bound
 * checks need, as the API runs it at `now`.
 */
export function metricQueriesOf(api: StartedApi, now: Date) {
  const { startDate, endDate } = lastProcessedDaySearch(reportingDayOf(now))
  return api.google.analyticsRequests.filter(
    (query) => query.get('startDate') !== startDate || query.get('endDate') !== endDate,
  )
}
