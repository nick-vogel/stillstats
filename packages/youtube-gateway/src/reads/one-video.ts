import type { ScopeName } from '@creator-analytics/token-vault'
import { type DateRange, hourMs, type ReadDefinition } from '../read-definition.ts'
import { currencyParamOf, type InCurrency } from './channel-metrics.ts'
import { recordsOf } from './result-table.ts'

export interface OneVideoRequest extends DateRange {
  videoId: string
}

/** A video's engaged views and views under one value of a dimension, such as a traffic source. */
export interface EngagedViewsAndViews {
  engagedViews: number
  views: number
}

/** A request for one video's revenue over the range, in a currency. */
export type OneVideoRevenueRequest = OneVideoRequest & InCurrency

/**
 * A read that makes one Analytics query of the request's video over the request's range. A request
 * with a currency sends it, and its cache key ends with it, so each currency keeps its own entry.
 */
export function oneVideoRead<V, R extends OneVideoRequest = OneVideoRequest>({
  cacheKeyPrefix,
  dimensions,
  metrics,
  needs = ['yt-analytics.readonly'],
  toValue,
}: {
  cacheKeyPrefix: string
  dimensions?: string
  metrics: string
  /** The scopes the read needs. Default: the Analytics scope, which reads no revenue. */
  needs?: ScopeName[]
  toValue(records: Record<string, unknown>[]): V
}): ReadDefinition<R, V> {
  return {
    needs,
    // A video id holds only letters, digits, `-` and `_`, so the key needs no escaping.
    cacheKey: (request: R & Partial<InCurrency>) => {
      const key = `${cacheKeyPrefix}:${request.videoId}:${request.startDate}:${request.endDate}`
      return request.currency === undefined ? key : `${key}:${request.currency}`
    },
    cacheWindowMs: 6 * hourMs,
    async fetch(google, request: R & Partial<InCurrency>) {
      const { startDate, endDate, videoId } = request
      const response = await google.analytics((api) =>
        api.reports.query({
          ids: 'channel==MINE',
          startDate,
          endDate,
          ...(dimensions === undefined ? {} : { dimensions }),
          filters: `video==${videoId}`,
          metrics,
          ...currencyParamOf(request),
        }),
      )
      return toValue(recordsOf(response.data))
    },
  }
}
