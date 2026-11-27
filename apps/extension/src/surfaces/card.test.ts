// @vitest-environment jsdom
// Limits: jsdom applies no stylesheet and lays nothing out, so these tests see what the card says
// and where it sits in Studio's markup, not that it takes Studio's type, sizes and colours, or that
// Studio's own CSS leaves it readable, or how the comparison row lines up beside Studio's ranking
// row. The fixture is one saved dashboard, so a Studio redesign after 2026-10-10 is not seen here.
// creator-analytics#99 walks real Studio in Chrome and Firefox.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VideoListAnswer, VideoRow, VideoWindow } from '@creator-analytics/api-types'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { backgroundAnswerer } from '../background-answer.ts'
import type { AskBackground, BackgroundRequest } from '../messages.ts'
import type { VideosRead } from '../product-api.ts'
import { viewsRowIn } from '../selectors/card.ts'
import { latestVideoCard } from './card.ts'
import { lineClicks } from './line-clicks.ts'
import { giveUpAfterMs, passEveryMs, reportThrough, watchPage } from './page-watcher.ts'
import { clicks, clicksIn, eventsIn, passAt, readAgain, shownOn, studioChanges } from './testing.ts'

const origin = 'https://stillstats.example'

const fixture = readFileSync(
  join(import.meta.dirname, '../../test/fixtures/studio/dashboard.html'),
  'utf8',
)
/** The first line of each fixture records the Studio URL it was saved from. */
const fixtureUrl = /^<!-- (\S+) /.exec(fixture)?.[1] ?? ''

const cardVideo: VideoRow = {
  id: 'NDha0z6zDA8',
  title: 'Payload Local API: Query Your Data Without Fetch',
  thumbnailUrl: null,
  thumbnails: [],
  durationSeconds: null,
  publishedAt: '2026-10-06T15:00:00Z',
  scheduled: false,
  privacy: 'public',
  format: 'video',
  engagedViews: 1234,
  views: 1400,
  averageViewPercentage: 41.2,
  subscribersGained: 3,
  estimatedMinutesWatched: 0,
  awaitingProcessing: false,
}

/**
 * The background's answer of `videos` in `window`, counted to `lastProcessedDay`: by default the
 * card video's second day, so its format read is in `first7`.
 */
function answerWith(
  videos: VideoRow[],
  {
    window = 'lifetime',
    lastProcessedDay = '2026-10-07',
    fromCache = false,
  }: Partial<{
    window: VideoWindow
    lastProcessedDay: string
    fromCache: boolean
  }> = {},
) {
  const answer: VideoListAnswer = {
    videos,
    window,
    page: 1,
    pageSize: 1,
    pageCount: 1,
    revenue: { refusal: 'consent_missing' },
    lastProcessedDay,
    creationDay: null,
    fetchedAt: '2026-10-10T12:00:00Z',
    fromCache,
  }
  return { state: 'read', channelId: 'channel-1', answer } satisfies VideosRead
}

/** Puts the saved dashboard in the jsdom document, as Chrome drew it. */
function loadDashboard(): void {
  const page = new DOMParser().parseFromString(fixture, 'text/html')
  document.replaceChild(document.importNode(page.documentElement, true), document.documentElement)
}

const studioCard = () => document.querySelector('ytcd-entity-snapshot-item')

/** The extension's own element in the card, and what the creator reads in it. */
function shownCard() {
  const host = document.querySelector('[data-stillstats-surface="card"]')
  const root = host?.shadowRoot
  return {
    host,
    text: [...(root?.children ?? [])]
      .filter((node) => node.localName !== 'style')
      .map((node) => node.textContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
    /** The engaged views pill, and the extension icon it opens with. */
    pill: root?.querySelector('.pill'),
    icon: root?.querySelector('svg[role="img"]'),
    links: [...(root?.querySelectorAll('a') ?? [])],
  }
}

let asked: BackgroundRequest[]
let stop: () => void
/** The URL the watch reads, which `navigate` moves. */
let dashboardUrl: string
/** Studio's in-page navigation to `to`, as WXT reports it to the content script. */
let navigate: (to: string) => void

/** Runs the content script's watch on the dashboard past the give-up time, the background answering `read`. */
const showDashboard = (read: Parameters<typeof showDashboardFor>[1]) =>
  showDashboardFor(giveUpAfterMs, read)

/** A `read-videos` request the card asks the background. */
type ReadRequest = Extract<BackgroundRequest, { type: 'read-videos' }>

/**
 * Runs the content script's watch on the dashboard for `ms`, its background answering `read` to
 * every read, or what `read(request)` answers at the time of each request.
 */
async function showDashboardFor(
  ms: number,
  read: VideosRead | ((request: ReadRequest) => VideosRead | Promise<VideosRead>),
  url = fixtureUrl,
): Promise<void> {
  asked = []
  const ask = (async (request: BackgroundRequest) => {
    asked.push(request)
    if (request.type !== 'read-videos') return true
    return typeof read === 'function' ? read(request) : read
  }) as AskBackground
  await watchDashboardFor(ms, ask, url)
}

/**
 * Runs the content script's watch on the dashboard for `ms`, asking the background with `ask`, the
 * tab's line clicks held in `clicks`.
 */
async function watchDashboardFor(
  ms: number,
  ask: AskBackground,
  url = fixtureUrl,
  clicks = lineClicks(ask),
): Promise<void> {
  dashboardUrl = url
  const watcher = watchPage({
    document,
    url: () => dashboardUrl,
    surfaces: [latestVideoCard({ ask, origin, locale: 'en-GB', lineClicks: clicks })],
    report: reportThrough(ask),
  })
  stop = watcher.stop
  navigate = (to) => {
    dashboardUrl = to
    watcher.navigated(to)
  }
  await vi.advanceTimersByTimeAsync(ms)
}

const readsAsked = () =>
  asked.flatMap((request) => (request.type === 'read-videos' ? [request] : []))
/** The reads of the card's own video, as against the format read its comparison row makes. */
const idsReadsAsked = () => readsAsked().filter((request) => 'ids' in request)
const eventsAsked = () => eventsIn(asked)
const clicksAsked = () => clicksIn(asked)

/** The card's line link whose text is `text`. */
const cardLink = (text: string) => shownCard().links.find((link) => link.textContent === text)

/** The card video as one of the channel's Shorts. */
const cardShort: VideoRow = { ...cardVideo, format: 'short' }

/**
 * The newest 10 public uploads of a format as the API answers them in a window after publish, newest
 * first: `card` at `newestAt` (0 is the newest), its `days` processed days adding up to its own
 * `engagedViews`, and around it uploads with engaged views over their first `days` days from
 * `others`. Each other upload has far more engaged views over its lifetime, and on the day after
 * its first `days`, so a lifetime sort, or one past the first `days` days, puts the card video
 * elsewhere.
 */
function newestOf(card: VideoRow, others: number[], newestAt = 0, days = 2): VideoRow[] {
  const firstDays = (figure: number) => [figure, ...Array<number>(days - 1).fill(0)]
  const rows = others.map(
    (engagedViews, index): VideoRow => ({
      ...card,
      id: `other${String(index).padStart(6, '0')}`,
      title: `Upload ${index}`,
      publishedAt: `2026-09-${String(28 - index).padStart(2, '0')}T15:00:00Z`,
      engagedViews: 100_000 + engagedViews,
      engagedViewsByDay: [...firstDays(engagedViews), 50_000],
    }),
  )
  rows.splice(newestAt, 0, { ...card, engagedViewsByDay: firstDays(card.engagedViews) })
  return rows
}

/** The background answering the `ids` read with `ids`, and the format read with `format`. */
const answering =
  (ids: VideosRead, format: VideosRead) =>
  (request: ReadRequest): VideosRead =>
    'ids' in request ? ids : format

/** The card's comparison row, under the engaged views row, and what the creator reads in it. */
function shownComparison() {
  const row = document
    .querySelector('[data-stillstats-surface="card"]')
    ?.shadowRoot?.querySelector('.comparison')
  return {
    row,
    place: row?.querySelector('.place')?.textContent,
    through: row?.querySelector('.through')?.textContent,
  }
}

/**
 * The card shows `place` in its comparison row with `through` under it, by default the card video's
 * two processed days, and nothing in the card says "Ranking by views", which Studio Mod matches to
 * hide Studio's own row.
 */
function expectComparison(place: string, through = 'First 2 days'): void {
  expect(shownComparison().place).toBe(place)
  expect(shownComparison().through).toBe(through)
  expect(shownCard().text).not.toContain('Ranking by views')
}

/** The card shows its figure and no comparison row, having made `reads` reads. */
function expectFigureAlone(reads: number): void {
  expect(shownComparison().row).toBeNull()
  expect(shownCard().text).not.toContain('by engaged views')
  expect(shownCard().text).not.toMatch(/First \d+ days|Publish day/)
  expect(readsAsked()).toHaveLength(reads)
}

beforeEach(() => {
  vi.useFakeTimers()
  loadDashboard()
})

afterEach(() => {
  stop()
  vi.useRealTimers()
})

describe('the latest video card against the saved dashboard', () => {
  test("the card shows the video's lifetime engaged views in the pill, after the extension icon named Stillstats, and the last processed day", async () => {
    await showDashboard(answerWith([cardVideo]))

    const { pill, icon, text } = shownCard()
    expect(pill?.firstElementChild).toBe(icon)
    expect(icon?.getAttribute('aria-label')).toBe('Stillstats')
    expect(icon?.getAttribute('fill')).toBe('currentColor')
    expect(pill?.textContent).toBe('1,234 engaged views')
    expect(text).toContain('Through 7 Oct')
    // The card's figure row has no link, so no text on it says Stillstats.
    expect(text).not.toContain('Stillstats')
  })

  test("Studio's views and ranking stay as they were, with the extension's row directly after the Views row", async () => {
    const before = studioCard()?.outerHTML
    // The fixture's metrics table: the ranking row, then the Views row.
    const viewsRow = studioCard()?.querySelectorAll('#metrics-table > .table-row')[1]
    await showDashboard(answerWith([cardVideo]))

    const { host, text } = shownCard()
    expect(viewsRow).toBeInstanceOf(Element)
    expect(host?.previousElementSibling).toBe(viewsRow)
    expect(text).toContain('engaged views')
    expect(text).not.toContain('Ranking by views')

    host?.remove()
    expect(studioCard()?.outerHTML).toBe(before)
  })

  test('a Studio redraw of only the Views row leaves one extension row, directly after the new Views row', async () => {
    await showDashboard(answerWith([cardVideo]))
    const viewsRow = shownCard().host?.previousElementSibling
    const redrawn = viewsRow?.cloneNode(true) as Element
    viewsRow?.replaceWith(redrawn)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(studioCard()?.querySelectorAll('[data-stillstats-surface="card"]')).toHaveLength(1)
    expect(shownCard().host?.previousElementSibling).toBe(redrawn)
  })

  test("the card reads its video in the URL's channel over its lifetime, then the newest 10 public uploads of the video's format over the first 7 days that cover its 2 processed days, with no ids", async () => {
    await showDashboard(answering(answerWith([cardShort]), answerWith([cardShort])))

    expect(readsAsked()).toEqual([
      {
        type: 'read-videos',
        youtubeChannelId: 'UC8mOjhMBTyPPScCF9vYtwFg',
        ids: ['NDha0z6zDA8'],
        window: 'lifetime',
      },
      {
        type: 'read-videos',
        youtubeChannelId: 'UC8mOjhMBTyPPScCF9vYtwFg',
        format: 'short',
        newest: 10,
        window: 'first7',
      },
    ])
  })

  test('a shown figure asks for extension_surface_shown on the card, once', async () => {
    await showDashboard(answerWith([cardVideo]))

    expect(eventsAsked()).toEqual([shownOn('card', { fromCache: false })])
  })

  test.each([
    ['both from the cache', true, true, true],
    ['the figure read cold', false, false, true],
    ['the comparison read cold', false, true, false],
    ['both read cold', false, false, false],
  ])(
    'a figure the background answers 1,200 ms after the pass found the card, %s, asks for extension_surface_shown with ms 1200 and fromCache %s, and no ID',
    async (_, fromCache, idsFromCache, formatFromCache) => {
      await showDashboard(async (request) => {
        if (!('ids' in request))
          return answerWith(newestOf(cardShort, [99]), { fromCache: formatFromCache })
        await new Promise((land) => setTimeout(land, 1_200))
        return answerWith([cardShort], { fromCache: idsFromCache })
      })

      expectComparison('1 of 2 Shorts by engaged views')
      expect(eventsAsked()).toEqual([
        { name: 'extension_surface_shown', surface: 'card', ms: 1_200, fromCache },
      ])
    },
  )

  test('a figure whose Views row Studio redraws during its cold read of 1,200 ms reports the time from the pass that found the card, as a cold read, though the next pass draws from the cache', async () => {
    let idsReads = 0
    await showDashboard(async (request) => {
      if (!('ids' in request)) return answerWith(newestOf(cardShort, [99]), { fromCache: true })
      idsReads += 1
      if (idsReads > 1) return answerWith([cardShort], { fromCache: true })
      await new Promise((land) => setTimeout(land, 1_200))
      const card = studioCard()
      const viewsRow = card && viewsRowIn(card)
      viewsRow?.replaceWith(viewsRow.cloneNode(true))
      return answerWith([cardShort], { fromCache: false })
    })

    expect(idsReads).toBe(2)
    expectComparison('1 of 2 Shorts by engaged views')
    expect(eventsAsked()).toEqual([shownOn('card', { ms: 1_200 + passEveryMs, fromCache: false })])
  })

  test('a figure whose comparison read waits 700 ms after its own read of 500 ms reports the 1,200 ms the figure waited on both', async () => {
    await showDashboard(async (request) => {
      await new Promise((land) => setTimeout(land, 'ids' in request ? 500 : 700))
      return 'ids' in request ? answerWith([cardShort]) : answerWith(newestOf(cardShort, [99]))
    })

    expect(eventsAsked()).toEqual([shownOn('card', { ms: 1_200, fromCache: false })])
  })

  // Where the content script has no Navigation API, WXT polls the URL once a second, so a pass runs
  // on the dashboard before WXT reports it.
  test("a cold figure a pass ahead of WXT's report read, whose comparison read the report cut short before it drew, reports the time from that pass and its reads' cache result, though the navigation's own pass draws from the background's keep at once", async () => {
    const cold = { ids: true, format: true }
    await showDashboardFor(
      passEveryMs,
      async (request) => {
        const kind = 'ids' in request ? 'ids' : 'format'
        const answer = (fromCache: boolean) =>
          answerWith(kind === 'ids' ? [cardShort] : newestOf(cardShort, [99]), { fromCache })
        if (!cold[kind]) return answer(true)
        await new Promise((land) => setTimeout(land, kind === 'ids' ? 500 : 700))
        cold[kind] = false
        return answer(false)
      },
      'https://studio.youtube.com/channel/UC1/videos',
    )

    // The URL moves and Studio draws the card; the pass ahead of WXT's report starts at once, and
    // WXT reports the move after its read of the card's video, while its comparison is read.
    dashboardUrl = fixtureUrl
    await passAt(Date.now() + passEveryMs)
    await vi.advanceTimersByTimeAsync(900)
    navigate(fixtureUrl)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(idsReadsAsked()).toHaveLength(2)
    expect(eventsAsked()).toEqual([
      { name: 'extension_surface_shown', surface: 'card', ms: 1_200, fromCache: false },
    ])
  })

  test('once the extension stops, as an update or a disable stops it, no figure or comparison row stays on the card', async () => {
    const newest = newestOf(cardShort, [5_000, 900, 2_000])
    await showDashboard(answering(answerWith([cardShort]), answerWith(newest)))
    expect(shownCard().pill?.textContent).toBe('1,234 engaged views')
    expect(shownComparison().row).toBeInstanceOf(Element)

    stop()

    expect(document.querySelectorAll('[data-stillstats-surface]')).toHaveLength(0)
  })

  test('a move off the dashboard, where Studio keeps the card, leaves no figure or comparison row on it', async () => {
    const newest = newestOf(cardShort, [5_000, 900, 2_000])
    await showDashboard(answering(answerWith([cardShort]), answerWith(newest)))
    expect(shownCard().pill?.textContent).toBe('1,234 engaged views')

    navigate(`${fixtureUrl}/videos/upload`)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(document.querySelectorAll('[data-stillstats-surface="card"]')).toHaveLength(0)
  })
})

describe('the shared states on the card', () => {
  test('a video YouTube has not processed shows "Not processed yet" and counts as shown', async () => {
    await showDashboard(answerWith([{ ...cardVideo, awaitingProcessing: true }]))

    expect(shownCard().text).toContain('Not processed yet')
    expect(shownCard().text).not.toContain('Through')
    expect(shownCard().pill?.textContent).toBe('engaged views')
    expect(shownCard().pill?.firstElementChild).toBe(shownCard().icon)
    expect(eventsAsked()).toEqual([shownOn('card', { fromCache: false })])
  })

  test.each([
    ['signed out', { state: 'signed-out' }, 'Sign in at stillstats.com'],
    [
      'an unconnected channel',
      { state: 'channel-not-in-stillstats' },
      'This channel is not in Stillstats. Connect it',
    ],
    [
      'a connection_revoked refusal',
      { state: 'refused', refusal: 'connection_revoked' },
      'Reconnect in Stillstats',
    ],
    [
      'a not_connected refusal',
      { state: 'refused', refusal: 'not_connected' },
      'Reconnect in Stillstats',
    ],
    [
      'a quota_reserved refusal',
      { state: 'refused', refusal: 'quota_reserved' },
      'Try again later',
    ],
    ['a google_failed refusal', { state: 'refused', refusal: 'google_failed' }, 'Try again later'],
  ] satisfies [string, VideosRead, string][])(
    '%s shows its line, no figure, and is not counted as shown',
    async (_, read, line) => {
      await showDashboard(read)

      const { text } = shownCard()
      expect(text).toContain(line)
      // Every figure and day the card shows has a digit, and no line has one.
      expect(text).not.toMatch(/\d/)
      expect(eventsAsked()).toEqual([])
    },
  )

  // The keep is timed from when the read lands, so a read the background answers late is kept
  // from its landing, not from its ask.
  test.each([
    [0, 29_999, 1, 'Sign in at stillstats.com'],
    [0, 30_000, 2, '1,234'],
    [100, 29_999, 1, 'Sign in at stillstats.com'],
    [100, 30_000, 2, '1,234'],
  ] as const)(
    'with a read that lands %i ms after its ask, the pass %i ms after the sign-in line shows makes %i reads of the video in all and shows "%s": a line is kept 30 seconds, so a creator who signs in from it in another tab sees the figure back in Studio',
    async (landsAfterMs, sinceLine, reads, shown) => {
      let read: VideosRead = { state: 'signed-out' }
      let landedAt: number | undefined
      await showDashboardFor(giveUpAfterMs, async () => {
        if (landsAfterMs > 0) await new Promise((land) => setTimeout(land, landsAfterMs))
        landedAt ??= Date.now()
        return read
      })
      expect(shownCard().text).toContain('Sign in at stillstats.com')

      read = answerWith([cardVideo])
      await passAt((landedAt ?? 0) + sinceLine)
      // The pass's reads, the video's and then its comparison's, land too.
      await vi.advanceTimersByTimeAsync(landsAfterMs * 2)

      expect(idsReadsAsked()).toHaveLength(reads)
      expect(shownCard().text).toContain(shown)
    },
  )

  test('a card whose background request is rejected shows "Try again later", is not reported missing, and is not asked for again on every pass', async () => {
    await showDashboardFor(giveUpAfterMs, () => {
      throw new Error('Could not establish connection. Receiving end does not exist.')
    })
    studioChanges()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(shownCard().text).toContain('Try again later')
    expect(eventsAsked()).toEqual([])
    expect(asked.filter(({ type }) => type === 'read-videos')).toHaveLength(1)
  })

  test('a card whose ask throws before it returns a promise shows "Try again later" and is not reported missing', async () => {
    asked = []
    const ask = ((request: BackgroundRequest) => {
      asked.push(request)
      if (request.type !== 'read-videos') return Promise.resolve(true)
      // What Chrome's sendMessage throws once the extension is updated under an open Studio tab.
      throw new Error('Extension context invalidated.')
    }) as AskBackground
    await watchDashboardFor(giveUpAfterMs * 2, ask)

    expect(shownCard().text).toContain('Try again later')
    expect(eventsAsked()).toEqual([])
  })

  test('a missing card shows nothing and asks for extension_surface_missing once the give-up time passes', async () => {
    studioCard()?.remove()
    await showDashboard(answerWith([cardVideo]))

    expect(shownCard().host).toBeNull()
    expect(asked.filter(({ type }) => type === 'read-videos')).toEqual([])
    expect(eventsAsked()).toEqual([{ name: 'extension_surface_missing', surface: 'card' }])
  })

  test('a card Studio draws before the give-up time is not reported missing', async () => {
    const card = studioCard()
    const parent = card?.parentElement
    card?.remove()
    await showDashboardFor(giveUpAfterMs / 2, answerWith([cardVideo]))
    if (card) parent?.append(card)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(shownCard().text).toContain('1,234')
    expect(eventsAsked()).toEqual([shownOn('card', { fromCache: false })])
  })
})

describe('the access line on the card', () => {
  test('with host access to stillstats.com withheld, the card shows the access line, with no link, no figure and no other line, and is not counted as shown', async () => {
    await showDashboard({ state: 'host-access-withheld' })

    const { text, links } = shownCard()
    expect(text).toContain('Allow access to stillstats.com')
    expect(text).not.toContain('Sign in at stillstats.com')
    expect(text).not.toContain('Try again later')
    expect(text).not.toMatch(/\d/)
    expect(links).toEqual([])
    expect(eventsAsked()).toEqual([])
  })

  /**
   * The background script's own answerer behind the card's asks: host access to stillstats.com is
   * `granted` or not, and the product API answers every read signed out.
   */
  function askBackgroundWithNoSession(granted: boolean): AskBackground {
    asked = []
    const answer = backgroundAnswerer({
      productApi: {
        readChannels: async () => ({ state: 'signed-out' }),
        readVideos: async () => ({ state: 'signed-out' }),
        readUploads: async () => ({ state: 'signed-out' }),
      },
      hostAccess: async () => granted,
      youtubeAccess: async () => false,
      settle: async () => true,
      installEvent: { sendOn: async () => {} },
    })
    return ((request: BackgroundRequest) => {
      asked.push(request)
      return answer(request, { url: location.href })
    }) as AskBackground
  }

  test('with host access granted and no session, the card still shows the sign-in line', async () => {
    await watchDashboardFor(giveUpAfterMs, askBackgroundWithNoSession(true))

    expect(shownCard().text).toContain('Sign in at stillstats.com')
    expect(shownCard().text).not.toContain('Allow access to stillstats.com')
  })

  test('with host access withheld and no session, the card shows the access line, not the sign-in line', async () => {
    await watchDashboardFor(giveUpAfterMs, askBackgroundWithNoSession(false))

    expect(shownCard().text).toContain('Allow access to stillstats.com')
    expect(shownCard().text).not.toContain('Sign in at stillstats.com')
  })
})

test('a Studio page other than the dashboard looks for no card and reports nothing', async () => {
  studioCard()?.remove()
  const contentList = 'https://studio.youtube.com/channel/UC8mOjhMBTyPPScCF9vYtwFg/videos/upload'
  await showDashboardFor(giveUpAfterMs, answerWith([cardVideo]), contentList)

  expect(asked).toEqual([])
})

describe('links from the card', () => {
  test.each([
    ['signed out', { state: 'signed-out' }],
    ['an unconnected channel', { state: 'channel-not-in-stillstats' }],
    ['a reconnect refusal', { state: 'refused', refusal: 'connection_revoked' }],
    ['a try again refusal', { state: 'refused', refusal: 'quota_reserved' }],
  ] satisfies [string, VideosRead][])(
    'the %s line links the web app in a new tab',
    async (_, read) => {
      await showDashboard(read)

      const { links } = shownCard()
      expect(links).not.toHaveLength(0)
      for (const link of links) {
        expect(link.getAttribute('href')).toBe(`${origin}/app`)
        expect(link.target).toBe('_blank')
        expect(link.rel.split(' ')).toContain('noopener')
      }
    },
  )
})

describe("the card's line clicks", () => {
  test.each(clicks)(
    '%s on the sign-in line asks for nothing while signed out, then extension_sign_in_clicked on the card once a read shows the creator signed in',
    async (_, click) => {
      let read: VideosRead = { state: 'signed-out' }
      await showDashboardFor(giveUpAfterMs, () => read)
      cardLink('Sign in at stillstats.com')?.dispatchEvent(click())
      await readAgain()
      expect(clicksAsked()).toEqual([])

      read = answerWith([cardVideo])
      await readAgain()

      expect(clicksAsked()).toEqual([{ name: 'extension_sign_in_clicked', surface: 'card' }])
    },
  )

  test('a sign-in click whose next read fails stays held, and is sent by a later signed-in read', async () => {
    let read: VideosRead = { state: 'signed-out' }
    await showDashboardFor(giveUpAfterMs, () => read)
    cardLink('Sign in at stillstats.com')?.dispatchEvent(clicks[0][1]())

    read = { state: 'failed' }
    await readAgain()
    expect(shownCard().text).toContain('Try again later')
    expect(clicksAsked()).toEqual([])

    read = { state: 'channel-not-in-stillstats' }
    await readAgain()
    expect(clicksAsked()).toEqual([{ name: 'extension_sign_in_clicked', surface: 'card' }])
  })

  /**
   * The background answering `read` to every read, where the ask for extension_sign_in_clicked
   * throws before it returns a promise, as Chrome's sendMessage does once the extension is updated
   * under an open Studio tab.
   */
  function askThrowingOnSignInClick(read: () => VideosRead): AskBackground {
    asked = []
    return ((request: BackgroundRequest) => {
      asked.push(request)
      if (request.type === 'read-videos') return Promise.resolve(read())
      if (request.type === 'usage-event' && request.event.name === 'extension_sign_in_clicked')
        throw new Error('Extension context invalidated.')
      return Promise.resolve(true)
    }) as AskBackground
  }

  test('a held sign-in click whose ask throws at once does not keep a card Studio draws late from showing its figure, nor report it missing', async () => {
    const ask = askThrowingOnSignInClick(() => answerWith([cardVideo]))
    const held = lineClicks(ask)
    held.opened('card', 'sign-in')
    const card = studioCard()
    const parent = card?.parentElement
    card?.remove()
    await watchDashboardFor(giveUpAfterMs - 1, ask, fixtureUrl, held)
    // Studio draws the card just before the give-up time, so the settled pass is the first to find it.
    if (card) parent?.append(card)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(shownCard().text).toContain('1,234')
    expect(eventsAsked()).not.toContainEqual({ name: 'extension_surface_missing', surface: 'card' })
  })

  test('a sign-in click whose ask throws at once does not keep the card from showing its figure once the creator signs in', async () => {
    let read: VideosRead = { state: 'signed-out' }
    const ask = askThrowingOnSignInClick(() => read)
    await watchDashboardFor(giveUpAfterMs, ask)
    cardLink('Sign in at stillstats.com')?.dispatchEvent(clicks[0][1]())

    read = answerWith([cardVideo])
    await readAgain()

    expect(shownCard().text).toContain('1,234')
    expect(eventsAsked()).not.toContainEqual({ name: 'extension_surface_missing', surface: 'card' })
  })

  test.each(clicks)(
    '%s on "Connect it" asks for extension_connect_channel_clicked on the card',
    async (_, click) => {
      await showDashboard({ state: 'channel-not-in-stillstats' })
      cardLink('Connect it')?.dispatchEvent(click())

      expect(clicksAsked()).toEqual([
        { name: 'extension_connect_channel_clicked', surface: 'card' },
      ])
    },
  )

  test.each([
    ['Reconnect in Stillstats', { state: 'refused', refusal: 'connection_revoked' }],
    ['Try again later', { state: 'refused', refusal: 'quota_reserved' }],
    ['Try again later', { state: 'failed' }],
  ] satisfies [string, VideosRead][])(
    'a click and a middle-click on "%s" (%o) each ask for extension_web_app_opened on the card',
    async (line, read) => {
      await showDashboard(read)
      for (const [, click] of clicks) cardLink(line)?.dispatchEvent(click())

      expect(clicksAsked()).toEqual([
        { name: 'extension_web_app_opened', surface: 'card' },
        { name: 'extension_web_app_opened', surface: 'card' },
      ])
    },
  )
})

describe("the comparison row: the card video's place among the newest 10 public uploads of its format, by engaged views over the same days since publish", () => {
  /** Engaged views of the nine other Shorts, which put the card video's 1,234 third. */
  const thirdAmongTen = [5_000, 900, 2_000, 800, 700, 600, 500, 400, 300]

  test('a Short third by engaged views over its first 2 days among 10 reads "3 of 10 Shorts by engaged views", with "First 2 days" under it and the lifetime figure above', async () => {
    const newest = newestOf(cardShort, thirdAmongTen)
    await showDashboard(answering(answerWith([cardShort]), answerWith(newest)))

    expectComparison('3 of 10 Shorts by engaged views')
    expect(shownCard().pill?.textContent).toBe('1,234 engaged views')
    expect(shownCard().text).toContain('Through 7 Oct')
    expect(eventsAsked()).toEqual([shownOn('card', { fromCache: false })])
  })

  test.each([
    ['first', [900, 800, 700, 600, 500, 400, 300, 200, 100], '1 of 10 Shorts by engaged views'],
    [
      'last',
      [5_000, 4_000, 3_000, 2_000, 1_900, 1_800, 1_700, 1_600, 1_500],
      '10 of 10 Shorts by engaged views',
    ],
  ])('a Short %s by engaged views among 10 reads "%s"', async (_, others, place) => {
    const newest = newestOf(cardShort, others)
    await showDashboard(answering(answerWith([cardShort]), answerWith(newest)))

    expectComparison(place)
  })

  test.each([
    ['newer', '2 of 10 Shorts by engaged views', 0],
    ['older', '3 of 10 Shorts by engaged views', 2],
  ])(
    'a Short that ties another on engaged views, and is the %s of the two, places as the video list orders ties, newest first: "%s"',
    async (_, place, newestAt) => {
      const newest = newestOf(
        cardShort,
        [5_000, 1_234, 900, 800, 700, 600, 500, 400, 300],
        newestAt,
      )
      await showDashboard(answering(answerWith([cardShort]), answerWith(newest)))

      expectComparison(place)
    },
  )

  test('a video among only 4 public videos reads the real count, "2 of 4 Videos by engaged views"', async () => {
    const newest = newestOf(cardVideo, [5_000, 900, 300])
    await showDashboard(answering(answerWith([cardVideo]), answerWith(newest)))

    expectComparison('2 of 4 Videos by engaged views')
  })

  test('a live upload names its format "Live"', async () => {
    const cardLive: VideoRow = { ...cardVideo, format: 'live' }
    const newest = newestOf(cardLive, thirdAmongTen)
    await showDashboard(answering(answerWith([cardLive]), answerWith(newest)))

    expectComparison('3 of 10 Live by engaged views')
    expect(readsAsked()[1]).toMatchObject({ format: 'live', newest: 10 })
  })

  test.each([
    ['Videos', '1 of 1 Video by engaged views', cardVideo],
    ['Shorts', '1 of 1 Short by engaged views', cardShort],
    ['Live', '1 of 1 Live by engaged views', { ...cardVideo, format: 'live' } satisfies VideoRow],
  ])(
    'the one public upload of %s names its format in the singular: "%s"',
    async (_, place, card) => {
      await showDashboard(answering(answerWith([card]), answerWith(newestOf(card, []))))

      expectComparison(place)
    },
  )

  test('a Short among 2 keeps the plural, "1 of 2 Shorts by engaged views"', async () => {
    const newest = newestOf(cardShort, [900])
    await showDashboard(answering(answerWith([cardShort]), answerWith(newest)))

    expectComparison('1 of 2 Shorts by engaged views')
  })

  test.each([1, 3, 5])(
    'the place comes only from the API\'s answers, not Studio\'s "6 of 10" ranking row: an answer that sorts the video %i reads that place',
    async (placeInAnswer) => {
      expect(studioCard()?.textContent).toContain('6 of 10')
      const others = [5_000, 4_000, 3_000, 2_000, 900, 800, 700, 600, 500].map(
        (engagedViews, index) =>
          index < placeInAnswer - 1 ? engagedViews : Math.min(engagedViews, 1_000),
      )
      const newest = newestOf(cardShort, others)
      await showDashboard(answering(answerWith([cardShort]), answerWith(newest)))

      expectComparison(`${placeInAnswer} of 10 Shorts by engaged views`)
      expect(shownCard().text).not.toContain('6 of 10')
    },
  )

  test.each([
    ['unlisted', { ...cardShort, privacy: 'unlisted' }],
    ['private', { ...cardShort, privacy: 'private' }],
    ['with no format', { ...cardShort, format: null }],
  ] satisfies [string, VideoRow][])(
    'a latest upload %s shows its figure and no comparison row, and makes no second read',
    async (_, video) => {
      await showDashboard(
        answering(answerWith([video]), answerWith(newestOf(video, thirdAmongTen))),
      )

      expect(shownCard().pill?.textContent).toBe('1,234 engaged views')
      expectFigureAlone(1)
    },
  )

  test('a latest upload YouTube has not processed shows "Not processed yet", no comparison row, and makes no second read', async () => {
    const video: VideoRow = { ...cardShort, awaitingProcessing: true }
    await showDashboard(answering(answerWith([video]), answerWith(newestOf(video, thirdAmongTen))))

    expect(shownCard().text).toContain('Not processed yet')
    expectFigureAlone(1)
  })

  test.each([
    ['refused', { state: 'refused', refusal: 'quota_reserved' }],
    ['failed', { state: 'failed' }],
    ['signed out', { state: 'signed-out' }],
  ] satisfies [string, VideosRead][])(
    'a format read that is %s leaves the figure with no comparison row and no line, counted as shown once',
    async (_, format) => {
      await showDashboard(answering(answerWith([cardShort]), format))

      expect(shownCard().pill?.textContent).toBe('1,234 engaged views')
      expect(shownCard().links).toEqual([])
      expect(shownCard().text).not.toMatch(/Try again later|Reconnect|Sign in/)
      expectFigureAlone(2)
      expect(eventsAsked()).toEqual([shownOn('card', { fromCache: false })])
    },
  )

  test("a format read that failed is asked again once a line's time has passed, and its row then shows", async () => {
    let formatReads = 0
    await showDashboard((request) => {
      if ('ids' in request) return answerWith([cardVideo])
      formatReads += 1
      return formatReads === 1 ? { state: 'failed' } : answerWith(newestOf(cardVideo, [99]))
    })
    expectFigureAlone(2)

    await readAgain()

    expect(formatReads).toBe(2)
    expect(shownCard().pill?.textContent).toBe('1,234 engaged views')
    expectComparison('1 of 2 Videos by engaged views')
    expect(eventsAsked()).toEqual([shownOn('card', { fromCache: false })])
  })

  test("a format answer counted to the figure's day that leaves the card video out shows the figure and no comparison row, and is not asked again", async () => {
    const others = newestOf(cardShort, thirdAmongTen).filter(({ id }) => id !== cardShort.id)
    await showDashboard(answering(answerWith([cardShort]), answerWith(others)))

    expect(shownCard().pill?.textContent).toBe('1,234 engaged views')
    expectFigureAlone(2)

    await readAgain()

    expect(readsAsked()).toHaveLength(2)
  })

  test("the place sorts the card video by its own first days in the format read, while the pill keeps the ids read's lifetime figure: 2,500 over 2 days reads second", async () => {
    const formatRows = newestOf(cardShort, thirdAmongTen).map((row) =>
      row.id === cardShort.id
        ? { ...row, engagedViews: 2_600, engagedViewsByDay: [2_000, 500] }
        : row,
    )
    await showDashboard(answering(answerWith([cardShort]), answerWith(formatRows)))

    expect(shownCard().pill?.textContent).toBe('1,234 engaged views')
    expectComparison('2 of 10 Shorts by engaged views')
  })

  test('a newest upload 2 days old with 96 engaged views, among uploads with up to 2,510 over their lifetime but fewer over their first 2 days, reads "2 of 10" and "First 2 days", not "10 of 10"', async () => {
    const card: VideoRow = { ...cardVideo, engagedViews: 96 }
    const lifetimes = [2_510, 2_200, 1_900, 1_500, 1_200, 900, 600, 400, 200]
    const firstTwoDays = [120, 90, 80, 70, 60, 50, 40, 30, 20]
    const formatRows = newestOf(card, firstTwoDays).map((row) => {
      const index = Number(row.id.replace('other', ''))
      return row.id === card.id ? row : { ...row, engagedViews: lifetimes[index] ?? 0 }
    })
    await showDashboard(answering(answerWith([card]), answerWith(formatRows, { window: 'first7' })))

    expect(shownCard().pill?.textContent).toBe('96 engaged views')
    expectComparison('2 of 10 Videos by engaged views', 'First 2 days')
  })

  test.each([
    ['1 processed day reads "Publish day"', '2026-10-06', 1, 'first1', 'Publish day'],
    ['8 processed days read "First 8 days"', '2026-10-13', 8, 'first28', 'First 8 days'],
    [
      '370 processed days read the longest window, "First 365 days"',
      '2027-10-10',
      365,
      'first365',
      'First 365 days',
    ],
  ] satisfies [string, string, number, VideoWindow, string][])(
    '%s, from a format read in the shortest window after publish that covers them',
    async (_, lastProcessedDay, days, window, words) => {
      const format = answerWith(newestOf(cardShort, thirdAmongTen, 0, days), {
        window,
        lastProcessedDay,
      })
      await showDashboard(answering(answerWith([cardShort], { lastProcessedDay }), format))

      expect(readsAsked()[1]).toMatchObject({ format: 'short', newest: 10, window })
      expectComparison('3 of 10 Shorts by engaged views', words)
    },
  )

  test("a format read counted to a day before the card video's publish day, so holding none of its days, is asked again once a line's time has passed, and its row then shows", async () => {
    let formatReads = 0
    await showDashboard((request) => {
      if ('ids' in request) return answerWith([cardShort])
      formatReads += 1
      if (formatReads > 1) return answerWith(newestOf(cardShort, thirdAmongTen))
      const kept = newestOf(cardShort, thirdAmongTen).map((row) =>
        row.id === cardShort.id ? { ...row, engagedViewsByDay: [] } : row,
      )
      return answerWith(kept, { lastProcessedDay: '2026-10-05' })
    })
    expectFigureAlone(2)

    await readAgain()

    expect(formatReads).toBe(2)
    expect(shownCard().pill?.textContent).toBe('1,234 engaged views')
    expectComparison('3 of 10 Shorts by engaged views')
  })

  test('a latest upload with no publish time shows its figure, no comparison row, and makes no second read', async () => {
    const video: VideoRow = { ...cardShort, publishedAt: null }
    await showDashboard(answering(answerWith([video]), answerWith(newestOf(video, thirdAmongTen))))

    expect(shownCard().pill?.textContent).toBe('1,234 engaged views')
    expectFigureAlone(1)
  })
})

// Proof for pre-PR review 5, NFI D: the ids read counted to day D, the format read to D+1.
describe('NFI D: a format read counted one day past the figure, at a window edge', () => {
  /** Engaged views of the nine other Shorts, which put the card video's 1,234 third. */
  const thirdAmongTen = [5_000, 900, 2_000, 800, 700, 600, 500, 400, 300]

  test.each([
    [1, '2026-10-06', '2026-10-07', 'first1', 'first7', 'First 2 days'],
    [7, '2026-10-12', '2026-10-13', 'first7', 'first28', 'First 8 days'],
    [28, '2026-11-02', '2026-11-03', 'first28', 'first90', 'First 29 days'],
    [90, '2027-01-03', '2027-01-04', 'first90', 'first365', 'First 91 days'],
  ] satisfies [number, string, string, VideoWindow, VideoWindow, string][])(
    'ids read at %i processed days (%s), format read a day later (%s): the row names every day Google has processed',
    async (days, idsDay, formatDay, window, longer, words) => {
      // The API caps each upload's engagedViewsByDay at the window's length
      // (window-after-publish.ts engagedViewsByDayOf), so the first-N-day read answers N entries
      // even though Google has processed N + 1 days for the card video.
      const capped = newestOf(cardShort, thirdAmongTen, 0, days).map((row) => ({
        ...row,
        engagedViewsByDay: (row.engagedViewsByDay ?? []).slice(0, days),
      }))
      const ids = answerWith([cardShort], { lastProcessedDay: idsDay })
      // Each format read is answered in the window it asks, counted to the later day.
      const formatIn = (asked: VideoWindow | undefined): VideosRead =>
        asked === window
          ? answerWith(capped, { window, lastProcessedDay: formatDay })
          : answerWith(newestOf(cardShort, thirdAmongTen, 0, days + 1), {
              window: longer,
              lastProcessedDay: formatDay,
            })
      await showDashboard((request) => ('ids' in request ? ids : formatIn(request.window)))

      expect(readsAsked()[1]).toMatchObject({ format: 'short', newest: 10, window })
      expect(readsAsked()[2]).toMatchObject({ format: 'short', newest: 10, window: longer })
      expect(shownComparison().through).toBe(words)
    },
  )
})
