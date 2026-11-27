// Test only: the web app's tests put this in place of `youtube-player.ts` with
// `vi.mock('./youtube-player.ts', () => import('./fake-youtube-player.ts'))`. No production file
// imports it. It loads nothing: its frame has no `src`, and a test drives what YouTube's player
// would report.
import type {
  PlayerState,
  VideoPlayer,
  VideoPlayerEvents,
  VideoPlayerOptions,
} from './youtube-player.ts'

/** One player the app created, with every call it made and the handles a test drives it by. */
export interface FakePlayer {
  element: HTMLElement
  videoId: string
  startSeconds: number
  frameTitle: string
  /** Every cue, in order: the video and its start. */
  cues: { videoId: string; startSeconds: number }[]
  /** Every seek, in seconds, in order. */
  seeks: number[]
  destroyed: boolean
  /** How many times the app has read the current time. */
  timeReads: number
  ready(): void
  changeState(state: PlayerState): void
  setCurrentTime(seconds: number): void
  fail(code: number): void
}

/** Every player created since the last `resetFakePlayers`, oldest first. */
export const fakePlayers: FakePlayer[] = []

export function resetFakePlayers(): void {
  fakePlayers.length = 0
}

/** The players created and not yet destroyed. */
export function livePlayers(): FakePlayer[] {
  return fakePlayers.filter(({ destroyed }) => !destroyed)
}

export function createVideoPlayer(
  element: HTMLElement,
  { videoId, startSeconds, frameTitle, events = {} }: VideoPlayerOptions,
): VideoPlayer {
  const frame = document.createElement('iframe')
  frame.title = frameTitle
  element.append(frame)
  const on: VideoPlayerEvents = events
  let state: PlayerState = -1
  let time = startSeconds
  const fake: FakePlayer = {
    element,
    videoId,
    startSeconds,
    frameTitle,
    cues: [],
    seeks: [],
    destroyed: false,
    timeReads: 0,
    ready: () => on.onReady?.(),
    changeState(next) {
      state = next
      on.onStateChange?.(next)
    },
    setCurrentTime(seconds) {
      time = seconds
    },
    fail: (code) => on.onError?.(code),
  }
  fakePlayers.push(fake)
  return {
    cue(nextVideoId, nextStartSeconds, nextFrameTitle) {
      fake.cues.push({ videoId: nextVideoId, startSeconds: nextStartSeconds })
      frame.title = nextFrameTitle
      time = nextStartSeconds
    },
    seekTo(seconds) {
      fake.seeks.push(seconds)
      time = seconds
    },
    currentTime() {
      fake.timeReads += 1
      return time
    },
    state: () => state,
    destroy() {
      fake.destroyed = true
      frame.remove()
    },
  }
}
