import { type DateRange, hourMs, type ReadDefinition } from '../read-definition.ts'
import { currencyParamOf, type InCurrency, revenueKeyOf } from './channel-metrics.ts'
import { recordsOf } from './result-table.ts'

/**
 * The `creatorContentType` row of the revenue YouTube ties to no video or format. Nick's live check
 * of 2026-10-08 answered it with zero views; Google's docs do not name it.
 */
const noFormatType = 'creatorContentTypeUnspecified'

/** The channel's revenue over a range by format, as one query by `creatorContentType` answers it. */
export interface RevenueByFormat {
  /** The revenue YouTube ties to no video or format: 0 when Google answers no such row. */
  noFormat: number
  /**
   * The revenue of every format, the revenue tied to no format included: every row added up, 0
   * when Google answers none, as for a channel YouTube reports no revenue for.
   */
  everyFormat: number
}

/**
 * The channel's revenue by format over the range, in the request's currency: the
 * `creatorContentTypeUnspecified` row of one query by `creatorContentType`, with no filter, and
 * every row added up.
 */
export const channelRevenueByFormat: ReadDefinition<DateRange & InCurrency, RevenueByFormat> = {
  needs: ['yt-analytics-monetary.readonly'],
  cacheKey: (request) => revenueKeyOf('channelRevenueByFormat:v2', request),
  cacheWindowMs: 6 * hourMs,
  async fetch(google, request) {
    const { startDate, endDate } = request
    const response = await google.analytics((api) =>
      api.reports.query({
        ids: 'channel==MINE',
        startDate,
        endDate,
        dimensions: 'creatorContentType',
        metrics: 'estimatedRevenue',
        ...currencyParamOf(request),
      }),
    )
    const records = recordsOf(response.data)
    const row = records.find((record) => record.creatorContentType === noFormatType)
    return {
      noFormat: Number(row?.estimatedRevenue ?? 0),
      everyFormat: records.reduce((sum, record) => sum + Number(record.estimatedRevenue ?? 0), 0),
    }
  },
}
