import type { VideoNumbers } from '../channel-data.ts'
import {
  acceptsContentTypeFilter,
  asksChannel,
  channelNumbersOf,
  contentTypeFilterOf,
  metricHeader,
  type Report,
  videoMetricNamesOf,
} from './report.ts'
import { reportedDays, rowsOf } from './rows.ts'

const dayMs = 24 * 60 * 60 * 1000

function daysBetween(startDate: string, endDate: string): string[] {
  const days: string[] = []
  for (let day = new Date(startDate); day.toISOString().slice(0, 10) <= endDate; ) {
    days.push(day.toISOString().slice(0, 10))
    day = new Date(day.getTime() + dayMs)
  }
  return days
}

/**
 * The channel's numbers for each day of a range, `dimensions=day`: the channel's own days when it
 * holds them, and otherwise every day with zeros. With a `creatorContentType==` filter, the
 * format's own days, and none when it holds none.
 */
export const dailyTotals: Report = {
  matches: (query) =>
    asksChannel(query, 'day') && acceptsContentTypeFilter(query) && !!videoMetricNamesOf(query),
  needsMonetaryScope: () => false,
  answer(asked) {
    const { query } = asked
    const metrics = videoMetricNamesOf(query) ?? []
    const contentType = contentTypeFilterOf(query)
    const heldDays = channelNumbersOf(asked, contentType)?.days
    const zeroEveryDay = contentType === null && heldDays === undefined
    const numberOf = (day: string, metric: keyof VideoNumbers) =>
      metric === 'engagedViews' || metric === 'views' || metric === 'estimatedMinutesWatched'
        ? (heldDays?.[day]?.[metric] ?? 0)
        : 0
    const range = daysBetween(query.get('startDate') ?? '', query.get('endDate') ?? '')
    const days = reportedDays(
      asked,
      range.filter((day) => zeroEveryDay || (heldDays !== undefined && day in heldDays)),
      (day) => day,
    )
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: [
        { name: 'day', columnType: 'DIMENSION', dataType: 'STRING' },
        ...metrics.map(metricHeader),
      ],
      ...rowsOf(days.map((day) => [day, ...metrics.map((metric) => numberOf(day, metric))])),
    }
  },
}
