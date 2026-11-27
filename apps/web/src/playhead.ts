// The playhead on the audience retention plots: the time the video player is at, while it plays.
// Google's IFrame Player API gives no time update event, so the follower reads the time from the
// player boundary on an interval while the player plays, and once on each later state change, so a
// paused or ended video holds its line where playback stopped. It talks to the boundary only
// (`youtube-player.ts`, ADR 0019), never to YouTube.
import type { PlayerState } from './youtube-player.ts'

/** How often the follower reads the time while the player plays, in milliseconds. */
const readEveryMilliseconds = 250

/**
 * The seconds the playhead shows, or null for none: an external store, so a read re-renders the
 * playhead lines alone and never the screen around them.
 */
export interface PlayheadStore {
  subscribe(listener: () => void): () => void
  seconds(): number | null
  set(seconds: number | null): void
}

export function createPlayheadStore(): PlayheadStore {
  let current: number | null = null
  const listeners = new Set<() => void>()
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    seconds: () => current,
    set(seconds) {
      if (seconds === current) return
      current = seconds
      for (const listener of listeners) listener()
    },
  }
}

/** What the video player tells the playhead: each state change, a cue of another video, its end. */
export interface PlayheadFollower {
  onStateChange(state: PlayerState): void
  /** A cue of another video: no playhead until it plays. */
  reset(): void
  /** The player's destroy: no more reads, and no playhead. */
  stop(): void
}

/**
 * Follows one player into a store, reading its time with `currentTime`, the boundary's read.
 * Nothing shows before the player first plays; playing reads the time now and on the interval, and
 * any other state after that reads it once and stops the interval.
 */
export function followPlayer(currentTime: () => number, store: PlayheadStore): PlayheadFollower {
  let played = false
  let interval: ReturnType<typeof setInterval> | undefined
  const read = () => store.set(currentTime())
  const clear = () => {
    if (interval !== undefined) clearInterval(interval)
    interval = undefined
  }
  return {
    onStateChange(state) {
      if (state === 1) {
        played = true
        read()
        interval ??= setInterval(read, readEveryMilliseconds)
        return
      }
      if (!played) return
      read()
      clear()
    },
    reset() {
      clear()
      played = false
      store.set(null)
    },
    stop() {
      clear()
      store.set(null)
    },
  }
}

/**
 * The playhead's place on a plot whose x runs from 0 to 1 over the video: the seconds' share of
 * the answer's duration, held to the plot, or null with no seconds or no duration.
 */
export function playheadRatioOf(
  seconds: number | null,
  durationSeconds: number | null,
): number | null {
  if (seconds === null || !durationSeconds) return null
  return Math.min(1, Math.max(0, seconds / durationSeconds))
}
