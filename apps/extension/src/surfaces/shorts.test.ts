// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://www.youtube.com/channel/UC8mOjhMBTyPPScCF9vYtwFg/shorts"}
// Limits: jsdom lays nothing out and the fixtures carry none of YouTube's stylesheets, so these
// tests see which Shorts get the engaged views pill, what it says and is named, and that it is the
// next sibling of a tile's view count or of the player's channel bar in YouTube's markup, that it
// opens with no separator, that its shadow stylesheet declares no capsule (background, border or
// padding), and that only the player's declares a top margin, on the pill and not the host. They do
// not see where it lands in the tile or over the player, how far the margin sets it from the channel
// row, that YouTube's rules leave it in place, that it takes
// YouTube's type and colour, or that it reads in YouTube's light and dark themes:
// creator-analytics#627's hand check, and creator-analytics#143's walk of the public page surfaces
// in Chrome and Firefox. The fixtures are one save of the Shorts tab and one of the player
// (2026-11-06), the player holding one reel, so a YouTube redesign after that day, and the reels
// YouTube may draw ahead, are not seen here. A tab YouTube grows as the creator scrolls is modelled
// by cloning its tiles with other ids. The player's in-page move to another Short is modelled by
// moving the URL with `history.pushState` and, for another channel's Short, pointing the shared
// overlay's channel link at that channel; a move between the tab and the player puts the saved
// player beside the saved tab. Another channel's grid is modelled by pointing the saved tiles at
// Shorts that are not the creator's. The ids are matched in the browser against the creator's
// uploads, which the fake background answers, and never sent: every test checks `videoIdsSentIn`,
// and test/page-boundary.test.ts holds the selectors and surfaces to reading hrefs and the URL only.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ListedChannel } from '@creator-analytics/api-types'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { signedInReadKeptMs } from '../kept.ts'
import type { AskBackground, BackgroundRequest } from '../messages.ts'
import type { UploadsRead } from '../product-api.ts'
import { lineClicks } from './line-clicks.ts'
import { giveUpAfterMs, passEveryMs, reportThrough, watchPage } from './page-watcher.ts'
import { shorts } from './shorts.ts'
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
  videoIdsSentIn,
} from './testing.ts'
import { surfaceText } from './text.ts'

const channelId = 'UC8mOjhMBTyPPScCF9vYtwFg'
const tabUrl = `/channel/${channelId}/shorts`
/** The Short the player fixture was saved playing, one of the creator's. */
const savedShort = 'h1jr1K82xuQ'
/** Eleven characters, like a YouTube id, unlike any id in the fixtures: another of the creator's. */
const nextShort = 'nextShort01'
/** Another channel's Short, not among the creator's uploads. */
const elsewhereShort = 'elsewhere01'

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

const shorthost = '[data-stillstats-surface="shorts"]'
const hosts = () => [...document.querySelectorAll('[data-stillstats-surface]')]

/** The pill `host` holds, as the creator sees and hears it. */
function pillOf(host: Element | null | undefined) {
  if (!host?.matches(shorthost)) return undefined
  const pill = host.shadowRoot?.querySelector('.pill')
  return {
    text: pill?.textContent?.replace(/\s+/g, ' ').trim(),
    title: pill?.getAttribute('title'),
    name: pill?.getAttribute('aria-label'),
    role: pill?.getAttribute('role'),
    opensWithIcon: pill?.firstElementChild?.localName === 'svg',
    links: host.shadowRoot?.querySelectorAll('a').length,
  }
}

/** What `host` draws before the pill, as the creator sees and a screen reader hears it. */
function separatorOf(host: Element | null | undefined) {
  const separator = separatorBefore(host)
  return separator && { text: separator.textContent, hidden: separator.getAttribute('aria-hidden') }
}

/** Every `margin*` declaration of one shadow rule, as `property: value`; undefined with no rule. */
function marginsOf(style: CSSStyleDeclaration | undefined) {
  return (
    style &&
    [...style]
      .filter((property) => property.startsWith('margin'))
      .map((property) => `${property}: ${style.getPropertyValue(property)}`)
  )
}

// The Shorts tab.

const channelPage = () =>
  document.querySelector('ytd-browse[page-subtype="channels"]:not([hidden])') as Element
const tiles = () => [...channelPage().querySelectorAll('ytm-shorts-lockup-view-model')]
/** The Short a tile links, as YouTube wrote it in the page. */
const tileId = (tile: Element) =>
  /^\/shorts\/([\w-]+)/.exec(
    tile.querySelector('a[href^="/shorts/"]')?.getAttribute('href') ?? '',
  )?.[1] ?? ''
/** YouTube's view count in a tile, "1.7K views". */
const viewCountOf = (tile: Element) =>
  tile.querySelector('.shortsLockupViewModelHostOutsideMetadataSubhead')
const pillHostsIn = (root: Element) => [...root.querySelectorAll(shorthost)]
/** The tile's pill, if it is the view count's next sibling. */
const pillBesideTile = (tile: Element) => pillOf(viewCountOf(tile)?.nextElementSibling)

/** YouTube points the tile at another Short: its links' hrefs change. */
function pointTileAt(tile: Element, id: string): void {
  for (const link of tile.querySelectorAll('a[href^="/shorts/"]'))
    link.setAttribute('href', `/shorts/${id}`)
}

/** More of the creator's Shorts, unlike any id in the fixtures. */
const otherId = (index: number) => `other${String(index).padStart(6, '0')}`
/** Another channel's Shorts, none of them among the creator's uploads. */
const theirId = (index: number) => `their${String(index).padStart(6, '0')}`

/** The creator's uploads: every Short of the saved tab, the saved Short, and more. */
const myUploads = [
  ...savedVideoIds('channel-shorts'),
  savedShort,
  nextShort,
  ...Array.from({ length: 100 }, (_, index) => otherId(index)),
]

/** YouTube draws `count` more tiles on the tab, copies of its first tile linking `idOf` Shorts. */
function addTiles(count: number, idOf = otherId): void {
  const first = tiles()[0] as Element
  for (let index = 0; index < count; index += 1) {
    const copy = first.cloneNode(true) as Element
    for (const host of pillHostsIn(copy)) host.remove()
    pointTileAt(copy, idOf(index))
    first.parentElement?.append(copy)
  }
}

/** YouTube redraws the grid with another channel's Shorts. */
function youtubeDrawsTheirGrid(): void {
  for (const [index, tile] of tiles().entries()) pointTileAt(tile, theirId(index))
}

// The Shorts player.

const player = () => document.querySelector('ytd-shorts:not([hidden])') as Element
const channelBar = () => player().querySelector('yt-reel-channel-bar-view-model')
const channelNameLinks = () => [
  ...player().querySelectorAll('.ytReelChannelBarViewModelChannelName a'),
]
/** The player's pill, if it is the channel bar's next sibling. */
const pillUnderChannelName = () => pillOf(channelBar()?.nextElementSibling)

/** YouTube points the shared overlay's channel name at `channel`. */
function overlayNames(channel: string): void {
  for (const link of channelNameLinks()) link.setAttribute('href', `${channel}/shorts`)
}

/** Puts the saved Shorts player beside the saved Shorts tab, hidden, as YouTube keeps it. */
function addHiddenPlayer(): void {
  const fixture = readFileSync(
    join(import.meta.dirname, '../../test/fixtures/youtube/shorts-player.html'),
    'utf8',
  )
  const saved = new DOMParser().parseFromString(fixture, 'text/html').querySelector('ytd-shorts')
  const copy = document.importNode(saved as Element, true)
  copy.setAttribute('hidden', '')
  channelPage().after(copy)
}

let asked: BackgroundRequest[] | undefined
let navigated: (to: string) => void
let stop: () => void = () => {}
/** The text of every pill the surface drew, in the order it drew them. */
let drawn: string[]
let recorder: MutationObserver | undefined

/**
 * Runs the content script's watch on the page past the give-up time, the background holding
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
  drawn = []
  recorder = new MutationObserver((records) => {
    for (const { addedNodes } of records)
      for (const node of addedNodes)
        if (node instanceof Element && node.matches(shorthost)) drawn.push(pillOf(node)?.text ?? '')
  })
  recorder.observe(document, { childList: true, subtree: true })
  const watcher = watchPage({
    document,
    url: () => location.href,
    // en-US, whose compact form is the approved copy's example, "334K"; en-GB's is "334k".
    surfaces: [shorts({ ask, origin: '', locale: 'en-US', lineClicks: lineClicks(ask) })],
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
const pilled = () => tiles().filter((tile) => pillBesideTile(tile) !== undefined)

/** The saved Short has 334,212 engaged views, every other 12,000. */
const byId: UploadsAnswer = { engagedViews: (id) => (id === savedShort ? 334_212 : 12_000) }

/** A promise and the function that settles it. */
function deferred(): { promise: Promise<void>; release: () => void } {
  let release = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

/** Loads a saved page and puts the jsdom page on `url`, by default the URL it was saved from. */
function load(name: 'channel-shorts' | 'shorts-player', url?: string): void {
  const savedAt = loadYouTubePage(name)
  history.replaceState(null, '', url ?? savedAt)
}

beforeEach(() => {
  vi.useFakeTimers()
  asked = undefined
  load('channel-shorts')
})

afterEach(() => {
  // Whatever a test did, the page sent no video id (ADR 0016, creator-analytics#520).
  expect(sent()).toEqual([])
  stop()
  recorder?.disconnect()
  vi.useRealTimers()
})

describe("the creator's Shorts tab", () => {
  test("each of the creator's Shorts shows the pill next to YouTube's view count, with the compact figure and the icon", async () => {
    await showPage()

    expect(tiles()).toHaveLength(45)
    for (const tile of tiles()) {
      expect(pillHostsIn(tile)).toHaveLength(1)
      expect(pillBesideTile(tile)).toMatchObject({
        text: '334K engaged views',
        role: 'img',
        opensWithIcon: true,
        links: 0,
      })
    }
  })

  test("a tile's pill, on its own line under YouTube's view count, has no separator before it", async () => {
    await showPage()

    expect(tiles()).toHaveLength(45)
    for (const tile of tiles()) {
      expect(pillBesideTile(tile)?.text).toBe('334K engaged views')
      expect(separatorOf(viewCountOf(tile)?.nextElementSibling)).toBeUndefined()
    }
  })

  test("each pill reads as one of the tile's metadata items: no capsule around it", async () => {
    await showPage()

    expect(tiles()).toHaveLength(45)
    for (const tile of tiles()) expect(capsuleOf(viewCountOf(tile)?.nextElementSibling)).toEqual([])
  })

  test("a tile's pill keeps no space above it: the player's top margin is the player's alone", async () => {
    await showPage()

    expect(tiles()).toHaveLength(45)
    for (const tile of tiles()) {
      const host = viewCountOf(tile)?.nextElementSibling
      expect(pillBesideTile(tile)?.text).toBe('334K engaged views')
      expect(marginsOf(declaredFor(host, ':host'))).toEqual([])
      expect(marginsOf(declaredFor(host, '.pill'))).toEqual([])
    }
  })

  test('the full figure and its day are in the hover and the accessible name', async () => {
    await showPage()

    const pill = pillBesideTile(tiles()[0] as Element)
    for (const said of [pill?.title, pill?.name]) {
      expect(said).toContain('334,212')
      expect(said).toContain('Oct 7')
    }
  })

  test("reads the held channel's uploads once and sends no tile's id", async () => {
    addTiles(15)

    await showPage()

    expect(uploadsReads()).toEqual([channelId])
    expect(sent()).toEqual([])
    expect(pilled()).toHaveLength(60)
  })

  test('the tab reached at its handle URL shows the pills', async () => {
    load('channel-shorts', '/@nick_vogel/shorts')

    await showPage()

    expect(pilled()).toHaveLength(45)
  })

  test("a Shorts tab of a channel the creator does not hold shows no pill on that channel's Shorts", async () => {
    load('channel-shorts', '/@someone_else/shorts')
    youtubeDrawsTheirGrid()

    await showPage({ channels: [nick, someoneElse] })

    expect(hosts()).toEqual([])
  })

  test("a move to another channel's Shorts tab takes the creator's pills off the tiles YouTube redraws", async () => {
    await showPage()
    expect(pillHostsIn(channelPage())).toHaveLength(45)

    urlMovesTo('/@someone_else/shorts')
    youtubeDrawsTheirGrid()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(hosts()).toEqual([])
  })

  test("a move to another channel's Shorts tab takes the creator's pills off the tiles YouTube points at that channel's Shorts while the next read is out, and keeps the pill of a tile still linking the creator's Short", async () => {
    let holding = false
    let out = 0
    await showPage({
      through: async (request) => {
        if (request.type !== 'read-uploads' || !holding) return
        out += 1
        await new Promise(() => {})
      },
    })
    const [kept, ...repointed] = tiles() as [Element, ...Element[]]
    expect(pilled()).toHaveLength(45)

    holding = true
    urlMovesTo('/@someone_else/shorts')
    await vi.advanceTimersByTimeAsync(passEveryMs)
    for (const [index, tile] of repointed.entries()) pointTileAt(tile, theirId(index))
    await vi.advanceTimersByTimeAsync(passEveryMs * 4)

    expect(out).toBe(1)
    expect(
      tiles()
        .filter((tile) => pillHostsIn(tile).length > 0)
        .map(tileId),
    ).toEqual([tileId(kept)])
  })

  test('a channels read that finds the creator signed out shows no pill and reads no uploads', async () => {
    await showPage({ channels: { state: 'signed-out' } })

    expect(hosts()).toEqual([])
    expect(uploadsReads()).toEqual([])
  })

  test('a Short not among the uploads and one YouTube has not processed show no pill, and the others still do', async () => {
    const [left, awaiting] = tiles().map(tileId) as [string, string]

    await showPage({
      uploads: { [channelId]: myUploads.filter((id) => id !== left) },
      answer: { awaiting: [awaiting] },
    })

    const [first, second, ...rest] = tiles()
    expect(pillHostsIn(first as Element)).toEqual([])
    expect(pillHostsIn(second as Element)).toEqual([])
    for (const tile of rest) expect(pillBesideTile(tile)).toBeDefined()
  })

  test("a tile YouTube points at another Short loses the old Short's pill and shows the new one's", async () => {
    await showPage({ answer: { engagedViews: (id) => (id === otherId(0) ? 12_000 : 334_212) } })
    const tile = tiles()[0] as Element

    pointTileAt(tile, otherId(0))
    await youtubeChanges()

    expect(pillHostsIn(tile)).toHaveLength(1)
    expect(pillBesideTile(tile)?.text).toBe('12K engaged views')
  })

  /** Another channel's Shorts tab, its grid drawn: the saved tab, pointed at that channel's Shorts. */
  async function showTheirTab(from = '/@someone_else/shorts'): Promise<void> {
    load('channel-shorts', from)
    youtubeDrawsTheirGrid()
    await showPage()
    expect(hosts()).toEqual([])
  }

  test("#138 F4.1 on the Shorts tab: after a move to the creator's tab, the old channel's tiles drawn after the URL moved show no pill and send no id", async () => {
    await showTheirTab()

    urlMovesTo(tabUrl)
    addTiles(10, (index) => theirId(100 + index))
    await youtubeChanges()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(hosts()).toEqual([])

    for (const [index, tile] of tiles().entries()) pointTileAt(tile, otherId(index))
    await youtubeChanges()

    expect(pilled()).toHaveLength(55)
  })

  test("#138 F4.2 on the Shorts tab: the grid redrawn with the next channel's Shorts before the URL leaves the creator's tab shows no pill and sends no id", async () => {
    await showPage()
    expect(pilled()).toHaveLength(45)

    youtubeDrawsTheirGrid()
    await youtubeChanges()

    expect(hosts()).toEqual([])

    await moveTo('/@someone_else/shorts')

    expect(hosts()).toEqual([])
  })

  test.each([
    ['the home feed', '/'],
    ['a channel Home tab', '/@someone_else'],
    ['a watch page', '/watch?v=dQw4w9WgXcQ'],
  ])(
    '#138 F4.3 on the Shorts tab: arriving from %s, YouTube drawing the grid before the URL moves, shows the pills and sends one extension_surface_shown',
    async (_, from) => {
      load('channel-shorts', from)
      await showPage()
      expect(hosts()).toEqual([])

      await moveTo(tabUrl)

      expect(pilled()).toHaveLength(45)
      expect(events()).toEqual([shownOn('shorts', { fromCache: false })])
    },
  )

  test("a tab the settle finds still holding only the other channel's grid sends no event: the grid is there", async () => {
    await showTheirTab()

    await moveTo(tabUrl)

    expect(events()).toEqual([])
  })

  test('a read that lands after the creator left the Shorts tab is not drawn', async () => {
    const held = deferred()
    await showPage({
      through: async (request) => {
        if (request.type === 'read-uploads') await held.promise
      },
    })

    urlMovesTo('/@nick_vogel/videos')
    await vi.advanceTimersByTimeAsync(passEveryMs)
    held.release()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(drawn).toEqual([])
  })
})

describe("the creator's Short in the Shorts player", () => {
  beforeEach(() => load('shorts-player'))

  test("shows the pill under the channel name, as the channel bar's next sibling, with the figure for the Short", async () => {
    await showPage()

    expect(pillUnderChannelName()).toMatchObject({
      text: '334K engaged views',
      role: 'img',
      opensWithIcon: true,
      links: 0,
    })
    expect(pillUnderChannelName()?.name).toContain('334,212')
    expect(hosts()).toHaveLength(1)
  })

  test('the pill under the channel name has no separator before it', async () => {
    await showPage()

    expect(pillUnderChannelName()?.text).toBe('334K engaged views')
    expect(separatorOf(channelBar()?.nextElementSibling)).toBeUndefined()
  })

  test('the pill under the channel name draws no capsule around it', async () => {
    await showPage()

    expect(pillUnderChannelName()).toBeDefined()
    expect(capsuleOf(channelBar()?.nextElementSibling)).toEqual([])
  })

  test('the pill under the channel name leaves space between the channel row and itself', async () => {
    await showPage()

    expect(pillUnderChannelName()).toBeDefined()
    const host = channelBar()?.nextElementSibling
    expect(marginsOf(declaredFor(host, '.pill'))).toEqual(['margin-block-start: 8px'])
    // On the host the margin loses to YouTube's own rules for that element (creator-analytics#627's
    // hand check measured 0px in Chrome), so the host declares none.
    expect(marginsOf(declaredFor(host, ':host'))).toEqual([])
  })

  test("reads the held channel's uploads and sends no id, the page URL's Short included", async () => {
    await showPage()

    expect(uploadsReads()).toEqual([channelId])
    expect(sent()).toEqual([])
  })

  test('shows the pill whatever channel the bar names: the uploads decide', async () => {
    overlayNames('/@someone_else')

    await showPage()

    expect(pillUnderChannelName()?.text).toBe('334K engaged views')
  })

  test('a Short not among the uploads of any held channel shows no pill', async () => {
    await showPage({ uploads: { [channelId]: [nextShort] } })

    expect(hosts()).toEqual([])
  })

  test('a channels read that finds the creator signed out shows no pill and reads no uploads', async () => {
    await showPage({ channels: { state: 'signed-out' } })

    expect(hosts()).toEqual([])
    expect(uploadsReads()).toEqual([])
  })

  test('an overlay YouTube redraws while the read is out is judged as it is on the next pass, and the pill is drawn once, under it', async () => {
    const held = deferred()
    await showPage({
      through: async (request) => {
        if (request.type === 'read-uploads') await held.promise
      },
    })

    overlayNames('/@someone_else')
    held.release()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(drawn).toEqual(['334K engaged views'])
    expect(pillUnderChannelName()?.text).toBe('334K engaged views')
  })
})

describe('an in-page move between Shorts', () => {
  beforeEach(() => load('shorts-player'))

  test("to another of the creator's Shorts shows that Short's figure", async () => {
    await showPage({ answer: byId })

    await moveTo(`/shorts/${nextShort}`)

    expect(pillUnderChannelName()?.text).toBe('12K engaged views')
    expect(hosts()).toHaveLength(1)
  })

  test("takes the old Short's pill down at the next tick, while the new navigation's read is out", async () => {
    const held = deferred()
    let reads = 0
    await showPage({
      answer: byId,
      through: async (request) => {
        if (request.type === 'read-uploads' && ++reads === 2) await held.promise
      },
    })
    expect(pillUnderChannelName()?.text).toBe('334K engaged views')

    urlMovesTo(`/shorts/${nextShort}`)
    await vi.advanceTimersByTimeAsync(passEveryMs)

    expect(hosts()).toEqual([])

    held.release()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(pillUnderChannelName()?.text).toBe('12K engaged views')
  })

  test('a read that lands after the move is not drawn', async () => {
    const held = deferred()
    let reads = 0
    await showPage({
      answer: byId,
      through: async (request) => {
        if (request.type === 'read-uploads' && ++reads === 1) await held.promise
      },
    })
    expect(hosts()).toEqual([])

    await moveTo(`/shorts/${nextShort}`)
    held.release()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(pillUnderChannelName()?.text).toBe('12K engaged views')
    expect(drawn).toEqual(['12K engaged views'])
  })

  test("#141 F2.1: the player whose URL moves to another channel's Short while the creator's channel bar is still drawn shows no pill and sends no id", async () => {
    await showPage()
    expect(pillUnderChannelName()?.text).toBe('334K engaged views')

    urlMovesTo(`/shorts/${elsewhereShort}`)
    await vi.advanceTimersByTimeAsync(passEveryMs)
    await youtubeChanges()

    expect(
      channelNameLinks().every((link) => link.getAttribute('href')?.startsWith('/@nick_vogel')),
    ).toBe(true)
    expect(hosts()).toEqual([])
    expect(drawn).toEqual(['334K engaged views'])

    overlayNames('/@someone_else')
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(hosts()).toEqual([])
    expect(sent()).toEqual([])
  })

  test.each([
    ['a held handle', [nick]],
    ['no handle', [{ ...nick, handle: null }]],
    ['a stale handle', [{ ...nick, handle: '@old_handle' }]],
  ])(
    "to the creator's Short while YouTube still draws the last Short's channel bar shows no pill until YouTube redraws the bar, then shows it before the page settles (%s)",
    async (_, channels) => {
      load('shorts-player', `/shorts/${elsewhereShort}`)
      overlayNames('/@someone_else')
      await showPage({ channels, answer: byId })
      expect(hosts()).toEqual([])

      urlMovesTo(`/shorts/${nextShort}`)
      await vi.advanceTimersByTimeAsync(passEveryMs * 4)

      expect(hosts()).toEqual([])
      expect(drawn).toEqual([])

      overlayNames('/@nick_vogel')
      await vi.advanceTimersByTimeAsync(passEveryMs * 4)

      expect(pillUnderChannelName()?.text).toBe('12K engaged views')
    },
  )

  test("to the creator's Short under a channel bar YouTube has not redrawn by the time the page settles shows the pill under the bar as the page shows it", async () => {
    load('shorts-player', `/shorts/${elsewhereShort}`)
    overlayNames('/@someone_else')
    await showPage({ answer: byId })

    await moveTo(`/shorts/${nextShort}`)

    expect(pillUnderChannelName()?.text).toBe('12K engaged views')
  })

  test("to the creator's Short whose channel bar YouTube redrew before the URL moved shows the pill before the page settles", async () => {
    load('shorts-player', `/shorts/${elsewhereShort}`)
    overlayNames('/@someone_else')
    await showPage({ answer: byId })

    overlayNames('/@nick_vogel')
    await vi.advanceTimersByTimeAsync(passEveryMs * 2)
    urlMovesTo(`/shorts/${nextShort}`)
    await vi.advanceTimersByTimeAsync(passEveryMs * 4)

    expect(pillUnderChannelName()?.text).toBe('12K engaged views')
  })

  test.each([
    ['a held handle', [nick]],
    ['no handle', [{ ...nick, handle: null }]],
  ])(
    "swiping from another channel's Short on through two of the creator's while YouTube still draws the first one's channel bar shows no pill under that bar (%s)",
    async (_, channels) => {
      load('shorts-player', `/shorts/${elsewhereShort}`)
      overlayNames('/@someone_else')
      await showPage({ channels, answer: byId })

      urlMovesTo(`/shorts/${nextShort}`)
      await vi.advanceTimersByTimeAsync(passEveryMs)
      urlMovesTo(`/shorts/${otherId(1)}`)
      await vi.advanceTimersByTimeAsync(passEveryMs * 4)

      expect(hosts()).toEqual([])
      expect(drawn).toEqual([])
    },
  )

  test("swiping from another channel's Short on through two of the creator's, the first left before its read lands, shows no pill under the first one's channel bar", async () => {
    const held = deferred()
    let reads = 0
    load('shorts-player', `/shorts/${elsewhereShort}`)
    overlayNames('/@someone_else')
    await showPage({
      answer: byId,
      through: async (request) => {
        if (request.type === 'read-uploads' && ++reads === 2) await held.promise
      },
    })

    urlMovesTo(`/shorts/${nextShort}`)
    await vi.advanceTimersByTimeAsync(passEveryMs)
    urlMovesTo(`/shorts/${otherId(1)}`)
    held.release()
    await vi.advanceTimersByTimeAsync(passEveryMs * 4)

    expect(hosts()).toEqual([])
    expect(drawn).toEqual([])
  })

  test.each([
    ['a held handle', [nick]],
    ['no handle', [{ ...nick, handle: null }]],
  ])(
    "swiping from the creator's Short to another channel's, whose bar YouTube redrew before the URL moved, then on to another of the creator's while YouTube still draws that bar, shows no pill under it (%s)",
    async (_, channels) => {
      await showPage({ channels, answer: byId })
      expect(pillUnderChannelName()?.text).toBe('334K engaged views')

      overlayNames('/@someone_else')
      await vi.advanceTimersByTimeAsync(passEveryMs * 2)
      urlMovesTo(`/shorts/${theirId(1)}`)
      await vi.advanceTimersByTimeAsync(passEveryMs * 4)
      drawn = []
      urlMovesTo(`/shorts/${otherId(1)}`)
      await vi.advanceTimersByTimeAsync(passEveryMs * 4)

      expect(hosts()).toEqual([])
      expect(drawn).toEqual([])

      overlayNames('/@nick_vogel')
      await vi.advanceTimersByTimeAsync(passEveryMs * 4)

      expect(pillUnderChannelName()?.text).toBe('12K engaged views')
    },
  )

  test("to another of the creator's Shorts under the same channel bar shows its figure, for a channel Stillstats holds no handle for", async () => {
    await showPage({ channels: [{ ...nick, handle: null }], answer: byId })
    expect(pillUnderChannelName()?.text).toBe('334K engaged views')

    await moveTo(`/shorts/${nextShort}`)

    expect(pillUnderChannelName()?.text).toBe('12K engaged views')
  })

  describe('for a channel Stillstats holds no handle for, or a stale one', () => {
    const noHandle = [{ ...nick, handle: null }]
    const staleHandle = [{ ...nick, handle: '@old_handle' }]

    test.each([
      ['no handle', noHandle],
      ['a stale handle', staleHandle],
    ])(
      "to the creator's Short whose channel bar YouTube redrew while the URL still named another channel's Short shows the pill (%s)",
      async (_, channels) => {
        load('shorts-player', `/shorts/${elsewhereShort}`)
        overlayNames('/@someone_else')
        await showPage({ channels, answer: byId })

        overlayNames('/@nick_vogel')
        await vi.advanceTimersByTimeAsync(passEveryMs * 2)
        await moveTo(`/shorts/${nextShort}`)

        expect(pillUnderChannelName()?.text).toBe('12K engaged views')
      },
    )

    test("swiping on through the creator's Shorts before a pass sees each one's pill shows every one's figure, without waiting for the page to settle", async () => {
      await showPage({ channels: noHandle, answer: byId })
      expect(pillUnderChannelName()?.text).toBe('334K engaged views')

      for (const id of [nextShort, otherId(1), otherId(2)]) {
        urlMovesTo(`/shorts/${id}`)
        await vi.advanceTimersByTimeAsync(passEveryMs)
      }
      await vi.advanceTimersByTimeAsync(passEveryMs * 4)

      expect(pillUnderChannelName()?.text).toBe('12K engaged views')
    })

    test("to the creator's Short after one of theirs that is not among the uploads read shows the pill", async () => {
      await showPage({
        channels: noHandle,
        uploads: { [channelId]: myUploads.filter((id) => id !== savedShort) },
        answer: byId,
      })
      expect(hosts()).toEqual([])

      await moveTo(`/shorts/${nextShort}`)

      expect(pillUnderChannelName()?.text).toBe('12K engaged views')
    })

    test.each([
      ['no handle', noHandle],
      ['a stale handle', staleHandle],
    ])(
      "swiping on from the creator's Short whose pill showed only once the page settled shows the next one's pill before the page settles, after one of theirs not among the uploads read (%s)",
      async (_, channels) => {
        await showPage({
          channels,
          uploads: { [channelId]: myUploads.filter((id) => id !== savedShort) },
          answer: byId,
        })
        await moveTo(`/shorts/${nextShort}`)
        expect(pillUnderChannelName()?.text).toBe('12K engaged views')

        urlMovesTo(`/shorts/${otherId(1)}`)
        await vi.advanceTimersByTimeAsync(passEveryMs * 4)

        expect(pillUnderChannelName()?.text).toBe('12K engaged views')
        expect(drawn).toEqual(['12K engaged views', '12K engaged views'])
      },
    )

    test.each([
      ['no handle', noHandle],
      ['a stale handle', staleHandle],
    ])(
      "swiping on from the creator's Short whose pill showed only once the page settled shows the next one's pill before the page settles, after another channel's Short whose bar YouTube redrew for the creator's (%s)",
      async (_, channels) => {
        load('shorts-player', `/shorts/${elsewhereShort}`)
        overlayNames('/@someone_else')
        await showPage({ channels, answer: byId })
        overlayNames('/@nick_vogel')
        await vi.advanceTimersByTimeAsync(passEveryMs * 2)
        await moveTo(`/shorts/${nextShort}`)
        expect(pillUnderChannelName()?.text).toBe('12K engaged views')

        urlMovesTo(`/shorts/${otherId(1)}`)
        await vi.advanceTimersByTimeAsync(passEveryMs * 4)

        expect(pillUnderChannelName()?.text).toBe('12K engaged views')
        expect(drawn).toEqual(['12K engaged views', '12K engaged views'])
      },
    )
  })

  test("to another channel's Short takes the pill down", async () => {
    await showPage()

    overlayNames('/@someone_else')
    await moveTo(`/shorts/${elsewhereShort}`)

    expect(hosts()).toEqual([])
  })
})

describe('a move between the Shorts tab and the player', () => {
  test("to the player leaves no pill on the hidden tab, and shows the Short's", async () => {
    addHiddenPlayer()
    await showPage()
    expect(pillHostsIn(channelPage())).toHaveLength(45)
    const tab = channelPage()

    tab.setAttribute('hidden', '')
    document.querySelector('ytd-shorts')?.removeAttribute('hidden')
    await moveTo(`/shorts/${savedShort}`)

    expect(pillHostsIn(tab)).toEqual([])
    expect(pillUnderChannelName()).toBeDefined()
    expect(hosts()).toHaveLength(1)
  })

  test("back to the tab takes the player's pill down and draws the tab's pills again", async () => {
    addHiddenPlayer()
    await showPage()
    const tab = channelPage()
    tab.setAttribute('hidden', '')
    document.querySelector('ytd-shorts')?.removeAttribute('hidden')
    await moveTo(`/shorts/${savedShort}`)
    const shownPlayer = player()

    shownPlayer.setAttribute('hidden', '')
    tab.removeAttribute('hidden')
    await moveTo(tabUrl)

    expect(pillHostsIn(shownPlayer)).toEqual([])
    expect(pillHostsIn(tab)).toHaveLength(45)
  })
})

describe('off the Shorts tab and the player', () => {
  test.each([
    ['the Shorts tab', 'channel-shorts', '/@nick_vogel/videos'],
    ['the Shorts tab', 'channel-shorts', '/watch?v=9SvyFna2XGM'],
    ['the player', 'shorts-player', '/@nick_vogel/videos'],
    ['the player', 'shorts-player', '/watch?v=9SvyFna2XGM'],
  ] as const)('a move from %s to %s takes the pills down', async (_, name, to) => {
    load(name)
    await showPage()
    expect(hosts()).not.toEqual([])

    await moveTo(to)

    expect(hosts()).toEqual([])
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

test.each([
  ['signed out', { state: 'signed-out' }],
  ['a channel not in Stillstats', { state: 'channel-not-in-stillstats' }],
  ['refused for a revoked connection', { state: 'refused', refusal: 'connection_revoked' }],
  ['failed', { state: 'failed' }],
] satisfies [string, UploadsRead][])(
  'an uploads read %s shows no pill and no line on the tab or in the player',
  async (_, read) => {
    for (const name of ['channel-shorts', 'shorts-player'] as const) {
      stop()
      recorder?.disconnect()
      load(name)
      await showPage({ uploads: { [channelId]: read } })

      expect(hosts()).toEqual([])
      for (const line of lineTexts) expect(document.body.textContent).not.toContain(line)
    }
  },
)

describe('events', () => {
  const shown = shownOn('shorts', { fromCache: false })
  const missing = { name: 'extension_surface_missing', surface: 'shorts' }

  test.each([true, false])(
    'a pill the background answers 1,200 ms after the pass found the tab asks for extension_surface_shown with ms 1200 and fromCache %s, once, and no ID',
    async (fromCache) => {
      await showPage({ answer: { fromCache }, through: uploadsAnsweredAfter(1_200) })
      await youtubeChanges()

      expect(events()).toEqual([
        { name: 'extension_surface_shown', surface: 'shorts', ms: 1_200, fromCache },
      ])
    },
  )

  test.each([true, false])(
    'a pill the background answers 1,200 ms after the pass found the player channel bar asks for extension_surface_shown with ms 1200 and fromCache %s, once, and no ID',
    async (fromCache) => {
      load('shorts-player')
      await showPage({ answer: { fromCache }, through: uploadsAnsweredAfter(1_200) })
      await youtubeChanges()

      expect(events()).toEqual([
        { name: 'extension_surface_shown', surface: 'shorts', ms: 1_200, fromCache },
      ])
    },
  )

  test('one extension_surface_shown per navigation on the tab, however many passes and scrolls', async () => {
    await showPage()
    addTiles(3)
    await youtubeChanges()
    await youtubeChanges()

    expect(events()).toEqual([shown])
  })

  test('one extension_surface_shown per Short in the player, however many passes', async () => {
    load('shorts-player')
    await showPage()
    await youtubeChanges()

    expect(events()).toEqual([shown])

    await moveTo(`/shorts/${nextShort}`)
    await youtubeChanges()

    expect(events()).toEqual([shown, shown])
  })

  test('a Shorts tab whose grid is not there sends one extension_surface_missing', async () => {
    for (const grid of document.querySelectorAll('ytd-rich-grid-renderer')) grid.remove()

    await showPage()
    await youtubeChanges()

    expect(events()).toEqual([missing])
  })

  test('a player with no channel name sends one extension_surface_missing, and reads no uploads', async () => {
    load('shorts-player')
    for (const bar of document.querySelectorAll('yt-reel-channel-bar-view-model')) bar.remove()

    await showPage()
    await youtubeChanges()

    expect(events()).toEqual([missing])
    expect(uploadsReads()).toEqual([])
  })

  test.each([
    ['a channel the creator does not hold', { channels: [someoneElse] }],
    ['a channels read signed out', { channels: { state: 'signed-out' } as const }],
    ['uploads that hold none of the Shorts', { uploads: { [channelId]: [theirId(0)] } }],
  ] satisfies [string, Parameters<typeof showPage>[0]][])(
    '%s sends no event on the tab or in the player',
    async (_, options) => {
      for (const name of ['channel-shorts', 'shorts-player'] as const) {
        stop()
        recorder?.disconnect()
        load(name)
        await showPage(options)
        await youtubeChanges()

        expect(events()).toEqual([])
      }
    },
  )
})

describe('a pill drawn after YouTube redraws the page during the uploads read', () => {
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
  const pointEveryTileElsewhere = () => {
    for (const [index, tile] of tiles().entries()) pointTileAt(tile, otherId(index))
  }
  const redrawChannelBar = () => {
    const bar = channelBar() as Element
    bar.replaceWith(bar.cloneNode(true))
  }

  test("on the tab, YouTube pointing every tile at another of the creator's Shorts, reports the time from the pass that found the tab", async () => {
    await showPage({ through: changedDuringFirstRead(pointEveryTileElsewhere) })

    expect(pilled()).toHaveLength(tiles().length)
    expect(events()).toEqual([
      shownOn('shorts', { ms: expect.toSatisfy((ms: number) => ms >= 1_200), fromCache: false }),
    ])
  })

  test("on the tab, YouTube pointing one tile at the creator's Short, beside tiles of another channel's Shorts, is timed from the pass that draws it", async () => {
    await showPage({
      uploads: { [channelId]: [otherId(0)] },
      through: changedDuringFirstRead(() => pointTileAt(tiles()[0] as Element, otherId(0))),
    })

    expect(pilled()).toHaveLength(1)
    expect(events()).toEqual([
      shownOn('shorts', { ms: expect.toSatisfy((ms: number) => ms < 1_200), fromCache: false }),
    ])
  })

  test('in the player, YouTube redrawing the channel bar reports the time from the pass that found the bar', async () => {
    load('shorts-player')
    await showPage({ through: changedDuringFirstRead(redrawChannelBar) })

    expect(pillUnderChannelName()).toBeDefined()
    expect(events()).toEqual([
      shownOn('shorts', { ms: expect.toSatisfy((ms: number) => ms >= 1_200), fromCache: false }),
    ])
  })

  test("on the tab, with a second held channel's read failing a failed read's keep after the first's, a redraw during the reads is not the figure's start", async () => {
    const { uploads, shownMs } = failingAcrossTheKeep(
      [channelId, someoneElse.youtubeChannelId],
      pointEveryTileElsewhere,
      Array.from({ length: 50 }, (_, index) => otherId(index)),
    )
    await showPage({ channels: [nick, someoneElse], uploads })
    await vi.advanceTimersByTimeAsync(signedInReadKeptMs)

    expect(pilled()).toHaveLength(tiles().length)
    expect(events().filter(({ name }) => name === 'extension_surface_shown')).toEqual([
      shownOn('shorts', { ms: shownMs, fromCache: false }),
    ])
  })

  test("in the player, with a second held channel's read failing a failed read's keep after the first's, a redraw during the reads is not the figure's start", async () => {
    load('shorts-player')
    const { uploads, shownMs } = failingAcrossTheKeep(
      [channelId, someoneElse.youtubeChannelId],
      redrawChannelBar,
      myUploads,
    )
    await showPage({ channels: [nick, someoneElse], uploads })
    await vi.advanceTimersByTimeAsync(signedInReadKeptMs)

    expect(pillUnderChannelName()).toBeDefined()
    expect(events().filter(({ name }) => name === 'extension_surface_shown')).toEqual([
      shownOn('shorts', { ms: shownMs, fromCache: false }),
    ])
  })
})
