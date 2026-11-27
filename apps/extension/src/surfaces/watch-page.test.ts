// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://www.youtube.com/watch?v=9SvyFna2XGM"}
// Limits: jsdom lays nothing out and the fixture carries none of YouTube's stylesheets, so these
// tests see whether the watch page gets the engaged views pill, what it says and is named, and that
// it is the next sibling of the view count under the title in YouTube's markup, that it opens with
// its own hidden spacer and no dot, and that its shadow stylesheet declares no capsule (background,
// border or padding). They do not see where it lands in the info line, how the spacer reads beside
// YouTube's, that it takes YouTube's type and colour, or that it reads in YouTube's light and dark
// themes: creator-analytics#627's hand check, and creator-analytics#143's walk of the public page
// surfaces in Chrome and Firefox. The fixture is one save of the page (2026-11-06) with the description collapsed, so the
// expanded description and a YouTube redesign after that day are not seen here. YouTube's in-page
// move to another video is modelled by setting the metadata block's `video-id` and its owner link's
// href, and moving the URL with `history.pushState`. The page URL's `v` is matched in the browser
// against the creator's uploads, which the fake background answers, and never sent: every test
// that can send one checks `videoIdsSentIn`, and test/page-boundary.test.ts holds the selectors and
// surfaces to reading hrefs and the URL only.
import type { ListedChannel } from '@creator-analytics/api-types'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { signedInReadKeptMs } from '../kept.ts'
import type { AskBackground, BackgroundRequest } from '../messages.ts'
import type { UploadsRead } from '../product-api.ts'
import { lineClicks } from './line-clicks.ts'
import { giveUpAfterMs, passEveryMs, reportThrough, watchPage } from './page-watcher.ts'
import {
  capsuleOf,
  eventsIn,
  failingAcrossTheKeep,
  fakeYouTubeBackground,
  loadYouTubePage,
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
import { watchPageSurface } from './watch-page.ts'

const channelId = 'UC8mOjhMBTyPPScCF9vYtwFg'
/** The video the fixture was saved playing, one of the creator's. */
const savedId = '9SvyFna2XGM'
/** Eleven characters, like a YouTube id, unlike any id in the fixture: another of the creator's. */
const nextId = 'nextVideo01'
/** Another channel's video, not among the creator's uploads. */
const elsewhereId = 'elsewhere01'
/** The creator's uploads, as the background reads them. */
const myUploads = [savedId, nextId]

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

const watchPageEl = () => document.querySelector('ytd-watch-flexy:not([hidden])') as Element
const metadata = () => watchPageEl().querySelector('ytd-watch-metadata') as Element
/** The view count under the title: "662 views" in the save, before the date. */
const viewCount = () => metadata().querySelector('ytd-watch-info-text #info > span:first-child')
const ownerLinks = () => [
  ...metadata().querySelectorAll(
    '#owner ytd-video-owner-renderer :is(a[href^="/@"], a[href^="/channel/"])',
  ),
]

const hosts = () => [...document.querySelectorAll('[data-stillstats-surface]')]

/** The pill, if it is the next sibling of the view count under the title. */
function pillBeside() {
  const next = viewCount()?.nextElementSibling
  if (!next?.matches('[data-stillstats-surface="watch_page"]')) return undefined
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

/** The pill host, if it is the next sibling of the view count under the title. */
const hostBeside = () => {
  const next = viewCount()?.nextElementSibling
  return next?.matches('[data-stillstats-surface="watch_page"]') ? next : undefined
}

/** What the pill host draws before the pill, as the creator sees and a screen reader hears it. */
function separatorOf() {
  const separator = separatorBefore(hostBeside())
  return separator && { text: separator.textContent, hidden: separator.getAttribute('aria-hidden') }
}

/** YouTube draws the watch page's block for `id`, owned by the channel `owner` links. */
function youtubeDraws(id: string, owner?: string): void {
  watchPageEl().setAttribute('video-id', id)
  metadata().setAttribute('video-id', id)
  if (owner) for (const link of ownerLinks()) link.setAttribute('href', owner)
}

let asked: BackgroundRequest[]
let navigated: (to: string) => void
let stop: () => void = () => {}
/** The text of every pill the surface drew, in the order it drew them. */
let drawn: string[]
let recorder: MutationObserver | undefined

/**
 * Runs the content script's watch on the watch page past the give-up time, the background holding
 * `channels` and answering each held channel's uploads read from `uploads` (by default the creator's
 * are `myUploads`, the saved video with 334,212 engaged views and every other with 12,000), each
 * request passing `through` on its way to it.
 */
async function showPage({
  channels = [nick],
  uploads = { [channelId]: myUploads },
  answer = { engagedViews: (id) => (id === savedId ? 334_212 : 12_000) },
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
        if (node instanceof Element && node.matches('[data-stillstats-surface="watch_page"]'))
          drawn.push(
            node.shadowRoot?.querySelector('.pill')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          )
  })
  recorder.observe(document, { childList: true, subtree: true })
  const watcher = watchPage({
    document,
    url: () => location.href,
    // en-US, whose compact form is the approved copy's example, "334K"; en-GB's is "334k".
    surfaces: [watchPageSurface({ ask, origin: '', locale: 'en-US', lineClicks: lineClicks(ask) })],
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

/** YouTube moves to the video `id`: it redraws the block for it and moves the URL, then settles. */
async function youtubeMovesTo(id: string, owner?: string): Promise<void> {
  youtubeDraws(id, owner)
  urlMovesTo(`/watch?v=${id}`)
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)
}

/** YouTube changes the page, and the pass it starts runs. */
async function youtubeChanges(): Promise<void> {
  studioChanges()
  await vi.advanceTimersByTimeAsync(1_000)
}

const idsSent = () => videoIdsSentIn(asked)
const uploadsReads = () => uploadsAskedIn(asked)
const events = () => eventsIn(asked)

/** A promise and the function that settles it. */
function deferred(): { promise: Promise<void>; release: () => void } {
  let release = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

beforeEach(() => {
  vi.useFakeTimers()
  const savedAt = loadYouTubePage('watch')
  history.replaceState(null, '', savedAt)
})

afterEach(() => {
  // Whatever a test did, the page sent no video id.
  if (asked) expect(idsSent()).toEqual([])
  stop()
  recorder?.disconnect()
  vi.useRealTimers()
})

describe("the creator's own video", () => {
  test('shows the pill next to the view count under the title, with the compact figure, and the full figure and its day in its hover and accessible name', async () => {
    await showPage()

    expect(pillBeside()).toEqual({
      text: '334K engaged views',
      title: 'Stillstats: 334,212 engaged views. Through Oct 7',
      name: 'Stillstats: 334,212 engaged views. Through Oct 7',
      role: 'img',
      opensWithIcon: true,
      links: 0,
    })
    // Not in the sidebar, nor in YouTube's older info block it keeps hidden.
    expect(hosts()).toHaveLength(1)
  })

  test("the pill follows YouTube's spacing in the info line, the two spaces it puts between the count and the date, with no dot, and stays the view count's next sibling", async () => {
    await showPage()

    expect(pillBeside()?.text).toBe('334K engaged views')
    expect(separatorOf()).toEqual({ text: '\u00a0\u00a0', hidden: 'true' })
  })

  test("the pill reads as one of the info line's items: no capsule around it", async () => {
    await showPage()

    expect(hostBeside()).toBeDefined()
    expect(capsuleOf(hostBeside())).toEqual([])
  })

  test("reads the held channel's uploads and sends no video id, the page URL's `v` included", async () => {
    await showPage()

    expect(uploadsReads()).toEqual([channelId])
    expect(idsSent()).toEqual([])
    expect(asked.filter(({ type }) => type === 'read-videos')).toEqual([])
  })

  test.each([
    ['an owner link to another channel', () => youtubeDraws(savedId, '/@someone_else')],
    ['no owner link', () => metadata().querySelector('#owner ytd-video-owner-renderer')?.remove()],
  ])(
    'shows the pill whatever the owner link says, here %s: the uploads decide',
    async (_, draw) => {
      draw()

      await showPage()

      expect(pillBeside()?.text).toBe('334K engaged views')
    },
  )

  test("a video of the creator's other held channel shows that channel's figure", async () => {
    await showPage({
      channels: [someoneElse, nick],
      uploads: { [someoneElse.youtubeChannelId]: [elsewhereId], [channelId]: myUploads },
    })

    expect(pillBeside()?.text).toBe('334K engaged views')
    expect(uploadsReads()).toEqual([someoneElse.youtubeChannelId, channelId])
  })
})

describe("another channel's video", () => {
  test('a video not among the uploads of any held channel shows no pill and sends no id', async () => {
    await showPage({
      channels: [someoneElse],
      uploads: { [someoneElse.youtubeChannelId]: [elsewhereId] },
    })

    expect(hosts()).toEqual([])
    expect(idsSent()).toEqual([])
  })

  test('a channels read that finds the creator signed out shows no pill and reads no uploads', async () => {
    await showPage({ channels: { state: 'signed-out' } })

    expect(hosts()).toEqual([])
    expect(uploadsReads()).toEqual([])
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

describe('no pill', () => {
  test.each([
    ['uploads that leave the video out', { [channelId]: [nextId] }, {}],
    ['a video YouTube has not processed', { [channelId]: myUploads }, { awaiting: [savedId] }],
    ['a read signed out', { [channelId]: { state: 'signed-out' } }, {}],
    ['a channel not in Stillstats', { [channelId]: { state: 'channel-not-in-stillstats' } }, {}],
    [
      'a read refused for a revoked connection',
      { [channelId]: { state: 'refused', refusal: 'connection_revoked' } },
      {},
    ],
    ['a failed read', { [channelId]: { state: 'failed' } }, {}],
  ] satisfies [string, Record<string, readonly string[] | UploadsRead>, UploadsAnswer][])(
    '%s shows no pill, no line, and sends no event',
    async (_, uploads, answer) => {
      await showPage({ uploads, answer })

      expect(hosts()).toEqual([])
      for (const line of lineTexts) expect(document.body.textContent).not.toContain(line)
      expect(events()).toEqual([])
    },
  )
})

describe('a read asked again', () => {
  test.each([
    ['failed', { state: 'failed' }],
    ['signed out', { state: 'signed-out' }],
  ] as const)(
    'a %s uploads read is asked again on the first pass once signedInReadKeptMs has passed, and the pill shows',
    async (_, first) => {
      await showPage({ uploads: { [channelId]: (call) => (call === 1 ? first : myUploads) } })
      expect(hosts()).toEqual([])

      await youtubeChanges()
      expect(hosts()).toEqual([])
      expect(uploadsReads()).toHaveLength(1)

      await vi.advanceTimersByTimeAsync(signedInReadKeptMs)
      await youtubeChanges()

      expect(pillBeside()?.text).toBe('334K engaged views')
      expect(uploadsReads()).toEqual([channelId, channelId])
      expect(events()).toEqual([shownOn('watch_page', { fromCache: false })])
    },
  )
})

describe('an in-page move', () => {
  test("to another of the creator's videos shows the new video's figure", async () => {
    await showPage()

    await youtubeMovesTo(nextId)

    expect(pillBeside()?.text).toBe('12K engaged views')
    expect(hosts()).toHaveLength(1)
  })

  test("takes the old video's pill down at the next tick, while the new navigation's read is out", async () => {
    const held = deferred()
    let reads = 0
    await showPage({
      through: async (request) => {
        if (request.type === 'read-uploads' && ++reads === 2) await held.promise
      },
    })
    expect(pillBeside()?.text).toBe('334K engaged views')

    youtubeDraws(nextId)
    urlMovesTo(`/watch?v=${nextId}`)
    await vi.advanceTimersByTimeAsync(passEveryMs)

    expect(hosts()).toEqual([])

    held.release()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(pillBeside()?.text).toBe('12K engaged views')
    expect(drawn).toEqual(['334K engaged views', '12K engaged views'])
  })

  test('a read that lands after the creator moved on is not drawn', async () => {
    const held = deferred()
    let reads = 0
    await showPage({
      through: async (request) => {
        if (request.type === 'read-uploads' && ++reads === 1) await held.promise
      },
    })
    expect(hosts()).toEqual([])

    await youtubeMovesTo(nextId)
    held.release()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(pillBeside()?.text).toBe('12K engaged views')
    expect(drawn).toEqual(['12K engaged views'])
  })

  test('a read that lands after the creator left the watch page is not drawn', async () => {
    const held = deferred()
    await showPage({
      through: async (request) => {
        if (request.type === 'read-uploads') await held.promise
      },
    })

    urlMovesTo('/')
    await vi.advanceTimersByTimeAsync(passEveryMs)
    held.release()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(drawn).toEqual([])
  })

  test('a move to another video while a pass awaits a read takes the old pill down at the next tick', async () => {
    const held = deferred()
    let channelsReads = 0
    await showPage({
      through: async (request) => {
        if (request.type === 'read-channels' && ++channelsReads === 2) await held.promise
      },
    })
    // The same video again, as a jump to a time in it is: a navigation whose read of channels is
    // held, so its pass holds the watch.
    urlMovesTo(`/watch?v=${savedId}&t=42s`)
    await vi.advanceTimersByTimeAsync(passEveryMs)
    expect(pillBeside()?.text).toBe('334K engaged views')

    youtubeDraws(nextId)
    urlMovesTo(`/watch?v=${nextId}`)
    await vi.advanceTimersByTimeAsync(passEveryMs)

    expect(hosts()).toEqual([])

    held.release()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(pillBeside()?.text).toBe('12K engaged views')
  })

  test("a block YouTube redraws for another channel's video while the read is out, before the URL moves, gets no pill and no shown event", async () => {
    const held = deferred()
    await showPage({
      through: async (request) => {
        if (request.type === 'read-uploads') await held.promise
      },
    })

    youtubeDraws(elsewhereId, '/@someone_else')
    held.release()
    await vi.advanceTimersByTimeAsync(0)

    expect(drawn).toEqual([])
    expect(events().map(({ name }) => name)).not.toContain('extension_surface_shown')
  })

  test("#139 F2.3: a block whose video-id YouTube sets to another channel's video before its owner link changes shows no pill and sends no id", async () => {
    await showPage()
    expect(pillBeside()?.text).toBe('334K engaged views')

    // The block names the next video, still under the creator's owner link, and the URL follows.
    youtubeDraws(elsewhereId)
    urlMovesTo(`/watch?v=${elsewhereId}`)
    await vi.advanceTimersByTimeAsync(passEveryMs)
    await youtubeChanges()

    expect(ownerLinks().every((link) => link.getAttribute('href') === '/@nick_vogel')).toBe(true)
    expect(hosts()).toEqual([])
    expect(drawn).toEqual(['334K engaged views'])

    for (const link of ownerLinks()) link.setAttribute('href', '/@someone_else')
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(hosts()).toEqual([])
    expect(idsSent()).toEqual([])
  })

  test("a URL that moves while the block still names the old video takes the old pill down and shows nothing until YouTube redraws the block, then shows the new video's", async () => {
    await showPage()

    urlMovesTo(`/watch?v=${nextId}`)
    await vi.advanceTimersByTimeAsync(passEveryMs)

    expect(hosts()).toEqual([])

    await youtubeChanges()

    expect(hosts()).toEqual([])

    youtubeDraws(nextId)
    await youtubeChanges()

    expect(pillBeside()?.text).toBe('12K engaged views')
  })

  test('a block YouTube redraws for the next video before the URL moves takes the pill down and shows nothing until the URL moves', async () => {
    await showPage()

    youtubeDraws(nextId)
    await youtubeChanges()

    expect(hosts()).toEqual([])

    urlMovesTo(`/watch?v=${nextId}`)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(pillBeside()?.text).toBe('12K engaged views')
  })

  test("to another channel's video takes the pill down and sends no id of it", async () => {
    await showPage()

    await youtubeMovesTo(elsewhereId, '/@someone_else')

    expect(hosts()).toEqual([])
    expect(idsSent()).toEqual([])
  })

  test('off the watch page takes the pill down', async () => {
    await showPage()
    expect(hosts()).toHaveLength(1)

    urlMovesTo('/')
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(hosts()).toEqual([])
  })
})

describe('events', () => {
  const shown = shownOn('watch_page', { fromCache: false })
  const missing = { name: 'extension_surface_missing', surface: 'watch_page' }

  test.each([true, false])(
    'a pill the background answers 1,200 ms after the pass found the view count asks for extension_surface_shown with ms 1200 and fromCache %s, once, and no ID',
    async (fromCache) => {
      await showPage({ answer: { fromCache }, through: uploadsAnsweredAfter(1_200) })
      await youtubeChanges()

      expect(events()).toEqual([
        { name: 'extension_surface_shown', surface: 'watch_page', ms: 1_200, fromCache },
      ])
    },
  )

  test('one extension_surface_shown per navigation, however many passes', async () => {
    await showPage()
    await youtubeChanges()
    await youtubeChanges()

    expect(events()).toEqual([shown])

    await youtubeMovesTo(nextId)
    await youtubeChanges()

    expect(events()).toEqual([shown, shown])
  })

  test('a page with no view count under the title sends one extension_surface_missing, and reads no uploads', async () => {
    metadata().querySelector('ytd-watch-info-text #info')?.remove()

    await showPage()
    await youtubeChanges()

    expect(events()).toEqual([missing])
    expect(hosts()).toEqual([])
    expect(uploadsReads()).toEqual([])
  })

  test("a block that never names the URL's video by the settle sends one extension_surface_missing, and reads no uploads", async () => {
    youtubeDraws(elsewhereId)

    await showPage()
    await youtubeChanges()

    expect(events()).toEqual([missing])
    expect(uploadsReads()).toEqual([])
  })

  test.each([
    [
      'a video of a channel the creator does not hold',
      () => showPage({ uploads: { [channelId]: [nextId] } }),
    ],
    ['a signed-out creator', () => showPage({ channels: { state: 'signed-out' } })],
  ])('%s sends no event: the view count is there, so the surface is placed', async (_, show) => {
    await show()
    await youtubeChanges()

    expect(events()).toEqual([])
  })
})
describe('a pill drawn after YouTube redraws the block during the uploads read', () => {
  /** Holds the first uploads read 1,200 ms, redrawing the block halfway; lets every later one through. */
  const blockRedrawnDuringFirstRead = () => {
    let reads = 0
    return async (request: BackgroundRequest) => {
      if (request.type !== 'read-uploads') return
      reads += 1
      if (reads > 1) return
      await new Promise((resolve) => setTimeout(resolve, 600))
      metadata().replaceWith(metadata().cloneNode(true))
      await new Promise((resolve) => setTimeout(resolve, 600))
    }
  }

  test('reports the time from the pass that found the view count', async () => {
    await showPage({ through: blockRedrawnDuringFirstRead() })

    expect(pillBeside()).toBeDefined()
    expect(events()).toEqual([
      shownOn('watch_page', {
        ms: expect.toSatisfy((ms: number) => ms >= 1_200),
        fromCache: false,
      }),
    ])
  })

  test("with a second held channel's read failing a failed read's keep after the first's, a redraw during the reads is not the figure's start", async () => {
    const { uploads, shownMs } = failingAcrossTheKeep(
      [channelId, someoneElse.youtubeChannelId],
      () => metadata().replaceWith(metadata().cloneNode(true)),
      myUploads,
    )
    await showPage({ channels: [nick, someoneElse], uploads })
    await vi.advanceTimersByTimeAsync(signedInReadKeptMs)

    expect(pillBeside()).toBeDefined()
    expect(events().filter(({ name }) => name === 'extension_surface_shown')).toEqual([
      shownOn('watch_page', { ms: shownMs, fromCache: false }),
    ])
  })
})
