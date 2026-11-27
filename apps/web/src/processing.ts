import type { VideoRow } from '@creator-analytics/api-types'

export const notProcessedText =
  'YouTube has not processed this video yet. Its numbers usually appear two to three days after it goes live.'

// Whether each video the page has had an answer for awaits processing, by id: the list unmounts
// when a video's screen opens, and the screen has only the id from the address. The flag does not
// depend on the window, so one per video is enough.
const awaitingVideos = new Map<string, boolean>()

/** Remembers whether each video awaits processing, replacing what an earlier answer said. */
export function rememberAwaitingProcessingOf(
  videos: readonly Pick<VideoRow, 'id' | 'awaitingProcessing'>[],
): void {
  for (const { id, awaitingProcessing } of videos) awaitingVideos.set(id, awaitingProcessing)
}

/** Whether the page's last answer for a video said Google has not processed it, false for none. */
export function awaitingProcessingFor(videoId: string): boolean {
  return awaitingVideos.get(videoId) ?? false
}

/**
 * A count of days, "1 day" in the singular and every other count in the plural. Nick asked for the
 * singular on 2026-10-10 for the creator-analytics#64 PR, in the partial label and the video's age.
 */
export function dayCountOf(count: number): string {
  return `${count} ${count === 1 ? 'day' : 'days'}`
}

/**
 * The days of a window after publish Google has processed for a partial video, or null. The unit
 * follows the window's length, so a one-day window reads "0 of 1 day".
 */
export function partialLabelOf({ partial }: Pick<VideoRow, 'partial'>): string | null {
  return partial ? `${partial.days} of ${dayCountOf(partial.of)}` : null
}

/** A YYYY-MM-DD day in the long date format of the reader's locale, "12 March 2019" in en-GB. */
export function longDateOf(day: string, locale?: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  })
}

/** The note on how current a screen's numbers are. */
export function delayNoteOf(lastProcessedDay: string, locale?: string): string {
  return `YouTube has processed data up to ${longDateOf(lastProcessedDay, locale)}. New numbers usually take two to three days to appear.`
}
