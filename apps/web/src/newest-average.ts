import {
  type NewestHistoryAverage,
  type VideoFormatFilter,
  type VideoListAnswer,
  type VideoWindow,
  videoWindowDays,
  type WindowAfterPublish,
  windowsAfterPublish,
} from '@creator-analytics/api-types'
import { ctrTextOf } from './history.ts'

// The sentence and its format words are approved word for word on 2026-10-19 in
// creator-analytics#243. Change them only with Nick.
const formatWords: Record<VideoFormatFilter, string> = {
  all: 'uploads',
  video: 'videos',
  short: 'Shorts',
  live: 'live streams',
}

/** The days the sentence counts over, from each upload's publish day. */
function daysTextOf(window: WindowAfterPublish): string {
  return window === 'first1'
    ? 'on their publish day'
    : `in their first ${videoWindowDays[window]} days`
}

/**
 * The sentence above the video list on the average engaged views of the newest public uploads, or
 * null when the answer carries no average of 2 or more uploads, or reads a window other than one
 * after publish.
 */
export function newestAverageTextOf(answer: VideoListAnswer, locale?: string): string | null {
  const { newestAverage } = answer
  const window = windowsAfterPublish.find((afterPublish) => afterPublish === answer.window)
  if (!newestAverage || newestAverage.count < 2 || !window) return null
  const { format, count, engagedViews } = newestAverage
  const average = Math.round(engagedViews).toLocaleString(locale)
  return `Your ${count} newest public ${formatWords[format]} averaged ${average} engaged views ${daysTextOf(window)}.`
}

/**
 * The sentence under the engaged views one on the average impressions and click-through rate of
 * the newest public uploads whose whole window the history holds, or null when the answer carries
 * no such average of 2 or more uploads, or reads a window other than one after publish.
 */
export function newestHistoryAverageTextOf(
  answer: VideoListAnswer,
  locale?: string,
): string | null {
  const { newestHistoryAverage } = answer
  const window = windowsAfterPublish.find((afterPublish) => afterPublish === answer.window)
  if (!newestHistoryAverage || newestHistoryAverage.count < 2 || !window) return null
  const { format, count, impressions, ctr } = newestHistoryAverage
  const average = Math.round(impressions).toLocaleString(locale)
  // Drafted for creator-analytics#785, approved by Nick word for word on 2026-11-19. The format words and
  // the days are the approved sentence's.
  const rate = ctr === null ? '' : ` at a ${ctrTextOf(ctr, locale)} click-through rate`
  return `Your ${count} newest public ${formatWords[format]} averaged ${average} impressions${rate} ${daysTextOf(window)}.`
}

/**
 * The note under the video screen's table of impressions and CTR on the uploads its newest uploads
 * columns average: their count, their format and their days, or null with no average or in a
 * window other than one after publish.
 */
export function newestUploadsNoteOf(
  average: Pick<NewestHistoryAverage, 'format' | 'count'> | undefined,
  window: VideoWindow,
): string | null {
  const afterPublish = windowsAfterPublish.find((each) => each === window)
  if (!average || !afterPublish) return null
  // Drafted for creator-analytics#785, approved by Nick word for word on 2026-11-19. The format words and
  // the days are the approved sentence's.
  return `The newest uploads columns average your ${average.count} newest public ${formatWords[average.format]} ${daysTextOf(afterPublish)}.`
}
