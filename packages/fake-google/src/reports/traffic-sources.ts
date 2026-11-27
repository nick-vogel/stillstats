import { oneVideoIdOf, oneVideoOf } from './one-video.ts'
import { asksChannel, metricHeader, type Report } from './report.ts'
import { rowsOf } from './rows.ts'

/**
 * One video's engaged views and views by `insightTrafficSourceType`, with exactly those two metrics
 * and a `video==` filter of one id. The fake answers the types the video holds for any range, and
 * omits a type it holds neither for.
 */
export const trafficSources: Report = {
  matches: (query) =>
    asksChannel(query, 'insightTrafficSourceType') &&
    !!oneVideoIdOf(query) &&
    query.get('metrics') === 'engagedViews,views',
  needsMonetaryScope: () => false,
  answer(asked) {
    const sources = Object.entries(oneVideoOf(asked)?.trafficSources ?? {})
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: [
        { name: 'insightTrafficSourceType', columnType: 'DIMENSION', dataType: 'STRING' },
        metricHeader('engagedViews'),
        metricHeader('views'),
      ],
      ...rowsOf(
        sources.flatMap(([type, { engagedViews, views }]) =>
          engagedViews || views ? [[type, engagedViews, views]] : [],
        ),
      ),
    }
  },
}
