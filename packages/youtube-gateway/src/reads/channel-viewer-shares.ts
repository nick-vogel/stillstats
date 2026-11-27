import { hourMs, type ReadDefinition } from '../read-definition.ts'
import {
  type ChannelRangeRequest,
  channelRangeKeyOf,
  contentTypeFiltersOf,
} from './channel-metrics.ts'
import { recordsOf } from './result-table.ts'

/** Google's `viewerPercentage`, 0 to 100, by Google's value of the read's dimension. */
export type ViewerShares = Record<string, number>

/**
 * The whole channel's share of signed-in viewers' views by one dimension over the range, or one
 * format's, in one query. Two reads, one by `ageGroup` and one by `gender`, not one of
 * `ageGroup,gender`: `viewerPercentage` is the share of signed-in viewers' views, and Google does
 * not normalize it across combined dimensions, so each read carries its own shares. Every row
 * Google answers is kept, a 0 share included. A live check on Nick's channel on 2026-10-19 answered
 * no Shorts rows for either in the last 28 days.
 */
function channelViewerShares(
  name: 'channelAgeGroups' | 'channelGenders',
  dimension: 'ageGroup' | 'gender',
): ReadDefinition<ChannelRangeRequest, ViewerShares> {
  return {
    needs: ['yt-analytics.readonly'],
    cacheKey: (request) => channelRangeKeyOf(name, request),
    cacheWindowMs: 6 * hourMs,
    async fetch(google, request) {
      const { startDate, endDate } = request
      const response = await google.analytics((api) =>
        api.reports.query({
          ids: 'channel==MINE',
          startDate,
          endDate,
          dimensions: dimension,
          metrics: 'viewerPercentage',
          ...contentTypeFiltersOf(request),
        }),
      )
      return Object.fromEntries(
        recordsOf(response.data).map((record) => [
          String(record[dimension]),
          Number(record.viewerPercentage ?? 0),
        ]),
      )
    },
  }
}

/** By Google's `ageGroup`, such as `age18-24`. */
export const channelAgeGroups = channelViewerShares('channelAgeGroups', 'ageGroup')

/** By Google's `gender`: `female`, `male` or `user_specified`. */
export const channelGenders = channelViewerShares('channelGenders', 'gender')
