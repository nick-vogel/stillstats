// @vitest-environment happy-dom
// Limits: these tests render App in happy-dom against the fake API (`fake-api.ts`), with the fake
// player (`fake-youtube-player.ts`) in place of the one module that talks to YouTube, so none
// loads YouTube's player or shows it playing: they observe what the app asks of the player
// boundary. happy-dom evaluates no stylesheet and lays nothing out, so none shows the thumbnail
// drawn over the frame until the player is ready, or the box keeping its size and place; `web.test.ts`
// reads the rule, and the browser walk measures the box in Chrome. The Short's frame is read here as the
// `video-player-short` class on the box, which `web.test.ts` holds to 9:16 in the built CSS. The playhead tests drive the fake player's
// states and time with fake intervals, and read the line's place as the CSS left the app sets: no
// test here sees the line's place in pixels, which the browser walk measures in Chrome while its
// fake player plays. The manual walk on staging (creator-analytics#650) plays real YouTube.
import type { AudienceRetentionPoint, VideoRow } from '@creator-analytics/api-types'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { track } from './analytics.ts'
import { chartLabelOf, sliderTextOf } from './chart-slider.ts'
import { dateRangeLabel } from './controls-bar.ts'
import {
  fakeChannel,
  fakeVideo,
  installFakeApi,
  type RenderedApp,
  renderApp,
  settle,
} from './fake-api.ts'
import { fakePlayers, livePlayers, resetFakePlayers } from './fake-youtube-player.ts'
import { relativeName } from './retention.ts'
import { youtubeWatchUrlOf } from './video-detail.ts'
import { cannotPlayText, playerMoveText, playerSecondsAt } from './video-player.ts'

vi.mock('./analytics.ts', () => ({ track: vi.fn() }))
vi.mock('./youtube-player.ts', () => import('./fake-youtube-player.ts'))

let rendered: RenderedApp | null = null

async function render(address: string): Promise<RenderedApp> {
  rendered = await renderApp(address)
  return rendered
}

async function click(element: HTMLElement): Promise<void> {
  await act(async () => element.click())
  await settle()
}

const medium = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`

function withThumbnail(video: VideoRow): VideoRow {
  return { ...video, thumbnailUrl: medium(video.id), thumbnails: [] }
}

const curve: AudienceRetentionPoint[] = [
  { elapsedVideoTimeRatio: 0.01, audienceWatchRatio: 1, relativeRetentionPerformance: 0.5 },
  { elapsedVideoTimeRatio: 1, audienceWatchRatio: 0.4, relativeRetentionPerformance: 0.5 },
]

const steppedThrough = [
  fakeVideo,
  { ...fakeVideo, id: 'video-2', title: 'Another video' },
  { ...fakeVideo, id: 'video-3', title: 'A third video' },
].map(withThumbnail)

/** A video's screen whose answer carries a duration and a retention curve, so it holds the player. */
function playableApi(videos: VideoRow[] = steppedThrough) {
  const api = installFakeApi()
  api.videos = videos
  api.retention = curve
  return api
}

function playerBox(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('.video-player')
}

/** The one player not yet destroyed: StrictMode creates one and destroys it before the next. */
function onlyLivePlayer() {
  const [player, ...others] = livePlayers()
  if (!player || others.length > 0) throw new Error(`${livePlayers().length} live players, not 1`)
  return player
}

/** What the box holds, by each child's class, the thumbnail's frame named by its own class. */
function boxChildren(container: HTMLElement): string[] {
  return [...(playerBox(container)?.children ?? [])].map((child) =>
    child.classList.contains('video-player-thumbnail') ? 'video-player-thumbnail' : child.className,
  )
}

/** The `video_player_loaded` events sent. */
function loadedEvents() {
  return vi
    .mocked(track)
    .mock.calls.filter(([event]) => event.name === 'video_player_loaded')
    .map(([event]) => event)
}

function watchLink(container: HTMLElement): { href: string | null; text: string | null } {
  const link = [...container.querySelectorAll('.video-detail-head a')].find(
    (each) => each.textContent === 'Watch on YouTube',
  )
  return { href: link?.getAttribute('href') ?? null, text: link?.textContent ?? null }
}

/** Picks a window in the controls bar's Date range select, the select its label wraps. */
async function chooseWindow(container: HTMLElement, value: string): Promise<void> {
  const select = [...container.querySelectorAll('label')]
    .find((label) => label.firstChild?.textContent === dateRangeLabel)
    ?.querySelector('select')
  if (!select) throw new Error(`No ${dateRangeLabel} select`)
  await act(async () => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await settle()
}

function linkLabelled(container: HTMLElement, label: string): HTMLAnchorElement {
  const link = container.querySelector<HTMLAnchorElement>(`a[aria-label="${label}"]`)
  if (!link) throw new Error(`No link labelled ${label}`)
  return link
}

/**
 * Each retention plot, found by its slider role and approved name, as `app.test.ts` does: on a
 * screen that holds the video player, the name ends with the sentence on moving it.
 */
function retentionPlots(
  container: HTMLElement,
  more: string | null = playerMoveText.moveSentence,
): HTMLElement[] {
  return ['Audience retention', relativeName].map((heading) => {
    const plot = container.querySelector<HTMLElement>(
      `[role="slider"][aria-label="${chartLabelOf(heading, more ?? undefined)}"]`,
    )
    if (!plot) throw new Error(`No plot named for ${heading}`)
    return plot
  })
}

beforeEach(() => {
  resetFakePlayers()
  vi.mocked(track).mockClear()
})

afterEach(() => {
  rendered?.unmount()
  rendered = null
  vi.unstubAllGlobals()
})

describe("the video player on a video's detail screen", () => {
  test('loads with the screen, with no press: one player in a box above the retention charts, cued at 0:00 and not started, named for the video', async () => {
    playableApi()
    const { container } = await render('videos/video-2')
    const box = playerBox(container)
    const player = onlyLivePlayer()
    const retention = box?.closest('section')

    expect(player.element.closest('.video-player')).toBe(box)
    expect({ videoId: player.videoId, startSeconds: player.startSeconds }).toEqual({
      videoId: 'video-2',
      startSeconds: 0,
    })
    expect([player.cues, player.seeks]).toEqual([[], []])
    expect(box?.querySelector('iframe')?.title).toBe('Video player: Another video')
    expect(retention?.querySelector('h2')?.textContent).toBe('Audience retention')
    expect(
      box &&
        retention?.querySelector('.chart')?.compareDocumentPosition(box) ===
          Node.DOCUMENT_POSITION_PRECEDING,
    ).toBe(true)
  })

  test('shows the thumbnail in the box, after the frame so it is drawn over it, until the player is ready, then the frame alone', async () => {
    playableApi()
    const { container } = await render('videos/video-2')
    const before = {
      children: boxChildren(container),
      thumbnail: playerBox(container)?.querySelector('img')?.getAttribute('src'),
    }
    await act(async () => onlyLivePlayer().ready())
    const frame = playerBox(container)?.querySelector('.video-player-frame')

    expect(before).toEqual({
      children: ['video-player-frame', 'video-player-thumbnail'],
      thumbnail: medium('video-2'),
    })
    expect(boxChildren(container)).toEqual(['video-player-frame'])
    expect([...(frame?.children ?? [])].map((child) => child.tagName)).toEqual(['IFRAME'])
  })

  test('sends video_player_loaded once each time the player reports ready, with no property, and none before', async () => {
    playableApi()
    const { container } = await render('videos/video-2')
    const beforeReady = loadedEvents()
    await act(async () => onlyLivePlayer().ready())
    await click(linkLabelled(container, 'Older video: A third video'))

    expect(beforeReady).toEqual([])
    expect(loadedEvents()).toEqual([{ name: 'video_player_loaded' }])
  })

  test("asks nothing of the player boundary while the screen's first read is in flight", async () => {
    const api = playableApi()
    // StrictMode reads the detail twice, so both reads are held.
    const route = `GET /api/channels/${fakeChannel.id}/videos/video-2`
    const reads = [api.hold(route), api.hold(route)]
    const { container } = await render('videos/video-2')
    const whileRead = { box: playerBox(container), players: [...fakePlayers] }
    await act(async () => {
      for (const read of reads) read.release()
    })
    await settle()

    expect(whileRead).toEqual({ box: null, players: [] })
    expect(livePlayers()).toHaveLength(1)
  })

  test.each([
    ['no duration', { durationSeconds: null }, curve],
    ['no retention curve', {}, []],
    ['Google has not processed it', { awaitingProcessing: true }, curve],
  ])(
    'shows no player box and asks nothing of the player boundary for a video with %s',
    async (_, change, retention) => {
      const api = installFakeApi()
      api.videos = [{ ...withThumbnail(fakeVideo), ...change }]
      api.retention = retention
      const { container } = await render('videos/video-1')

      expect(container.querySelector('.video-detail-head h1')?.textContent).toBe('A video')
      expect(playerBox(container)).toBeNull()
      expect(fakePlayers).toEqual([])
    },
  )

  test('leaves the head\'s "Watch on YouTube" link as it is, before and after the player is ready', async () => {
    playableApi()
    const { container } = await render('videos/video-2')
    const before = watchLink(container)
    await act(async () => onlyLivePlayer().ready())

    expect([before, watchLink(container)]).toEqual([
      { href: youtubeWatchUrlOf('video-2'), text: 'Watch on YouTube' },
      { href: youtubeWatchUrlOf('video-2'), text: 'Watch on YouTube' },
    ])
  })
})

describe('the video player across the previous and next video', () => {
  test('a step keeps the one player and cues the new video at 0:00, named for it, with no second player', async () => {
    playableApi()
    const { container } = await render('videos/video-2')
    const player = onlyLivePlayer()
    const created = fakePlayers.length
    const frame = container.querySelector('.video-player iframe')

    await click(linkLabelled(container, 'Older video: A third video'))
    await click(linkLabelled(container, 'Newer video: Another video'))

    expect([livePlayers(), fakePlayers.length]).toEqual([[player], created])
    expect(player.cues).toEqual([
      { videoId: 'video-3', startSeconds: 0 },
      { videoId: 'video-2', startSeconds: 0 },
    ])
    expect(container.querySelector('.video-player iframe')).toBe(frame)
  })

  test('the frame is named for the video a step cues', async () => {
    playableApi()
    const { container } = await render('videos/video-2')
    await click(linkLabelled(container, 'Older video: A third video'))

    expect(container.querySelector('.video-player iframe')?.getAttribute('title')).toBe(
      'Video player: A third video',
    )
  })

  test('a change of the date range keeps the one player while the video is read again', async () => {
    const api = playableApi()
    const { container } = await render('videos/video-2')
    const player = onlyLivePlayer()
    const created = fakePlayers.length
    const frame = container.querySelector('.video-player iframe')
    const read = api.hold(`GET /api/channels/${fakeChannel.id}/videos/video-2`)
    await chooseWindow(container, 'lifetime')
    const whileRead = {
      frame: container.querySelector('.video-player iframe'),
      live: livePlayers(),
    }
    await act(async () => read.release())
    await settle()

    expect(whileRead.frame).toBe(frame)
    expect([fakePlayers.length, whileRead.live, livePlayers()]).toEqual([
      created,
      [player],
      [player],
    ])
    expect(container.querySelector('.video-player iframe')).toBe(frame)
    expect(player.cues).toEqual([])
  })

  test('unmounting the screen destroys the player', async () => {
    playableApi()
    const shown = await render('videos/video-2')
    shown.unmount()
    rendered = null

    expect(fakePlayers.length).toBeGreaterThan(0)
    expect(livePlayers()).toEqual([])
  })
})

describe("the video player's frame: 9:16 for a Short, 16:9 for every other video", () => {
  const shortClass = 'video-player-short'

  test("a Short's box is the Short's frame, with the player in it, before and after the player is ready", async () => {
    playableApi(steppedThrough.map((video) => ({ ...video, format: 'short' as const })))
    const { container } = await render('videos/video-2')
    const box = playerBox(container)
    const before = box?.classList.contains(shortClass)
    const player = onlyLivePlayer()
    await act(async () => player.ready())

    expect(before).toBe(true)
    expect(playerBox(container)).toBe(box)
    expect(box?.classList.contains(shortClass)).toBe(true)
    expect(player.element.closest('.video-player')).toBe(box)
  })

  test.each([
    ['a video', { format: 'video' as const }],
    ['a live stream with a duration', { format: 'live' as const, durationSeconds: 5400 }],
    ['a video with no format', { format: null }],
  ])('%s keeps the 16:9 frame, before and after the player is ready', async (_, change) => {
    playableApi(steppedThrough.map((video) => ({ ...video, ...change })))
    const { container } = await render('videos/video-2')
    const before = playerBox(container)?.classList.contains(shortClass)
    await act(async () => onlyLivePlayer().ready())

    expect(before).toBe(false)
    expect(playerBox(container)?.classList.contains(shortClass)).toBe(false)
    expect(livePlayers()).toHaveLength(1)
  })

  test('a step from a Short to a video keeps the one player and gives the box the 16:9 frame', async () => {
    const [newest, short, older] = steppedThrough
    if (!newest || !short || !older) throw new Error('Three videos to step through')
    playableApi([newest, { ...short, format: 'short' }, { ...older, format: 'video' }])
    const { container } = await render('videos/video-2')
    const player = onlyLivePlayer()
    const frame = container.querySelector('.video-player iframe')
    const before = playerBox(container)?.classList.contains(shortClass)

    await click(linkLabelled(container, 'Older video: A third video'))

    expect(before).toBe(true)
    expect(livePlayers()).toEqual([player])
    expect(container.querySelector('.video-player iframe')).toBe(frame)
    expect(playerBox(container)?.classList.contains(shortClass)).toBe(false)
  })
})

describe('the playhead on the audience retention plots', () => {
  beforeEach(() => {
    // Intervals only, so `settle`'s microtasks run as they do everywhere else.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // fakeVideo's duration is 754 seconds, so these times sit at a quarter, half and three quarters.
  const quarter = 188.5
  const half = 377
  const threeQuarters = 565.5

  /** The playhead's place on each retention plot, as its CSS left, or null for none. */
  function playheads(container: HTMLElement): (string | null)[] {
    return retentionPlots(container).map(
      (plot) => plot.querySelector<HTMLElement>('.retention-playhead')?.style.left ?? null,
    )
  }

  async function drive(change: () => void): Promise<void> {
    await act(async () => change())
    await settle()
  }

  async function advance(milliseconds: number): Promise<void> {
    await drive(() => vi.advanceTimersByTime(milliseconds))
  }

  /** The screen of video-2 with its player ready and cued, and not yet played. */
  async function cuedPlayer() {
    playableApi()
    const { container } = await render('videos/video-2')
    const player = onlyLivePlayer()
    await drive(() => {
      player.ready()
      player.changeState(-1)
      player.changeState(5)
    })
    return { container, player }
  }

  /** The cued player, playing from a time. */
  async function playingAt(seconds: number) {
    const cued = await cuedPlayer()
    await drive(() => {
      cued.player.setCurrentTime(seconds)
      cued.player.changeState(1)
    })
    return cued
  }

  test('shows no playhead on either plot before the player has played', async () => {
    const { container } = await cuedPlayer()

    expect(playheads(container)).toEqual([null, null])
  })

  test("on playing, shows a playhead on both plots at the current time's share of the duration", async () => {
    const { container } = await playingAt(half)

    expect(playheads(container)).toEqual(['50%', '50%'])
  })

  test("moves on both plots when the fake's current time advances and the interval reads it", async () => {
    const { container, player } = await playingAt(quarter)
    await drive(() => player.setCurrentTime(half))
    const beforeTheRead = playheads(container)
    await advance(250)

    expect([beforeTheRead, playheads(container)]).toEqual([
      ['25%', '25%'],
      ['50%', '50%'],
    ])
  })

  test.for([
    ['pause', 2],
    ['end', 0],
  ] as const)('holds on both plots at the time of the %s', async ([, state]) => {
    const { container, player } = await playingAt(quarter)
    await drive(() => player.setCurrentTime(half))
    await drive(() => player.changeState(state))
    const held = playheads(container)
    await drive(() => player.setCurrentTime(threeQuarters))
    await advance(1000)

    expect([held, playheads(container)]).toEqual([
      ['50%', '50%'],
      ['50%', '50%'],
    ])
  })

  test.for(['pause', 'end', 'unmount'] as const)(
    'stops reading the current time on %s',
    async (stop) => {
      const { player } = await playingAt(quarter)
      await advance(500)
      const readsWhilePlaying = player.timeReads
      if (stop === 'unmount') {
        rendered?.unmount()
        rendered = null
      } else {
        await drive(() => player.changeState(stop === 'pause' ? 2 : 0))
      }
      const readsAtTheStop = player.timeReads
      await advance(1000)

      expect(readsWhilePlaying).toBeGreaterThan(1)
      expect(player.timeReads).toBe(readsAtTheStop)
    },
  )

  test('a second playing report starts no second read, so a pause still stops reading', async () => {
    const { player } = await playingAt(quarter)
    await drive(() => player.changeState(1))
    await drive(() => player.changeState(2))
    const readsAtThePause = player.timeReads
    await advance(1000)

    expect(player.timeReads).toBe(readsAtThePause)
  })

  test("sits at the plot's right edge for a time past the answer's duration", async () => {
    const { container } = await playingAt(800)

    expect(playheads(container)).toEqual(['100%', '100%'])
  })

  test('a step to the next video hides the playhead until that video plays', async () => {
    const { container, player } = await playingAt(half)
    await click(linkLabelled(container, 'Older video: A third video'))
    const afterTheStep = playheads(container)
    await drive(() => {
      player.changeState(5)
      player.setCurrentTime(quarter)
    })
    await advance(1000)
    const cued = playheads(container)
    await drive(() => player.changeState(1))

    expect([afterTheStep, cued, playheads(container)]).toEqual([
      [null, null],
      [null, null],
      ['25%', '25%'],
    ])
  })

  /** Each retention plot's slider value and text, and the app's own live region beside it. */
  function cursorsOf(container: HTMLElement) {
    return retentionPlots(container).map((plot) => ({
      valueNow: plot.getAttribute('aria-valuenow'),
      valueText: plot.getAttribute('aria-valuetext'),
      spoken:
        plot.parentElement?.querySelector('p.visually-hidden[aria-live="polite"] > span')
          ?.textContent ?? '',
    }))
  }

  test('shows no hover card and places no cursor while it moves', async () => {
    const { container, player } = await playingAt(quarter)
    await drive(() => player.setCurrentTime(half))
    await advance(250)
    const cards = retentionPlots(container).map((plot) => plot.querySelector('.chart-hover-card'))

    expect(playheads(container)).toEqual(['50%', '50%'])
    expect(cursorsOf(container).map(({ valueText, spoken }) => [valueText, spoken])).toEqual([
      [sliderTextOf(null), ''],
      [sliderTextOf(null), ''],
    ])
    expect(cards).toEqual([null, null])
  })

  /** Each retention plot's hover card title, or null where the plot shows no card. */
  function cardTitlesOf(container: HTMLElement) {
    return retentionPlots(container).map(
      (plot) => plot.querySelector('.chart-hover-card .chart-hover-title')?.textContent ?? null,
    )
  }

  test('the shared cursor and its hover card follow the keyboard while it moves', async () => {
    const { container, player } = await playingAt(quarter)
    const [watching] = retentionPlots(container)
    if (!watching) throw new Error('No audience retention plot')
    await act(async () => watching.focus())
    await act(async () => {
      watching.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    })
    const placed = cursorsOf(container)
    const placedCards = cardTitlesOf(container)
    await drive(() => player.setCurrentTime(half))
    await advance(1000)

    expect(placed.map(({ valueNow }) => valueNow)).toEqual(['2', '2'])
    expect(placed.every(({ valueText }) => valueText !== sliderTextOf(null))).toBe(true)
    expect(placed[0]?.spoken).not.toBe('')
    // End steps to the curve's last point, at fakeVideo's 754 seconds.
    expect(placedCards).toEqual(['12:34', '12:34'])
    expect(cursorsOf(container)).toEqual(placed)
    expect(cardTitlesOf(container)).toEqual(placedCards)
    expect(playheads(container)).toEqual(['50%', '50%'])
  })

  test('the shared cursor and its hover card follow the pointer while it moves', async () => {
    const { container, player } = await playingAt(quarter)
    const [watching] = retentionPlots(container)
    const svg = watching?.querySelector('.cursor-plot-chart svg')
    if (!svg) throw new Error('No library svg in the watching plot')
    // happy-dom's `getScreenCTM` is the identity, so these are the library svg's own coordinates
    // (viewBox 0 0 640 320): the curve's last point, at the plot's right edge.
    await act(async () => {
      svg.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerType: 'mouse',
          bubbles: true,
          clientX: 640,
          clientY: 192,
        }),
      )
    })
    const placed = cursorsOf(container)
    const placedCards = cardTitlesOf(container)
    await drive(() => player.setCurrentTime(half))
    await advance(1000)

    expect(placed.map(({ valueNow }) => valueNow)).toEqual(['2', '2'])
    // The pointer sits on the curve's last point, at fakeVideo's 754 seconds.
    expect(placedCards).toEqual(['12:34', '12:34'])
    expect(cursorsOf(container)).toEqual(placed)
    expect(cardTitlesOf(container)).toEqual(placedCards)
    expect(playheads(container)).toEqual(['50%', '50%'])
  })
})

// fakeVideo's duration is 754 seconds. The point at 0.11 ends the slice that starts at the point
// before it, 0.05, which is 37.7 seconds, so the player moves to the whole second 37, which reads
// 0:37.
const moveCurve: AudienceRetentionPoint[] = [
  { elapsedVideoTimeRatio: 0.05, audienceWatchRatio: 1, relativeRetentionPerformance: 0.5 },
  { elapsedVideoTimeRatio: 0.11, audienceWatchRatio: 0.8, relativeRetentionPerformance: 0.6 },
  { elapsedVideoTimeRatio: 1, audienceWatchRatio: 0.4, relativeRetentionPerformance: 0.5 },
]
const atSecondPoint = 0.11

/** video-2's screen, whose answer holds the player, over `moveCurve`. */
async function moveScreen() {
  const api = playableApi()
  api.retention = moveCurve
  const { container } = await render('videos/video-2')
  return container
}

/** video-2's screen with its player ready and cued, and the fake player behind it. */
async function loadedMoveScreen() {
  const container = await moveScreen()
  const player = onlyLivePlayer()
  await act(async () => {
    player.ready()
    player.changeState(5)
  })
  vi.mocked(track).mockClear()
  return { container, player }
}

/**
 * A pointer event on a plot's library svg at a point's share of the video. happy-dom's
 * `getScreenCTM` is the identity, so these are the svg's own coordinates (viewBox 0 0 640 320),
 * and the plot's x runs over the whole video with no margin.
 */
async function pointerOn(
  plot: HTMLElement | undefined,
  type: 'click' | 'pointercancel' | 'pointerdown' | 'pointermove',
  pointerType: 'mouse' | 'pen' | 'touch',
  ratio: number,
): Promise<void> {
  const svg = plot?.querySelector('.cursor-plot-chart svg')
  if (!svg) throw new Error('No library svg in the plot')
  await act(async () => {
    svg.dispatchEvent(
      new PointerEvent(type, { pointerType, bubbles: true, clientX: 640 * ratio, clientY: 160 }),
    )
  })
  await settle()
}

/** A tap as a finger makes it: its pointerdown, then the click the browser follows it with. */
async function tapOn(plot: HTMLElement | undefined, ratio: number): Promise<void> {
  await pointerOn(plot, 'pointerdown', 'touch', ratio)
  await pointerOn(plot, 'click', 'touch', ratio)
}

/**
 * A finger that lands on a plot and scrolls the page: its pointerdown, then the pointercancel the
 * browser sends when it takes the pan, and no click after it.
 */
async function scrollFrom(plot: HTMLElement | undefined, ratio: number): Promise<void> {
  await pointerOn(plot, 'pointerdown', 'touch', ratio)
  await pointerOn(plot, 'pointercancel', 'touch', ratio)
}

async function keyOn(plot: HTMLElement | undefined, key: string): Promise<void> {
  if (!plot) throw new Error('No plot')
  await act(async () => plot.focus())
  await act(async () => {
    plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
  await settle()
}

/** What the app's own live region beside a plot says. */
function spokenBeside(plot: HTMLElement | undefined): string {
  return (
    plot?.parentElement?.querySelector('p.visually-hidden[aria-live="polite"] > span')
      ?.textContent ?? ''
  )
}

/** The `video_player_seeked` events sent, with their properties. */
function seekedEvents() {
  return vi
    .mocked(track)
    .mock.calls.map(([event]) => event)
    .filter(
      (event): event is Extract<typeof event, { name: 'video_player_seeked' }> =>
        event.name === 'video_player_seeked',
    )
}

describe('a pick on an audience retention plot moves the video player', () => {
  test.for([0, 1])(
    "a click on plot %i seeks to the start of the point's slice, the whole second at or before the point before it",
    async (which) => {
      const { container, player } = await loadedMoveScreen()
      await pointerOn(retentionPlots(container)[which], 'click', 'mouse', atSecondPoint)

      expect(player.seeks).toEqual([37])
    },
  )

  test.for([0, 1])('a click on the first point of plot %i seeks to 0:00', async (which) => {
    const { container, player } = await loadedMoveScreen()
    await pointerOn(retentionPlots(container)[which], 'click', 'pen', 0.05)

    expect(player.seeks).toEqual([0])
  })

  test('a slice that starts on a whole second seeks to that second, not the one before', () => {
    // 0.57 times 100 is 56.99999999999999 in floating point.
    const points = [0.57, 0.58].map((elapsedVideoTimeRatio) => ({
      elapsedVideoTimeRatio,
      audienceWatchRatio: 0.5,
      relativeRetentionPerformance: 0.5,
    }))

    expect(playerSecondsAt(points, 1, 100)).toBe(57)
  })

  test('a tap seeks once and places the hover card on both plots', async () => {
    const { container, player } = await loadedMoveScreen()
    const plots = retentionPlots(container)
    await tapOn(plots[1], atSecondPoint)

    expect(player.seeks).toEqual([37])
    expect(plots.map((plot) => plot.getAttribute('aria-valuenow'))).toEqual(['2', '2'])
    expect(plots.map((plot) => plot.getAttribute('aria-valuetext'))).not.toContain(
      sliderTextOf(null),
    )
  })

  test('a finger that scrolls from a plot places the hover card and moves nothing', async () => {
    const { container, player } = await loadedMoveScreen()
    const plots = retentionPlots(container)
    await scrollFrom(plots[1], atSecondPoint)

    expect(plots.map((plot) => plot.getAttribute('aria-valuenow'))).toEqual(['2', '2'])
    expect([player.seeks, player.cues, seekedEvents(), plots.map(spokenBeside)]).toEqual([
      [],
      [],
      [],
      ['', ''],
    ])
  })

  test.for(['Enter', ' '])('the key "%s" seeks to the point the keys selected', async (key) => {
    const { container, player } = await loadedMoveScreen()
    const [watching] = retentionPlots(container)
    await keyOn(watching, 'ArrowRight')
    await keyOn(watching, 'ArrowRight')
    await keyOn(watching, key)

    expect(player.seeks).toEqual([37])
  })

  test.for(['Enter', ' '])('the key "%s" with no point selected seeks nothing', async (key) => {
    const { container, player } = await loadedMoveScreen()
    await keyOn(retentionPlots(container)[0], key)

    expect(player.seeks).toEqual([])
  })

  test('a hover and the arrow keys, Home and End move the cursor and seek nothing', async () => {
    const { container, player } = await loadedMoveScreen()
    const [watching] = retentionPlots(container)
    await pointerOn(watching, 'pointermove', 'mouse', atSecondPoint)
    const hovered = watching?.getAttribute('aria-valuenow')
    for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) await keyOn(watching, key)

    expect([hovered, watching?.getAttribute('aria-valuenow')]).toEqual(['2', '3'])
    expect(player.seeks).toEqual([])
  })

  // The fake records what the app asks of the boundary; that a seek leaves a paused or cued player
  // stopped is the boundary's rule, which youtube-player.test.ts holds over YouTube's own calls.
  test.for([
    ['playing', 1],
    ['paused', 2],
    ['cued', 5],
  ] as const)(
    'a click while %s asks the boundary for one seek and nothing else',
    async ([, state]) => {
      const { container, player } = await loadedMoveScreen()
      const created = fakePlayers.length
      await act(async () => player.changeState(state))
      await pointerOn(retentionPlots(container)[0], 'click', 'mouse', atSecondPoint)

      expect([player.seeks, player.cues, fakePlayers.length]).toEqual([[37], [], created])
    },
  )

  test("the clicked plot's live region says where the player is", async () => {
    const { container } = await loadedMoveScreen()
    const plots = retentionPlots(container)
    await pointerOn(plots[1], 'click', 'mouse', atSecondPoint)

    expect(plots.map(spokenBeside)).toEqual(['', 'Video player at 0:37.'])
  })

  test('a plot on a video with no duration keeps its name with no sentence on the player', async () => {
    const api = installFakeApi()
    api.videos = [{ ...withThumbnail(fakeVideo), durationSeconds: null }]
    api.retention = moveCurve
    const { container } = await render('videos/video-1')

    expect(retentionPlots(container, null)).toHaveLength(2)
    expect(() => retentionPlots(container)).toThrow()
  })
})

// The fake records the seek the app asks for; that a seek before ready waits and is cued once the
// player is ready is the boundary's rule, which youtube-player.test.ts holds over YouTube's calls.
describe('a pick on an audience retention plot before the player is ready', () => {
  test.for([
    ['a click', (plots: HTMLElement[]) => pointerOn(plots[0], 'click', 'mouse', atSecondPoint)],
    ['a tap', (plots: HTMLElement[]) => tapOn(plots[1], atSecondPoint)],
    ...['Enter', ' '].map(
      (key) =>
        [
          `the key "${key}"`,
          async (plots: HTMLElement[]) => {
            for (const each of ['ArrowRight', 'ArrowRight', key]) await keyOn(plots[0], each)
          },
        ] as const,
    ),
  ] as const)('%s asks the one player for the seek, with no second player', async ([, pick]) => {
    const container = await moveScreen()
    const player = onlyLivePlayer()
    const created = fakePlayers.length
    await pick(retentionPlots(container))

    expect([player.seeks, player.cues, fakePlayers.length]).toEqual([[37], [], created])
  })

  test("the plot's live region says where the player is", async () => {
    const container = await moveScreen()
    const [watching] = retentionPlots(container)
    await keyOn(watching, 'ArrowRight')
    await keyOn(watching, 'ArrowRight')
    await keyOn(watching, 'Enter')

    expect(spokenBeside(watching)).toBe('Video player at 0:37.')
  })
})

describe('video_player_seeked', () => {
  test('a click on each plot sends the plot it came from, and the pointer', async () => {
    const { container } = await loadedMoveScreen()
    const plots = retentionPlots(container)
    await pointerOn(plots[0], 'click', 'mouse', atSecondPoint)
    await pointerOn(plots[1], 'click', 'pen', atSecondPoint)

    expect(seekedEvents()).toEqual([
      { name: 'video_player_seeked', plot: 'absolute', input: 'pointer' },
      { name: 'video_player_seeked', plot: 'relative', input: 'pointer' },
    ])
  })

  test('a tap sends touch, and Enter and Space send keyboard', async () => {
    const { container } = await loadedMoveScreen()
    const [watching] = retentionPlots(container)
    await tapOn(watching, atSecondPoint)
    await keyOn(watching, 'Enter')
    await keyOn(watching, ' ')

    expect(seekedEvents().map(({ input }) => input)).toEqual(['touch', 'keyboard', 'keyboard'])
  })

  test('a pick before the player is ready sends it too, as it moves the player', async () => {
    const container = await moveScreen()
    await pointerOn(retentionPlots(container)[0], 'click', 'mouse', atSecondPoint)

    expect(seekedEvents()).toEqual([
      { name: 'video_player_seeked', plot: 'absolute', input: 'pointer' },
    ])
  })
})

/** What the player's box shows in place of the player: its lines, its link, and any frame. */
function cannotPlayPanel(container: HTMLElement) {
  const panel = playerBox(container)?.querySelector('.video-player-cannot-play')
  const link = panel?.querySelector('a')
  return {
    lines: [...(panel?.querySelectorAll('p') ?? [])].map(({ textContent }) => textContent),
    link: [link?.textContent, link?.getAttribute('href')],
    frame: playerBox(container)?.querySelector('iframe') ?? null,
  }
}

/** video-2's screen over `moveCurve`, with video-2 answered as `playability` says. */
async function screenOf(playability: { embeddable?: boolean; madeForKids?: boolean }) {
  const api = playableApi()
  api.retention = moveCurve
  api.playability = { 'video-2': playability }
  const { container } = await render('videos/video-2')
  return container
}

describe('a video that cannot play in the video player', () => {
  test('a video not embeddable shows the not-embeddable text and the Watch on YouTube link in the box, and asks nothing of the player boundary, before and after a plot click', async () => {
    const container = await screenOf({ embeddable: false })
    const before = cannotPlayPanel(container)
    await pointerOn(retentionPlots(container, null)[0], 'click', 'mouse', atSecondPoint)

    const shown = {
      lines: [cannotPlayText.notEmbeddable],
      link: ['Watch on YouTube', youtubeWatchUrlOf('video-2')],
      frame: null,
    }
    expect([before, cannotPlayPanel(container)]).toEqual([shown, shown])
    expect(fakePlayers).toEqual([])
  })

  test.for([100, 101, 150])(
    'player error %i replaces the player with the not-embeddable text and the link, and destroys it',
    async (code) => {
      const { container, player } = await loadedMoveScreen()
      await act(async () => player.fail(code))
      await settle()

      expect(cannotPlayPanel(container)).toEqual({
        lines: [cannotPlayText.notEmbeddable],
        link: ['Watch on YouTube', youtubeWatchUrlOf('video-2')],
        frame: null,
      })
      expect(livePlayers()).toEqual([])
    },
  )

  test('any other player error replaces the player with the failure text and the link', async () => {
    const { container, player } = await loadedMoveScreen()
    await act(async () => player.fail(5))
    await settle()

    expect(cannotPlayPanel(container)).toEqual({
      lines: [cannotPlayText.failed],
      link: ['Watch on YouTube', youtubeWatchUrlOf('video-2')],
      frame: null,
    })
    expect(livePlayers()).toEqual([])
  })

  test('while the video cannot play, the retention plots carry no sentence on the player and a click moves nothing', async () => {
    const { container, player } = await loadedMoveScreen()
    await act(async () => player.fail(150))
    await settle()
    await pointerOn(retentionPlots(container, null)[0], 'click', 'mouse', atSecondPoint)

    expect(() => retentionPlots(container)).toThrow()
    expect([player.seeks, seekedEvents(), cannotPlayPanel(container).lines]).toEqual([
      [],
      [],
      [cannotPlayText.notEmbeddable],
    ])
  })

  test('a step from a video whose player failed to one that plays shows a player again, cued at 0:00, with no press', async () => {
    const { container, player } = await loadedMoveScreen()
    await act(async () => player.fail(100))
    await settle()
    await click(linkLabelled(container, 'Older video: A third video'))
    const [next, ...others] = livePlayers()

    expect(others).toEqual([])
    expect({ videoId: next?.videoId, startSeconds: next?.startSeconds }).toEqual({
      videoId: 'video-3',
      startSeconds: 0,
    })
    expect(next?.element.closest('.video-player')).toBe(playerBox(container))
  })

  test('a step from a video not embeddable to one whose answer holds no retention curve asks nothing of the player boundary, during the read or after it', async () => {
    const api = playableApi()
    api.retention = moveCurve
    api.playability = { 'video-2': { embeddable: false } }
    const { container } = await render('videos/video-2')
    const read = api.hold(`GET /api/channels/${fakeChannel.id}/videos/video-3`)
    api.retention = []
    await click(linkLabelled(container, 'Older video: A third video'))
    const createdDuringRead = fakePlayers.map(({ videoId }) => videoId)
    await act(async () => read.release())
    await settle()

    expect({
      createdDuringRead,
      created: fakePlayers.map(({ videoId }) => videoId),
      box: playerBox(container) !== null,
    }).toEqual({ createdDuringRead: [], created: [], box: false })
  })

  test('a step from a video whose player failed creates no player while the next video is read, and one once its answer holds the player', async () => {
    const api = playableApi()
    api.retention = moveCurve
    const { container } = await render('videos/video-2')
    await act(async () => onlyLivePlayer().fail(100))
    await settle()
    const read = api.hold(`GET /api/channels/${fakeChannel.id}/videos/video-3`)
    await click(linkLabelled(container, 'Older video: A third video'))
    const liveDuringRead = livePlayers().map(({ videoId }) => videoId)
    await act(async () => read.release())
    await settle()

    expect([liveDuringRead, livePlayers().map(({ videoId }) => videoId)]).toEqual([[], ['video-3']])
    expect(onlyLivePlayer().element.closest('.video-player')).toBe(playerBox(container))
  })
})

describe('a video made for kids sends no player event', () => {
  test('the player loads and its ready sends no video_player_loaded', async () => {
    const container = await screenOf({ madeForKids: true })
    const player = onlyLivePlayer()
    vi.mocked(track).mockClear()
    await act(async () => player.ready())

    expect([player.videoId, playerBox(container)?.contains(player.element)]).toEqual([
      'video-2',
      true,
    ])
    expect(vi.mocked(track).mock.calls).toEqual([])
  })

  test('a click seeks the player and sends no video_player_seeked', async () => {
    const container = await screenOf({ madeForKids: true })
    const player = onlyLivePlayer()
    await act(async () => {
      player.ready()
      player.changeState(5)
    })
    vi.mocked(track).mockClear()
    await pointerOn(retentionPlots(container)[0], 'click', 'mouse', atSecondPoint)

    expect([player.seeks, vi.mocked(track).mock.calls]).toEqual([[37], []])
  })

  // A step heads the screen from the next video's list row, which says nothing of made for kids.
  test('a ready while a step is read sends no video_player_loaded, not even once the answer says the video is not made for kids', async () => {
    const api = playableApi()
    api.retention = moveCurve
    const { container } = await render('videos/video-2')
    const player = onlyLivePlayer()
    const route = `GET /api/channels/${fakeChannel.id}/videos/video-3`
    const reads = [api.hold(route), api.hold(route)]
    await click(linkLabelled(container, 'Older video: A third video'))
    vi.mocked(track).mockClear()
    await act(async () => player.ready())
    await act(async () => {
      for (const read of reads) read.release()
    })
    await settle()

    expect([livePlayers(), player.cues, loadedEvents()]).toEqual([
      [player],
      [{ videoId: 'video-3', startSeconds: 0 }],
      [],
    ])
  })
})
