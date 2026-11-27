import {
  daysProcessedSince,
  pacificDayOf,
  type VideoRow,
  videoWindowDays,
  type WindowAfterPublish,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import type { VideosRead } from '../product-api.ts'
import { surfaceText } from './text.ts'

/** How many of the newest public uploads of its format the card's video is placed among. */
export const comparedUploads = 10

/**
 * The days Google has processed for a video (`daysProcessedSince`, the count the API reads), from
 * the reporting day its publish time falls in. 0 for a video with no publish time.
 */
export function daysProcessedOf(publishedAt: string | null, lastProcessedDay: string): number {
  return daysProcessedSince(
    publishedAt === null ? null : pacificDayOf(publishedAt),
    lastProcessedDay,
  )
}

/**
 * The shortest window after publish that covers `days` days, which the format read asks: each
 * upload's first `days` days are the first entries of its `engagedViewsByDay` there. Past 365 days,
 * the longest window the API serves, `first365`.
 */
export function windowCovering(days: number): WindowAfterPublish {
  return windowsAfterPublish.find((window) => videoWindowDays[window] >= days) ?? 'first365'
}

/**
 * What the latest video card's comparison row says: its place, such as "3 of 10 Shorts by engaged
 * views", and under it the days since publish it counts, such as "First 3 days".
 */
export interface ComparisonView {
  place: string
  through: string
}

/**
 * The card video's place among the newest uploads of its format, each counted over its own first N
 * days, N being the days Google has processed for the card video: its `engagedViewsByDay` length in
 * `read`, the format read in a window after publish that covers N (`windowCovering`), which counts
 * them to that answer's last processed day. Each upload's figure is the sum of its first N entries
 * of `engagedViewsByDay`, simple arithmetic under ADR 0013; an upload with fewer processed days
 * counts the days it has. The format read answers newest first, then by id: the video list's tie
 * order, which a stable sort keeps, so the newer of two uploads that tie places first. Every number
 * comes from the format read, so N and the figures count to the same day. Undefined when the format
 * read holds no answer, the card video is not among it, or N is 0.
 */
export function comparisonOf(video: VideoRow, read: VideosRead): ComparisonView | undefined {
  if (read.state !== 'read' || video.format === null) return undefined
  const { videos } = read.answer
  const days = videos.find(({ id }) => id === video.id)?.engagedViewsByDay?.length ?? 0
  if (days === 0) return undefined
  const figureOf = (row: VideoRow) =>
    (row.engagedViewsByDay ?? []).slice(0, days).reduce((sum, day) => sum + day, 0)
  const index = videos
    .toSorted((a, b) => figureOf(b) - figureOf(a))
    .findIndex(({ id }) => id === video.id)
  return {
    place: surfaceText.comparison(index + 1, videos.length, video.format),
    through: days === 1 ? surfaceText.publishDay : surfaceText.firstDays(days),
  }
}
