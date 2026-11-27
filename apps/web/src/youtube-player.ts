// The only web app code that talks to YouTube's player (ADR 0019, ADR 0020). It loads YouTube's
// IFrame Player API on the first player the page creates, never at import, and frames the player
// from the privacy-enhanced host. Facts from Google's IFrame Player API reference
// (https://developers.google.com/youtube/iframe_api_reference, read 2026-11-11): `YT.Player` has
// no option for the frame's host, so the module builds the `<iframe>` itself and hands it to
// `YT.Player`; the API calls the global `onYouTubeIframeAPIReady` once it has loaded; a cued video
// is not requested until `playVideo` or `seekTo`; and `seekTo` keeps a paused player paused but
// plays a player in any other state, a cued or buffering one included, so `seekTo` here calls it
// only on a player that is paused, playing, or buffering after anything but a pause.

/** YouTube's player states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued. */
export type PlayerState = -1 | 0 | 1 | 2 | 3 | 5

export interface VideoPlayerEvents {
  onReady?: () => void
  onStateChange?: (state: PlayerState) => void
  /** YouTube's error codes: 2, 5, 100, 101, 150 and 153. */
  onError?: (code: number) => void
}

export interface VideoPlayerOptions {
  videoId: string
  startSeconds: number
  /** The frame's accessible name, the screen's approved text for the video (`video-player.ts`). */
  frameTitle: string
  events?: VideoPlayerEvents
}

/**
 * A player for one element. It has no play method on purpose: playback starts only from YouTube's
 * own play button (Developer Policies III.C.2, creator-analytics#6).
 */
export interface VideoPlayer {
  cue(videoId: string, startSeconds: number, frameTitle: string): void
  seekTo(seconds: number): void
  currentTime(): number
  state(): PlayerState
  destroy(): void
}

interface YouTubePlayer {
  cueVideoById(options: { videoId: string; startSeconds: number }): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getPlayerState(): number
  destroy(): void
}

interface YouTubeNamespace {
  Player: new (
    frame: HTMLIFrameElement,
    options: {
      events: {
        onReady: () => void
        onStateChange: (event: { data: number }) => void
        onError: (event: { data: number }) => void
      }
    },
  ) => YouTubePlayer
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

// Only the browser walk's build sets the variable, to its fake player served from 'self'.
const iframeApiUrl =
  import.meta.env.VITE_YOUTUBE_IFRAME_API_URL || 'https://www.youtube.com/iframe_api'

const playerFrameOrigin = 'https://www.youtube-nocookie.com'

let iframeApi: Promise<YouTubeNamespace> | undefined

function loadIframeApi(): Promise<YouTubeNamespace> {
  iframeApi ??= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT) resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = iframeApiUrl
    document.head.append(script)
  })
  return iframeApi
}

function frameSourceOf(videoId: string, startSeconds: number): string {
  const query = new URLSearchParams({
    enablejsapi: '1',
    origin: window.location.origin,
    start: String(Math.floor(startSeconds)),
  })
  return `${playerFrameOrigin}/embed/${encodeURIComponent(videoId)}?${query}`
}

/**
 * Playing, paused, or buffering after anything but a pause: the states a `seekTo` leaves playing or
 * paused as they are. `settled` is the last state YouTube reported other than buffering. A buffering
 * after a pause can be the creator's play, a scrub in the frame or the module's own seek, and a
 * `seekTo` in the last two would play the video, so it counts as stopped (a decision on
 * creator-analytics#646). The module never plays a stopped player, so any other buffering is a play.
 */
function seekKeepsPlaybackAsItIs(state: number, settled: number): boolean {
  return state === 1 || state === 2 || (state === 3 && settled !== 2)
}

export function createVideoPlayer(
  element: HTMLElement,
  { videoId, startSeconds, frameTitle, events = {} }: VideoPlayerOptions,
): VideoPlayer {
  const frame = document.createElement('iframe')
  frame.src = frameSourceOf(videoId, startSeconds)
  frame.title = frameTitle
  frame.allow = 'encrypted-media; picture-in-picture; fullscreen'
  element.append(frame)

  let player: YouTubePlayer | undefined
  let destroyed = false
  // A cue before the player is ready points the frame at the next video, so a script that never
  // loads or a player that never reports ready leaves no old video on screen, and is cued again
  // once the player is ready, as the API answers no call until onReady. The API's widget polls the
  // frame until it answers and polls again on each load of the frame, so a new `src` before ready
  // keeps the handshake (www-widgetapi.js, read 2026-11-11). After ready the frame is the player's.
  let pendingCue: { videoId: string; startSeconds: number } | undefined
  // The video the frame shows or is cued at, which a seek on a stopped player cues again.
  let shownVideoId = videoId
  // The last state YouTube reported other than buffering (3), which a seek while buffering reads.
  let settledState = -1

  void loadIframeApi().then((YT) => {
    if (destroyed) return
    const created = new YT.Player(frame, {
      events: {
        onReady: () => {
          player = created
          if (pendingCue) player.cueVideoById(pendingCue)
          pendingCue = undefined
          events.onReady?.()
        },
        onStateChange: ({ data }) => {
          if (data !== 3) settledState = data
          events.onStateChange?.(data as PlayerState)
        },
        onError: ({ data }) => events.onError?.(data),
      },
    })
  })

  return {
    cue(nextVideoId, nextStartSeconds, nextFrameTitle) {
      frame.title = nextFrameTitle
      shownVideoId = nextVideoId
      const cue = { videoId: nextVideoId, startSeconds: nextStartSeconds }
      if (player) player.cueVideoById(cue)
      else {
        frame.src = frameSourceOf(nextVideoId, nextStartSeconds)
        pendingCue = cue
      }
    },
    seekTo(seconds) {
      const cue = { videoId: shownVideoId, startSeconds: seconds }
      // The frame already shows this video, so a seek before ready waits for onReady alone.
      if (!player) pendingCue = cue
      // Google's reference (read 2026-11-11): "If the player is paused when the function is called,
      // it will remain paused. If the function is called from another state (playing, video cued,
      // etc.), the player will play the video." A seek must never start a stopped player
      // (Developer Policies III.C.2, creator-analytics#6), so a stopped one is cued at the time.
      else if (seekKeepsPlaybackAsItIs(player.getPlayerState(), settledState)) {
        player.seekTo(seconds, true)
      } else player.cueVideoById(cue)
    },
    currentTime() {
      return player?.getCurrentTime() ?? 0
    },
    state() {
      return (player?.getPlayerState() ?? -1) as PlayerState
    },
    destroy() {
      destroyed = true
      player?.destroy()
      player = undefined
      frame.remove()
    },
  }
}
