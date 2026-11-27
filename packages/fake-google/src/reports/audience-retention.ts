import { oneVideoIdOf, oneVideoOf } from './one-video.ts'
import { asksChannel, type Report } from './report.ts'
import { rowsOf } from './rows.ts'

const metrics = ['audienceWatchRatio', 'relativeRetentionPerformance'] as const

/**
 * One video's audience retention curve: `dimensions=elapsedVideoTimeRatio`, both ratios, and a
 * `video==` filter of one id, which Google requires. The fake answers the curve the video holds
 * for any range.
 */
export const audienceRetention: Report = {
  matches: (query) =>
    asksChannel(query, 'elapsedVideoTimeRatio') &&
    !!oneVideoIdOf(query) &&
    query.get('metrics') === metrics.join(','),
  needsMonetaryScope: () => false,
  answer(asked) {
    const points = oneVideoOf(asked)?.retention ?? []
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: [
        { name: 'elapsedVideoTimeRatio', columnType: 'DIMENSION', dataType: 'FLOAT' },
        ...metrics.map((name) => ({ name, columnType: 'METRIC', dataType: 'FLOAT' })),
      ],
      ...rowsOf(
        points.map((point) => [
          point.elapsedVideoTimeRatio,
          ...metrics.map((metric) => point[metric]),
        ]),
      ),
    }
  },
}
