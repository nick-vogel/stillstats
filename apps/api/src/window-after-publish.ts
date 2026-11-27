import {
  addDays,
  daysFrom,
  daysProcessedSince,
  isWindowFinished,
  type PartialWindow,
  videoWindowDays,
  type WindowAfterPublish,
} from '@creator-analytics/api-types'
import {
  type DateRange,
  maxVideosPerQuery,
  type VideoRangeRequest,
} from '@creator-analytics/youtube-gateway'

/**
 * The days of a window after publish: from the publish day, ending no later than today. A video
 * published after today has none, so the range runs backwards.
 */
export function rangeAfterPublish(
  window: WindowAfterPublish,
  publishDay: string,
  today: string,
): DateRange {
  const lastDay = addDays(publishDay, videoWindowDays[window] - 1)
  return { startDate: publishDay, endDate: lastDay < today ? lastDay : today }
}

/** The day's place in the window after publish: 1 on the publish day. */
export function dayAfterPublishOf(publishDay: string, day: string): number {
  return daysFrom(publishDay, day) + 1
}

/**
 * The days of the window Google has processed for the video, up to the last day it has processed
 * (`processedThroughOf`), when it has not finished the window (`isWindowFinished`, the rule the web
 * app's placeholder reads too), and no `partial` when it has. A video with no publish day, or one
 * Google has processed no day of, has 0.
 */
export function partialOf(
  window: WindowAfterPublish,
  publishDay: string | null,
  processedThrough: string,
): { partial?: PartialWindow } {
  if (isWindowFinished(window, publishDay, processedThrough)) return {}
  return {
    partial: {
      days: daysProcessedSince(publishDay, processedThrough),
      of: videoWindowDays[window],
    },
  }
}

/**
 * The video's engaged views on each day of its window after publish Google has processed, day 1
 * (the publish day) first: as many days as `partialOf` counts processed, and none for a video with
 * no publish day. A day with no row is 0, and a day outside those processed days counts nowhere.
 */
export function engagedViewsByDayOf(
  window: WindowAfterPublish,
  publishDay: string | null,
  processedThrough: string,
  days: { day: string; engagedViews: number }[],
): number[] {
  if (!publishDay) return []
  const byDay = Array.from(
    {
      length: Math.min(daysProcessedSince(publishDay, processedThrough), videoWindowDays[window]),
    },
    () => 0,
  )
  for (const { day, engagedViews } of days) {
    const index = dayAfterPublishOf(publishDay, day) - 1
    if (index >= 0 && index < byDay.length) byDay[index] = (byDay[index] ?? 0) + engagedViews
  }
  return byDay
}

// The longest range a daily rows query asks for: this project's own cap, to keep each query's rows
// small, and not a limit of Google's, which answered `dimensions=video,day` past it in a live check
// (see `videoDailyRows` in the gateway). Google answers a row for each day each video has numbers,
// so one range from the oldest upload to the newest would answer every day of every video. A query
// of at most 500 videos over at most 100 days answers at most 50,000 videos times days, the size
// the channel reports page allows the traffic source report (checked 2026-10-07).
const maxSliceDays = 100

export interface PublishedVideo {
  videoId: string
  publishDay: string
}

/**
 * The daily rows queries that cover every video's window. The days from the first publish day to
 * the last window's end are cut into consecutive slices of `maxSliceDays` days, and each slice asks
 * for the videos whose windows meet it, `maxVideosPerQuery` a query in publish day order, over the
 * slice's days up to the last of their windows' ends. A window can run over several slices, so a
 * video's days can come back in several queries, and the slices never share a day. A channel that
 * publishes at most 500 videos in any 464 days takes one query a slice: 1,200 daily uploads take 13
 * in first365 when read 1 to 100 days after the last upload, and 16 once every window has ended.
 */
export function dailyRowsQueriesOf(
  videos: PublishedVideo[],
  window: WindowAfterPublish,
  today: string,
): VideoRangeRequest[] {
  const ranges = videos
    .map((video) => ({ ...video, ...rangeAfterPublish(window, video.publishDay, today) }))
    .toSorted((a, b) => a.publishDay.localeCompare(b.publishDay))
  const first = ranges.at(0)?.startDate
  if (!first) return []
  const last = latestEndOf(ranges)
  const queries: VideoRangeRequest[] = []
  for (let sliceStart = first; sliceStart <= last; sliceStart = addDays(sliceStart, maxSliceDays)) {
    const sliceEnd = addDays(sliceStart, maxSliceDays - 1)
    const meeting = ranges.filter(
      ({ startDate, endDate }) => startDate <= sliceEnd && endDate >= sliceStart,
    )
    for (let start = 0; start < meeting.length; start += maxVideosPerQuery) {
      const chunk = meeting.slice(start, start + maxVideosPerQuery)
      const chunkEnd = latestEndOf(chunk)
      queries.push({
        startDate: sliceStart,
        endDate: chunkEnd < sliceEnd ? chunkEnd : sliceEnd,
        videoIds: chunk.map(({ videoId }) => videoId),
      })
    }
  }
  return queries
}

/** The last of the ranges' end days. */
function latestEndOf(ranges: DateRange[]): string {
  return ranges.reduce((end, { endDate }) => (endDate > end ? endDate : end), '')
}
