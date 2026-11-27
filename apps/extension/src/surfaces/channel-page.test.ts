// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://www.youtube.com/channel/UC8mOjhMBTyPPScCF9vYtwFg/videos"}
// Limits: jsdom lays nothing out and the fixtures carry none of YouTube's stylesheets, so these
// tests see which tiles get the engaged views pill, what it says and is named, and that it is the
// view count element's next sibling in YouTube's markup, that it opens with its own hidden space,
// as YouTube's lockup delimiter does, and no dot, and that its shadow stylesheet declares no capsule
// (background, border or padding). They do not see where it lands in the tile's metadata line,
// how its spacing reads beside YouTube's, that it takes YouTube's type and colour, or that it reads in YouTube's light and dark
// themes: creator-analytics#627's hand check, and creator-analytics#143's walk of the public page
// surfaces in Chrome and Firefox. The fixtures are one save of each tab (2026-11-06, the Live tab 2026-11-08), so a YouTube redesign after that day
// is not seen here. A tab YouTube grows as the creator scrolls is modelled by cloning its tiles with
// other ids, and another channel's grid by pointing the saved tiles at ids that are not the
// creator's. The tiles' ids are matched in the browser against the creator's uploads, which the fake
// background answers, and never sent: every test checks `videoIdsSentIn`, and
// test/page-boundary.test.ts holds the selectors and surfaces to reading hrefs and the URL only.
import type { ListedChannel } from '@creator-analytics/api-types'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { signedInReadKeptMs } from '../kept.ts'
import type { AskBackground, BackgroundRequest } from '../messages.ts'
import type { UploadsRead } from '../product-api.ts'
import { channelPage } from './channel-page.ts'
import { lineClicks } from './line-clicks.ts'
import { giveUpAfterMs, passEveryMs, reportThrough, watchPage } from './page-watcher.ts'
import {
  capsuleOf,
  eventsIn,
  failingAcrossTheKeep,
  fakeYouTubeBackground,
  loadYouTubePage,
  savedVideoIds,
  separatorBefore,
  shownOn,
  studioChanges,
  type UploadsAnswer,
  type UploadsOfChannel,
  uploadsAnsweredAfter,
  uploadsAskedIn,
  uploadsOf,
  videoIdsSentIn,
} from './testing.ts'
import { surfaceText } from './text.ts'

const channelId = 'UC8mOjhMBTyPPScCF9vYtwFg'

const nick: ListedChannel = {
  id: 'channel-1',
  youtubeChannelId: channelId,
  title: 'Nick Vogel',
  handle: '@nick_vogel',
  revenueConsentedAt: null,
}
const someoneElse: ListedChannel = {
  id: 'channel-2',
  youtubeChannelId: 'UCaaaaaaaaaaaaaaaaaaaaaa',
  title: 'Someone else',
  handle: '@someone_else',
  revenueConsentedAt: null,
}

/** The channel page on screen; YouTube keeps a hidden watch page beside it. */
const shownPage = () => document.querySelector('ytd-browse[page-subtype="channels"]:not([hidden])')
const allTiles = () => [...(shownPage()?.querySelectorAll('yt-lockup-view-model') ?? [])]
const isPlaylist = (tile: Element) =>
  tile.querySelector('yt-collection-thumbnail-view-model, yt-collections-stack') !== null
const videoTiles = () => allTiles().filter((tile) => !isPlaylist(tile))
const playlistTiles = () => allTiles().filter(isPlaylist)

/** The video a tile links, as YouTube wrote it in the page. */
function tileId(tile: Element): string {
  const href = tile.querySelector('a[href^="/watch?v="]')?.getAttribute('href') ?? ''
  return new URL(href, location.href).searchParams.get('v') ?? ''
}

/** YouTube's view count in a tile: the metadata text after the row's play icon. */
const viewCountOf = (tile: Element) =>
  tile.querySelector(
    '.ytContentMetadataViewModelLeadingIcon + .ytContentMetadataViewModelMetadataText',
  )

const hosts = () => [...document.querySelectorAll('[data-stillstats-surface]')]
const pillHostsIn = (tile: Element) => [
  ...tile.querySelectorAll('[data-stillstats-surface="channel_page"]'),
]

/** The tile's pill, if it is the view count's next sibling. */
function pillBeside(tile: Element) {
  const next = viewCountOf(tile)?.nextElementSibling
  if (!next?.matches('[data-stillstats-surface="channel_page"]')) return undefined
  const pill = next.shadowRoot?.querySelector('.pill')
  return {
    text: pill?.textContent?.replace(/\s+/g, ' ').trim(),
    title: pill?.getAttribute('title'),
    name: pill?.getAttribute('aria-label'),
    role: pill?.getAttribute('role'),
    opensWithIcon: pill?.firstElementChild?.localName === 'svg',
    links: next.shadowRoot?.querySelectorAll('a').length,
  }
}

/** The tile's pill host, if it is the view count's next sibling. */
const hostBeside = (tile: Element) => {
  const next = viewCountOf(tile)?.nextElementSibling
  return next?.matches('[data-stillstats-surface="channel_page"]') ? next : undefined
}

/** What the tile's pill host draws before the pill, as the creator sees and a screen reader hears it. */
function separatorOf(tile: Element) {
  const separator = separatorBefore(hostBeside(tile))
  return separator && { text: separator.textContent, hidden: separator.getAttribute('aria-hidden') }
}

/** Eleven characters, like a YouTube id, unlike any id in the fixtures: more of the creator's. */
const otherId = (index: number) => `other${String(index).padStart(6, '0')}`
/** Another channel's videos, none of them among the creator's uploads. */
const theirId = (index: number) => `their${String(index).padStart(6, '0')}`

/** The creator's uploads: every video of the saved tabs, and 100 more they scroll to. */
const myUploads = [
  ...savedVideoIds('channel-videos'),
  ...savedVideoIds('channel-home'),
  ...savedVideoIds('channel-streams'),
  ...Array.from({ length: 100 }, (_, index) => otherId(index)),
]

/** YouTube points the tile at another video: its links' hrefs change. */
function pointTileAt(tile: Element, id: string): void {
  for (const link of tile.querySelectorAll('a[href^="/watch?v="]'))
    link.setAttribute('href', `/watch?v=${id}`)
}

/** YouTube draws `count` more tiles on the tab, copies of its first tile linking `idOf` videos. */
function addTiles(count: number, idOf = otherId): void {
  const first = videoTiles()[0] as Element
  for (let index = 0; index < count; index += 1) {
    const copy = first.cloneNode(true) as Element
    for (const host of pillHostsIn(copy)) host.remove()
    pointTileAt(copy, idOf(index))
    first.parentElement?.append(copy)
  }
}

/** YouTube redraws the grid with another channel's videos. */
function youtubeDrawsTheirGrid(): void {
  for (const [index, tile] of videoTiles().entries()) pointTileAt(tile, theirId(index))
}

let asked: BackgroundRequest[] | undefined
let navigated: (to: string) => void
let stop: () => void = () => {}

/**
 * Runs the content script's watch on the channel page past the give-up time, the background holding
 * `channels` and answering each held channel's uploads read from `uploads`, by default the creator's
 * `myUploads`, each request passing `through` on its way to it.
 */
async function showPage({
  channels = [nick],
  uploads = { [channelId]: myUploads },
  answer,
  through = (request) => Promise.resolve(request),
}: {
  channels?: Parameters<typeof fakeYouTubeBackground>[0]['channels']
  uploads?: Record<string, UploadsOfChannel>
  answer?: UploadsAnswer
  through?: (request: BackgroundRequest) => Promise<unknown>
} = {}): Promise<void> {
  const background = fakeYouTubeBackground({ channels, uploads, answer })
  asked = background.asked
  const ask = (async (request: BackgroundRequest) => {
    await through(request)
    return background.ask(request)
  }) as AskBackground
  const watcher = watchPage({
    document,
    url: () => location.href,
    // en-US, whose compact form is the approved copy's example, "334K"; en-GB's is "334k".
    surfaces: [channelPage({ ask, origin: '', locale: 'en-US', lineClicks: lineClicks(ask) })],
    report: reportThrough(ask),
  })
  stop = watcher.stop
  navigated = watcher.navigated
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)
}

/** An in-page move of the URL to `url`, as YouTube's router makes it and WXT reports it. */
function urlMovesTo(url: string): void {
  history.pushState(null, '', url)
  navigated(location.href)
}

/** An in-page move to `url` that then settles. */
async function moveTo(url: string): Promise<void> {
  urlMovesTo(url)
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)
}

/** YouTube changes the page, and the pass it starts runs. */
async function youtubeChanges(): Promise<void> {
  studioChanges()
  await vi.advanceTimersByTimeAsync(1_000)
}

const sent = () => videoIdsSentIn(asked ?? [])
const uploadsReads = () => uploadsAskedIn(asked ?? [])
const events = () => eventsIn(asked ?? [])
const pilled = () => videoTiles().filter((tile) => pillBeside(tile) !== undefined)

/** Loads a saved tab and puts the jsdom page on `url`, by default the URL it was saved from. */
function load(name: 'channel-videos' | 'channel-home' | 'channel-streams', url?: string): void {
  const savedAt = loadYouTubePage(name)
  history.replaceState(null, '', url ?? savedAt)
}

beforeEach(() => {
  vi.useFakeTimers()
  asked = undefined
  load('channel-videos')
})

afterEach(() => {
  // Whatever a test did, the page sent no video id (ADR 0016, creator-analytics#520).
  expect(sent()).toEqual([])
  stop()
  vi.useRealTimers()
})

describe("the creator's channel tabs", () => {
  test.each([
    ['Videos', 'channel-videos', 30],
    ['Home', 'channel-home', 40],
  ] as const)(
    "on the %s tab, each of the creator's videos shows the pill next to YouTube's view count, with the compact figure, and the full figure and its day in its hover and accessible name",
    async (_, name, count) => {
      load(name)

      await showPage()

      expect(videoTiles()).toHaveLength(count)
      for (const tile of videoTiles()) {
        expect(pillHostsIn(tile)).toHaveLength(1)
        expect(pillBeside(tile)).toEqual({
          text: '334K engaged views',
          title: 'Stillstats: 334,212 engaged views. Through Oct 7',
          name: 'Stillstats: 334,212 engaged views. Through Oct 7',
          role: 'img',
          opensWithIcon: true,
          links: 0,
        })
      }
    },
  )

  test("on the Live tab, each of the creator's streams with a view count shows the pill next to it, a members-only stream YouTube draws with no count shows none, and the uploads are read once", async () => {
    load('channel-streams')

    await showPage()

    expect(videoTiles()).toHaveLength(30)
    const counted = videoTiles().filter((tile) => viewCountOf(tile) !== null)
    const membersOnly = videoTiles().filter((tile) => viewCountOf(tile) === null)
    expect(counted).toHaveLength(27)
    expect(membersOnly.map(tileId)).toEqual(['3UDiLVe0PFA', 'QBTWky803kQ', 'sEso-KBGcnc'])
    for (const tile of counted) {
      expect(pillHostsIn(tile)).toHaveLength(1)
      expect(pillBeside(tile)).toEqual({
        text: '334K engaged views',
        title: 'Stillstats: 334,212 engaged views. Through Oct 7',
        name: 'Stillstats: 334,212 engaged views. Through Oct 7',
        role: 'img',
        opensWithIcon: true,
        links: 0,
      })
    }
    for (const tile of membersOnly) expect(pillHostsIn(tile)).toEqual([])
    expect(uploadsReads()).toEqual([channelId])
    expect(events()).toEqual([shownOn('channel_page', { fromCache: false })])
  })

  test.each([
    ['Videos', 'channel-videos'],
    ['Home', 'channel-home'],
    ['Live', 'channel-streams'],
  ] as const)(
    "on the %s tab, each pill follows YouTube's lockup spacing, the one space its delimiter puts between the count and the date, with no dot, and stays the view count's next sibling",
    async (_, name) => {
      load(name)

      await showPage()

      const pilled = videoTiles().filter((tile) => hostBeside(tile) !== undefined)
      expect(pilled.length).toBeGreaterThan(0)
      for (const tile of pilled)
        expect(separatorOf(tile)).toEqual({ text: '\u00a0', hidden: 'true' })
    },
  )

  test.each([
    ['Videos', 'channel-videos'],
    ['Home', 'channel-home'],
    ['Live', 'channel-streams'],
  ] as const)(
    "on the %s tab, each pill reads as one of the line's metadata items: no capsule around it",
    async (_, name) => {
      load(name)

      await showPage()

      const pilled = videoTiles().filter((tile) => hostBeside(tile) !== undefined)
      expect(pilled.length).toBeGreaterThan(0)
      for (const tile of pilled) expect(capsuleOf(hostBeside(tile))).toEqual([])
    },
  )

  test("the Home tab's playlist tiles show no pill, and the held channel's uploads are read once, sending no tile's id", async () => {
    load('channel-home')

    await showPage()

    expect(playlistTiles()).toHaveLength(3)
    for (const tile of playlistTiles()) expect(pillHostsIn(tile)).toEqual([])
    expect(uploadsReads()).toEqual([channelId])
    expect(sent()).toEqual([])
  })

  test('a playlist tile shows no pill, even drawn with a view count', async () => {
    load('channel-home')
    const row = viewCountOf(videoTiles()[0] as Element)?.parentElement as Element
    for (const tile of playlistTiles())
      tile.querySelector('.ytContentMetadataViewModelMetadataRow')?.after(row.cloneNode(true))

    await showPage()

    expect(playlistTiles().every((tile) => viewCountOf(tile) !== null)).toBe(true)
    for (const tile of playlistTiles()) expect(pillHostsIn(tile)).toEqual([])
  })

  test.each([
    ['channel-videos', `/@nick_vogel/videos`, 30],
    ['channel-videos', '/@NICK_VOGEL', 30],
    ['channel-videos', `/channel/${channelId}/videos`, 30],
    ['channel-streams', `/channel/${channelId}/streams`, 27],
    ['channel-streams', '/@NICK_VOGEL/streams', 27],
  ] as const)(
    'the %s tab reached at %s shows the pills, a held channel with no handle too: the uploads decide',
    async (name, path, count) => {
      load(name, path)

      await showPage({ channels: [{ ...nick, handle: null }] })

      expect(pilled()).toHaveLength(count)
    },
  )

  test.each([
    ['channel-videos', '/@someone_else/videos'],
    ['channel-streams', '/@someone_else/streams'],
  ] as const)(
    "a channel tab whose channel the creator does not hold, %s at %s, shows no pill on that channel's videos, and a featured video of the creator's there gets its pill",
    async (name, path) => {
      load(name, path)
      youtubeDrawsTheirGrid()
      const featured = videoTiles()[3] as Element
      pointTileAt(featured, otherId(0))

      await showPage()

      expect(pilled()).toEqual([featured])
    },
  )

  test("a Home tile featuring another channel's video shows no pill", async () => {
    load('channel-home')
    const featured = videoTiles()[0] as Element
    pointTileAt(featured, theirId(0))
    for (const link of featured.querySelectorAll('a[href="/@nick_vogel"]'))
      link.setAttribute('href', '/@someone_else')

    await showPage()

    expect(pillHostsIn(featured)).toEqual([])
    expect(pilled()).toHaveLength(39)
  })

  test("#138 F4.5: a Home tile of the creator's other held channel gets that channel's figure", async () => {
    load('channel-home')
    const featured = videoTiles()[0] as Element
    pointTileAt(featured, theirId(0))

    await showPage({
      channels: [nick, someoneElse],
      uploads: {
        [channelId]: myUploads,
        [someoneElse.youtubeChannelId]: uploadsOf([theirId(0)], { engagedViews: () => 12_000 }),
      },
    })

    expect(pillBeside(featured)?.text).toBe('12K engaged views')
    expect(pilled()).toHaveLength(40)
    expect(uploadsReads()).toEqual([channelId, someoneElse.youtubeChannelId])
  })

  test("a Home tile YouTube redraws with another channel's video loses its pill", async () => {
    load('channel-home')
    await showPage()
    const featured = videoTiles()[0] as Element
    expect(pillHostsIn(featured)).toHaveLength(1)

    pointTileAt(featured, theirId(0))
    await youtubeChanges()

    expect(pillHostsIn(featured)).toEqual([])
  })
})

/** Every line the Studio surfaces show, none of which a public page shows. */
const lineTexts = [
  surfaceText.signIn,
  surfaceText.channelNotInStillstats,
  surfaceText.connect,
  surfaceText.reconnect,
  surfaceText.allowAccess,
  surfaceText.tryAgain,
  surfaceText.notProcessed,
]

/** What the extension wrote anywhere on the page: each host's shadow text. */
const extensionText = () => hosts().map((host) => host.shadowRoot?.textContent ?? '')

describe('no pill', () => {
  test('a video not among the uploads and one YouTube has not processed show no pill, the others still do, and no line shows', async () => {
    const [left, awaiting] = videoTiles().map(tileId) as [string, string]

    await showPage({
      uploads: { [channelId]: myUploads.filter((id) => id !== left) },
      answer: { awaiting: [awaiting] },
    })

    const [first, second, ...rest] = videoTiles()
    expect(pillHostsIn(first as Element)).toEqual([])
    expect(pillHostsIn(second as Element)).toEqual([])
    for (const tile of rest) expect(pillBeside(tile)).toBeDefined()
    expect(hosts()).toHaveLength(rest.length)
    for (const line of lineTexts) expect(extensionText().join(' ')).not.toContain(line)
  })

  test('on the Live tab, a stream not among the uploads and one YouTube has not processed show no pill, the other counted streams still do, and no line shows', async () => {
    load('channel-streams')
    const [left, awaiting] = videoTiles().map(tileId) as [string, string]

    await showPage({
      uploads: { [channelId]: myUploads.filter((id) => id !== left) },
      answer: { awaiting: [awaiting] },
    })

    const [first, second] = videoTiles()
    expect(pillHostsIn(first as Element)).toEqual([])
    expect(pillHostsIn(second as Element)).toEqual([])
    expect(pilled()).toHaveLength(25)
    expect(hosts()).toHaveLength(25)
    for (const line of lineTexts) expect(extensionText().join(' ')).not.toContain(line)
  })

  test.each([
    ['signed out', { state: 'signed-out' }],
    ['a channel not in Stillstats', { state: 'channel-not-in-stillstats' }],
    ['refused for a reserved quota', { state: 'refused', refusal: 'quota_reserved' }],
    ['refused for a revoked connection', { state: 'refused', refusal: 'connection_revoked' }],
    ['failed', { state: 'failed' }],
    ['with host access withheld', { state: 'host-access-withheld' }],
  ] satisfies [string, UploadsRead][])(
    'an uploads read %s shows no pill and no line anywhere on the page',
    async (_, read) => {
      await showPage({ uploads: { [channelId]: read } })

      expect(hosts()).toEqual([])
      for (const line of lineTexts) expect(document.body.textContent).not.toContain(line)
    },
  )

  test('a channels read that finds the creator signed out shows no pill and reads no uploads', async () => {
    await showPage({ channels: { state: 'signed-out' } })

    expect(hosts()).toEqual([])
    expect(uploadsReads()).toEqual([])
  })
})

describe('the uploads read', () => {
  test('tiles YouTube appends as the creator scrolls get their pills with no new request', async () => {
    await showPage()
    const before = asked?.length

    addTiles(5)
    await youtubeChanges()
    await youtubeChanges()

    for (const tile of videoTiles()) expect(pillBeside(tile)).toBeDefined()
    expect(videoTiles()).toHaveLength(35)
    expect(asked?.length).toBe(before)
    expect(uploadsReads()).toEqual([channelId])
  })

  test.each([
    ['the Home tab', `/channel/${channelId}`],
    ['the Live tab', '/@nick_vogel/streams'],
  ])(
    'a move from the Videos tab to %s is a new navigation, which reads the uploads again',
    async (_, path) => {
      await showPage()

      await moveTo(path)

      expect(uploadsReads()).toEqual([channelId, channelId])
    },
  )

  test('a tab whose grid holds no video tile reads nothing', async () => {
    for (const tile of allTiles()) tile.remove()

    await showPage()

    expect(asked?.filter(({ type }) => type !== 'usage-event')).toEqual([])
  })

  /**
   * Another channel's Videos tab, its grid drawn: the saved tab, its tiles pointed at that
   * channel's videos, on that channel's URL.
   */
  async function showTheirTab(from = '/@someone_else/videos'): Promise<void> {
    load('channel-videos', from)
    youtubeDrawsTheirGrid()
    await showPage()
    expect(hosts()).toEqual([])
  }

  test("#138 F4.1: after a move to the creator's Videos tab, a continuation of the old channel's tiles drawn after the URL moved shows no pill and sends no id", async () => {
    await showTheirTab()

    urlMovesTo(`/channel/${channelId}/videos`)
    addTiles(10, (index) => theirId(100 + index))
    await youtubeChanges()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(hosts()).toEqual([])
    expect(sent()).toEqual([])

    for (const [index, tile] of videoTiles().entries()) pointTileAt(tile, otherId(index))
    await youtubeChanges()

    expect(pilled()).toHaveLength(40)
  })

  test("#138 F4.2: the grid redrawn with the next channel's tiles before the URL leaves the creator's tab shows no pill on them and sends no id", async () => {
    await showPage()
    expect(pilled()).toHaveLength(30)

    youtubeDrawsTheirGrid()
    await youtubeChanges()

    expect(hosts()).toEqual([])
    expect(sent()).toEqual([])

    await moveTo('/@someone_else/videos')

    expect(hosts()).toEqual([])
  })

  test.each([
    ['the home feed', '/'],
    ['search', '/results?search_query=payload'],
    ['a watch page', '/watch?v=dQw4w9WgXcQ'],
  ])(
    "#138 F4.3: arriving at the creator's tab from %s, YouTube drawing the grid before the URL moves, shows the pills and sends one extension_surface_shown",
    async (_, from) => {
      load('channel-videos', from)
      await showPage()
      expect(hosts()).toEqual([])

      await moveTo(`/channel/${channelId}/videos`)

      expect(pilled()).toHaveLength(30)
      expect(events()).toEqual([shownOn('channel_page', { fromCache: false })])
    },
  )

  test("#138 F3.4: a tile of the creator's video YouTube showed under another channel's URL first gets its pill once on the creator's tab", async () => {
    load('channel-videos', '/@someone_else/videos')
    await showPage()

    await moveTo(`/channel/${channelId}/videos`)
    await youtubeChanges()

    expect(pilled()).toHaveLength(30)
  })

  test.each([
    ['Podcasts tab', '/@someone_else/podcasts'],
    ['channel search', '/@someone_else/search?query=payload'],
  ])(
    "the tiles of a page the surface does not place on, here a %s, show no pill on the creator's tab and send no id",
    async (_, from) => {
      load('channel-videos', from)
      youtubeDrawsTheirGrid()
      await showPage()

      await moveTo(`/channel/${channelId}/videos`)
      await youtubeChanges()

      expect(hosts()).toEqual([])
    },
  )

  test("a tab the settle finds still holding only the other channel's grid sends no event: the grid is there", async () => {
    await showTheirTab()

    await moveTo(`/channel/${channelId}/videos`)

    expect(events()).toEqual([])
  })

  test("a tile YouTube points at another channel's video while the uploads read is out shows no pill", async () => {
    let release = () => {}
    await showPage({
      through: async (request) => {
        if (request.type !== 'read-uploads') return
        await new Promise<void>((resolve) => {
          release = resolve
        })
      },
    })
    const tile = videoTiles()[0] as Element
    expect(hosts()).toEqual([])

    pointTileAt(tile, theirId(0))
    release()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(pillHostsIn(tile)).toEqual([])
    expect(pilled()).toHaveLength(29)
  })

  test("a tile YouTube points at another of the creator's videos loses the old video's pill and shows the new one's", async () => {
    await showPage({
      answer: { engagedViews: (id) => (id === otherId(0) ? 12_000 : 334_212) },
    })
    const tile = videoTiles()[0] as Element

    pointTileAt(tile, otherId(0))
    await youtubeChanges()

    expect(pillHostsIn(tile)).toHaveLength(1)
    expect(pillBeside(tile)?.text).toBe('12K engaged views')
  })

  test("a move to another channel's tab takes the creator's pills off the tiles YouTube points at that channel's videos while the next read is out, and keeps the pill of a tile still linking the creator's video", async () => {
    let holding = false
    let out = 0
    await showPage({
      through: async (request) => {
        if (request.type !== 'read-uploads' || !holding) return
        out += 1
        await new Promise(() => {})
      },
    })
    const [kept, ...repointed] = videoTiles() as [Element, ...Element[]]
    expect(pilled()).toHaveLength(30)

    holding = true
    urlMovesTo('/@someone_else/videos')
    await vi.advanceTimersByTimeAsync(passEveryMs)
    for (const [index, tile] of repointed.entries()) pointTileAt(tile, theirId(index))
    await vi.advanceTimersByTimeAsync(passEveryMs * 4)

    expect(out).toBe(1)
    expect(
      videoTiles()
        .filter((tile) => pillHostsIn(tile).length > 0)
        .map(tileId),
    ).toEqual([tileId(kept)])
  })
})

describe('events', () => {
  const shown = shownOn('channel_page', { fromCache: false })
  const missing = { name: 'extension_surface_missing', surface: 'channel_page' }

  test.each([true, false])(
    'a pill the background answers 1,200 ms after the pass found the tab asks for extension_surface_shown with ms 1200 and fromCache %s, once, and no ID',
    async (fromCache) => {
      await showPage({ answer: { fromCache }, through: uploadsAnsweredAfter(1_200) })
      await youtubeChanges()

      expect(events()).toEqual([
        { name: 'extension_surface_shown', surface: 'channel_page', ms: 1_200, fromCache },
      ])
    },
  )

  test("a pill drawn after YouTube points every tile at another of the creator's videos during the 1,200 ms uploads read reports the time from the pass that found the tab", async () => {
    await showPage({
      through: async (request) => {
        if (request.type !== 'read-uploads') return
        await new Promise((resolve) => setTimeout(resolve, 1_200))
        for (const [index, tile] of videoTiles().entries()) pointTileAt(tile, otherId(index))
      },
    })

    expect(pilled()).toHaveLength(videoTiles().length)
    expect(events()).toEqual([
      shownOn('channel_page', { ms: 1_200 + passEveryMs, fromCache: false }),
    ])
  })

  test("a pill drawn after YouTube points one tile at the creator's video during the uploads read, beside tiles of another channel's videos, is timed from the pass that draws it", async () => {
    await showPage({
      uploads: { [channelId]: [otherId(0)] },
      through: async (request) => {
        if (request.type !== 'read-uploads') return
        await new Promise((resolve) => setTimeout(resolve, 1_200))
        pointTileAt(videoTiles()[0] as Element, otherId(0))
      },
    })

    expect(pilled()).toHaveLength(1)
    expect(events()).toEqual([shownOn('channel_page', { ms: 0, fromCache: false })])
  })

  test('one extension_surface_shown per navigation, however many passes and scrolls', async () => {
    await showPage()
    addTiles(3)
    await youtubeChanges()
    await youtubeChanges()

    expect(events()).toEqual([shown])

    await moveTo(`/channel/${channelId}`)

    expect(events()).toEqual([shown, shown])
  })

  test('a tab whose grid is not there sends one extension_surface_missing', async () => {
    for (const grid of document.querySelectorAll('ytd-rich-grid-renderer')) grid.remove()

    await showPage()
    await youtubeChanges()

    expect(events()).toEqual([missing])
  })

  test.each([
    ['a channel the creator does not hold', { channels: [someoneElse] }],
    ['an uploads read that holds no answer', { uploads: { [channelId]: { state: 'failed' } } }],
    ['uploads that hold none of the videos', { uploads: { [channelId]: [theirId(0)] } }],
  ] satisfies [string, Parameters<typeof showPage>[0]][])(
    '%s sends no event: the grid is there, so the surface is placed',
    async (_, options) => {
      await showPage(options)

      expect(events()).toEqual([])
    },
  )
})

test.each([`/channel/${channelId}/shorts`, '/watch?v=9SvyFna2XGM'])(
  "a move off the channel's Videos, Live and Home tabs, to %s, takes the pills down",
  async (path) => {
    await showPage()
    expect(hosts()).not.toEqual([])

    await moveTo(path)

    expect(hosts()).toEqual([])
  },
)

test("with a second held channel's read failing a failed read's keep after the first's, a redraw during the reads is not the figure's start", async () => {
  const { uploads, shownMs } = failingAcrossTheKeep(
    [channelId, someoneElse.youtubeChannelId],
    () => {
      for (const [index, tile] of videoTiles().entries()) pointTileAt(tile, otherId(index))
    },
    Array.from({ length: 50 }, (_, index) => otherId(index)),
  )
  await showPage({ channels: [nick, someoneElse], uploads })
  await vi.advanceTimersByTimeAsync(signedInReadKeptMs)

  expect(pilled()).toHaveLength(videoTiles().length)
  expect(events().filter(({ name }) => name === 'extension_surface_shown')).toEqual([
    shownOn('channel_page', { ms: shownMs, fromCache: false }),
  ])
})
