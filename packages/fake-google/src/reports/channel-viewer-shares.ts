import {
  acceptsContentTypeFilter,
  asksChannel,
  channelNumbersOf,
  contentTypeFilterOf,
  metricHeader,
  type Report,
} from './report.ts'
import { rowsOf } from './rows.ts'

/**
 * The whole channel's `viewerPercentage` by one dimension, or one format's with a
 * `creatorContentType==` filter, with exactly that one metric, over any range, answering the rows
 * as held and no row when none is. A live check on Nick's channel on 2026-10-19 answered no Shorts
 * rows for either age group or gender in the last 28 days.
 */
function channelViewerShares(dimension: 'ageGroup' | 'gender'): Report {
  const field = dimension === 'ageGroup' ? 'ageGroups' : 'genders'
  return {
    matches: (query) =>
      asksChannel(query, dimension) &&
      acceptsContentTypeFilter(query) &&
      query.get('metrics') === 'viewerPercentage',
    needsMonetaryScope: () => false,
    answer(asked) {
      const held = channelNumbersOf(asked, contentTypeFilterOf(asked.query))?.[field] ?? {}
      return {
        kind: 'youtubeAnalytics#resultTable',
        columnHeaders: [
          { name: dimension, columnType: 'DIMENSION', dataType: 'STRING' },
          metricHeader('viewerPercentage'),
        ],
        ...rowsOf(Object.entries(held)),
      }
    },
  }
}

/** The channel's, or one format's, share of signed-in viewers' views by `ageGroup`. */
export const channelAgeGroups: Report = channelViewerShares('ageGroup')

/** The channel's, or one format's, share of signed-in viewers' views by `gender`. */
export const channelGenders: Report = channelViewerShares('gender')
