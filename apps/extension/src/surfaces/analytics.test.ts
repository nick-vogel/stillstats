// @vitest-environment jsdom
// Limits: jsdom applies no stylesheet and lays nothing out, so these tests see what the figure in
// Studio's Views tile and the line above Studio's key metric card say and where they sit in Studio's
// markup, not how they look; the style tests pin the CSS, not the look, such as the figure's
// centring. The fixture is one saved Overview tab with "Last 90 days" selected: the other periods'
// URLs are built from the period menu's test-ids, not seen in Studio. creator-analytics#99 walks
// real Studio. Hand check (creator-analytics#229): in Chrome, the figure reads centred under Studio's
// number in the Views tile, "engaged views" above the mark and the figure and "Lifetime" under them
// in the font of Studio's "Views" label, and the line above the tiles and the chart, in the light
// and the dark theme; the screenshot goes on creator-analytics#229.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VideoListAnswer, VideoRow } from '@creator-analytics/api-types'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { AskBackground, BackgroundRequest } from '../messages.ts'
import type { VideosRead } from '../product-api.ts'
import { videoAnalyticsPage } from './analytics.ts'
import { lineClicks } from './line-clicks.ts'
import { giveUpAfterMs, passEveryMs, reportThrough, watchPage } from './page-watcher.ts'
import { clicks, clicksIn, declaredFor, eventsIn, passAt, readAgain, shownOn } from './testing.ts'

const origin = 'https://stillstats.example'

const fixture = readFileSync(
  join(import.meta.dirname, '../../test/fixtures/studio/video-analytics.html'),
  'utf8',
)
/** The first line of each fixture records the Studio URL it was saved from. */
const fixtureUrl = /^<!-- (\S+) /.exec(fixture)?.[1] ?? ''
const pageUrl = (period: string) => fixtureUrl.replace(/period-quarter$/, period)

const pageVideo: VideoRow = {
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

function answerWith(videos: VideoRow[], fromCache = false) {
  const answer: VideoListAnswer = {
    videos,
    window: 'lifetime',
    page: 1,
    pageSize: 1,
    pageCount: 1,
    revenue: { refusal: 'consent_missing' },
    lastProcessedDay: '2026-10-07',
    creationDay: null,
    fetchedAt: '2026-10-10T12:00:00Z',
    fromCache,
  }
  return { state: 'read', channelId: 'channel-1', answer } satisfies VideosRead
}

/** Puts the saved analytics page in the jsdom document, as Chrome drew it. */
function loadAnalyticsPage(): void {
  const page = new DOMParser().parseFromString(fixture, 'text/html')
  document.replaceChild(document.importNode(page.documentElement, true), document.documentElement)
}

const studioCard = () => document.querySelector('yta-key-metric-card')

const hosts = () => [...document.querySelectorAll('[data-stillstats-surface="analytics"]')]

const viewsTab = () => document.querySelector('#EXTERNAL_VIEWS-tab')
const viewsNumber = () => document.querySelector('#EXTERNAL_VIEWS-tab #metric-total')

/** What the creator reads in a host's shadow root, its style left out. */
function textIn(root: ShadowRoot | null | undefined): string {
  const parts = [...(root?.children ?? [])]
    .filter((node) => node.localName !== 'style')
    .map((node) => node.textContent)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * What a screen reader says for a host's shadow root, in document order: each text, and the name of
 * each image in its place.
 */
function spokenIn(root: ShadowRoot | null | undefined): string {
  const said: string[] = []
  const walk = (node: Node) => {
    if (node instanceof Element && node.localName === 'style') return
    if (node instanceof Element && node.getAttribute('role') === 'img') {
      said.push(node.getAttribute('aria-label') ?? '')
      return
    }
    if (node.nodeType === Node.TEXT_NODE) said.push(node.textContent ?? '')
    for (const child of node.childNodes) walk(child)
  }
  for (const child of root?.childNodes ?? []) walk(child)
  return said.join(' ').replace(/\s+/g, ' ').trim()
}

/** The extension's figure inside Studio's Views tile, and what the creator reads in it. */
function shownFigure() {
  const host = viewsTab()?.querySelector('[data-stillstats-surface="analytics"]') ?? null
  const root = host?.shadowRoot
  const style = root?.querySelector('style')?.textContent ?? ''
  return {
    host,
    /** What the creator sees in the figure: every word in it is visible. */
    seen: textIn(root),
    /** The figure's own words, as a screen reader says them. */
    spoken: spokenIn(root),
    icon: root?.querySelector('svg[role="img"]'),
    /** The first thing the figure draws. */
    first: root?.querySelector('.figure')?.firstElementChild,
    figure: root?.querySelector('.number')?.textContent ?? undefined,
    notProcessed: root?.querySelector('.not-processed')?.textContent ?? undefined,
    period: root?.querySelector('.period')?.textContent ?? undefined,
    /** The rule for the figure's host, which lays out the figure's content. */
    hostRule: /:host\s*\{[^}]*\}/.exec(style)?.[0],
    style,
    links: [...(root?.querySelectorAll('a') ?? [])],
  }
}

/** The extension's line above Studio's key metric card, directly before it, and what it says. */
function shownLine() {
  const before = studioCard()?.previousElementSibling
  const host = before?.matches('[data-stillstats-surface="analytics"]') ? before : null
  const root = host?.shadowRoot
  return {
    host,
    text: textIn(root),
    icon: root?.querySelector('svg[role="img"]'),
    /** The first thing the line draws. */
    first: root?.querySelector('.line')?.firstElementChild,
    links: [...(root?.querySelectorAll('a') ?? [])],
    style: root?.querySelector('style')?.textContent ?? '',
  }
}

let asked: BackgroundRequest[]
let url: string
let watcher: { navigated(to: string): void; stop(): void }

/**
 * Runs the content script's watch on the analytics page at `at` for `ms`, its background answering
 * each read with what `read()` returns at the time of the request.
 */
async function showPageFor(
  ms: number,
  read: () => VideosRead | Promise<VideosRead>,
  at = fixtureUrl,
): Promise<void> {
  asked = []
  url = at
  const ask = (async (request: BackgroundRequest) => {
    asked.push(request)
    return request.type === 'read-videos' ? read() : true
  }) as AskBackground
  watcher = watchPage({
    document,
    url: () => url,
    surfaces: [videoAnalyticsPage({ ask, origin, locale: 'en-GB', lineClicks: lineClicks(ask) })],
    report: reportThrough(ask),
  })
  await vi.advanceTimersByTimeAsync(ms)
}

/**
 * A background read whose first call answers with the page's video and whose every later call is
 * held open, as a slow API would hold it.
 */
function firstReadThenHeld(): () => VideosRead | Promise<VideosRead> {
  let reads = 0
  return () => {
    reads += 1
    return reads === 1 ? answerWith([pageVideo]) : new Promise<VideosRead>(() => {})
  }
}

/** Runs the watch on the page at `at` past the give-up time, every read answered with `read`. */
const showPage = (read: VideosRead, at = fixtureUrl) => showPageFor(giveUpAfterMs, () => read, at)

const readsAsked = () =>
  asked.flatMap((request) => (request.type === 'read-videos' ? [request] : []))
const eventsAsked = () => eventsIn(asked)
const clicksAsked = () => clicksIn(asked)
/** The line's link whose text is `text`. */
const lineLink = (text: string) => shownLine().links.find((link) => link.textContent === text)
const viewInStillstats = () => lineLink('View this video in Stillstats')

/** Stops jsdom's navigation on a followed link, as the test's page, not the extension, would. */
function keepPage(): void {
  document.addEventListener('click', (event) => event.preventDefault())
}

beforeEach(() => {
  vi.useFakeTimers()
  loadAnalyticsPage()
})

afterEach(() => {
  watcher.stop()
  vi.useRealTimers()
})

describe("a video's analytics page against the saved Overview tab", () => {
  test.each([
    ['period-week', 'last7'],
    ['period-4_weeks', 'last28'],
    ['period-quarter', 'last90'],
    ['period-year', 'last365'],
    ['period-lifetime', 'lifetime'],
  ])(
    "%s reads the video's engaged views in %s and shows no period, since the figure's is Studio's",
    async (period, window) => {
      await showPage(answerWith([pageVideo]), pageUrl(period))

      expect(readsAsked()).toEqual([
        {
          type: 'read-videos',
          youtubeChannelId: 'UC8mOjhMBTyPPScCF9vYtwFg',
          ids: ['NDha0z6zDA8'],
          window,
        },
      ])
      expect([shownFigure().figure, shownFigure().period]).toEqual(['1,234', undefined])
      expect(shownFigure().seen).toBe('engaged views 1,234')
    },
  )

  test.each([
    ['an unmapped period, since_publish', pageUrl('period-since_publish')],
    ["the nav drawer's period-default", pageUrl('period-default')],
    ['a custom range, period-fixed', pageUrl('period-fixed')],
    [
      'a period carrying characters outside the period names, a custom range with its dates',
      pageUrl('period-fixed,2026-09-01,2026-09-30'),
    ],
    ['a URL with no period', fixtureUrl.replace(/\/period-quarter$/, '')],
  ])(
    '%s reads lifetime engaged views and says "Lifetime" under the label and the figure, inside the tile',
    async (_, at) => {
      await showPage(answerWith([pageVideo]), at)

      expect(readsAsked()).toEqual([
        {
          type: 'read-videos',
          youtubeChannelId: 'UC8mOjhMBTyPPScCF9vYtwFg',
          ids: ['NDha0z6zDA8'],
          window: 'lifetime',
        },
      ])
      expect([shownFigure().figure, shownFigure().period]).toEqual(['1,234', 'Lifetime'])
      expect(shownFigure().seen).toBe('engaged views 1,234 Lifetime')
    },
  )

  test('a figure shows inside Studio\'s Views tile, after Studio\'s number row: the visible words "engaged views", then the mark and the engaged views number, and nothing else', async () => {
    await showPage(answerWith([pageVideo]))

    const { host, seen, spoken, links } = shownFigure()
    expect(host).not.toBeNull()
    expect(host?.previousElementSibling).toBe(viewsNumber()?.parentElement)
    expect(seen).toBe('engaged views 1,234')
    // The words are seen, and a screen reader hears them once, before the mark and the figure, as
    // Studio's tile says "Views" before its number.
    expect(spoken).toBe('engaged views Stillstats 1,234')
    expect(links).toEqual([])
    // Nowhere else: no other tile and nothing else in Studio's tabs holds a host of the extension's.
    const inTabs = [...document.querySelectorAll('#key-metric-blocks [data-stillstats-surface]')]
    expect(inTabs).toEqual([host])
  })

  test('the figure opens with the extension icon, named Stillstats and drawn in the text colour', async () => {
    await showPage(answerWith([pageVideo]))

    const { first, icon } = shownFigure()
    expect(first).toBe(icon)
    expect(icon?.getAttribute('aria-label')).toBe('Stillstats')
    expect(icon?.getAttribute('fill')).toBe('currentColor')
  })

  test('the words "engaged views" and "Lifetime" are in Studio\'s label font, normal weight, muted alike and 15% smaller than before, whatever font the tile sets', async () => {
    await showPage(answerWith([pageVideo]), pageUrl('period-since_publish'))

    const { host } = shownFigure()
    const look = (selector: string) => {
      const rule = declaredFor(host, selector)
      return ['font-family', 'font-weight', 'font-size', 'opacity'].map((property) =>
        rule?.getPropertyValue(property),
      )
    }
    // Roboto is the font of Studio's own "Views" label, declared here and never read from the page.
    // "engaged views" was at the tile's size (1em) and "Lifetime" at 0.8em; each is 15% smaller,
    // still relative, so both scale with Studio's tile.
    expect(look('.label')).toEqual(['Roboto, Arial, sans-serif', 'normal', '0.85em', '0.7'])
    expect(look('.period')).toEqual(['Roboto, Arial, sans-serif', 'normal', '0.68em', '0.7'])
  })

  test("the line above Studio's key metric card, directly before it and outside it, says where the data is from, through which day, and links the video in Stillstats", async () => {
    await showPage(answerWith([pageVideo]))

    const { host, text, first, icon, links } = shownLine()
    expect(host).not.toBeNull()
    // The only host inside the card is the figure in the Views tile: the line sits above the tiles
    // and the chart both.
    expect([...(studioCard()?.querySelectorAll('[data-stillstats-surface]') ?? [])]).toEqual([
      shownFigure().host,
    ])
    expect(text).toBe('Data from Stillstats as of 7 Oct. View this video in Stillstats.')
    expect(first).toBe(icon)
    expect(icon?.getAttribute('aria-label')).toBe('Stillstats')
    expect(links.map((link) => link.textContent)).toEqual(['View this video in Stillstats'])
  })

  test('an answer with no processed day says where the data is from, with no day', async () => {
    await showPage({
      ...answerWith([pageVideo]),
      answer: { ...answerWith([]).answer, videos: [pageVideo], lastProcessedDay: '' },
    })

    expect(shownLine().text).toBe('Data from Stillstats. View this video in Stillstats.')
  })

  test("the figure's and the line's styles set no colour or background of their own, and the figure's host centres its content", async () => {
    await showPage(answerWith([pageVideo]))

    // Studio's light and dark themes set the text colour; the extension takes it and sets none.
    const colours = (style: string) =>
      [...style.matchAll(/(?:^|[;{\s])(?:color|background)\s*:\s*([^;}]+)/g)].map(([, value]) =>
        value?.trim(),
      )
    expect(colours(shownFigure().style)).toEqual(['inherit'])
    expect(colours(shownLine().style)).toEqual(['inherit', 'inherit'])
    // Only the extension's own host centres its content under Studio's number; jsdom lays nothing
    // out, so the hand check proves the look.
    expect(shownFigure().hostRule).toMatch(/text-align:\s*center/)
    expect(shownFigure().style).not.toMatch(/clip-path/)
  })

  test('once the extension stops, as an update or a disable stops it, neither the figure nor the line stays on the page', async () => {
    await showPage(answerWith([pageVideo]))
    expect(shownFigure().figure).toBe('1,234')
    expect(viewInStillstats()).toBeInstanceOf(HTMLAnchorElement)

    watcher.stop()

    expect(document.querySelectorAll('[data-stillstats-surface]')).toHaveLength(0)
  })

  test("Studio's key metric card stays as it was once the extension's figure and line are removed", async () => {
    const before = studioCard()?.outerHTML
    await showPage(answerWith([pageVideo]))
    expect(hosts()).toHaveLength(2)

    for (const host of hosts()) host.remove()
    expect(studioCard()?.outerHTML).toBe(before)
  })

  test('a change of period in place reads the new window and links it, leaving one figure and one line', async () => {
    await showPage(answerWith([pageVideo]))
    url = pageUrl('period-week')
    watcher.navigated(url)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(readsAsked().map(({ window }) => window)).toEqual(['last90', 'last7'])
    expect(hosts()).toHaveLength(2)
    expect([shownFigure().figure, shownFigure().period]).toEqual(['1,234', undefined])
    expect(viewInStillstats()?.getAttribute('href')).toMatch(/window=last7$/)
  })

  test.each([
    ['period-lifetime', 'period-since_publish', '"Lifetime"', 'Lifetime'],
    ['period-since_publish', 'period-lifetime', 'no period', undefined],
  ])(
    'a change of period in place from %s to %s, both lifetime, shows %s under the number',
    async (from, to, _, label) => {
      await showPage(answerWith([pageVideo]), pageUrl(from))
      url = pageUrl(to)
      watcher.navigated(url)
      await vi.advanceTimersByTimeAsync(1_000)

      expect(hosts()).toHaveLength(2)
      expect([shownFigure().figure, shownFigure().period]).toEqual(['1,234', label])
    },
  )

  test('Studio redrawing its Views tile alone gets the figure placed again in the new tile, with one line', async () => {
    const freshTile = document
      .querySelector('#EXTERNAL_VIEWS-tab yta-key-metric-block')
      ?.cloneNode(true)
    await showPage(answerWith([pageVideo]))
    expect(shownFigure().figure).toBe('1,234')

    if (!(freshTile instanceof Element)) throw new Error('the fixture has no Views tile')
    document.querySelector('#EXTERNAL_VIEWS-tab yta-key-metric-block')?.replaceWith(freshTile)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(freshTile.contains(shownFigure().host)).toBe(true)
    expect(shownFigure().figure).toBe('1,234')
    expect(hosts()).toHaveLength(2)
    expect(eventsAsked()).toEqual([shownOn('analytics', { fromCache: false })])
  })

  test("Studio redrawing its whole key metric card gets the line placed again directly before the new card, and the figure in the new card's Views tile, with the old ones gone", async () => {
    const freshCard = studioCard()?.cloneNode(true)
    await showPage(answerWith([pageVideo]))
    const oldLine = shownLine().host
    expect(oldLine).not.toBeNull()

    if (!(freshCard instanceof Element)) throw new Error('the fixture has no key metric card')
    studioCard()?.replaceWith(freshCard)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(studioCard()).toBe(freshCard)
    expect(shownLine().host).not.toBeNull()
    expect(shownLine().host).not.toBe(oldLine)
    expect(oldLine?.isConnected).toBe(false)
    expect(freshCard.contains(shownLine().host ?? null)).toBe(false)
    expect(freshCard.contains(shownFigure().host)).toBe(true)
    expect(shownFigure().figure).toBe('1,234')
    expect(hosts()).toHaveLength(2)
  })

  test("a change of period while the background answers never draws the old period's figure or link", async () => {
    const answers: ((read: VideosRead) => void)[] = []
    /** The window each link the extension puts on the page opens, as it goes on. */
    const drawn: (string | null | undefined)[] = []
    new MutationObserver((records) => {
      for (const node of records.flatMap((record) => [...record.addedNodes])) {
        if (node instanceof Element && node.matches('[data-stillstats-surface="analytics"]')) {
          const link = node.shadowRoot?.querySelector('a')
          if (link) drawn.push(new URL(link.href).searchParams.get('window'))
        }
      }
    }).observe(document, { childList: true, subtree: true })
    await showPageFor(1_000, () => new Promise((resolve) => answers.push(resolve)))
    url = pageUrl('period-week')
    watcher.navigated(url)
    await vi.advanceTimersByTimeAsync(1_000)
    answers[0]?.(answerWith([pageVideo]))
    await vi.advanceTimersByTimeAsync(1_000)
    answers[1]?.(answerWith([pageVideo]))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(readsAsked().map(({ window }) => window)).toEqual(['last90', 'last7'])
    expect(drawn).toEqual(['last7'])
    expect(hosts()).toHaveLength(2)
  })

  test.each([
    ['another period', () => pageUrl('period-week')],
    ['another video', () => fixtureUrl.replace('NDha0z6zDA8', 'AAAAAAAAAAA')],
  ])(
    "a move to %s that redraws Studio's whole key metric card takes the page before's line and link down while the new read is out",
    async (_, next) => {
      // Studio's card as Studio draws it, with nothing of the extension's in it.
      const freshCard = studioCard()?.cloneNode(true)
      await showPageFor(giveUpAfterMs, firstReadThenHeld())
      expect(viewInStillstats()?.getAttribute('href')).toMatch(/NDha0z6zDA8\?.*window=last90$/)

      if (!(freshCard instanceof Element)) throw new Error('the fixture has no key metric card')
      studioCard()?.replaceWith(freshCard)
      url = next()
      watcher.navigated(url)
      await vi.advanceTimersByTimeAsync(1_000)

      expect(readsAsked()).toHaveLength(2)
      expect(hosts()).toEqual([])
    },
  )

  test.each([
    // The new period's own answer draws its line, which needs no Views number, and no figure.
    ['another period', () => pageUrl('period-week'), ['last7']],
    // The answer lacks the new video, so it draws nothing.
    ['another video', () => fixtureUrl.replace('NDha0z6zDA8', 'AAAAAAAAAAA'), []],
  ])(
    "a move to %s while Studio has not drawn the Views number leaves nothing of the page before's figure or line",
    async (_, next, linesOpening) => {
      await showPage(answerWith([pageVideo]))
      expect(hosts()).toHaveLength(2)

      viewsNumber()?.parentElement?.remove()
      url = next()
      watcher.navigated(url)
      await vi.advanceTimersByTimeAsync(giveUpAfterMs)

      expect(shownFigure().host).toBeNull()
      expect(hosts()).toEqual(linesOpening.length > 0 ? [shownLine().host] : [])
      expect(
        shownLine().links.map((link) => new URL(link.href).searchParams.get('window')),
      ).toEqual(linesOpening)
    },
  )

  test('a move to another analytics tab, where Studio keeps its key metric card, leaves neither the figure nor the line up', async () => {
    await showPage(answerWith([pageVideo]))
    expect(shownFigure().figure).toBe('1,234')

    url = fixtureUrl.replace('/tab-overview/', '/tab-reach_viewers/')
    watcher.navigated(url)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(hosts()).toEqual([])
  })
})

test.each([
  ['the dashboard', 'https://studio.youtube.com/channel/UC8mOjhMBTyPPScCF9vYtwFg'],
  [
    "the analytics page's Advanced mode",
    'https://studio.youtube.com/video/NDha0z6zDA8/analytics/tab-overview/period-quarter/explore',
  ],
  [
    "the analytics page's Reach tab",
    'https://studio.youtube.com/video/NDha0z6zDA8/analytics/tab-reach_viewers/period-quarter',
  ],
  ["the video's details", 'https://studio.youtube.com/video/NDha0z6zDA8/edit'],
])('%s looks for no analytics figure and reports nothing', async (_, at) => {
  await showPage(answerWith([pageVideo]), at)

  expect(asked).toEqual([])
  expect(hosts()).toEqual([])
})

describe("the line's link to the video's detail screen in the web app", () => {
  test('opens the video in the channel and window of the page in a new tab', async () => {
    await showPage(answerWith([pageVideo]))

    const link = viewInStillstats()
    expect(link?.getAttribute('href')).toBe(
      `${origin}/app/videos/NDha0z6zDA8?channel=channel-1&window=last90`,
    )
    expect(link?.target).toBe('_blank')
    expect(link?.rel.split(' ')).toContain('noopener')
  })

  test("writes lifetime into the link, since the web app's default window is the last 28 days", async () => {
    await showPage(answerWith([pageVideo]), pageUrl('period-lifetime'))

    expect(viewInStillstats()?.getAttribute('href')).toBe(
      `${origin}/app/videos/NDha0z6zDA8?channel=channel-1&window=lifetime`,
    )
  })

  test.each(clicks)(
    '%s asks for extension_web_app_opened on the analytics page',
    async (_, click) => {
      await showPage(answerWith([pageVideo]))
      keepPage()
      viewInStillstats()?.dispatchEvent(click())

      expect(eventsAsked()).toEqual([
        shownOn('analytics', { fromCache: false }),
        { name: 'extension_web_app_opened', surface: 'analytics' },
      ])
    },
  )
})

describe('the shared states on the analytics page', () => {
  test('a shown figure asks for extension_surface_shown on the analytics page, once', async () => {
    await showPage(answerWith([pageVideo]))
    document.body.append(document.createElement('div'))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(eventsAsked()).toEqual([shownOn('analytics', { fromCache: false })])
  })

  test.each([true, false])(
    'a figure the background answers 1,200 ms after the pass found the page asks for extension_surface_shown with ms 1200 and fromCache %s, once, and no ID',
    async (fromCache) => {
      await showPageFor(giveUpAfterMs, async () => {
        await new Promise((land) => setTimeout(land, 1_200))
        return answerWith([pageVideo], fromCache)
      })

      expect(eventsAsked()).toEqual([
        { name: 'extension_surface_shown', surface: 'analytics', ms: 1_200, fromCache },
      ])
    },
  )

  test('a change of period in place to another lifetime period keeps the cold figure, and that navigation reports it from the cache, as no request left the browser', async () => {
    await showPageFor(
      giveUpAfterMs,
      async () => {
        await new Promise((land) => setTimeout(land, 1_200))
        return answerWith([pageVideo])
      },
      pageUrl('period-since_publish'),
    )
    url = pageUrl('period-default')
    watcher.navigated(url)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(readsAsked()).toHaveLength(1)
    expect(eventsAsked()).toEqual([
      { name: 'extension_surface_shown', surface: 'analytics', ms: 1_200, fromCache: false },
      { name: 'extension_surface_shown', surface: 'analytics', ms: 0, fromCache: true },
    ])
  })

  // Where the content script has no Navigation API, WXT polls the URL once a second, so a pass runs
  // on the analytics page before WXT reports it.
  test("a cold read a pass ahead of WXT's report started, which the report cut short before it drew, reports the time from that pass and its own cache result, though the navigation's own pass draws from the background's keep at once", async () => {
    let cold = true
    await showPageFor(
      passEveryMs,
      async () => {
        if (!cold) return answerWith([pageVideo], true)
        await new Promise((land) => setTimeout(land, 1_500))
        cold = false
        return answerWith([pageVideo])
      },
      'https://studio.youtube.com/channel/UC1/dashboard',
    )

    // The URL moves and Studio draws the page; the pass ahead of WXT's report starts at once.
    url = fixtureUrl
    await passAt(Date.now() + passEveryMs)
    await vi.advanceTimersByTimeAsync(600)
    watcher.navigated(url)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(readsAsked()).toHaveLength(2)
    expect(eventsAsked()).toEqual([
      { name: 'extension_surface_shown', surface: 'analytics', ms: 1_500, fromCache: false },
    ])
  })

  test('a video YouTube has not processed shows the mark and "Not processed yet" in the number\'s place with "engaged views" above it, the same line above Studio\'s key metric card, and counts as shown', async () => {
    await showPage(answerWith([{ ...pageVideo, awaitingProcessing: true }]))

    const { first, icon, seen, spoken, figure, notProcessed, period } = shownFigure()
    expect(first).toBe(icon)
    expect(seen).toBe('engaged views Not processed yet')
    expect(spoken).toBe('engaged views Stillstats Not processed yet')
    expect([figure, notProcessed, period]).toEqual([undefined, 'Not processed yet', undefined])
    expect(shownLine().text).toBe(
      'Data from Stillstats as of 7 Oct. View this video in Stillstats.',
    )
    expect(eventsAsked()).toEqual([shownOn('analytics', { fromCache: false })])
  })

  test('a video missing from the answer draws no figure, no line and no link, and counts nothing as shown', async () => {
    await showPage(answerWith([]))

    expect(hosts()).toEqual([])
    expect(viewInStillstats()).toBeUndefined()
    expect(eventsAsked().map(({ name }) => name)).not.toContain('extension_surface_shown')
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
    ['a google_failed refusal', { state: 'refused', refusal: 'google_failed' }, 'Try again later'],
    ['a failed read', { state: 'failed' }, 'Try again later'],
  ] satisfies [string, VideosRead, string][])(
    "%s shows the mark and its line above Studio's key metric card in place of the sentence, nothing in the Views tile or anywhere in the card, and is not counted as shown",
    async (_, read, line) => {
      await showPage(read)

      expect(studioCard()?.querySelector('[data-stillstats-surface]')).toBeNull()
      expect(hosts()).toHaveLength(1)
      const { host, text, first, icon } = shownLine()
      expect(host).toBe(hosts()[0])
      expect(text).toBe(line)
      expect(first).toBe(icon)
      // Every figure and day the extension shows has a digit, and no line has one.
      expect(text).not.toMatch(/\d/)
      expect(viewInStillstats()).toBeUndefined()
      expect(eventsAsked()).toEqual([])
    },
  )

  test("with host access to stillstats.com withheld, the line above Studio's key metric card is the mark and the access line alone, with no link, nothing in the Views tile, and is not counted as shown", async () => {
    await showPage({ state: 'host-access-withheld' })

    expect(studioCard()?.querySelector('[data-stillstats-surface]')).toBeNull()
    expect(hosts()).toHaveLength(1)
    const { host, text, first, icon, links } = shownLine()
    expect(host).toBe(hosts()[0])
    expect(text).toBe('Allow access to stillstats.com')
    expect(first).toBe(icon)
    expect(links).toEqual([])
    expect(eventsAsked()).toEqual([])
  })

  test.each([
    ["Studio's key metric card", 'yta-key-metric-card'],
    ["Studio's header link to the dashboard (the channel id's only source)", 'a#home-button'],
  ])(
    'without %s, the page shows nothing, asks no read, and asks for extension_surface_missing once the give-up time passes',
    async (_, missing) => {
      const studioElement = document.querySelector(missing)
      expect(studioElement).not.toBeNull()
      studioElement?.remove()
      await showPage(answerWith([pageVideo]))
      await vi.advanceTimersByTimeAsync(giveUpAfterMs)

      expect(hosts()).toEqual([])
      expect(readsAsked()).toEqual([])
      expect(eventsAsked()).toEqual([{ name: 'extension_surface_missing', surface: 'analytics' }])
    },
  )

  test("without the Views tile's number, a read answer shows its line above Studio's key metric card with its day and link and nothing in the Views tile, asks one read, and asks for extension_surface_missing once the give-up time passes", async () => {
    viewsNumber()?.remove()
    await showPage(answerWith([pageVideo]))
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(shownFigure().host).toBeNull()
    expect(hosts()).toEqual([shownLine().host])
    expect(shownLine().text).toBe(
      'Data from Stillstats as of 7 Oct. View this video in Stillstats.',
    )
    expect(viewInStillstats()?.getAttribute('href')).toBe(
      `${origin}/app/videos/NDha0z6zDA8?channel=channel-1&window=last90`,
    )
    expect(readsAsked()).toHaveLength(1)
    expect(eventsAsked()).toEqual([{ name: 'extension_surface_missing', surface: 'analytics' }])
  })

  test('Studio drawing the Views number after the line shows gets the figure placed under it on the next pass, with one line, and asks for extension_surface_shown once', async () => {
    const number = viewsNumber() as Element
    const row = number.parentElement as Element
    const next = number.nextSibling
    number.remove()
    await showPageFor(1_000, () => answerWith([pageVideo]))
    expect(shownLine().text).toBe(
      'Data from Stillstats as of 7 Oct. View this video in Stillstats.',
    )
    expect(shownFigure().host).toBeNull()

    row.insertBefore(number, next)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(shownFigure().figure).toBe('1,234')
    expect(shownLine().host).not.toBeNull()
    expect(hosts()).toHaveLength(2)
    expect(eventsAsked()).toEqual([shownOn('analytics', { fromCache: false })])
  })

  test("with the key metric header and the Views tile outside Studio's key metric card, the line has nowhere to go: the page shows nothing, asks no read, and asks for extension_surface_missing once the give-up time passes", async () => {
    const card = studioCard()
    if (!card) throw new Error('the fixture has no key metric card')
    const plain = document.createElement('div')
    plain.append(...card.childNodes)
    card.replaceWith(plain)
    expect(viewsNumber()).not.toBeNull()
    await showPage(answerWith([pageVideo]))
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(hosts()).toEqual([])
    expect(readsAsked()).toEqual([])
    expect(eventsAsked()).toEqual([{ name: 'extension_surface_missing', surface: 'analytics' }])
  })
})

describe("the analytics page's line clicks", () => {
  test.each(clicks)(
    '%s on the sign-in line asks for nothing while signed out, then extension_sign_in_clicked on the analytics page once a read shows the creator signed in',
    async (_, click) => {
      let read: VideosRead = { state: 'signed-out' }
      await showPageFor(giveUpAfterMs, () => read)
      keepPage()
      lineLink('Sign in at stillstats.com')?.dispatchEvent(click())
      await readAgain()
      expect(clicksAsked()).toEqual([])

      read = answerWith([pageVideo])
      await readAgain()

      expect(clicksAsked()).toEqual([{ name: 'extension_sign_in_clicked', surface: 'analytics' }])
    },
  )

  test.each(clicks)(
    '%s on "Connect it" asks for extension_connect_channel_clicked on the analytics page',
    async (_, click) => {
      await showPage({ state: 'channel-not-in-stillstats' })
      keepPage()
      lineLink('Connect it')?.dispatchEvent(click())

      expect(clicksAsked()).toEqual([
        { name: 'extension_connect_channel_clicked', surface: 'analytics' },
      ])
    },
  )

  test.each([
    ['Reconnect in Stillstats', { state: 'refused', refusal: 'not_connected' }],
    ['Try again later', { state: 'refused', refusal: 'google_failed' }],
    ['Try again later', { state: 'failed' }],
  ] satisfies [string, VideosRead][])(
    'a click and a middle-click on "%s" (%o) each ask for extension_web_app_opened on the analytics page',
    async (line, read) => {
      await showPage(read)
      keepPage()
      for (const [, click] of clicks) lineLink(line)?.dispatchEvent(click())

      expect(clicksAsked()).toEqual([
        { name: 'extension_web_app_opened', surface: 'analytics' },
        { name: 'extension_web_app_opened', surface: 'analytics' },
      ])
    },
  )
})

describe("a line state on the analytics page and Studio's Views number", () => {
  test("a signed-out page whose Views tile has not drawn Studio's number shows the sign-in line", async () => {
    viewsNumber()?.remove()
    await showPage({ state: 'signed-out' })

    expect(document.querySelector('#key-metric-header')).not.toBeNull()
    expect(viewsNumber()).toBeNull()
    expect({ line: shownLine().text, reads: readsAsked().length }).toEqual({
      line: 'Sign in at stillstats.com',
      reads: 1,
    })
  })

  test('a signed-out page whose Views number Studio has drawn empty shows the sign-in line', async () => {
    viewsNumber()?.replaceChildren()
    await showPage({ state: 'signed-out' })

    expect(viewsNumber()?.textContent).toBe('')
    expect(shownLine().text).toBe('Sign in at stillstats.com')
  })

  test("a signed-out page with Studio's Views number shows the sign-in line", async () => {
    await showPage({ state: 'signed-out' })

    expect(viewsNumber()).not.toBeNull()
    expect(shownLine().text).toBe('Sign in at stillstats.com')
  })

  test("a sign-in line stays up while Studio's Views number is gone for a moment on the same page", async () => {
    await showPage({ state: 'signed-out' })
    expect(shownLine().text).toBe('Sign in at stillstats.com')
    const number = viewsNumber() as Element
    const row = number.parentElement as Element
    number.remove()
    // Studio changes its page: the watch runs a pass.
    document.body.append(document.createElement('div'))
    await vi.advanceTimersByTimeAsync(1_000)
    const lineWhileGone = shownLine().text
    row.append(number)
    document.body.append(document.createElement('div'))
    await vi.advanceTimersByTimeAsync(1_000)

    expect({ lineWhileGone, after: shownLine().text, reads: readsAsked().length }).toEqual({
      lineWhileGone: 'Sign in at stillstats.com',
      after: 'Sign in at stillstats.com',
      reads: 1,
    })
  })
})

describe('when Studio takes its Views number away after the figure shows', () => {
  test.each([
    ['#metric-total', () => viewsNumber()?.remove()],
    ["the number's row", () => viewsNumber()?.parentElement?.remove()],
  ])(
    'without %s, the Views tile shows no figure while the next read is out',
    async (_, takeAway) => {
      await showPageFor(giveUpAfterMs, firstReadThenHeld())
      expect(shownFigure().figure).toBe('1,234')

      takeAway()
      // Studio changes its page: the watch runs a pass, which asks the next read.
      document.body.append(document.createElement('div'))
      await vi.advanceTimersByTimeAsync(10_000)

      expect(viewsNumber()).toBeNull()
      expect({ figure: shownFigure().host, reads: readsAsked().length }).toEqual({
        figure: null,
        reads: 2,
      })
    },
  )
})

test("a figure Studio's Views number row arrives for after the cold read of 1,200 ms reports the time from the pass that found the page, as a cold read, though the next pass reads from the cache", async () => {
  const total = document.querySelector('#EXTERNAL_VIEWS-tab #metric-total') as Element
  const row = total.parentElement as Element
  const parent = row.parentElement as Element
  const next = row.nextSibling
  row.remove()
  let reads = 0
  await showPageFor(passEveryMs + 1_210, async () => {
    reads += 1
    if (reads > 1) return answerWith([pageVideo], true)
    await new Promise((land) => setTimeout(land, 1_200))
    return answerWith([pageVideo], false)
  })
  parent.insertBefore(row, next)
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)

  expect(shownFigure().host).not.toBeNull()
  expect(eventsAsked()).toEqual([
    {
      name: 'extension_surface_shown',
      surface: 'analytics',
      ms: expect.toSatisfy((ms: number) => ms >= 1_200),
      fromCache: false,
    },
  ])
})
