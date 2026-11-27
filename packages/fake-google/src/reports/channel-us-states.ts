import { channelOf } from '../channel-data.ts'
import { asksChannel, metricHeader, type Report } from './report.ts'
import { rowsOf } from './rows.ts'

/**
 * The whole channel's engaged views and views by `province`, with exactly those two metrics and
 * the `country==US` filter Google requires of a province query, over any range. The fake answers
 * every row it holds, a row of 0 engaged views and 0 views included, so the gateway's drop of such
 * a row shows. It answers 400 to a format filter beside `country==US`: a live check on Nick's
 * channel on 2026-10-19 found Google answering wrong numbers under one (California 99 engaged views
 * with `creatorContentType==videoOnDemand` against 557 without, for August), so a format filter
 * here fails loudly. The same check answered no rows for 2026-09-17 to 2026-10-14 and normal rows
 * for August and the last 365 days.
 */
export const channelUsStates: Report = {
  matches: (query) =>
    asksChannel(query, 'province') &&
    query.get('filters') === 'country==US' &&
    query.get('metrics') === 'engagedViews,views',
  needsMonetaryScope: () => false,
  answer(asked) {
    const held = channelOf(asked)?.usStates ?? {}
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: [
        { name: 'province', columnType: 'DIMENSION', dataType: 'STRING' },
        metricHeader('engagedViews'),
        metricHeader('views'),
      ],
      ...rowsOf(
        Object.entries(held).map(([code, { engagedViews, views }]) => [code, engagedViews, views]),
      ),
    }
  },
}
