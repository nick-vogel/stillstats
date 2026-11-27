import { type DateRange, hourMs, type ReadDefinition } from '../read-definition.ts'
import { channelRangeKeyOf } from './channel-metrics.ts'
import type { EngagedViewsAndViews } from './one-video.ts'
import { recordsOf } from './result-table.ts'

/**
 * By Google's `province`, ISO 3166-2 such as `US-CA`; `US-ZZ` for a state it could not identify.
 */
export type UsStateNumbers = Record<string, EngagedViewsAndViews>

/**
 * The whole channel's engaged views and views by US state over the range, in one query, filtered
 * to `country==US` as Google requires of a province query. Every format, never one: the request is
 * a bare range, because a live check on Nick's channel on 2026-10-19 found Google answering wrong
 * numbers under a format filter (California 99 engaged views with
 * `creatorContentType==videoOnDemand` against 557 without, for August). The same check answered no
 * rows for 2026-09-17 to 2026-10-14, as the channel's data stops about 2026-08-29, and normal rows
 * for August and the last 365 days. Google leaves out states with few views, at limits it does not
 * publish. A row of 0 engaged views and 0 views is dropped: it is a state nobody watched from.
 */
export const channelUsStates: ReadDefinition<DateRange, UsStateNumbers> = {
  needs: ['yt-analytics.readonly'],
  cacheKey: (request) => channelRangeKeyOf('channelUsStates', request),
  cacheWindowMs: 6 * hourMs,
  async fetch(google, { startDate, endDate }) {
    const response = await google.analytics((api) =>
      api.reports.query({
        ids: 'channel==MINE',
        startDate,
        endDate,
        dimensions: 'province',
        filters: 'country==US',
        metrics: 'engagedViews,views',
      }),
    )
    return Object.fromEntries(
      recordsOf(response.data).flatMap((record) => {
        const engagedViews = Number(record.engagedViews ?? 0)
        const views = Number(record.views ?? 0)
        return engagedViews || views ? [[String(record.province), { engagedViews, views }]] : []
      }),
    )
  },
}
