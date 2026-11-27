import { hourMs, type ReadDefinition } from '../read-definition.ts'
import {
  type ChannelRangeRequest,
  channelRangeKeyOf,
  contentTypeFiltersOf,
} from './channel-metrics.ts'
import type { EngagedViewsAndViews } from './one-video.ts'
import { recordsOf } from './result-table.ts'

/** Engaged views and views by Google's value of the read's dimension. */
export type BreakdownNumbers = Record<string, EngagedViewsAndViews>

/**
 * The whole channel's engaged views and views by one dimension over the range, or one format's, in
 * one query. A row of 0 engaged views and 0 views is dropped: nobody watched under that value.
 */
export function channelBreakdownRead(
  name: string,
  dimension: string,
): ReadDefinition<ChannelRangeRequest, BreakdownNumbers> {
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
          metrics: 'engagedViews,views',
          ...contentTypeFiltersOf(request),
        }),
      )
      return Object.fromEntries(
        recordsOf(response.data).flatMap((record) => {
          const engagedViews = Number(record.engagedViews ?? 0)
          const views = Number(record.views ?? 0)
          return engagedViews || views ? [[String(record[dimension]), { engagedViews, views }]] : []
        }),
      )
    },
  }
}

// A live check on Nick's channel on 2026-10-19 answered Shorts rows for the last 28 days to each of
// the three reads below. Google's Dimensions page lists the values in each comment (checked
// 2026-10-20), and the same check found Google answering operating systems the page does not list.

/**
 * By Google's `deviceType`: `DESKTOP`, `MOBILE`, `TABLET`, `TV`, `GAME_CONSOLE`, `AUTOMOTIVE`,
 * `WEARABLE` or `UNKNOWN_PLATFORM`.
 */
export const channelDevices = channelBreakdownRead('channelDevices', 'deviceType')

/** By Google's `operatingSystem`, such as `WINDOWS`, `MACINTOSH`, `ANDROID` or `IOS`. */
export const channelOperatingSystems = channelBreakdownRead(
  'channelOperatingSystems',
  'operatingSystem',
)

/**
 * By Google's `subscribedStatus`, `SUBSCRIBED` or `UNSUBSCRIBED`, for the whole channel. A video's
 * split is `subscriberSplit`'s.
 */
export const channelSubscriberSplit = channelBreakdownRead(
  'channelSubscriberSplit',
  'subscribedStatus',
)
