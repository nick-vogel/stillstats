import { oneVideoIdOf, oneVideoOf } from './one-video.ts'
import { asksChannel, metricHeader, type Report } from './report.ts'
import { rowsOf } from './rows.ts'

/**
 * One video's engaged views and views by `subscribedStatus`, with exactly those two metrics and a
 * `video==` filter of one id. The fake answers the split the video holds for any range, and omits
 * a status it holds neither for.
 */
export const subscriberSplit: Report = {
  matches: (query) =>
    asksChannel(query, 'subscribedStatus') &&
    !!oneVideoIdOf(query) &&
    query.get('metrics') === 'engagedViews,views',
  needsMonetaryScope: () => false,
  answer(asked) {
    const sides = Object.entries(oneVideoOf(asked)?.subscriberNumbers ?? {})
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: [
        { name: 'subscribedStatus', columnType: 'DIMENSION', dataType: 'STRING' },
        metricHeader('engagedViews'),
        metricHeader('views'),
      ],
      ...rowsOf(
        sides.flatMap(([status, { engagedViews, views }]) =>
          engagedViews || views ? [[status, engagedViews, views]] : [],
        ),
      ),
    }
  },
}
