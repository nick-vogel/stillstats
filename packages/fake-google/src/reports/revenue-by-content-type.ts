import { channelOf, filterContentTypes } from '../channel-data.ts'
import { asksChannel, metricHeader, type Report } from './report.ts'
import { rowsOf } from './rows.ts'

/**
 * The `creatorContentType` row of the revenue YouTube ties to no video or format, with zero views,
 * from Nick's live check of 2026-10-08.
 */
const noFormat = 'creatorContentTypeUnspecified'

/**
 * The channel's estimated revenue by `creatorContentType` over a date range, with no filter: a row
 * for each format the channel holds revenue for, and one for the revenue tied to no format.
 */
export const revenueByContentType: Report = {
  matches: (query) =>
    asksChannel(query, 'creatorContentType') &&
    !query.has('filters') &&
    query.get('metrics') === 'estimatedRevenue',
  needsMonetaryScope: () => true,
  answer(asked) {
    const formats = channelOf(asked)?.formats ?? {}
    const noFormatRevenue = asked.youtubeChannelId
      ? asked.data.revenue.get(asked.youtubeChannelId)?.noFormatRevenue
      : undefined
    const rows = [
      ...filterContentTypes.flatMap((contentType) => {
        const revenue = formats[contentType]?.estimatedRevenue
        return revenue === undefined ? [] : [[contentType, revenue]]
      }),
      ...(noFormatRevenue === undefined ? [] : [[noFormat, noFormatRevenue]]),
    ]
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: [
        { name: 'creatorContentType', columnType: 'DIMENSION', dataType: 'STRING' },
        metricHeader('estimatedRevenue'),
      ],
      ...rowsOf(rows),
    }
  },
}
