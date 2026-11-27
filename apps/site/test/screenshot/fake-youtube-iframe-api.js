// Test only: the browser walk's stand-in for YouTube's IFrame Player API, which the stub serves
// from the page's own origin at /sample/youtube-iframe-api.js and the walk's build points the web
// app at (VITE_YOUTUBE_IFRAME_API_URL). It loads nothing: it drives the frame the web app built,
// as YouTube's player would report on it, and marks the frame so the walk knows it ran. The walk
// plays it through the frame's `stillstatsFakePlayer` handle: `play(seconds)` sets the time and
// reports playing, as YouTube's player does once its own play button is pressed. A cue and a seek
// write the time they set to the frame's `data-time`, so the walk sees where a chart moved it. The
// production build never names this file, and apps/web/test/web.test.ts holds the build to
// containing none of its marker.
;(() => {
  const marker = 'stillstats-walk-fake-youtube-iframe-api'

  class Player {
    constructor(frame, { events = {} } = {}) {
      this.frame = frame
      this.time = 0
      this.state = -1
      this.events = events
      frame.dataset.fakePlayer = marker
      frame.stillstatsFakePlayer = this
      setTimeout(() => events.onReady?.({ target: this }), 0)
    }

    play(seconds) {
      this.time = seconds
      this.state = 1
      this.events.onStateChange?.({ data: 1, target: this })
    }

    cueVideoById({ videoId, startSeconds = 0 }) {
      this.time = startSeconds
      this.state = 5
      this.frame.dataset.cued = videoId
      this.frame.dataset.time = String(startSeconds)
    }

    seekTo(seconds) {
      this.time = seconds
      this.frame.dataset.time = String(seconds)
    }

    getCurrentTime() {
      return this.time
    }

    getPlayerState() {
      return this.state
    }

    destroy() {
      this.frame.remove()
    }
  }

  window.YT = { Player }
  window.onYouTubeIframeAPIReady?.()
})()
