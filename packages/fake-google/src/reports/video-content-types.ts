import { asksChannel, lifetimeUploadsOf, metricHeader, type Report, videoIdsOf } from './report.ts'

/**
 * Each listed video's content type and views over a date range: `dimensions=video,creatorContentType`
 * with a `video==` filter and `metrics=views`.
 */
export const videoContentTypes: Report = {
  matches: (query) =>
    asksChannel(query, 'video,creatorContentType') &&
    !!videoIdsOf(query) &&
    query.get('metrics') === 'views',
  needsMonetaryScope: () => false,
  answer(asked) {
    const ids = new Set(videoIdsOf(asked.query))
    const rows = lifetimeUploadsOf(asked).flatMap(
      ({ videoId, metrics, creatorContentType, contentTypeViews }) => {
        if (!ids.has(videoId)) return []
        const views =
          contentTypeViews ??
          (metrics ? { [creatorContentType ?? 'videoOnDemand']: metrics.views } : {})
        return Object.entries(views).map(([contentType, n]) => [videoId, contentType, n])
      },
    )
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: [
        { name: 'video', columnType: 'DIMENSION', dataType: 'STRING' },
        { name: 'creatorContentType', columnType: 'DIMENSION', dataType: 'STRING' },
        metricHeader('views'),
      ],
      ...(rows.length > 0 ? { rows } : {}),
    }
  },
}
