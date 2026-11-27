import type { DateRange, GoogleCalls } from '../read-definition.ts'
import { metricsOf, recordsOf } from './result-table.ts'

/**
 * The `creatorContentType` values Google accepts in a `filters=creatorContentType==` query, all
 * lowercase. A live check on 2026-10-08 refused the uppercase values Google's docs list, such as
 * `SHORTS` and `VIDEO_ON_DEMAND`, with a 400.
 */
export type FilterContentType = 'videoOnDemand' | 'shorts' | 'liveStream'

/** A channel-wide read over a date range, of every format or of one. */
export interface ChannelRangeRequest extends DateRange {
  /** Narrows the read to one format. Absent: every format, and no filter is sent. */
  creatorContentType?: FilterContentType
}

/** A revenue read's currency, which Google converts every amount into at its daily exchange rate. */
export interface InCurrency {
  /**
   * A three-letter ISO 4217 code from the list Google's Analytics API documents for `currency`.
   * The gateway sends it as given; the API checks it against Google's list.
   */
  currency: string
}

/** A channel-wide revenue read over a date range, of every format or of one, in a currency. */
export type ChannelRevenueRequest = ChannelRangeRequest & InCurrency

/** The `currency` parameter of a query: the request's, and none for a read with no currency. */
export function currencyParamOf(request: Partial<InCurrency>): { currency?: string } {
  return request.currency === undefined ? {} : { currency: request.currency }
}

/** The `filters` parameter of a channel-wide query: none for every format. */
export function contentTypeFiltersOf({ creatorContentType }: ChannelRangeRequest): {
  filters?: string
} {
  return creatorContentType ? { filters: `creatorContentType==${creatorContentType}` } : {}
}

/** The cache key of a channel-wide read. A read of every format carries no format in its key. */
export function channelRangeKeyOf(
  read: string,
  { startDate, endDate, creatorContentType }: ChannelRangeRequest,
): string {
  const key = `${read}:${startDate}:${endDate}`
  return creatorContentType ? `${key}:${creatorContentType}` : key
}

/**
 * The cache key of a channel-wide revenue read: its range key, then its currency, so each currency
 * keeps its own cache entry.
 */
export function revenueKeyOf(read: string, request: ChannelRevenueRequest): string {
  return `${channelRangeKeyOf(read, request)}:${request.currency}`
}

/**
 * The whole channel's metrics over a date range, or one format's: one query, no dimension. A
 * request with a currency sends it.
 */
export async function channelMetrics<M extends string>(
  google: GoogleCalls,
  request: ChannelRangeRequest & Partial<InCurrency>,
  metrics: readonly M[],
): Promise<Record<M, number>> {
  const { startDate, endDate } = request
  const response = await google.analytics((api) =>
    api.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: metrics.join(','),
      ...contentTypeFiltersOf(request),
      ...currencyParamOf(request),
    }),
  )
  // Google omits the rows of a range with no data, which is a zero of each metric.
  const [record] = recordsOf(response.data)
  return metricsOf(record, metrics)
}

/**
 * The whole channel's metrics for each day of a date range, or one format's, oldest first: one
 * query, `dimensions=day`. A day Google has no row for is absent. A request with a currency sends
 * it.
 */
export async function channelDailyMetrics<M extends string>(
  google: GoogleCalls,
  request: ChannelRangeRequest & Partial<InCurrency>,
  metrics: readonly M[],
): Promise<(Record<M, number> & { day: string })[]> {
  const { startDate, endDate } = request
  const response = await google.analytics((api) =>
    api.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      dimensions: 'day',
      metrics: metrics.join(','),
      ...contentTypeFiltersOf(request),
      ...currencyParamOf(request),
    }),
  )
  const days = recordsOf(response.data).map((record) => ({
    day: String(record.day),
    ...metricsOf(record, metrics),
  }))
  // Oldest first, not the row order. Google documents no row order without `sort`, whose
  // dimensions or metrics "determine the sort order" (reports.query page, checked 2026-10-07).
  return days.sort((a, b) => a.day.localeCompare(b.day))
}
