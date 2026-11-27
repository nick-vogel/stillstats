import type { Asked } from '../channel-data.ts'

/** The rows of a report. Google omits rows when it has no data for the range. */
export function rowsOf(rows: unknown[][]): { rows?: unknown[][] } {
  return rows.length > 0 ? { rows } : {}
}

/**
 * The days of a `dimensions=day` report: those in its range up to the last processed day, as
 * Google's rows end there. Newest first, so a client that relies on row order fails here. The
 * reports.query page names `sort` as what sets the order and documents no order without it
 * (checked 2026-10-07).
 */
export function reportedDays<T>({ query, data }: Asked, days: T[], dayOf: (day: T) => string): T[] {
  const startDate = query.get('startDate') ?? ''
  const endDate = query.get('endDate') ?? ''
  const lastDay =
    data.lastProcessedDay && data.lastProcessedDay < endDate ? data.lastProcessedDay : endDate
  return days
    .filter((day) => dayOf(day) >= startDate && dayOf(day) <= lastDay)
    .toSorted((a, b) => dayOf(b).localeCompare(dayOf(a)))
}
