import { type DateRange, hourMs, type ReadDefinition } from '../read-definition.ts'
import { channelRangeKeyOf } from './channel-metrics.ts'
import type { EngagedViewsAndViews } from './one-video.ts'
import { recordsOf } from './result-table.ts'

/**
 * Google's rows as a list, not a record by name: Google documents no format for a city's value,
 * and two cities can share a name, which a record would merge.
 */
export type CityNumbers = ({ name: string } & EngagedViewsAndViews)[]

// Google's channel reports page says the city report requires a `sort` and a `maxResults` of 250
// or less (checked 2026-10-20).
const maxCities = 250

/**
 * The whole channel's engaged views and views by city over the range, in one query: the 250 cities
 * with most views. Every format, never one: the request is a bare range, because a live check on
 * Nick's channel on 2026-10-19 found Google answering wrong numbers under a format filter (one
 * row, Mumbai, with 0, for August with `creatorContentType==videoOnDemand`). The same check
 * answered no rows for 2026-09-17 to 2026-10-14, as the channel's data stops about 2026-08-29, and
 * normal rows for August and the last 365 days. Google leaves out cities with few views, at limits
 * it does not publish. A row of 0 engaged views and 0 views is dropped: it is a city nobody watched
 * from.
 */
export const channelCities: ReadDefinition<DateRange, CityNumbers> = {
  needs: ['yt-analytics.readonly'],
  cacheKey: (request) => channelRangeKeyOf('channelCities', request),
  cacheWindowMs: 6 * hourMs,
  async fetch(google, { startDate, endDate }) {
    const response = await google.analytics((api) =>
      api.reports.query({
        ids: 'channel==MINE',
        startDate,
        endDate,
        dimensions: 'city',
        metrics: 'engagedViews,views',
        sort: '-views',
        maxResults: maxCities,
      }),
    )
    return recordsOf(response.data).flatMap((record) => {
      const engagedViews = Number(record.engagedViews ?? 0)
      const views = Number(record.views ?? 0)
      return engagedViews || views ? [{ name: String(record.city), engagedViews, views }] : []
    })
  },
}
