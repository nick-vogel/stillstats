import { channelOf, type FakeUpload } from '../channel-data.ts'
import {
  asksChannel,
  asksRevenue,
  coversLifetime,
  metricHeader,
  type Report,
  revenueMetricNames,
  videoIdsOf,
  videoMetricNames,
  videoReportMetricsOf,
} from './report.ts'

/** A video's numbers, or its revenue and its sources, the way the video list reads them. */
function metricNamesOf(query: URLSearchParams) {
  return videoReportMetricsOf(query, videoMetricNames, revenueMetricNames)
}

/**
 * Each listed video's numbers, or its revenue and its sources, over a date range:
 * `dimensions=video` with a `video==` filter. The fake answers the numbers a video holds for that
 * exact range. Failing that, it answers a video's lifetime numbers to a range that starts on or
 * before the channel's creation day, and omits the video from any other range.
 */
export const videoTotals: Report = {
  matches: (query) => asksChannel(query, 'video') && !!videoIdsOf(query) && !!metricNamesOf(query),
  needsMonetaryScope: asksRevenue,
  answer(asked) {
    const { query } = asked
    const metrics = metricNamesOf(query) ?? []
    const ids = new Set(videoIdsOf(query))
    const [startDate, endDate] = [query.get('startDate') ?? '', query.get('endDate') ?? '']
    const channel = channelOf(asked)
    const lifetime = !!channel && coversLifetime(query, channel)
    const numbersOf = (upload: FakeUpload) =>
      upload.rangeMetrics?.find(
        (range) => range.startDate === startDate && range.endDate === endDate,
      )?.metrics ?? (lifetime ? upload.metrics : undefined)
    const rows = (channel?.uploads ?? []).flatMap((upload) => {
      const numbers = numbersOf(upload)
      return ids.has(upload.videoId) && numbers
        ? [[upload.videoId, ...metrics.map((metric) => numbers[metric] ?? 0)]]
        : []
    })
    return {
      kind: 'youtubeAnalytics#resultTable',
      columnHeaders: [
        { name: 'video', columnType: 'DIMENSION', dataType: 'STRING' },
        ...metrics.map(metricHeader),
      ],
      ...(rows.length > 0 ? { rows } : {}),
    }
  },
}
