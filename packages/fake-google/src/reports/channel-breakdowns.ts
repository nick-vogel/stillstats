import {
  acceptsContentTypeFilter,
  asksChannel,
  channelNumbersOf,
  contentTypeFilterOf,
  metricHeader,
  type Report,
} from './report.ts'
import { rowsOf } from './rows.ts'

type BreakdownField = 'countries' | 'devices' | 'operatingSystems' | 'subscribedStatuses'

/**
 * The whole channel's engaged views and views by one dimension, or one format's with a
 * `creatorContentType==` filter, with exactly those two metrics, over any range. The fake answers
 * every row it holds, a row of 0 engaged views and 0 views included, so the gateway's drop of such
 * a row shows. A `video==` filter leaves the query unmatched, so the one video reports keep theirs.
 */
export function channelBreakdownReport(dimension: string, field: BreakdownField): Report {
  return {
    matches: (query) =>
      asksChannel(query, dimension) &&
      acceptsContentTypeFilter(query) &&
      query.get('metrics') === 'engagedViews,views',
    needsMonetaryScope: () => false,
    answer(asked) {
      const held = channelNumbersOf(asked, contentTypeFilterOf(asked.query))?.[field] ?? {}
      return {
        kind: 'youtubeAnalytics#resultTable',
        columnHeaders: [
          { name: dimension, columnType: 'DIMENSION', dataType: 'STRING' },
          metricHeader('engagedViews'),
          metricHeader('views'),
        ],
        ...rowsOf(
          Object.entries(held).map(([value, { engagedViews, views }]) => [
            value,
            engagedViews,
            views,
          ]),
        ),
      }
    },
  }
}

// A live check on Nick's channel on 2026-10-19 answered Shorts rows for the last 28 days to each of
// the three below.

/** By Google's `deviceType`, such as `MOBILE`. */
export const channelDevices: Report = channelBreakdownReport('deviceType', 'devices')

/** By Google's `operatingSystem`, such as `IOS`. */
export const channelOperatingSystems: Report = channelBreakdownReport(
  'operatingSystem',
  'operatingSystems',
)

/**
 * By Google's `subscribedStatus`, `SUBSCRIBED` or `UNSUBSCRIBED`, for the whole channel. A video's
 * split is the `subscriberSplit` report's, which takes a `video==` filter this one refuses.
 */
export const channelSubscriberSplit: Report = channelBreakdownReport(
  'subscribedStatus',
  'subscribedStatuses',
)
