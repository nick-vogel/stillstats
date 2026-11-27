// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://www.youtube.com/"}
// Limits: jsdom lays nothing out and the fixtures carry none of YouTube's stylesheets, so these
// tests see which tiles get the engaged views pill, what it says and is named, and that it is the
// view count element's next sibling in YouTube's markup, or in the watch sidebar the next sibling
// of the view count's metadata row, that it opens with its own hidden "•" on a search result and
// its own hidden space on a home feed lockup, as YouTube's lockup delimiter does, and none in the
// sidebar, and that its shadow stylesheet declares no capsule (background, border or padding), and
// in the sidebar a block host and a pill that does not wrap. They do not see where it lands in the
// tile, how the dot or the space reads beside YouTube's, that the sidebar's row fits a narrow tile,
// that it takes YouTube's type and colour, or that it reads in YouTube's light and dark themes: creator-analytics#627's hand check, and creator-analytics#143's walk of the public page
// surfaces in Chrome and Firefox. The fixtures are one save of each page (2026-11-06), so a YouTube redesign after that day
// is not seen here. A feed YouTube grows as the creator scrolls is modelled by cloning its tiles with
// other ids, and a page YouTube keeps drawn beside another by importing it from that page's save.
// Which tiles are the creator's is modelled by the uploads the fake background answers: the home
// feed save holds none of Nick's videos, so a test answers some of its ids as the creator's. The
// tiles' ids are matched in the browser against those uploads and never sent: every test checks
// `videoIdsSentIn`, and test/page-boundary.test.ts holds the selectors and surfaces to reading hrefs
// and the URL only.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ListedChannel } from '@creator-analytics/api-types'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { signedInReadKeptMs } from '../kept.ts'
import type { AskBackground, BackgroundRequest } from '../messages.ts'
import type { UploadsRead } from '../product-api.ts'
import { feed } from './feed.ts'
import { lineClicks } from './line-clicks.ts'
import { giveUpAfterMs, passEveryMs, reportThrough, watchPage } from './page-watcher.ts'
import {
  capsuleOf,
  declaredFor,
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
  type YouTubePage,
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

/** Two of `@bashbunni`'s videos in the home feed save, answered as the creator's. */
const homeMine = ['j3QaHCS3KB0', 'XkAsmjwE8h4']
/** The live tile in the home feed save, "35 watching": no view count. */
const liveId = 'T5TOxGIDUos'
/** The search save's results from `/@nick_vogel`. */
const searchMine = [
  'NDha0z6zDA8',
  'Lr-jezF6_D8',
  'YZ8MdtxvqiM',
  '1UtweOH5cgY',
  '9jFRn7jp8E4',
  'Mzjtul0G5T4',
  'PgS5VschX3Y',
]
/** The creator's videos among the watch page save's sidebar, none of which carries a channel link. */
const sidebarMine = ['YZ8MdtxvqiM', 'Mzjtul0G5T4', 'HTLu3CX1Ysw']

const isPlaylist = (tile: Element) =>
  tile.querySelector('yt-collection-thumbnail-view-model, yt-collections-stack') !== null

const homeGrid = () =>
  document.querySelector('ytd-browse[page-subtype="home"]:not([hidden]) ytd-rich-grid-renderer')
const searchList = () =>
  document.querySelector('ytd-search:not([hidden]) ytd-section-list-renderer')
const sidebar = () => document.querySelector('ytd-watch-next-secondary-results-renderer')

const lockupsIn = (root: Element | null) => [
  ...(root?.querySelectorAll('yt-lockup-view-model') ?? []),
]
const homeTiles = () => lockupsIn(homeGrid()).filter((tile) => !isPlaylist(tile))
const homePlaylists = () => lockupsIn(homeGrid()).filter(isPlaylist)
const searchResults = () => [...(searchList()?.querySelectorAll('ytd-video-renderer') ?? [])]
const watchAgainTiles = () => [...(searchList()?.querySelectorAll('ytd-grid-video-renderer') ?? [])]
const searchLockups = () => lockupsIn(searchList())
const shortsTiles = () => [
  ...(searchList()?.querySelectorAll(
    'ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2',
  ) ?? []),
]
const sidebarTiles = () => lockupsIn(sidebar())

/** The video a tile links, as YouTube wrote it in the page. */
function tileId(tile: Element): string {
  const href = tile.querySelector('a[href^="/watch?v="]')?.getAttribute('href') ?? ''
  return new URL(href, location.href).searchParams.get('v') ?? ''
}

/** A Shorts tile's Short, as YouTube wrote it in the page. */
const shortId = (tile: Element) =>
  /^\/shorts\/([\w-]{11})/.exec(
    tile.querySelector('a[href^="/shorts/"]')?.getAttribute('href') ?? '',
  )?.[1]

/**
 * YouTube's view count in a tile: in a lockup, the metadata text after the row's play icon; in a
 * search result, the first item of its metadata line.
 */
const viewCountOf = (tile: Element) =>
  tile.localName === 'yt-lockup-view-model'
    ? tile.querySelector(
        '.ytContentMetadataViewModelLeadingIcon + .ytContentMetadataViewModelMetadataText',
      )
    : tile.querySelector('[id="metadata-line"] > span')

const hosts = () => [...document.querySelectorAll('[data-stillstats-surface]')]
const pillHostsIn = (tile: Element) => [
  ...tile.querySelectorAll('[data-stillstats-surface="feed"]'),
]

/** The metadata row of a lockup that holds YouTube's view count. */
const viewCountRowOf = (tile: Element) =>
  viewCountOf(tile)?.closest('.ytContentMetadataViewModelMetadataRow') ?? null

/**
 * What the tile's pill follows: in the watch page's sidebar, whose tiles are narrow, the view
 * count's metadata row, so the pill is a row of its own under it; everywhere else, the view count.
 */
const pillPlaceOf = (tile: Element) =>
  tile.closest('ytd-watch-next-secondary-results-renderer')
    ? viewCountRowOf(tile)
    : viewCountOf(tile)

/** The tile's pill, if it is the next sibling of what it follows (`pillPlaceOf`). */
function pillBeside(tile: Element) {
  const next = pillPlaceOf(tile)?.nextElementSibling
  if (!next?.matches('[data-stillstats-surface="feed"]')) return undefined
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

/** The tile's pill host, if it is the next sibling of what it follows (`pillPlaceOf`). */
const hostBeside = (tile: Element) => {
  const next = pillPlaceOf(tile)?.nextElementSibling
  return next?.matches('[data-stillstats-surface="feed"]') ? next : undefined
}

/** What the tile's pill host draws before the pill, as the creator sees and a screen reader hears it. */
function separatorOf(tile: Element) {
  const separator = separatorBefore(hostBeside(tile))
  return separator && { text: separator.textContent, hidden: separator.getAttribute('aria-hidden') }
}

const thePill = {
  text: '334K engaged views',
  title: 'Stillstats: 334,212 engaged views. Through Oct 7',
  name: 'Stillstats: 334,212 engaged views. Through Oct 7',
  role: 'img',
  opensWithIcon: true,
  links: 0,
}

/** Eleven characters, like a YouTube id, unlike any id in the fixtures: more of the creator's. */
const otherId = (index: number) => `other${String(index).padStart(6, '0')}`
/** Another channel's videos, none of them among the creator's uploads. */
const theirId = (index: number) => `their${String(index).padStart(6, '0')}`
const moreMine = Array.from({ length: 100 }, (_, index) => otherId(index))

/** YouTube points the tile at another video: its links' hrefs change. */
function pointTileAt(tile: Element, id: string): void {
  for (const link of tile.querySelectorAll('a[href^="/watch?v="]'))
    link.setAttribute('href', `/watch?v=${id}`)
}

/** YouTube draws `count` more tiles after `first`, copies of it linking `idOf` videos. */
function addTiles(first: Element, count: number, idOf = otherId): Element[] {
  return Array.from({ length: count }, (_, index) => {
    const copy = first.cloneNode(true) as Element
    for (const host of pillHostsIn(copy)) host.remove()
    pointTileAt(copy, idOf(index))
    first.parentElement?.append(copy)
    return copy
  })
}

let asked: BackgroundRequest[] | undefined
let navigated: (to: string) => void
let stop: () => void = () => {}

/**
 * Runs the content script's watch with the feed past the give-up time, the background holding
 * `channels` and answering each held channel's uploads read from `uploads`, each request passing
 * `through` on its way to it.
 */
async function showPage({
  channels = [nick],
  uploads,
  answer,
  through = (request) => Promise.resolve(request),
}: {
  channels?: Parameters<typeof fakeYouTubeBackground>[0]['channels']
  uploads: Record<string, UploadsOfChannel>
  answer?: UploadsAnswer
  through?: (request: BackgroundRequest) => Promise<unknown>
}): Promise<void> {
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
    surfaces: [feed({ ask, origin: '', locale: 'en-US', lineClicks: lineClicks(ask) })],
    report: reportThrough(ask),
  })
  stop = watcher.stop
  navigated = watcher.navigated
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)
}

/** The creator's uploads holding `ids`, for `showPage`. */
const mine = (ids: readonly string[]) => ({ [channelId]: ids })

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
const pilledIds = (tiles: Element[]) =>
  tiles.filter((tile) => pillBeside(tile) !== undefined).map(tileId)

/** Loads a saved page and puts the jsdom page on `url`, by default the URL it was saved from. */
function load(name: YouTubePage, url?: string): void {
  const savedAt = loadYouTubePage(name)
  history.replaceState(null, '', url ?? savedAt)
}

/** Draws the element `selector` finds in another page's save into this page, as YouTube keeps it. */
function drawFrom(name: YouTubePage, selector: string): void {
  const fixture = readFileSync(
    join(import.meta.dirname, `../../test/fixtures/youtube/${name}.html`),
    'utf8',
  )
  const element = new DOMParser().parseFromString(fixture, 'text/html').querySelector(selector)
  document.body.append(document.importNode(element as Element, true))
}

/** Holds every uploads read out until the test releases it. */
function holdUploads() {
  let releases: (() => void)[] = []
  let holding = false
  return {
    through: async (request: BackgroundRequest) => {
      if (request.type !== 'read-uploads' || !holding) return
      await new Promise<void>((resolve) => {
        releases.push(resolve)
      })
    },
    /** How many uploads reads are held out. */
    out: () => releases.length,
    hold() {
      holding = true
    },
    release() {
      holding = false
      for (const release of releases) release()
      releases = []
    },
  }
}

/**
 * Every feed pill the extension draws under `root` from now on, though a later pass takes it down:
 * a pill drawn for a moment is one the creator sees.
 */
function pillsDrawnIn(root: Element): () => Element[] {
  const drawn: Element[] = []
  const observer = new MutationObserver((records) => {
    for (const { addedNodes } of records)
      for (const node of addedNodes)
        if (node instanceof Element && node.matches('[data-stillstats-surface="feed"]'))
          drawn.push(node)
  })
  observer.observe(root, { childList: true, subtree: true })
  return () => {
    for (const record of observer.takeRecords())
      for (const node of record.addedNodes)
        if (node instanceof Element && node.matches('[data-stillstats-surface="feed"]'))
          drawn.push(node)
    return drawn
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  asked = undefined
  load('home-feed')
})

afterEach(() => {
  // Whatever a test did, the page sent no video id and asked for no read of videos (ADR 0016,
  // creator-analytics#520).
  expect(sent()).toEqual([])
  expect((asked ?? []).filter(({ type }) => type === 'read-videos')).toEqual([])
  stop()
  vi.useRealTimers()
})

describe('the home feed', () => {
  test("each of the creator's tiles shows the pill next to YouTube's view count, with the compact figure, and the full figure and its day in its hover and accessible name; no other tile shows one", async () => {
    await showPage({ uploads: mine([...homeMine, liveId]) })

    expect(homeTiles()).toHaveLength(20)
    for (const tile of homeTiles()) {
      if (homeMine.includes(tileId(tile))) {
        expect(pillHostsIn(tile)).toHaveLength(1)
        expect(pillBeside(tile)).toEqual(thePill)
      } else expect(pillHostsIn(tile)).toEqual([])
    }
    expect(homePlaylists()).toHaveLength(1)
    expect(pillHostsIn(homePlaylists()[0] as Element)).toEqual([])
    expect(hosts()).toHaveLength(2)
  })

  test("a lockup's pill follows YouTube's lockup spacing, the one space its delimiter puts between the count and the date, with no dot, and stays the view count's next sibling", async () => {
    await showPage({ uploads: mine(homeMine) })

    const pilled = homeTiles().filter((tile) => homeMine.includes(tileId(tile)))
    expect(pilled).toHaveLength(2)
    for (const tile of pilled) {
      expect(pillBeside(tile)).toEqual(thePill)
      expect(separatorOf(tile)).toEqual({ text: '\u00a0', hidden: 'true' })
    }
  })

  test("a lockup's pill stays inline in the view count's row, directly after the view count, with the one space and no row of its own", async () => {
    await showPage({ uploads: mine(homeMine) })

    const pilled = homeTiles().filter((tile) => homeMine.includes(tileId(tile)))
    expect(pilled).toHaveLength(2)
    for (const tile of pilled) {
      const host = viewCountOf(tile)?.nextElementSibling
      expect(host?.matches('[data-stillstats-surface="feed"]')).toBe(true)
      expect(host?.parentElement).toBe(viewCountRowOf(tile))
      expect(declaredFor(host, ':host')?.getPropertyValue('display')).toBe('inline-block')
      expect(declaredFor(host, '.pill')?.getPropertyValue('white-space')).toBe('')
      expect(separatorOf(tile)).toEqual({ text: '\u00a0', hidden: 'true' })
    }
  })

  test("the pill reads as one of the line's metadata items: no capsule around it", async () => {
    await showPage({ uploads: mine(homeMine) })

    const pilled = homeTiles().filter((tile) => homeMine.includes(tileId(tile)))
    expect(pilled).toHaveLength(2)
    for (const tile of pilled) expect(capsuleOf(hostBeside(tile))).toEqual([])
  })

  test('a live tile, which shows no view count, shows no pill though it is among the uploads', async () => {
    await showPage({ uploads: mine([liveId]) })

    const live = homeTiles().find((tile) => tileId(tile) === liveId) as Element
    expect(viewCountOf(live)).toBeNull()
    expect(hosts()).toEqual([])
  })
})

describe('search results', () => {
  beforeEach(() => load('search'))

  test("each of the creator's results shows the pill beside the first item of its metadata line, and no other result, playlist or Short does", async () => {
    const shorts = savedVideoIds('channel-shorts')

    await showPage({ uploads: mine([...searchMine, ...shorts]) })

    expect(searchResults()).toHaveLength(12)
    for (const tile of searchResults()) {
      if (searchMine.includes(tileId(tile))) expect(pillBeside(tile)).toEqual(thePill)
      else expect(pillHostsIn(tile)).toEqual([])
    }
    expect(searchLockups()).toHaveLength(1)
    expect(pillHostsIn(searchLockups()[0] as Element)).toEqual([])
    // The creator's own Shorts are among the uploads, and still the feed leaves Shorts tiles alone.
    expect(shortsTiles().filter((tile) => shorts.includes(shortId(tile) ?? ''))).not.toEqual([])
    for (const tile of shortsTiles()) expect(pillHostsIn(tile)).toEqual([])
    expect(hosts()).toHaveLength(7)
  })

  test("a result's pill follows YouTube's dot, as the date after it does, and stays the view count's next sibling", async () => {
    await showPage({ uploads: mine(searchMine) })

    const pilled = searchResults().filter((tile) => searchMine.includes(tileId(tile)))
    expect(pilled).toHaveLength(7)
    for (const tile of pilled) {
      expect(pillBeside(tile)).toEqual(thePill)
      expect(separatorOf(tile)).toEqual({ text: '•', hidden: 'true' })
    }
  })

  test("a result's pill reads as one of the line's metadata items: no capsule around it", async () => {
    await showPage({ uploads: mine(searchMine) })

    const pilled = searchResults().filter((tile) => searchMine.includes(tileId(tile)))
    expect(pilled).toHaveLength(7)
    for (const tile of pilled) expect(capsuleOf(hostBeside(tile))).toEqual([])
  })

  test('a "Watch again" tile whose video is among the uploads shows the pill beside its view count', async () => {
    const [first, ...others] = watchAgainTiles()
    const id = tileId(first as Element)

    await showPage({ uploads: mine([id]) })

    expect(pillBeside(first as Element)).toEqual(thePill)
    for (const tile of others) expect(pillHostsIn(tile)).toEqual([])
  })

  test("a result whose channel link is the creator's but whose video is not among the uploads shows no pill, and one whose link names another channel but whose video is among them shows it", async () => {
    const [left, ...rest] = searchMine
    const theirs = 'lyAOXO5TcZw'

    await showPage({ uploads: mine([...rest, theirs]) })

    expect(pilledIds(searchResults()).sort()).toEqual([...rest, theirs].sort())
    const leftTile = searchResults().find((tile) => tileId(tile) === left) as Element
    expect(leftTile.querySelector('a[href="/@nick_vogel"]')).not.toBeNull()
    expect(pillHostsIn(leftTile)).toEqual([])
  })
})

describe("the watch page's sidebar", () => {
  beforeEach(() => load('watch'))

  test("each of the creator's tiles shows the pill though no tile carries a channel link, and no other tile shows one", async () => {
    await showPage({ uploads: mine(sidebarMine) })

    expect(sidebarTiles()).toHaveLength(20)
    for (const tile of sidebarTiles())
      expect(tile.querySelector('a[href^="/@"], a[href^="/channel/"]')).toBeNull()
    expect(pilledIds(sidebarTiles()).sort()).toEqual([...sidebarMine].sort())
    for (const tile of sidebarTiles())
      if (sidebarMine.includes(tileId(tile))) expect(pillBeside(tile)).toEqual(thePill)
    expect(hosts()).toHaveLength(3)
  })

  test("a sidebar tile's pill is a row of its own directly under the view count's metadata row, not inside it and not the view count's sibling, as one more of YouTube's rows, so a narrow tile does not break it", async () => {
    await showPage({ uploads: mine(sidebarMine) })

    const pilled = sidebarTiles().filter((tile) => sidebarMine.includes(tileId(tile)))
    expect(pilled).toHaveLength(3)
    for (const tile of pilled) {
      const row = viewCountRowOf(tile) as Element
      expect(row).not.toBeNull()
      const host = row.nextElementSibling
      expect(host?.matches('[data-stillstats-surface="feed"]')).toBe(true)
      expect(pillHostsIn(tile)).toEqual([host])
      expect(row.querySelector('[data-stillstats-surface]')).toBeNull()
      expect(viewCountOf(tile)?.nextElementSibling).not.toBe(host)
      expect(pillBeside(tile)).toEqual(thePill)
    }
  })

  test("a sidebar tile's pill row is a block, has no separator before it, and its pill does not wrap", async () => {
    await showPage({ uploads: mine(sidebarMine) })

    const pilled = sidebarTiles().filter((tile) => sidebarMine.includes(tileId(tile)))
    expect(pilled).toHaveLength(3)
    for (const tile of pilled) {
      const host = hostBeside(tile)
      expect(host).toBeDefined()
      expect(declaredFor(host, ':host')?.getPropertyValue('display')).toBe('block')
      expect(separatorOf(tile)).toBeUndefined()
      expect(host?.shadowRoot?.querySelector('.separator')).toBeNull()
      expect(declaredFor(host, '.pill')?.getPropertyValue('white-space')).toBe('nowrap')
    }
  })

  test("a sidebar tile's pill reads as one of the line's metadata items: no capsule around it", async () => {
    await showPage({ uploads: mine(sidebarMine) })

    const pilled = sidebarTiles().filter((tile) => sidebarMine.includes(tileId(tile)))
    expect(pilled).toHaveLength(3)
    for (const tile of pilled) expect(capsuleOf(hostBeside(tile))).toEqual([])
  })
})

describe('what the feed asks', () => {
  test("each held channel's uploads are read once under its own channel id, and each tile shows its own channel's figure", async () => {
    const [mineId, theirsId] = homeMine as [string, string]

    await showPage({
      channels: [nick, someoneElse],
      uploads: {
        [channelId]: uploadsOf([mineId], { engagedViews: () => 334_212 }),
        [someoneElse.youtubeChannelId]: uploadsOf([theirsId], { engagedViews: () => 12_000 }),
      },
    })

    const tileOf = (id: string) => homeTiles().find((tile) => tileId(tile) === id) as Element
    expect(pillBeside(tileOf(mineId))?.text).toBe('334K engaged views')
    expect(pillBeside(tileOf(theirsId))?.text).toBe('12K engaged views')
    expect(uploadsReads()).toEqual([channelId, someoneElse.youtubeChannelId])
  })

  test("a feed of more than 50 of the creator's tiles shows every pill on the one read", async () => {
    addTiles(homeTiles()[0] as Element, 60)

    await showPage({ uploads: mine([...homeMine, ...moreMine]) })

    expect(pilledIds(homeTiles())).toHaveLength(62)
    expect(uploadsReads()).toEqual([channelId])
  })

  test('a feed with no tile to match reads nothing', async () => {
    for (const tile of homeTiles()) tile.remove()

    await showPage({ uploads: mine(homeMine) })

    expect(asked?.filter(({ type }) => type !== 'usage-event')).toEqual([])
  })
})

describe('the feed as the creator scrolls', () => {
  test('tiles YouTube appends get their pill with no new request, and one not among the uploads none', async () => {
    await showPage({ uploads: mine([...homeMine, ...moreMine]) })
    const before = asked?.length

    const added = addTiles(homeTiles()[0] as Element, 4)
    const [notMine] = addTiles(homeTiles()[0] as Element, 1, theirId)
    await youtubeChanges()
    await youtubeChanges()

    for (const tile of added) expect(pillBeside(tile)).toEqual(thePill)
    expect(pillHostsIn(notMine as Element)).toEqual([])
    expect(asked?.length).toBe(before)
    expect(uploadsReads()).toEqual([channelId])
  })

  test('a tile whose view count YouTube takes away, as it does for a video gone live, loses its pill', async () => {
    await showPage({ uploads: mine(homeMine) })
    const [first, second] = homeTiles().filter((tile) => homeMine.includes(tileId(tile)))

    viewCountOf(first as Element)?.remove()
    expect(pillHostsIn(first as Element)).toHaveLength(1)
    await youtubeChanges()

    expect(pillHostsIn(first as Element)).toEqual([])
    expect(pillBeside(second as Element)).toEqual(thePill)
  })

  test("a tile YouTube points at another video loses its pill, and shows the new one's when that is the creator's", async () => {
    await showPage({
      uploads: mine([...homeMine, otherId(0)]),
      answer: { engagedViews: (id) => (id === otherId(0) ? 12_000 : 334_212) },
    })
    const [first, second] = homeTiles().filter((tile) => homeMine.includes(tileId(tile)))

    pointTileAt(first as Element, otherId(0))
    pointTileAt(second as Element, theirId(0))
    await youtubeChanges()

    expect(pillHostsIn(first as Element)).toHaveLength(1)
    expect(pillBeside(first as Element)?.text).toBe('12K engaged views')
    expect(pillHostsIn(second as Element)).toEqual([])
  })

  test("a tile YouTube points at another channel's video while the uploads read is out shows no pill", async () => {
    const held = holdUploads()
    held.hold()
    await showPage({ uploads: mine(homeMine), through: held.through })
    const [first, second] = homeTiles().filter((tile) => homeMine.includes(tileId(tile)))
    expect(hosts()).toEqual([])

    pointTileAt(first as Element, theirId(0))
    const drawn = pillsDrawnIn(first as Element)
    held.release()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(drawn()).toEqual([])
    expect(pillBeside(second as Element)).toEqual(thePill)
  })

  test('a read that lands after the creator left the feed draws no pill, even for a moment', async () => {
    const held = holdUploads()
    held.hold()
    await showPage({ uploads: mine(homeMine), through: held.through })
    const drawn = pillsDrawnIn(homeGrid() as Element)

    urlMovesTo(`/channel/${channelId}/videos`)
    held.release()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(drawn()).toEqual([])
    expect(hosts()).toEqual([])
  })

  test('a new search is a new navigation, which reads the uploads again', async () => {
    load('search')
    await showPage({ uploads: mine(searchMine) })

    await moveTo('/results?search_query=payload+cms')

    expect(uploadsReads()).toEqual([channelId, channelId])
    expect(pilledIds(searchResults())).toHaveLength(7)
  })

  test("a move from the home feed to search reads the uploads again and shows search's pills, taking the home feed's down", async () => {
    drawFrom('search', 'ytd-search')
    await showPage({ uploads: mine([...homeMine, ...searchMine]) })
    expect(pilledIds(homeTiles())).toHaveLength(2)

    await moveTo('/results?search_query=payload')

    expect(uploadsReads()).toEqual([channelId, channelId])
    expect(pilledIds(searchResults())).toHaveLength(7)
    expect(pilledIds(homeTiles())).toEqual([])
    expect(homeTiles()).toHaveLength(20)
  })
})

describe('events', () => {
  const shown = shownOn('feed', { fromCache: false })
  const missing = { name: 'extension_surface_missing', surface: 'feed' }

  test.each([true, false])(
    'a pill the background answers 1,200 ms after the pass found the results asks for extension_surface_shown with ms 1200 and fromCache %s, once, and no ID',
    async (fromCache) => {
      load('search')
      await showPage({
        uploads: mine(searchMine),
        answer: { fromCache },
        through: uploadsAnsweredAfter(1_200),
      })
      await youtubeChanges()

      expect(events()).toEqual([
        { name: 'extension_surface_shown', surface: 'feed', ms: 1_200, fromCache },
      ])
    },
  )

  test('one extension_surface_shown per navigation, however many passes and scrolls, and one again after a move', async () => {
    load('search')
    await showPage({ uploads: mine([...searchMine, ...moreMine]) })
    addTiles(searchResults()[0] as Element, 3)
    await youtubeChanges()
    await youtubeChanges()

    expect(events()).toEqual([shown])

    await moveTo('/results?search_query=payload+cms')

    expect(events()).toEqual([shown, shown])
  })

  test("the home feed as saved, which holds none of the creator's videos, sends no event and shows no pill", async () => {
    await showPage({ uploads: mine(savedVideoIds('channel-videos')) })

    expect(uploadsReads()).toEqual([channelId])
    expect(hosts()).toEqual([])
    expect(events()).toEqual([])
  })

  test.each([
    ['a channels read that finds the creator signed out', { channels: { state: 'signed-out' } }],
    ['a failed uploads read', { uploads: { [channelId]: { state: 'failed' } } }],
    [
      'a refused uploads read',
      { uploads: { [channelId]: { state: 'refused', refusal: 'quota_reserved' } } },
    ],
    [
      'an answer whose matches all await processing',
      { uploads: mine(homeMine), answer: { awaiting: homeMine } },
    ],
  ] satisfies [string, Partial<Parameters<typeof showPage>[0]>][])(
    '%s shows no pill and sends no event: the feed is there, so it is placed',
    async (_, options) => {
      await showPage({ uploads: mine(homeMine), ...options })

      expect(hosts()).toEqual([])
      expect(events()).toEqual([])
    },
  )

  test.each([
    ['the home feed', 'home-feed', 'ytd-rich-grid-renderer'],
    ['search results', 'search', 'ytd-section-list-renderer'],
    ['the watch page', 'watch', 'ytd-watch-next-secondary-results-renderer'],
  ] as const)(
    '%s whose tile container is not there sends one extension_surface_missing',
    async (_, name, container) => {
      load(name)
      for (const element of document.querySelectorAll(container)) element.remove()

      await showPage({ uploads: mine([...homeMine, ...searchMine, ...sidebarMine]) })
      await youtubeChanges()

      expect(events()).toEqual([missing])
      expect(uploadsReads()).toEqual([])
    },
  )
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

describe('no pill', () => {
  test('a video the answer leaves out and one awaiting processing show no pill while the others do, and no line shows', async () => {
    load('search')
    const [left, awaiting, ...rest] = searchMine as [string, string, ...string[]]

    await showPage({
      uploads: mine([awaiting, ...rest]),
      answer: { awaiting: [awaiting] },
    })

    expect(pilledIds(searchResults()).sort()).toEqual([...rest].sort())
    for (const id of [left, awaiting]) {
      const tile = searchResults().find((result) => tileId(result) === id) as Element
      expect(pillHostsIn(tile)).toEqual([])
    }
    const text = hosts()
      .map((host) => host.shadowRoot?.textContent ?? '')
      .join(' ')
    for (const line of lineTexts) expect(text).not.toContain(line)
  })

  test.each([
    ['signed out', { state: 'signed-out' }],
    ['failed', { state: 'failed' }],
    ['refused', { state: 'refused', refusal: 'connection_revoked' }],
  ] satisfies [string, UploadsRead][])(
    'an uploads read %s shows no pill and no line anywhere on the page',
    async (_, read) => {
      await showPage({ uploads: { [channelId]: read } })

      expect(hosts()).toEqual([])
      for (const line of lineTexts) expect(document.body.textContent).not.toContain(line)
    },
  )
})

describe('leaving and moving', () => {
  test.each([`/channel/${channelId}/videos`, '/shorts/h1jr1K82xuQ', '/feed/subscriptions'])(
    'a move from the home feed to %s takes the pills down, the feed being off there',
    async (path) => {
      await showPage({ uploads: mine(homeMine) })
      expect(hosts()).toHaveLength(2)

      await moveTo(path)

      expect(hosts()).toEqual([])
      expect(events()).toEqual([shownOn('feed', { fromCache: false })])
    },
  )

  test("a move from the watch page to the home feed takes the sidebar's pills down at once, while the next read is out, though YouTube keeps the sidebar in the document", async () => {
    load('watch')
    drawFrom('home-feed', 'ytd-browse[page-subtype="home"]:not([hidden])')
    const held = holdUploads()
    await showPage({ uploads: mine([...sidebarMine, ...homeMine]), through: held.through })
    expect(pilledIds(sidebarTiles())).toHaveLength(3)

    held.hold()
    urlMovesTo('/')
    await vi.advanceTimersByTimeAsync(passEveryMs)

    expect(held.out()).toBe(1)
    expect(hosts()).toEqual([])
    expect(sidebarTiles()).toHaveLength(20)

    held.release()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(uploadsReads()).toEqual([channelId, channelId])
    expect(pilledIds(homeTiles())).toHaveLength(2)
    expect(pilledIds(sidebarTiles())).toEqual([])
  })

  test.each([
    [
      'watch page to the next, in the sidebar',
      'watch',
      '/watch?v=abcdefghijk',
      sidebarMine,
      sidebarTiles,
    ],
    [
      'search to the next, in the results',
      'search',
      '/results?search_query=payload+cms',
      searchMine,
      searchResults,
    ],
  ] as const)(
    "a move from one %s, takes the creator's pills off the tiles YouTube points at other channels' videos while the next read is out, and keeps the pill of a tile still linking the creator's video",
    async (_, name, to, ids, tilesOn) => {
      load(name)
      const held = holdUploads()
      await showPage({ uploads: mine(ids), through: held.through })
      const [kept, ...repointed] = tilesOn().filter((tile) => ids.includes(tileId(tile)))
      expect(pilledIds(tilesOn())).toHaveLength(ids.length)

      held.hold()
      urlMovesTo(to)
      await vi.advanceTimersByTimeAsync(passEveryMs)
      for (const [index, tile] of repointed.entries()) pointTileAt(tile, theirId(index))
      await vi.advanceTimersByTimeAsync(passEveryMs * 4)

      expect(held.out()).toBe(1)
      expect(
        tilesOn()
          .filter((tile) => pillHostsIn(tile).length > 0)
          .map(tileId),
      ).toEqual([tileId(kept as Element)])
    },
  )
})
describe('a pill drawn after YouTube redraws the results during the uploads read', () => {
  const others = Array.from({ length: 50 }, (_, index) => otherId(index))
  /** Holds the first uploads read 1,200 ms, making `change` halfway; lets every later one through. */
  const changedDuringFirstRead = (change: () => void) => {
    let reads = 0
    return async (request: BackgroundRequest) => {
      if (request.type !== 'read-uploads') return
      reads += 1
      if (reads > 1) return
      await new Promise((resolve) => setTimeout(resolve, 600))
      change()
      await new Promise((resolve) => setTimeout(resolve, 600))
    }
  }
  const pointEveryResultElsewhere = () => {
    for (const [index, tile] of [
      ...searchResults(),
      ...watchAgainTiles(),
      ...searchLockups(),
    ].entries())
      pointTileAt(tile, otherId(index))
  }

  test("YouTube pointing every result at another of the creator's videos reports the time from the pass that found the results", async () => {
    load('search')
    await showPage({
      uploads: mine([...searchMine, ...others]),
      through: changedDuringFirstRead(pointEveryResultElsewhere),
    })

    expect(pilledIds(searchResults()).length).toBeGreaterThan(0)
    expect(events()).toEqual([
      shownOn('feed', { ms: expect.toSatisfy((ms: number) => ms >= 1_200), fromCache: false }),
    ])
  })

  test("YouTube pointing one result at the creator's video, beside results of another channel's videos, is timed from the pass that draws it", async () => {
    load('search')
    await showPage({
      uploads: mine([otherId(0)]),
      through: changedDuringFirstRead(() => pointTileAt(searchResults()[0] as Element, otherId(0))),
    })

    expect(pilledIds(searchResults())).toEqual([otherId(0)])
    expect(events()).toEqual([
      shownOn('feed', { ms: expect.toSatisfy((ms: number) => ms < 1_200), fromCache: false }),
    ])
  })

  test("with a second held channel's read failing a failed read's keep after the first's, a redraw during the reads is not the figure's start", async () => {
    load('search')
    const { uploads, shownMs } = failingAcrossTheKeep(
      [channelId, someoneElse.youtubeChannelId],
      pointEveryResultElsewhere,
      [...searchMine, ...others],
    )
    await showPage({ channels: [nick, someoneElse], uploads })
    await vi.advanceTimersByTimeAsync(signedInReadKeptMs)

    expect(pilledIds(searchResults()).length).toBeGreaterThan(0)
    expect(events().filter(({ name }) => name === 'extension_surface_shown')).toEqual([
      shownOn('feed', { ms: shownMs, fromCache: false }),
    ])
  })
})
