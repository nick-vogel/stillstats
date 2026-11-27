import type { AudienceRetentionPoint, VideoDetailAnswer } from '@creator-analytics/api-types'
import { retentionChartsOf, timeLabelOf } from './retention.ts'

// The text is approved word for word in creator-analytics#646. Change it only with Nick.
export const playerMoveText = {
  /** Added to each retention plot's accessible name, after the keys sentence. */
  moveSentence: 'Press Enter to move the video player to that point.',
  /** The plot's live region after a seek. */
  movedTo: (seconds: number) => `Video player at ${timeLabelOf(seconds)}.`,
}

// The text is approved word for word in creator-analytics#649. Change it only with Nick.
export const cannotPlayText = {
  notEmbeddable: 'This video does not allow embedding.',
  failed: 'The video player could not load this video.',
}

/**
 * YouTube's player errors that mean the video does not play in an embedded player: 100, the video
 * is not found or private, and 101 and 150, its owner does not allow embedding (IFrame Player API
 * reference, read 2026-11-11).
 */
const notEmbeddableErrors: ReadonlySet<number> = new Set([100, 101, 150])

/**
 * The line the player's box shows in place of the player, or null for a video that can play: the
 * not-embeddable text for a video Google marks not embeddable, and for the player errors that mean
 * the same; the failure text for any other player error.
 */
export function cannotPlayLineOf(
  embeddable: boolean | null,
  playerError: number | null,
): string | null {
  if (embeddable === false) return cannotPlayText.notEmbeddable
  if (playerError === null) return null
  return notEmbeddableErrors.has(playerError) ? cannotPlayText.notEmbeddable : cannotPlayText.failed
}

/** Which retention plot moved the player: the share still watching, or relative retention. */
export type PlayerSeekPlot = 'absolute' | 'relative'

/** What moved the player from a plot: a mouse or a pen, a finger, or Enter or Space. */
export type PlayerSeekInput = 'pointer' | 'touch' | 'keyboard'

/**
 * The whole second the player moves to for the retention point at `at`: the start of the point's
 * slice, which is the time of the point before it, or 0:00 for the first point. Google's point is
 * the end of a 1% slice and a drop comes from what played just before it, so the player starts at
 * the slice's start, and floors to the whole second so it never starts after it. Google's data
 * cannot say where in the slice viewers left.
 */
export function playerSecondsAt(
  points: readonly AudienceRetentionPoint[],
  at: number,
  durationSeconds: number,
): number {
  const previous = points[at - 1]
  if (!previous) return 0
  // Rounded to the millisecond before the floor, so floating point noise such as 0.57 times 100,
  // 56.99999999999999, floors to 57 and not 56.
  return Math.floor(Math.round(previous.elapsedVideoTimeRatio * durationSeconds * 1000) / 1000)
}

/** The player frame's accessible name, approved in creator-analytics#645. */
export function playerFrameTitleOf(title: string): string {
  return `Video player: ${title}`
}

/**
 * Whether a video's screen holds the video player: only beside an audience retention curve to
 * move it along, so not for a video with no duration, none with no curve, and none Google has not
 * processed.
 */
export function holdsVideoPlayer({
  awaitingProcessing,
  video,
  audienceRetention,
}: VideoDetailAnswer): boolean {
  return (
    !awaitingProcessing &&
    Boolean(video.durationSeconds) &&
    retentionChartsOf(audienceRetention) !== null
  )
}
