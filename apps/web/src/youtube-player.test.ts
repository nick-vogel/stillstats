// @vitest-environment happy-dom
// Limits: these tests run the player boundary in happy-dom over a fake `window.YT` they install,
// and fire `onYouTubeIframeAPIReady` themselves. happy-dom here evaluates no script and loads no
// frame's page (its defaults), so no test reaches real YouTube: none shows the IFrame API loading,
// the privacy-enhanced host answering the API, or a real player cueing and seeking. The browser
// walk runs the module over a fake player script in Chrome, and the manual walk on staging
// (creator-analytics#650) runs it against real YouTube.
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

interface FakeYouTubePlayer {
  frame: HTMLIFrameElement
  events: {
    onReady: () => void
    onStateChange: (event: { data: number }) => void
    onError: (event: { data: number }) => void
  }
  cueVideoById: ReturnType<typeof vi.fn>
  seekTo: ReturnType<typeof vi.fn>
  /** YouTube's own play call, which the boundary must never make. */
  playVideo: ReturnType<typeof vi.fn>
  getCurrentTime: () => number
  getPlayerState: () => number
  destroy: ReturnType<typeof vi.fn>
}

let players: FakeYouTubePlayer[]
/** The state the fake reports to `getPlayerState`, as YouTube's codes. */
let fakeState: number

function installFakeYouTube(): void {
  players = []
  fakeState = 2
  class Player {
    constructor(frame: HTMLIFrameElement, { events }: { events: FakeYouTubePlayer['events'] }) {
      players.push({
        frame,
        events,
        cueVideoById: vi.fn(),
        seekTo: vi.fn(),
        playVideo: vi.fn(),
        getCurrentTime: () => 42.5,
        getPlayerState: () => fakeState,
        destroy: vi.fn(),
      })
      // biome-ignore lint/correctness/noConstructorReturn: the fake hands back its recording.
      return players.at(-1) as unknown as Player
    }
  }
  window.YT = { Player } as unknown as NonNullable<Window['YT']>
}

async function playerModule() {
  vi.resetModules()
  return import('./youtube-player.ts')
}

function apiScripts(): HTMLScriptElement[] {
  return [...document.querySelectorAll('script')].filter((script) =>
    script.src.includes('iframe_api'),
  )
}

async function apiLoaded(): Promise<void> {
  window.onYouTubeIframeAPIReady?.()
  await Promise.resolve()
  await Promise.resolve()
}

const options = { videoId: 'ANIQ6TTkj70', startSeconds: 0, frameTitle: 'Video player: How I edit' }

// happy-dom loads neither the script nor the frame's page. This quiets the script's refusal;
// happy-dom logs the frame's refusal whatever its settings.
beforeAll(() => {
  ;(
    window as unknown as { happyDOM: { settings: { handleDisabledFileLoadingAsSuccess: boolean } } }
  ).happyDOM.settings.handleDisabledFileLoadingAsSuccess = true
})

beforeEach(() => {
  document.head.replaceChildren()
  document.body.replaceChildren()
  delete window.onYouTubeIframeAPIReady
  installFakeYouTube()
})

afterEach(() => {
  delete window.YT
})

describe('the YouTube player boundary', () => {
  test('loads nothing from YouTube until the first player is created', async () => {
    await playerModule()

    expect(apiScripts()).toEqual([])
  })

  test("loads YouTube's IFrame API script once, however many players the page creates", async () => {
    const { createVideoPlayer } = await playerModule()

    createVideoPlayer(document.body.appendChild(document.createElement('div')), options)
    createVideoPlayer(document.body.appendChild(document.createElement('div')), options)

    expect(apiScripts().map((script) => script.src)).toEqual(['https://www.youtube.com/iframe_api'])
  })

  test("frames the player from YouTube's privacy-enhanced host, with the API on and the page's origin", async () => {
    const { createVideoPlayer } = await playerModule()
    const box = document.body.appendChild(document.createElement('div'))

    createVideoPlayer(box, options)
    const frame = box.querySelector('iframe')
    const source = new URL(frame?.src ?? '')

    expect(source.origin).toBe('https://www.youtube-nocookie.com')
    expect(source.pathname).toBe('/embed/ANIQ6TTkj70')
    expect(source.searchParams.get('enablejsapi')).toBe('1')
    expect(source.searchParams.get('origin')).toBe(window.location.origin)
  })

  test('names the frame as it is told, and a cue renames it for the next video', async () => {
    const { createVideoPlayer } = await playerModule()
    const box = document.body.appendChild(document.createElement('div'))

    const player = createVideoPlayer(box, options)
    const named = box.querySelector('iframe')?.title
    player.cue('b0xQUOtGl0A', 0, 'Video player: Why I left')

    expect([named, box.querySelector('iframe')?.title]).toEqual([
      'Video player: How I edit',
      'Video player: Why I left',
    ])
  })

  test("hands its own frame to YouTube's player once the API has loaded", async () => {
    const { createVideoPlayer } = await playerModule()
    const box = document.body.appendChild(document.createElement('div'))

    createVideoPlayer(box, options)
    await apiLoaded()

    expect(players.map(({ frame }) => frame)).toEqual([box.querySelector('iframe')])
  })

  test('cues a video at its start once the player is ready, without playing it', async () => {
    const { createVideoPlayer } = await playerModule()
    const ready = vi.fn()

    const player = createVideoPlayer(document.body.appendChild(document.createElement('div')), {
      ...options,
      events: { onReady: ready },
    })
    await apiLoaded()
    player.cue('b0xQUOtGl0A', 0, 'Why I left')
    const [youtube] = players
    youtube?.events.onReady()
    player.cue('Zs1p7d0vbuQ', 12, 'What I use')

    expect(ready).toHaveBeenCalledTimes(1)
    expect(youtube?.cueVideoById.mock.calls).toEqual([
      [{ videoId: 'b0xQUOtGl0A', startSeconds: 0 }],
      [{ videoId: 'Zs1p7d0vbuQ', startSeconds: 12 }],
    ])
    expect(Object.keys(player).filter((name) => /play/i.test(name))).toEqual([])
  })

  test("a cue before YouTube's player is ready points the frame at the next video, and one after leaves the frame to the player", async () => {
    const { createVideoPlayer } = await playerModule()
    const box = document.body.appendChild(document.createElement('div'))
    const shown = () => {
      const source = new URL(box.querySelector('iframe')?.src ?? '')
      return `${source.pathname}?start=${source.searchParams.get('start')}`
    }

    const player = createVideoPlayer(box, options)
    player.cue('b0xQUOtGl0A', 12, 'Video player: Why I left')
    const beforeTheApi = shown()
    await apiLoaded()
    player.cue('Zs1p7d0vbuQ', 0, 'Video player: What I use')
    const beforeReady = shown()
    players[0]?.events.onReady()
    player.cue('ANIQ6TTkj70', 0, 'Video player: How I edit')

    expect([beforeTheApi, beforeReady, shown()]).toEqual([
      '/embed/b0xQUOtGl0A?start=12',
      '/embed/Zs1p7d0vbuQ?start=0',
      '/embed/Zs1p7d0vbuQ?start=0',
    ])
  })

  test("reads YouTube's current time and state", async () => {
    const { createVideoPlayer } = await playerModule()

    const player = createVideoPlayer(
      document.body.appendChild(document.createElement('div')),
      options,
    )
    await apiLoaded()
    players[0]?.events.onReady()

    expect([player.currentTime(), player.state()]).toEqual([42.5, 2])
  })

  /**
   * A ready player after a cue of a second video, whose YouTube player has reported `reported` in
   * turn and now reports `state`, and the fake behind it.
   */
  async function readyPlayerIn(state: number, reported: readonly number[] = [state]) {
    const { createVideoPlayer } = await playerModule()
    const player = createVideoPlayer(
      document.body.appendChild(document.createElement('div')),
      options,
    )
    await apiLoaded()
    players[0]?.events.onReady()
    player.cue('b0xQUOtGl0A', 0, 'Video player: Why I left')
    players[0]?.cueVideoById.mockClear()
    for (const data of reported) players[0]?.events.onStateChange({ data })
    fakeState = state
    return { player, youtube: players[0] }
  }

  // A buffering after playing, or after a stopped state, can only be the creator's own play in the
  // frame, as the module never plays a stopped player, so the playback is under way and a seekTo
  // keeps it going. The rule reads the last state YouTube reported before the buffering.
  test.for([
    ['playing', 1, [1]],
    ['paused', 2, [2]],
    ['buffering after playing', 3, [1, 3]],
    ['buffering after a pause and then a play', 3, [2, 3, 1, 3]],
    ['buffering after a play from a cue', 3, [5, 3]],
    ['buffering after a play from unstarted', 3, [-1, 3]],
    ['buffering before YouTube reports any other state', 3, [3]],
  ] as const)(
    'a seek while %s moves the playback with seekTo, and cues nothing',
    async ([, state, reported]) => {
      const { player, youtube } = await readyPlayerIn(state, reported)
      player.seekTo(80)

      expect(youtube?.seekTo.mock.calls).toEqual([[80, true]])
      expect(youtube?.cueVideoById).not.toHaveBeenCalled()
      expect(youtube?.playVideo).not.toHaveBeenCalled()
    },
  )

  // Google's reference says a seekTo from any state but paused plays the video, so a seek on a
  // cued, unstarted or ended player must never reach YouTube as a seekTo (Developer Policies
  // III.C.2, creator-analytics#6).
  // From YouTube's states alone, a buffering after a pause cannot tell the creator's play from a
  // scrub in the frame or the module's own seek, and a seekTo on the two that leave the player
  // paused would play it, so the seek cues (a decision on creator-analytics#646). The cost: a click in
  // the moment the creator's play from a pause buffers stops that play.
  test.for([
    ['cued', 5, [5]],
    ['unstarted', -1, [-1]],
    ['ended', 0, [0]],
    ['buffering after a pause', 3, [2, 3]],
  ] as const)(
    'a seek while %s cues the video it shows at the time, and calls no seekTo',
    async ([, state, reported]) => {
      const { player, youtube } = await readyPlayerIn(state, reported)
      player.seekTo(80)

      expect(youtube?.cueVideoById.mock.calls).toEqual([
        [{ videoId: 'b0xQUOtGl0A', startSeconds: 80 }],
      ])
      expect(youtube?.seekTo).not.toHaveBeenCalled()
      expect(youtube?.playVideo).not.toHaveBeenCalled()
    },
  )

  test("a second seek while YouTube buffers the module's own seek on a paused player cues the video at the time, and calls no second seekTo", async () => {
    const { player, youtube } = await readyPlayerIn(2)
    player.seekTo(60)
    youtube?.events.onStateChange({ data: 3 })
    fakeState = 3
    player.seekTo(80)

    expect(youtube?.seekTo.mock.calls).toEqual([[60, true]])
    expect(youtube?.cueVideoById.mock.calls).toEqual([
      [{ videoId: 'b0xQUOtGl0A', startSeconds: 80 }],
    ])
    expect(youtube?.playVideo).not.toHaveBeenCalled()
  })

  test("a seek before YouTube's player is ready asks nothing of it until ready, then cues the video at that time", async () => {
    const { createVideoPlayer } = await playerModule()
    const box = document.body.appendChild(document.createElement('div'))

    const player = createVideoPlayer(box, options)
    const source = box.querySelector('iframe')?.src
    player.seekTo(80)
    await apiLoaded()
    player.seekTo(95)
    const [youtube] = players
    const beforeReady = [youtube?.cueVideoById.mock.calls.length, youtube?.seekTo.mock.calls.length]
    youtube?.events.onReady()

    expect(beforeReady).toEqual([0, 0])
    expect(box.querySelector('iframe')?.src).toBe(source)
    expect(youtube?.cueVideoById.mock.calls).toEqual([
      [{ videoId: 'ANIQ6TTkj70', startSeconds: 95 }],
    ])
    expect(youtube?.seekTo).not.toHaveBeenCalled()
  })

  test("reports YouTube's state changes and error codes", async () => {
    const { createVideoPlayer } = await playerModule()
    const onStateChange = vi.fn()
    const onError = vi.fn()

    createVideoPlayer(document.body.appendChild(document.createElement('div')), {
      ...options,
      events: { onStateChange, onError },
    })
    await apiLoaded()
    players[0]?.events.onStateChange({ data: 1 })
    players[0]?.events.onError({ data: 150 })

    expect(onStateChange.mock.calls).toEqual([[1]])
    expect(onError.mock.calls).toEqual([[150]])
  })

  test("destroying the player removes its frame and destroys YouTube's player", async () => {
    const { createVideoPlayer } = await playerModule()
    const box = document.body.appendChild(document.createElement('div'))

    const player = createVideoPlayer(box, options)
    await apiLoaded()
    players[0]?.events.onReady()
    player.destroy()

    expect(box.querySelector('iframe')).toBeNull()
    expect(players[0]?.destroy).toHaveBeenCalledTimes(1)
  })

  test('a player destroyed before the API loads never becomes a YouTube player', async () => {
    const { createVideoPlayer } = await playerModule()

    createVideoPlayer(document.body.appendChild(document.createElement('div')), options).destroy()
    await apiLoaded()

    expect(players).toEqual([])
  })
})
