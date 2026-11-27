import { channelOf } from '../channel-data.ts'
import { asksChannel, metricHeader, type Report } from './report.ts'
import { rowsOf } from './rows.ts'

// Google's channel reports page says the city report requires a `sort`, of `views` or
// `estimatedMinutesWatched`, and a `maxResults` of 250 or less (checked 2026-10-20). The fake holds
// no minutes watched by city, so it takes the views sorts only.
const maxCities = 250
const sorts = ['-views', 'views']

function citiesCapOf(query: URLSearchParams): number | undefined {
  const maxResults = Number(query.get('maxResults'))
  return Number.isInteger(maxResults) && maxResults >= 1 && maxResults <= maxCities
    ? maxResults
    : undefined
}

/**
 * The whole channel's engaged views and views by `city`, with exactly those two metrics, a views
 * sort and a cap, and no filter, over any range. The fake answers its rows by most views, or by
 * fewest for `views`, cut to `maxResults`, a row of 0 engaged views and 0 views included, so the
 * gateway's drop of such a row shows. It answers 400 to any filter: a live check on Nick's channel
 * on 2026-10-19 found Google answering wrong numbers under a format filter (one row, Mumbai, with
 * 0, for August with `creatorContentType==videoOnDemand`), so a format filter here fails loudly.
 * The same check answered no rows for 2026-09-17 to 2026-10-14 and normal rows for August and the
 * last 365 days.
 */
export const channelCities: Report = {
  matches: (query) =>
    asksChannel(query, 'city') &&
    !query.has('filters') &&
    query.get('metrics') === 'engagedViews,views' &&
    sorts.includes(query.get('sort') ?? '') &&
    citiesCapOf(query) !== undefined,
  needsMonetaryScope: () => false,
  answer(asked) {
    const held = Object.entries(channelOf(asked)?.cities ?? {})
    const fewestFirst = asked.query.get('sort') === 'views'
    const sorted = held.toSorted(([, a], [, b]) =>
      fewestFirst ? a.views - b.views : b.views - a.views,
    )
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: [
        { name: 'city', columnType: 'DIMENSION', dataType: 'STRING' },
        metricHeader('engagedViews'),
        metricHeader('views'),
      ],
      ...rowsOf(
        sorted
          .slice(0, citiesCapOf(asked.query))
          .map(([name, { engagedViews, views }]) => [name, engagedViews, views]),
      ),
    }
  },
}
