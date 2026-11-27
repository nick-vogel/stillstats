// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://studio.youtube.com/"}
// Limits: jsdom lays nothing out, and the fixture carries none of Studio's stylesheets, so these
// tests see what the Content list says and where it sits in Studio's markup, and the styles the
// extension declares for a row's figure (an anchor of no width, the figure out of flow under it, no
// wrap) as far as jsdom reads them. They do not see that the figure lands under Studio's views,
// that Studio's number and date stay apart, or that the figures stay readable in Studio's type and
// colours. The hand check for that: in Chrome, on a channel with six-figure and seven-figure view
// counts, no row's date and views overlap and no figure breaks onto two lines, with a screenshot on
// creator-analytics#219. Nor do they see where the pill draws in Studio's Views heading, that
// Studio's h3 clips nothing of it, that it fits inside the heading, or that a click on it sorts:
// they check that the extension's one anchor sits in Studio's Views heading cell, directly after the
// h3 that holds the word "Views" and outside it, declares no width and its own line height, draws
// the pill out of flow, end-aligned to the anchor and half an em plus 2px below its middle, in
// 0.8em type, and takes no click. Studio's layout of that cell (a flex row 47px tall whose line
// height is its height, its h3 32px wide with overflow hidden) is known only from Nick's console in
// real Studio on 2026-10-15, recorded on headingStyle in render.ts with the arithmetic the pill's
// place rests on. Nor do they see where the line under Studio's page title draws: they check only
// that it is the title element's next sibling. The hand check for both: in Chrome, on the Videos tab
// at the default and the narrowest Views column, in light and dark theme, Studio's word "Views"
// shows whole, the small pill sits under it, ending where the word ends, with its bottom above the
// heading's bottom and over no row, no "Through <day>" shows anywhere in the table, and a click on
// the pill sorts by views; the line "Data from Stillstats as of <day>." sits under "Channel content",
// above Studio's tabs, starting where the title starts, and a sign-in line shows there when signed
// out; with a screenshot on creator-analytics#230.
// The fixture is one saved page of one tab (Videos, first page, 2026-10-10), so the Shorts and Live
// tabs and a Studio redesign after that day are not seen here. Studio writes the sort in the URL
// (the fixture's first line), so a re-sort is modelled as a
// navigation; rows reordered with no navigation stand for a redraw within one page, which jsdom
// cannot tell from what Studio really does. The tests also assume Studio draws a navigation within
// the give-up time, when the navigation settles, which only real Studio shows.
// creator-analytics#99 walks real Studio in Chrome and Firefox.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VideoListAnswer, VideoRow } from '@creator-analytics/api-types'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { signedInReadKeptMs } from '../kept.ts'
import type { AskBackground, BackgroundRequest } from '../messages.ts'
import type { VideosRead } from '../product-api.ts'
import { contentList } from './content-list.ts'
import { lineClicks } from './line-clicks.ts'
import { giveUpAfterMs, passEveryMs, reportThrough, watchPage } from './page-watcher.ts'
import {
  advanceWhileRunning,
  clicks,
  clicksIn,
  declaredFor,
  eventsIn,
  passAt,
  readAgain,
  shownOn,
  studioChanges,
  studioKeepsChangingFor,
  watchThroughWxt,
} from './testing.ts'

const origin = 'https://stillstats.example'

const fixture = readFileSync(
  join(import.meta.dirname, '../../test/fixtures/studio/content-list.html'),
  'utf8',
)
/** The first line of each fixture records the Studio URL it was saved from. */
const fixtureUrl = /^<!-- (\S+) /.exec(fixture)?.[1] ?? ''
const channelId = 'UC8mOjhMBTyPPScCF9vYtwFg'

/** Puts the saved Content list in the jsdom document, as Chrome drew it. */
function loadContentList(): void {
  const page = new DOMParser().parseFromString(fixture, 'text/html')
  document.replaceChild(document.importNode(page.documentElement, true), document.documentElement)
}

const studioList = () => document.querySelector('#video-list')
const studioRows = () => [...document.querySelectorAll('ytcp-video-row')]
const viewsCellOf = (row: Element) => row.querySelector('.tablecell-views')

/** The video id in a row's title link, as Studio wrote it in the page. */
function rowId(row: Element): string {
  const href = row.querySelector('a#video-title')?.getAttribute('href') ?? ''
  return /^\/video\/([\w-]{11})\//.exec(href)?.[1] ?? ''
}

/** Studio shows another video in the row: its title and thumbnail now link that video. */
function pointRowAt(row: Element, id: string): void {
  for (const link of row.querySelectorAll('a#video-title, a#thumbnail-anchor')) {
    link.setAttribute('href', `/video/${id}/edit`)
  }
}

/** Eleven characters, like a YouTube id, unlike any id in the fixture. */
const otherId = (index: number) => `other${String(index).padStart(6, '0')}`

/** Studio shows `count` more rows on the page, copies of its first row linking other videos. */
function addRows(count: number): void {
  const first = studioRows()[0]
  for (let index = 0; index < count; index += 1) {
    const copy = first?.cloneNode(true) as Element
    pointRowAt(copy, otherId(index))
    first?.parentElement?.append(copy)
  }
}

/** What the creator reads in one of the extension's elements. */
function textOf(host: Element | null | undefined): string {
  return [...(host?.shadowRoot?.children ?? [])]
    .filter((node) => node.localName !== 'style')
    .map((node) => node.textContent)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The engaged views pill in one of the extension's elements, and the extension icon it opens with. */
function pillOf(host: Element | null | undefined) {
  const pill = host?.shadowRoot?.querySelector('.pill')
  const icon = host?.shadowRoot?.querySelector('svg[role="img"]')
  return {
    opensWithIcon: !!icon && pill?.firstElementChild === icon,
    icon,
    text: pill?.textContent,
  }
}

/**
 * Hidden from the eye and kept for a screen reader: the clip pattern, which cuts an element to
 * nothing while it stays in the text a screen reader reads.
 */
function clippedAway(node: Element): boolean {
  return getComputedStyle(node).getPropertyValue('clip-path') === 'inset(50%)'
}

/**
 * What the creator sees in one of the extension's elements, in order: "icon" for the extension
 * icon, then each run of text not clipped away. The screen reader hears `textOf` and the icon's name.
 */
function seenIn(host: Element | null | undefined): string[] {
  const seen: string[] = []
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) seen.push(text)
      return
    }
    if (!(node instanceof Element) || node.localName === 'style' || clippedAway(node)) return
    if (node.localName === 'svg') {
      seen.push('icon')
      return
    }
    for (const child of node.childNodes) walk(child)
  }
  for (const child of host?.shadowRoot?.childNodes ?? []) walk(child)
  return seen
}

const hosts = () => [...document.querySelectorAll('[data-stillstats-surface="content_list"]')]
/** The extension's element in a row's views cell. */
const cellHostsOf = (row: Element) => [
  ...(viewsCellOf(row)?.querySelectorAll('[data-stillstats-surface="content_list"]') ?? []),
]
/**
 * Studio's page title, "Channel content": the page header of the Content section, which holds
 * Studio's `h1`.
 */
const pageTitle = () =>
  document.querySelector('ytcp-content-section#video-list > ytcp-entity-page-header')
/**
 * The extension's line under Studio's page title, its next sibling: the day the figures run
 * through, or a line state's line.
 */
const titleLineHost = () => {
  const next = pageTitle()?.nextElementSibling
  return next?.matches('[data-stillstats-surface="content_list"]') ? next : null
}
/** The extension's elements anywhere after Studio's column headings, where the old page line went. */
const afterTableHeader = () =>
  hosts().filter((host) => host.previousElementSibling?.id === 'table-header')
/** The extension's elements for the page, wherever they are: everything not in a row. */
const pageHosts = () => hosts().filter((host) => !host.closest('ytcp-video-row'))
/** What a screen reader hears of the extension's in Studio's table, its heading and its rows. */
const tableText = () =>
  hosts()
    .filter((host) => host.closest('ytcp-video-section-content'))
    .map(textOf)
    .join(' ')
/** Studio's Views column heading. */
const viewsHeading = () =>
  document.querySelector('#table-header [role="columnheader"].tablecell-views')
/** The line of Studio's Views heading that holds its sort control and the word "Views". */
const viewsWordLine = () => viewsHeading()?.querySelector('h3') ?? null
/** Studio's sort control on that line, the button that holds the word "Views". */
const sortControl = () => viewsHeading()?.querySelector('#views-header-name') ?? null
/**
 * The extension's elements anywhere in Studio's Views column heading: for a page with figures, the
 * anchor that draws the pill.
 */
const headingHosts = () => [
  ...(viewsHeading()?.querySelectorAll('[data-stillstats-surface="content_list"]') ?? []),
]
/** What the creator sees of the extension's in Studio's Views heading, in order. */
const seenInHeading = () => headingHosts().flatMap(seenIn)
/** The names a screen reader hears for the icons in one of the extension's elements. */
const iconNamesIn = (host: Element | null | undefined) =>
  [...(host?.shadowRoot?.querySelectorAll('[aria-label]') ?? [])].map((node) =>
    node.getAttribute('aria-label'),
  )
/** Whether `now` holds the very elements `before` held, in order, and not copies Studio drew. */
const sameElements = (now: Element[], before: Element[]) =>
  now.length === before.length && now.every((host, index) => host === before[index])

/** A video the API answers with `engagedViews`. */
function videoOf(id: string, engagedViews: number): VideoRow {
  return {
    id,
    title: id,
    thumbnailUrl: null,
    thumbnails: [],
    durationSeconds: null,
    publishedAt: '2026-10-06T15:00:00Z',
    scheduled: false,
    privacy: 'public',
    format: 'video',
    engagedViews,
    views: engagedViews + 100,
    averageViewPercentage: 41.2,
    subscribersGained: 3,
    estimatedMinutesWatched: 0,
    awaitingProcessing: false,
  }
}

function answerWith(videos: VideoRow[]) {
  const answer: VideoListAnswer = {
    videos,
    window: 'lifetime',
    page: 1,
    pageSize: videos.length,
    pageCount: 1,
    revenue: { refusal: 'consent_missing' },
    lastProcessedDay: '2026-10-07',
    creationDay: null,
    fetchedAt: '2026-10-10T12:00:00Z',
    fromCache: false,
  }
  return { state: 'read', channelId: 'channel-1', answer } satisfies VideosRead
}

/**
 * Row `index` is answered `thousands` thousand plus its index, so each row's figure is its own: with
 * 10, "10,000" for the first row and "10,029" for the thirtieth.
 */
const figureFor = (index: number, thousands: number) => thousands * 1_000 + index
const shownFigureFor = (index: number, thousands = 10) =>
  `${thousands},${String(index).padStart(3, '0')}`

/** The API's answer for the ids asked: each row's figure, by the row's place on the page now. */
function answerForRows(ids: string[], thousands = 10): VideosRead {
  const order = studioRows().map(rowId)
  return answerWith(
    ids.flatMap((id) => {
      const index = order.indexOf(id)
      return index === -1 ? [] : [videoOf(id, figureFor(index, thousands))]
    }),
  )
}

/** `read` as the API answers it from its cache, or not. */
const fromCacheIn = (read: VideosRead, fromCache: boolean): VideosRead =>
  read.state === 'read' ? { ...read, answer: { ...read.answer, fromCache } } : read

/** The API's answer for the ids asked, with the video in row `index` not yet processed by YouTube. */
const answerWaitingAt =
  (index: number) =>
  (ids: string[]): VideosRead => {
    const read = answerForRows(ids)
    if (read.state !== 'read') return read
    const waiting = rowId(studioRows()[index] as Element)
    const videos = read.answer.videos.map((video) =>
      video.id === waiting ? { ...video, awaitingProcessing: true } : video,
    )
    return { ...read, answer: { ...read.answer, videos } }
  }

/** A background answer held open until the test resolves it. */
function heldAnswer() {
  let resolve: (read: VideosRead) => void = () => {}
  const read = new Promise<VideosRead>((done) => {
    resolve = done
  })
  return { read, resolve }
}

let asked: BackgroundRequest[]
let stop: () => void
/** Studio's in-page navigation to `studioUrl`, as WXT reports it to the content script. */
let navigate: () => void
let studioUrl: string

/**
 * Runs the content script's watch on the Content list for `ms`, its background answering each
 * read with what `read(ids)` returns at the time of the request.
 */
async function showListFor(
  ms: number,
  read: (ids: string[]) => VideosRead | Promise<VideosRead>,
  url = fixtureUrl,
): Promise<void> {
  studioUrl = url
  asked = []
  const ask = (async (request: BackgroundRequest) => {
    asked.push(request)
    if (request.type !== 'read-videos') return true
    // The content list asks only for ids.
    return read('ids' in request ? request.ids : [])
  }) as AskBackground
  const watcher = watchPage({
    document,
    url: () => studioUrl,
    surfaces: [contentList({ ask, origin, locale: 'en-GB', lineClicks: lineClicks(ask) })],
    report: reportThrough(ask),
  })
  stop = watcher.stop
  navigate = () => watcher.navigated(studioUrl)
  await vi.advanceTimersByTimeAsync(ms)
}

/** Runs the watch past the give-up time, the background answering `read`, or each row's figure. */
const showList = (
  read: VideosRead | ((ids: string[]) => VideosRead) = (ids) => answerForRows(ids),
) => showListFor(giveUpAfterMs, typeof read === 'function' ? read : () => read)

/**
 * Runs the watch past the give-up time, the background answering the first read with what
 * `first(ids)` returns and holding every later one, as a slow API would hold it, and returns the
 * held answer.
 */
async function showListWithLaterReadsHeld(
  first: (ids: string[]) => VideosRead = answerForRows,
): Promise<ReturnType<typeof heldAnswer>> {
  const held = heldAnswer()
  let reads = 0
  await showListFor(giveUpAfterMs, (ids) => {
    reads += 1
    return reads === 1 ? first(ids) : held.read
  })
  return held
}

/** The content list's reads, each of a page's ids. */
const readsAsked = () =>
  asked.flatMap((request) => (request.type === 'read-videos' && 'ids' in request ? [request] : []))
const eventsAsked = () => eventsIn(asked)
const clicksAsked = () => clicksIn(asked)

beforeEach(() => {
  vi.useFakeTimers()
  loadContentList()
})

afterEach(() => {
  stop()
  vi.useRealTimers()
})

describe('the Content list against the saved Videos tab', () => {
  test("every row's views cell holds that row's own lifetime engaged views in the pill, heard whole, after the extension icon named Stillstats", async () => {
    await showList()

    const rows = studioRows()
    expect(rows).toHaveLength(30)
    rows.forEach((row, index) => {
      const cellHosts = cellHostsOf(row)
      expect(cellHosts).toHaveLength(1)
      const pill = pillOf(cellHosts[0])
      expect(pill.opensWithIcon).toBe(true)
      expect(pill.icon?.getAttribute('aria-label')).toBe('Stillstats')
      expect(pill.icon?.getAttribute('fill')).toBe('currentColor')
      expect(pill.text).toBe(`${shownFigureFor(index)} engaged views`)
      expect(textOf(cellHosts[0])).not.toContain('Stillstats')
    })
  })

  test("a row's views cell shows the icon and the number only, since Studio's Views heading says engaged views", async () => {
    await showList()

    studioRows().forEach((row, index) => {
      expect(seenIn(cellHostsOf(row)[0])).toEqual(['icon', shownFigureFor(index)])
    })
    // The heading keeps the words.
    expect(seenInHeading()).toEqual(expect.arrayContaining(['icon', 'engaged views']))
  })

  // Why these styles: the comment on cellStyle in render.ts.
  test.each([
    ['figure', (ids: string[]) => answerForRows(ids), () => studioRows()],
    ['"Not processed yet"', answerWaitingAt(5), () => [studioRows()[5] as Element]],
  ])(
    "a row's %s takes no width beside Studio's number, draws on a line of its own under it, and never breaks onto two lines",
    async (_, read, rowsShowing) => {
      await showList(read)

      for (const row of rowsShowing()) {
        const host = cellHostsOf(row)[0]
        const hostRule = declaredFor(host, ':host')
        expect(hostRule?.getPropertyValue('inline-size')).toBe('0px')
        expect(hostRule?.getPropertyValue('position')).toBe('relative')
        expect(declaredFor(host, '.cell')?.getPropertyValue('top')).toBe('1lh')

        const figure = host?.shadowRoot?.querySelector('.cell') as Element
        expect(getComputedStyle(figure).getPropertyValue('position')).toBe('absolute')
        expect(getComputedStyle(figure).getPropertyValue('white-space')).toBe('nowrap')
      }
    },
  )

  test("a page with figures shows a line directly under Studio's page title: the icon named Stillstats, then the last processed day, heard once, with no link", async () => {
    await showList()

    const line = titleLineHost()
    expect(line).not.toBeNull()
    // Directly after Studio's title element, a child of the Content section beside it, not inside it.
    expect(pageTitle()?.nextSibling).toBe(line)
    expect(pageTitle()?.querySelectorAll('[data-stillstats-surface]')).toHaveLength(0)
    expect(line?.shadowRoot?.querySelector('svg[role="img"]')).not.toBeNull()
    expect(seenIn(line)).toEqual(['icon', 'Data from Stillstats as of 7 Oct.'])
    expect(iconNamesIn(line)).toEqual(['Stillstats'])
    expect(textOf(line)).toBe('Data from Stillstats as of 7 Oct.')
    expect(line?.shadowRoot?.querySelectorAll('a')).toHaveLength(0)
  })

  test("a page with figures shows the pill, with the icon named Stillstats and the words engaged views, heard once, from one anchor directly after the h3 of Studio's word Views, in Studio's heading cell and nothing inside the h3, and no day anywhere in the table", async () => {
    await showList()

    const line = viewsWordLine() as Element
    const anchors = headingHosts()
    expect(anchors).toHaveLength(1)
    const [anchor] = anchors
    // Directly after Studio's h3, with none of Studio's nodes between: a zero-width item of the
    // heading cell, where the h3's clipping cannot reach it.
    expect(line.nextSibling).toBe(anchor)
    expect(anchor?.parentElement).toBe(viewsHeading())
    expect(line.querySelectorAll('[data-stillstats-surface]')).toHaveLength(0)
    const pill = pillOf(anchor)
    expect(pill.opensWithIcon).toBe(true)
    expect(pill.text).toBe('engaged views')
    expect(seenIn(anchor)).toEqual(['icon', 'engaged views'])
    // A screen reader hears "Stillstats engaged views" once.
    expect(iconNamesIn(anchor)).toEqual(['Stillstats'])
    expect(textOf(anchor)).toBe('engaged views')
    expect(tableText()).not.toContain('Through')
    expect(afterTableHeader()).toEqual([])
  })

  // Why these styles: the comment on headingStyle in render.ts.
  test("the heading's anchor takes no width in Studio's heading cell and declares its own line height; the pill draws out of flow just under Studio's word, ending where the word ends, in a smaller type, breaks no line, and lets a click through to Studio's heading", async () => {
    await showList()

    const [anchor] = headingHosts()
    const hostRule = declaredFor(anchor, ':host')
    expect(hostRule?.getPropertyValue('inline-size')).toBe('0px')
    expect(hostRule?.getPropertyValue('position')).toBe('relative')
    expect(hostRule?.getPropertyValue('pointer-events')).toBe('none')
    // Studio's cell sets its line height to its own 47px, which the shadow text would inherit.
    expect(hostRule?.getPropertyValue('line-height')).toBe('1')
    // The anchor stands at the h3's end, where the word ends, and is the cell's height, so the
    // pill ends there and starts just under the word, centred on the cell's middle.
    const underRule = declaredFor(anchor, '.under')
    expect(underRule?.getPropertyValue('inset-inline-end')).toBe('0px')
    expect(underRule?.getPropertyValue('top')).toBe('calc(50% + 0.5em)')
    expect(underRule?.getPropertyValue('margin-block-start')).toBe('2px')
    const pillRule = declaredFor(anchor, '.under .pill')
    expect(pillRule?.getPropertyValue('line-height')).toBe('1')
    expect(pillRule?.getPropertyValue('font-size')).toBe('0.8em')
    expect(pillRule?.getPropertyValue('padding')).toBe('0.1em 0.45em')

    const under = anchor?.shadowRoot?.querySelector('.under') as Element
    expect(under.querySelector('.pill')).not.toBeNull()
    expect(getComputedStyle(under).getPropertyValue('position')).toBe('absolute')
    expect(getComputedStyle(under).getPropertyValue('white-space')).toBe('nowrap')
    // Nothing the anchor draws takes the click.
    expect(getComputedStyle(under).getPropertyValue('pointer-events')).toBe('none')
    expect(anchor?.shadowRoot?.querySelectorAll('a')).toHaveLength(0)
  })

  test('a page where YouTube has processed none of the videos still shows the pill in the heading and the day under the title', async () => {
    await showList((ids) => {
      const read = answerForRows(ids)
      if (read.state !== 'read') return read
      const videos = read.answer.videos.map((video) => ({ ...video, awaitingProcessing: true }))
      return { ...read, answer: { ...read.answer, videos } }
    })

    for (const row of studioRows()) {
      expect(seenIn(cellHostsOf(row)[0])).toEqual(['icon', 'Not processed yet'])
    }
    expect(seenInHeading()).toEqual(['icon', 'engaged views'])
    expect(seenIn(titleLineHost())).toEqual(['icon', 'Data from Stillstats as of 7 Oct.'])
    expect(afterTableHeader()).toEqual([])
  })

  test("Studio's page stays as it was, and the extension writes only in the views cells, the Views heading and the line under the title, so the pill and the day sit nowhere else", async () => {
    const before = studioList()?.outerHTML
    await showList()

    const inRowsViewsCells = hosts().filter(
      (host) => host.parentElement?.matches('.tablecell-views') && host.closest('ytcp-video-row'),
    )
    const afterWordLine = hosts().filter((host) => host.previousSibling === viewsWordLine())
    expect(inRowsViewsCells).toHaveLength(30)
    expect(afterWordLine).toHaveLength(1)
    expect(titleLineHost()).not.toBeNull()
    expect(hosts()).toHaveLength(32)

    for (const host of hosts()) host.remove()
    expect(studioList()?.outerHTML).toBe(before)
  })

  test('a shown page asks for extension_surface_shown on the Content list, once', async () => {
    await showList()

    expect(eventsAsked()).toEqual([shownOn('content_list', { fromCache: false })])
  })

  test.each([true, false])(
    'a page the background answers 1,200 ms after the pass found it asks for extension_surface_shown with ms 1200 and fromCache %s, once, and no ID',
    async (fromCache) => {
      await showListFor(giveUpAfterMs, async (ids) => {
        await new Promise((land) => setTimeout(land, 1_200))
        return fromCacheIn(answerForRows(ids), fromCache)
      })

      expect(eventsAsked()).toEqual([
        { name: 'extension_surface_shown', surface: 'content_list', ms: 1_200, fromCache },
      ])
    },
  )

  // Where the content script has no Navigation API, WXT polls the URL once a second, so a pass runs
  // on the Content list before WXT reports it.
  test("a cold read a pass ahead of WXT's report started, which the report cut short before it drew, reports the time from that pass and its own cache result, though the navigation's own pass draws from the background's keep at once", async () => {
    let cold = true
    await showListFor(
      0,
      async (ids) => {
        if (!cold) return fromCacheIn(answerForRows(ids), true)
        await new Promise((land) => setTimeout(land, 1_500))
        cold = false
        return answerForRows(ids)
      },
      `https://studio.youtube.com/channel/${channelId}/dashboard`,
    )
    await vi.advanceTimersByTimeAsync(passEveryMs)

    // The URL moves and Studio draws the list; the pass ahead of WXT's report starts at once.
    studioUrl = fixtureUrl
    await passAt(Date.now() + passEveryMs)
    await vi.advanceTimersByTimeAsync(600)
    navigate()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(readsAsked()).toHaveLength(2)
    expect(eventsAsked()).toEqual([
      { name: 'extension_surface_shown', surface: 'content_list', ms: 1_500, fromCache: false },
    ])
  })
})

describe('reads', () => {
  test("the page asks once for every row's video in the URL's channel, over its lifetime, and not again while its rows stand", async () => {
    await showList()
    studioChanges()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(readsAsked()).toEqual([
      {
        type: 'read-videos',
        youtubeChannelId: channelId,
        ids: studioRows().map(rowId).sort(),
        window: 'lifetime',
      },
    ])
    expect(readsAsked()[0]?.ids).toHaveLength(30)
  })

  test('a page of 51 rows asks in two requests, since the API answers at most 50 ids at once', async () => {
    addRows(21)
    await showList()

    const requests = readsAsked()
    expect(requests).toHaveLength(2)
    expect(requests.every(({ ids }) => ids.length <= 50)).toBe(true)
    expect(requests.flatMap(({ ids }) => ids).sort()).toEqual(studioRows().map(rowId).sort())
  })

  test.each([
    ['both from the cache', true, [true, true]],
    ['one read cold', false, [true, false]],
  ])(
    'a page of 51 rows whose two requests are %s is shown with fromCache %s',
    async (_, fromCache, [first, second]) => {
      addRows(21)
      await showList((ids) =>
        fromCacheIn(answerForRows(ids), ids.includes(otherId(0)) ? !!second : !!first),
      )

      expect(readsAsked()).toHaveLength(2)
      expect(eventsAsked()).toEqual([shownOn('content_list', { fromCache })])
    },
  )

  test("a page of 51 rows whose one request is refused still shows the other request's figures", async () => {
    addRows(21)
    let refused: string[] = []
    await showList((ids) => {
      if (!ids.includes(otherId(0))) return answerForRows(ids)
      refused = ids
      return { state: 'refused', refusal: 'quota_reserved' }
    })

    expect(readsAsked()).toHaveLength(2)
    studioRows().forEach((row, index) => {
      if (refused.includes(rowId(row))) expect(cellHostsOf(row)).toEqual([])
      else expect(textOf(cellHostsOf(row)[0])).toContain(shownFigureFor(index))
    })
    expect(eventsAsked()).toEqual([shownOn('content_list', { fromCache: false })])
  })

  test('a row the API does not answer shows nothing, and every other row still shows its figure', async () => {
    const unanswered = rowId(studioRows()[3] as Element)
    await showList((ids) => answerForRows(ids.filter((id) => id !== unanswered)))

    studioRows().forEach((row, index) => {
      if (index === 3) expect(cellHostsOf(row)).toEqual([])
      else expect(textOf(cellHostsOf(row)[0])).toContain(shownFigureFor(index))
    })
    expect(eventsAsked()).toEqual([shownOn('content_list', { fromCache: false })])
  })

  test('a page Studio fills with other videos asks for them and shows their figures', async () => {
    const firstPage = new Set(studioRows().map(rowId))
    await showList((ids) => answerForRows(ids, ids.some((id) => firstPage.has(id)) ? 10 : 20))
    studioRows().forEach((row, index) => {
      pointRowAt(row, otherId(index))
    })
    await vi.advanceTimersByTimeAsync(1_000)

    expect(readsAsked()).toHaveLength(2)
    expect(readsAsked()[1]?.ids).toEqual(studioRows().map(rowId).sort())
    studioRows().forEach((row, index) => {
      expect(cellHostsOf(row)).toHaveLength(1)
      expect(textOf(cellHostsOf(row)[0])).toContain(shownFigureFor(index, 20))
    })
  })

  test('a row Studio points at another video loses its figure at once, while the background answers for the new one', async () => {
    const secondPage = heldAnswer()
    await showListFor(giveUpAfterMs, (ids) =>
      ids.includes(otherId(0)) ? secondPage.read : answerForRows(ids),
    )
    pointRowAt(studioRows()[0] as Element, otherId(0))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(readsAsked()).toHaveLength(2)
    expect(cellHostsOf(studioRows()[0] as Element)).toEqual([])
    expect(textOf(cellHostsOf(studioRows()[1] as Element)[0])).toContain(shownFigureFor(1))
    secondPage.resolve(answerForRows([]))
  })

  test('a row Studio points at another video while a read is in flight loses its figure at once', async () => {
    const secondPage = heldAnswer()
    await showListFor(giveUpAfterMs, (ids) =>
      ids.includes(otherId(0)) ? secondPage.read : answerForRows(ids),
    )
    const [first, second] = studioRows() as [Element, Element]
    pointRowAt(first, otherId(0))
    await vi.advanceTimersByTimeAsync(1_000)
    expect(textOf(cellHostsOf(second)[0])).toContain(shownFigureFor(1))

    // Studio repoints a second row while the read for the first one is still out.
    pointRowAt(second, otherId(1))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(readsAsked()).toHaveLength(2)
    expect(cellHostsOf(second)).toEqual([])
    secondPage.resolve(answerForRows([]))
  })

  test('an answer that arrives after Studio showed other videos in the rows lands on none of them', async () => {
    const firstPage = heldAnswer()
    const secondPage = heldAnswer()
    const firstIds = new Set(studioRows().map(rowId))
    await showListFor(1_000, (ids) =>
      ids.some((id) => firstIds.has(id)) ? firstPage.read : secondPage.read,
    )
    const firstOrder = studioRows().map(rowId)
    studioRows().forEach((row, index) => {
      pointRowAt(row, otherId(index))
    })
    firstPage.resolve(answerWith(firstOrder.map((id, index) => videoOf(id, figureFor(index, 10)))))
    // The held request's own pass ends here, before Studio's changes run the next one.
    await vi.advanceTimersByTimeAsync(0)
    for (const row of studioRows()) expect(cellHostsOf(row)).toEqual([])

    await vi.advanceTimersByTimeAsync(1_000)
    expect(readsAsked()).toHaveLength(2)
    secondPage.resolve(answerForRows(studioRows().map(rowId), 20))
    await vi.advanceTimersByTimeAsync(1_000)
    studioRows().forEach((row, index) => {
      expect(cellHostsOf(row)).toHaveLength(1)
      expect(textOf(cellHostsOf(row)[0])).toContain(shownFigureFor(index, 20))
    })
  })

  test("rows Studio points at other videos and back before the answer lands show the answer's figures, with no second request", async () => {
    const firstPage = heldAnswer()
    await showListFor(1_000, () => firstPage.read)
    const firstOrder = studioRows().map(rowId)
    studioRows().forEach((row, index) => {
      pointRowAt(row, otherId(index))
    })
    await vi.advanceTimersByTimeAsync(1_000)
    studioRows().forEach((row, index) => {
      pointRowAt(row, firstOrder[index] as string)
    })
    await vi.advanceTimersByTimeAsync(1_000)
    firstPage.resolve(answerWith(firstOrder.map((id, index) => videoOf(id, figureFor(index, 10)))))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(readsAsked()).toHaveLength(1)
    studioRows().forEach((row, index) => {
      expect(cellHostsOf(row)).toHaveLength(1)
      expect(textOf(cellHostsOf(row)[0])).toContain(shownFigureFor(index))
    })
  })

  test("rows Studio reorders within one navigation while the background answers each show their own video's figure", async () => {
    const firstPage = heldAnswer()
    await showListFor(1_000, () => firstPage.read)
    const firstOrder = studioRows().map(rowId)
    const last = firstOrder.length - 1
    studioRows().forEach((row, index) => {
      pointRowAt(row, firstOrder[last - index] as string)
    })
    firstPage.resolve(answerWith(firstOrder.map((id, index) => videoOf(id, figureFor(index, 10)))))
    const eachRowShowsItsOwn = () => {
      studioRows().forEach((row, index) => {
        expect(cellHostsOf(row)).toHaveLength(1)
        expect(textOf(cellHostsOf(row)[0])).toContain(shownFigureFor(last - index))
      })
    }
    // The held request's own pass ends here, before Studio's changes run the next one.
    await vi.advanceTimersByTimeAsync(0)
    eachRowShowsItsOwn()

    await vi.advanceTimersByTimeAsync(1_000)
    expect(readsAsked()).toHaveLength(1)
    eachRowShowsItsOwn()
  })

  test('an answer that lands while Studio shows other videos, which then shows the first videos again, counts the page as shown once their figures show', async () => {
    const firstPage = heldAnswer()
    await showListFor(1_000, () => firstPage.read)
    const firstOrder = studioRows().map(rowId)
    studioRows().forEach((row, index) => {
      pointRowAt(row, otherId(index))
    })
    // Studio goes back to the first videos just after their answer lands on rows showing others.
    const studioGoesBack = new MutationObserver((records) => {
      const placed = records.some(({ addedNodes }) =>
        [...addedNodes].some(
          (node) => node instanceof Element && node.matches('[data-stillstats-surface]'),
        ),
      )
      if (!placed) return
      studioGoesBack.disconnect()
      studioRows().forEach((row, index) => {
        pointRowAt(row, firstOrder[index] as string)
      })
    })
    studioGoesBack.observe(document, { childList: true, subtree: true })
    firstPage.resolve(answerWith(firstOrder.map((id, index) => videoOf(id, figureFor(index, 10)))))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(readsAsked()).toHaveLength(1)
    studioRows().forEach((row, index) => {
      expect(textOf(cellHostsOf(row)[0])).toContain(shownFigureFor(index))
    })
    expect(eventsAsked()).toEqual([shownOn('content_list', { fromCache: false })])
  })

  test('a creator who leaves the Content list and comes back to the same rows has them read again once Studio has had the give-up time to draw them', async () => {
    await showList()
    studioUrl = `https://studio.youtube.com/channel/${channelId}/dashboard`
    navigate()
    await vi.advanceTimersByTimeAsync(1_000)
    studioUrl = fixtureUrl
    navigate()
    // The rows Studio kept stand as answered: they may yet be redrawn for the navigation.
    await vi.advanceTimersByTimeAsync(1_000)
    expect(readsAsked()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(readsAsked()).toHaveLength(2)
    expect(readsAsked()[1]?.ids).toEqual(studioRows().map(rowId).sort())
  })

  test('a creator back on the same rows who leaves again in the last second before the give-up, before WXT reports it, is not reported missing while every row shows its figure', async () => {
    const dashboard = `https://studio.youtube.com/channel/${channelId}/dashboard`
    await showList()
    studioUrl = dashboard
    navigate()
    await vi.advanceTimersByTimeAsync(1_000)
    studioUrl = fixtureUrl
    navigate()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs - 500)
    // The URL moves on; WXT's location poll reports it only after the give-up has run.
    studioUrl = dashboard
    await vi.advanceTimersByTimeAsync(1_000)

    expect(eventsAsked()).toEqual([shownOn('content_list', { fromCache: false })])
    studioRows().forEach((row, index) => {
      expect(cellHostsOf(row)).toHaveLength(1)
      expect(textOf(cellHostsOf(row)[0])).toContain(shownFigureFor(index))
    })
  })

  test('a Content list Studio draws before WXT reports the move, which the creator leaves before the give-up, is reported shown', async () => {
    const dashboard = `https://studio.youtube.com/channel/${channelId}/dashboard`
    await showListFor(1_000, (ids) => answerForRows(ids), dashboard)
    // The URL moves to the Content list and Studio draws it; WXT's location poll reports it later.
    studioUrl = fixtureUrl
    studioChanges()
    await vi.advanceTimersByTimeAsync(500)
    navigate()
    await vi.advanceTimersByTimeAsync(2_000)
    studioUrl = dashboard
    navigate()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs + 1_000)

    expect(eventsAsked()).toEqual([shownOn('content_list', { fromCache: false })])
  })

  test('rows that stand as answered are read again once the give-up time passes, though the system clock steps back during the navigation', async () => {
    await showList()
    studioUrl = `https://studio.youtube.com/channel/${channelId}/dashboard`
    navigate()
    await vi.advanceTimersByTimeAsync(1_000)
    studioUrl = fixtureUrl
    navigate()
    await vi.advanceTimersByTimeAsync(1_000)
    // The operating system corrects its clock back a minute, as an NTP step does.
    vi.setSystemTime(Date.now() - 60_000)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(readsAsked()).toHaveLength(2)
  })

  // On WXT's poll path (no Navigation API), which reports the URL once a second. The test lets an
  // hour and ten minutes pass on that poll: some 4,300 timers, each followed by a turn of the event
  // loop, and a pass over the saved page each minute. That is real work, about 0.6 s of CPU alone,
  // which a loaded full run stretched past vitest's 5 s default, so its timeout is its own.
  test.for([
    ['0.6 s, between two of its polls, so WXT never reports it', 600],
    ['1.4 s, across one of its polls', 1_400],
  ] as const)(
    'a list visit of %s, then a return to the same videos 10 minutes later, reads the rows again and shows the new figures for the hour the creator stays',
    { timeout: 30_000 },
    async ([, visitMs], { signal }) => {
      const advance = advanceWhileRunning(signal)
      const dashboard = `https://studio.youtube.com/channel/${channelId}/dashboard`
      history.replaceState(null, '', dashboard)
      asked = []
      let reads = 0
      // Read n answers every row n times 10,000.
      const ask = (async (request: BackgroundRequest) => {
        asked.push(request)
        if (request.type !== 'read-videos') return true
        reads += 1
        return answerForRows('ids' in request ? request.ids : [], reads * 10)
      }) as AskBackground
      const wxt = await watchThroughWxt({
        navigationApi: false,
        surfaces: [contentList({ ask, origin, locale: 'en-GB', lineClicks: lineClicks(ask) })],
        report: reportThrough(ask),
      })
      stop = wxt.stop
      await advance(6_100)

      wxt.moveTo(fixtureUrl)
      studioChanges()
      await advance(visitMs)
      wxt.moveTo(dashboard)
      studioChanges()
      await advance(10 * 60_000)
      expect(readsAsked()).toHaveLength(1)

      // Studio draws the list afresh, on the same videos.
      loadContentList()
      wxt.moveTo(fixtureUrl)
      for (let minute = 0; minute < 60; minute += 1) {
        studioChanges()
        await advance(60_000)
      }

      expect(readsAsked()).toHaveLength(2)
      studioRows().forEach((row, index) => {
        expect(textOf(cellHostsOf(row)[0])).toContain(shownFigureFor(index, 20))
      })
    },
  )

  // Under the Navigation API, which WXT reports from `navigate` before the URL moves. Whether Studio
  // fires a navigate that never commits is a creator-analytics#99 check.
  test('a navigate away from the Content list that never commits reads the list no second time', async () => {
    history.replaceState(null, '', fixtureUrl)
    asked = []
    const ask = (async (request: BackgroundRequest) => {
      asked.push(request)
      return request.type === 'read-videos' ? ({ state: 'failed' } as const) : true
    }) as AskBackground
    const wxt = await watchThroughWxt({
      navigationApi: true,
      surfaces: [contentList({ ask, origin, locale: 'en-GB', lineClicks: lineClicks(ask) })],
      report: reportThrough(ask),
    })
    stop = wxt.stop
    await studioKeepsChangingFor(giveUpAfterMs + 1_000)
    expect(readsAsked()).toHaveLength(1)

    wxt.navigateEvent(`https://studio.youtube.com/channel/${channelId}/comments`)
    await studioKeepsChangingFor(giveUpAfterMs + 2_000)

    expect(location.href).toBe(fixtureUrl)
    expect(readsAsked()).toHaveLength(1)
  })

  test('a navigation to a tab Studio draws empty, after the outgoing rows stood for a pass, is reported missing and not shown, and keeps nothing from the tab before', async () => {
    await showList()
    studioUrl = `https://studio.youtube.com/channel/${channelId}/videos/live`
    navigate()
    // A pass runs on the new URL while Studio still shows the outgoing tab's rows.
    await vi.advanceTimersByTimeAsync(300)
    for (const row of studioRows()) row.remove()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(eventsAsked()).toEqual([
      shownOn('content_list', { fromCache: false }),
      { name: 'extension_surface_missing', surface: 'content_list' },
    ])
    // Studio keeps the list and its column headings on a tab with no uploads.
    expect(document.querySelector('#table-header')).not.toBeNull()
    expect(hosts()).toEqual([])
  })

  test("a re-sort of the same rows reads them again, and each row shows its own video's figure", async () => {
    await showList()
    const order = studioRows().map(rowId)
    studioUrl = fixtureUrl.replace('DESCENDING', 'ASCENDING')
    navigate()
    studioRows().forEach((row, index) => {
      pointRowAt(row, order[order.length - 1 - index] as string)
    })
    await vi.advanceTimersByTimeAsync(1_000)

    expect(readsAsked()).toHaveLength(2)
    expect(readsAsked()[1]?.ids).toEqual([...order].sort())
    studioRows().forEach((row, index) => {
      expect(cellHostsOf(row)).toHaveLength(1)
      expect(textOf(cellHostsOf(row)[0])).toContain(shownFigureFor(index))
    })
  })

  test("a navigation Studio draws only after the list's next pass shows no outgoing video's figure while the background answers for the incoming ones", async () => {
    const later = await showListWithLaterReadsHeld()
    studioUrl = fixtureUrl.replace('DESCENDING', 'ASCENDING')
    navigate()
    // A pass runs on the new URL before Studio has drawn the rows it shows.
    await vi.advanceTimersByTimeAsync(300)
    studioRows().forEach((row, index) => {
      pointRowAt(row, otherId(index))
    })
    await vi.advanceTimersByTimeAsync(1_000)

    for (const row of studioRows()) expect(cellHostsOf(row)).toEqual([])
    later.resolve(answerForRows(studioRows().map(rowId), 20))
    await vi.advanceTimersByTimeAsync(1_000)
    studioRows().forEach((row, index) => {
      expect(textOf(cellHostsOf(row)[0])).toContain(shownFigureFor(index, 20))
    })
  })

  test('a navigation to another page of rows asks for that page alone, not again for the page it left', async () => {
    const order = studioRows().map(rowId)
    await showList()
    studioUrl = fixtureUrl.replace('DESCENDING', 'ASCENDING')
    navigate()
    // A pass runs on the new URL before Studio has drawn the rows it shows.
    await vi.advanceTimersByTimeAsync(300)
    studioRows().forEach((row, index) => {
      pointRowAt(row, otherId(index))
    })
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(readsAsked().map(({ ids }) => ids)).toEqual([
      [...order].sort(),
      studioRows().map(rowId).sort(),
    ])
  })

  test('a Studio redraw of one row leaves one figure in its views cell', async () => {
    await showList()
    const row = studioRows()[2] as Element
    const redrawn = row.cloneNode(true) as Element
    row.replaceWith(redrawn)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(cellHostsOf(redrawn)).toHaveLength(1)
    expect(textOf(cellHostsOf(redrawn)[0])).toContain(shownFigureFor(2))
    expect(readsAsked()).toHaveLength(1)
  })

  test("a Studio redraw of the Views heading leaves one pill's anchor in it, after its h3, and asks for nothing again", async () => {
    await showList()
    const heading = viewsHeading() as Element
    const redrawn = heading.cloneNode(true) as Element
    heading.replaceWith(redrawn)
    await vi.advanceTimersByTimeAsync(1_000)

    const anchors = [...redrawn.querySelectorAll('[data-stillstats-surface="content_list"]')]
    const line = redrawn.querySelector('h3') as Element
    expect(sameElements(anchors, [line.nextSibling] as Element[])).toBe(true)
    expect(anchors.flatMap(seenIn)).toEqual(['icon', 'engaged views'])
    expect(readsAsked()).toHaveLength(1)
  })

  test("a Studio redraw of its page title that leaves a copy of the extension's line leaves one line under the title, and asks for nothing again", async () => {
    await showList()
    const title = pageTitle() as Element
    const line = titleLineHost() as Element
    // Studio's copy of the line carries the extension's element, with nothing in it.
    const redrawn = title.cloneNode(true) as Element
    title.replaceWith(redrawn)
    line.replaceWith(line.cloneNode(true))
    await vi.advanceTimersByTimeAsync(1_000)

    const beside = [...(redrawn.parentElement?.children ?? [])].filter((node) =>
      node.matches('[data-stillstats-surface="content_list"]'),
    )
    expect(beside).toHaveLength(1)
    expect(redrawn.nextSibling).toBe(beside[0])
    expect(seenIn(beside[0])).toEqual(['icon', 'Data from Stillstats as of 7 Oct.'])
    expect(readsAsked()).toHaveLength(1)
  })

  test("a Studio redraw of the Views heading while a re-read is out, which lands on a line state, leaves no copy of the pill in Studio's heading", async () => {
    const reRead = await showListWithLaterReadsHeld()
    // A re-sort Studio draws on the same rows: they are read again once the navigation settles.
    studioUrl = fixtureUrl.replace('DESCENDING', 'ASCENDING')
    navigate()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)
    expect(readsAsked()).toHaveLength(2)

    // Studio's copy of its heading carries the extension's element, with nothing in it.
    const heading = viewsHeading() as Element
    heading.replaceWith(heading.cloneNode(true))
    reRead.resolve({ state: 'signed-out' })
    await vi.advanceTimersByTimeAsync(0)

    expect(textOf(titleLineHost())).toContain('Sign in at stillstats.com')
    expect(hosts()).toEqual([titleLineHost()])
  })
})

// Limits: whether real Studio takes its rows away, or strips their links, while it redraws them is a
// creator-analytics#99 check, and so is what Studio's Playlists tab puts in place of the Videos tab
// page, which these tests stand in for with an element of their own.
describe("when the Content list's page elements, the line under the title and the pill in the Views heading, come down", () => {
  /** Studio takes every row away, and the returned call puts the same rows back. */
  function takeRowsAway(): () => void {
    const rows = studioRows()
    const parent = rows[0]?.parentElement
    for (const row of rows) row.remove()
    return () => parent?.append(...rows)
  }

  /** Studio strips every row's title link, and the returned call puts the same links back. */
  function stripRowLinks(): () => void {
    const links = studioRows().flatMap((row) => [...row.querySelectorAll('a#video-title')])
    const hrefs = links.map((link) => link.getAttribute('href') ?? '')
    for (const link of links) link.removeAttribute('href')
    return () => {
      links.forEach((link, index) => {
        link.setAttribute('href', hrefs[index] as string)
      })
    }
  }

  test.each([
    ['takes away', takeRowsAway],
    ['strips the links of', stripRowLinks],
  ])(
    'rows Studio %s for longer than a pass while it redraws them keep the line under the title and the pill in the Views heading up, with no second read',
    async (_, redraw) => {
      await showList()
      const shown = pageHosts()
      expect(shown).toHaveLength(2)

      const restore = redraw()
      await vi.advanceTimersByTimeAsync(300)
      expect(document.querySelector('#table-header')).not.toBeNull()
      expect(sameElements(pageHosts(), shown)).toBe(true)

      restore()
      await vi.advanceTimersByTimeAsync(300)
      expect(sameElements(pageHosts(), shown)).toBe(true)
      expect(readsAsked()).toHaveLength(1)
      expect(eventsAsked()).toEqual([shownOn('content_list', { fromCache: false })])
    },
  )

  test('rows Studio takes away for longer than a pass, while the settled re-read of those same rows is out, keep the line under the title and the pill in the Views heading up', async () => {
    const reRead = await showListWithLaterReadsHeld()
    const shown = pageHosts()
    expect(shown).toHaveLength(2)
    // A re-sort Studio draws on the same rows: they are read again once the navigation settles.
    studioUrl = fixtureUrl.replace('DESCENDING', 'ASCENDING')
    navigate()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)
    expect(readsAsked()).toHaveLength(2)

    const restore = takeRowsAway()
    await vi.advanceTimersByTimeAsync(300)
    expect(document.querySelector('#table-header')).not.toBeNull()
    expect(sameElements(pageHosts(), shown)).toBe(true)

    restore()
    await vi.advanceTimersByTimeAsync(300)
    expect(sameElements(pageHosts(), shown)).toBe(true)
    reRead.resolve(answerForRows(studioRows().map(rowId)))
  })

  test('a video list Studio takes away for one pass, while the settled re-read of those same rows is out, keeps the line under the title and the pill in the Views heading up', async () => {
    const reRead = await showListWithLaterReadsHeld()
    const shown = pageHosts()
    expect(shown).toHaveLength(2)
    // A re-sort Studio draws on the same rows: they are read again once the navigation settles.
    studioUrl = fixtureUrl.replace('DESCENDING', 'ASCENDING')
    navigate()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)
    expect(readsAsked()).toHaveLength(2)

    // Studio takes its video list away for one pass and puts the same list back.
    const list = document.querySelector('ytcp-video-section-content#video-list') as Element
    const parent = list.parentElement as Element
    const next = list.nextSibling
    list.remove()
    await vi.advanceTimersByTimeAsync(300)
    parent.insertBefore(list, next)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(sameElements(pageHosts(), shown)).toBe(true)
    reRead.resolve(answerForRows(studioRows().map(rowId)))
  })

  test('rows Studio takes away at once on a settled list, with no navigation and no change after it, take the line and the pill down by the second pass', async () => {
    await showList()
    expect(pageHosts()).toHaveLength(2)

    takeRowsAway()
    await vi.advanceTimersByTimeAsync(2 * passEveryMs)
    expect(document.querySelector('#table-header')).not.toBeNull()
    expect(pageHosts()).toEqual([])
    expect(readsAsked()).toHaveLength(1)
  })

  test('a tab Studio draws with no rows, opened while the read of another page is out, keeps no line or pill from the page before', async () => {
    const secondPage = heldAnswer()
    await showListFor(giveUpAfterMs, (ids) =>
      ids.includes(otherId(0)) ? secondPage.read : answerForRows(ids),
    )
    expect(textOf(titleLineHost())).toContain('as of 7 Oct')
    // The creator pages: Studio shows other videos in the rows, and their read stays out.
    studioRows().forEach((row, index) => {
      pointRowAt(row, otherId(index))
    })
    await vi.advanceTimersByTimeAsync(300)
    expect(readsAsked()).toHaveLength(2)

    studioUrl = `https://studio.youtube.com/channel/${channelId}/videos/live`
    navigate()
    for (const row of studioRows()) row.remove()
    await vi.advanceTimersByTimeAsync(passEveryMs)
    expect(document.querySelector('#table-header')).not.toBeNull()
    expect(pageHosts()).toEqual([])

    await vi.advanceTimersByTimeAsync(14_999 - passEveryMs)
    expect(pageHosts()).toEqual([])
    secondPage.resolve(answerForRows([]))
  })

  function takeTabPageAway(): () => void {
    const tabPage = document.querySelector('ytcp-video-section') as Element
    const other = document.createElement('ytcp-playlist-section')
    tabPage.replaceWith(other)
    return () => other.replaceWith(tabPage)
  }

  test.each([
    ['a move to the Playlists tab', '/videos/playlists'],
    ['Studio taking the Videos tab page away on the same page', undefined],
  ])(
    'after %s, which shows no video list, nothing of the extension stays, not even the line under the title',
    async (_, tabPath) => {
      await showList()
      expect(textOf(titleLineHost())).toContain('as of 7 Oct')

      if (tabPath) {
        studioUrl = fixtureUrl.replace(/\/videos\/upload.*$/, tabPath)
        navigate()
      }
      takeTabPageAway()
      await vi.advanceTimersByTimeAsync(giveUpAfterMs)

      expect(hosts()).toEqual([])
    },
  )

  test('a move to the Collabs tab, whose list Studio draws with rows of other ids, leaves no line under the title and no pill', async () => {
    await showList()
    expect(textOf(titleLineHost())).toContain('as of 7 Oct')

    studioUrl = fixtureUrl.replace(/\/videos\/upload.*$/, '/videos/collabs')
    navigate()
    for (const [index, row] of studioRows().entries()) pointRowAt(row, otherId(index))
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(hosts()).toEqual([])
  })

  test('a reported move to the Collabs tab while a read is out takes the line under the title and the pill down before the read answers', async () => {
    const held = await showListWithLaterReadsHeld()
    expect(textOf(titleLineHost())).toContain('as of 7 Oct')
    // Studio shows other videos in the rows, so a second read goes out and is held.
    for (const [index, row] of studioRows().entries()) pointRowAt(row, otherId(index))
    await vi.advanceTimersByTimeAsync(1_000)
    expect(readsAsked()).toHaveLength(2)

    studioUrl = fixtureUrl.replace(/\/videos\/upload.*$/, '/videos/collabs')
    navigate()
    for (const [index, row] of studioRows().entries()) pointRowAt(row, otherId(index + 100))
    await vi.advanceTimersByTimeAsync(3_000)

    const hostsWhileOut = hosts()
    held.resolve(answerWith([]))
    expect(hostsWhileOut).toEqual([])
  })

  test('a return from the Collabs tab to the Videos tab shows the line under the title, the pill and every row figure again', async () => {
    await showList()
    const ids = studioRows().map(rowId)
    studioUrl = fixtureUrl.replace(/\/videos\/upload.*$/, '/videos/collabs')
    navigate()
    for (const [index, row] of studioRows().entries()) pointRowAt(row, otherId(index))
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)
    expect(hosts()).toEqual([])

    studioUrl = fixtureUrl
    navigate()
    for (const [index, row] of studioRows().entries()) pointRowAt(row, ids[index] as string)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(textOf(titleLineHost())).toContain('as of 7 Oct')
    expect(headingHosts()).toHaveLength(1)
    for (const [index, row] of studioRows().entries()) {
      expect(textOf(cellHostsOf(row)[0])).toContain(shownFigureFor(index))
    }
  })

  test('the Videos tab page Studio puts back on the same page shows the line under the title again, with no second read', async () => {
    await showList()
    expect(textOf(titleLineHost())).toContain('as of 7 Oct')

    const putBack = takeTabPageAway()
    await vi.advanceTimersByTimeAsync(2 * passEveryMs)

    putBack()
    await vi.advanceTimersByTimeAsync(2 * passEveryMs)
    expect(textOf(titleLineHost())).toContain('as of 7 Oct')
    expect(pageHosts()).toHaveLength(2)
    expect(readsAsked()).toHaveLength(1)
  })
})

describe('a same-key re-read out while Studio empties the list', () => {
  test('a tab Studio draws with no rows, opened while the settled re-read of the answered rows is out, keeps no line or pill from the page before', async () => {
    const reRead = await showListWithLaterReadsHeld()
    expect(textOf(titleLineHost())).toContain('as of 7 Oct')
    // A re-sort Studio draws on the same rows: they are read again once the navigation settles.
    studioUrl = fixtureUrl.replace('DESCENDING', 'ASCENDING')
    navigate()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)
    expect(readsAsked()).toHaveLength(2)

    studioUrl = `https://studio.youtube.com/channel/${channelId}/videos/live`
    navigate()
    for (const row of studioRows()) row.remove()
    await vi.advanceTimersByTimeAsync(2 * passEveryMs)
    const headerWhileOut = document.querySelector('#table-header')
    const pageHostsWhileOut = pageHosts()
    reRead.resolve(answerForRows([]))
    expect(headerWhileOut).not.toBeNull()
    expect(pageHostsWhileOut).toEqual([])
  })

  test('a tab Studio draws with no rows, opened while the keep-time re-read of the answered rows is out, keeps no page line from the page before', async () => {
    const reRead = await showListWithLaterReadsHeld(() => ({ state: 'signed-out' }))
    expect(textOf(titleLineHost())).toContain('Sign in')
    // The line's keep time passes and Studio changes the page: the same rows are read again.
    await readAgain()
    expect(readsAsked()).toHaveLength(2)

    studioUrl = `https://studio.youtube.com/channel/${channelId}/videos/live`
    navigate()
    for (const row of studioRows()) row.remove()
    await vi.advanceTimersByTimeAsync(2 * passEveryMs)
    const headerWhileOut = document.querySelector('#table-header')
    const lineWhileOut = pageHosts()
    reRead.resolve({ state: 'signed-out' })
    expect(headerWhileOut).not.toBeNull()
    expect(lineWhileOut).toEqual([])
  })
})

describe('once the extension stops in an open Studio tab, as an update or a disable stops it', () => {
  test('no figure stays in Studio, so a row Studio then points at another video shows none', async () => {
    await showList()
    const row = studioRows()[0] as Element
    expect(textOf(cellHostsOf(row)[0])).toContain(shownFigureFor(0))

    stop()
    pointRowAt(row, otherId(0))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(document.querySelectorAll('[data-stillstats-surface]')).toHaveLength(0)
  })

  test('a pass Studio queued behind a read in flight draws nothing once the stop has come', async () => {
    const page = heldAnswer()
    await showListFor(1_000, () => page.read)
    document.body.append(document.createElement('div'))
    await vi.advanceTimersByTimeAsync(1_000)

    stop()
    page.resolve(answerForRows(studioRows().map(rowId)))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(document.querySelectorAll('[data-stillstats-surface]')).toHaveLength(0)
  })

  test('a read the background answers only after the stop draws nothing', async () => {
    const page = heldAnswer()
    await showListFor(1_000, () => page.read)

    stop()
    page.resolve(answerForRows(studioRows().map(rowId)))
    await vi.advanceTimersByTimeAsync(1_000)

    expect(document.querySelectorAll('[data-stillstats-surface]')).toHaveLength(0)
  })
})

describe('the shared states on the Content list', () => {
  test('a video YouTube has not processed shows the icon and "Not processed yet" in its row, and the others show their figures', async () => {
    await showList(answerWaitingAt(5))

    studioRows().forEach((row, index) => {
      const text = textOf(cellHostsOf(row)[0])
      if (index === 5) {
        expect(text).toContain('Not processed yet')
        expect(pillOf(cellHostsOf(row)[0])).toMatchObject({
          opensWithIcon: true,
          text: 'engaged views',
        })
        // Seen without the words; heard whole.
        expect(seenIn(cellHostsOf(row)[0])).toEqual(['icon', 'Not processed yet'])
      } else expect(text).toContain(shownFigureFor(index))
    })
    expect(eventsAsked()).toEqual([shownOn('content_list', { fromCache: false })])
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
    ['a failed read', { state: 'failed' }, 'Try again later'],
  ] satisfies [string, VideosRead, string][])(
    "%s shows its line once for the page, after the icon in the line under Studio's page title and nowhere after Studio's column headings, with no pill in the Views heading, no figure in any row, and is not counted as shown",
    async (_, read, line) => {
      await showList(read)

      expect(seenIn(titleLineHost())[0]).toBe('icon')
      expect(textOf(titleLineHost())).toContain(line)
      expect(afterTableHeader()).toEqual([])
      expect(headingHosts()).toEqual([])
      expect(hosts()).toEqual([titleLineHost()])
      // Every figure and day the list shows has a digit, and no line has one.
      expect(textOf(titleLineHost())).not.toMatch(/\d/)
      expect(eventsAsked()).toEqual([])
    },
  )

  test("with host access to stillstats.com withheld, the line under Studio's page title is the icon and the access line alone, with no link, no pill in the Views heading and no figure in any row, and is not counted as shown", async () => {
    await showList({ state: 'host-access-withheld' })

    expect(seenIn(titleLineHost())).toEqual(['icon', 'Allow access to stillstats.com'])
    expect(titleLineHost()?.shadowRoot?.querySelectorAll('a')).toHaveLength(0)
    expect(headingHosts()).toEqual([])
    expect(hosts()).toEqual([titleLineHost()])
    expect(eventsAsked()).toEqual([])
  })

  // The keep is timed from when the read lands, so a read the background answers late is kept
  // from its landing, not from its ask.
  test.each([
    [0, 29_999, 1, 'Sign in at stillstats.com', []],
    [0, 30_000, 2, 'Data from Stillstats as of 7 Oct.', [`${shownFigureFor(0)} engaged views`]],
    [100, 29_999, 1, 'Sign in at stillstats.com', []],
    [100, 30_000, 2, 'Data from Stillstats as of 7 Oct.', [`${shownFigureFor(0)} engaged views`]],
  ] satisfies [number, number, number, string, string[]][])(
    'with a read that lands %i ms after its ask, the pass %i ms after the sign-in line shows makes %i reads in all, shows "%s" for the page and %j in the first row: a line is kept 30 seconds, so a creator who signs in from it in another tab sees the figures back in Studio',
    async (landsAfterMs, sinceLine, reads, shown, firstRow) => {
      let read: VideosRead = { state: 'signed-out' }
      let landedAt: number | undefined
      await showListFor(giveUpAfterMs, async (ids) => {
        if (landsAfterMs > 0) await new Promise((land) => setTimeout(land, landsAfterMs))
        landedAt ??= Date.now()
        return read.state === 'read' ? answerForRows(ids) : read
      })
      expect(textOf(titleLineHost())).toContain('Sign in at stillstats.com')

      read = answerForRows([])
      await passAt((landedAt ?? 0) + sinceLine)
      // The pass's read lands too.
      await vi.advanceTimersByTimeAsync(landsAfterMs)

      expect(readsAsked()).toHaveLength(reads)
      // The line and the day both show in the line under Studio's page title, one in the other's
      // place, and the pill shows in Studio's Views heading only with the figures.
      expect(textOf(titleLineHost())).toBe(shown)
      expect(headingHosts()).toHaveLength(firstRow.length)
      expect(hosts().filter((host) => host === titleLineHost())).toHaveLength(1)
      expect(cellHostsOf(studioRows()[0] as Element).map((host) => pillOf(host).text)).toEqual(
        firstRow,
      )
    },
  )

  test('a list whose background request is rejected shows "Try again later", is not reported missing, and is not asked for again on every pass', async () => {
    await showListFor(giveUpAfterMs, () => {
      throw new Error('Could not establish connection. Receiving end does not exist.')
    })
    studioChanges()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(textOf(titleLineHost())).toContain('Try again later')
    expect(eventsAsked()).toEqual([])
    expect(readsAsked()).toHaveLength(1)
  })

  test.each([
    ['the list', () => studioList()?.remove()],
    // The line that says the day the figures run through, or a line state's line, stands under it.
    ['a page title', () => pageTitle()?.remove()],
    // A figure with no pill near it says nothing of what it counts.
    ['a Views column heading', () => viewsHeading()?.remove()],
    [
      'every row',
      () => {
        for (const row of studioRows()) row.remove()
      },
    ],
  ])(
    'a page without %s shows nothing and asks for extension_surface_missing once the give-up time passes',
    async (_, removeFromStudio) => {
      removeFromStudio()
      await showList()

      expect(hosts()).toEqual([])
      expect(readsAsked()).toEqual([])
      expect(eventsAsked()).toEqual([
        { name: 'extension_surface_missing', surface: 'content_list' },
      ])
    },
  )

  // The pill's anchor stands after the line that holds Studio's word "Views": with none, it has
  // nowhere to go, so a page with figures shows nothing.
  test("a page with figures without the Views heading's line that holds the word Views shows nothing and asks for extension_surface_missing once the give-up time passes", async () => {
    viewsWordLine()?.remove()
    await showList()

    expect(hosts()).toEqual([])
    expect(eventsAsked()).toEqual([{ name: 'extension_surface_missing', surface: 'content_list' }])
  })

  // A line state shows its line under the title without the line that holds Studio's word "Views",
  // so the page is read to know which it is.
  test("a page with figures without the Views heading's line that holds the word Views is read once", async () => {
    viewsWordLine()?.remove()
    await showList()

    expect(readsAsked()).toHaveLength(1)
  })

  test("a Views heading whose line Studio draws without its sort control still shows the pill after the line, and every row's figure, since the anchor stands on the line and not on the control", async () => {
    sortControl()?.remove()
    await showList()

    const line = viewsWordLine() as Element
    expect(sameElements(headingHosts(), [line.nextSibling] as Element[])).toBe(true)
    expect(seenInHeading()).toEqual(['icon', 'engaged views'])
    expect(studioRows().filter((row) => cellHostsOf(row).length === 1)).toHaveLength(30)
    expect(eventsAsked()).toEqual([shownOn('content_list', { fromCache: false })])
  })

  test('a list Studio draws before the give-up time is not reported missing', async () => {
    const list = studioList()
    const parent = list?.parentElement
    list?.remove()
    await showListFor(giveUpAfterMs / 2, (ids) => answerForRows(ids))
    if (list) parent?.append(list)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(textOf(cellHostsOf(studioRows()[0] as Element)[0])).toContain(shownFigureFor(0))
    expect(eventsAsked()).toEqual([shownOn('content_list', { fromCache: false })])
  })
})

test('the Studio dashboard looks for no Content list and reports nothing, and the list the creator then opens is read', async () => {
  const dashboard = `https://studio.youtube.com/channel/${channelId}/dashboard`
  await showListFor(giveUpAfterMs, (ids) => answerForRows(ids), dashboard)

  expect(asked).toEqual([])
  expect(hosts()).toEqual([])

  studioUrl = fixtureUrl
  navigate()
  await vi.advanceTimersByTimeAsync(1_000)
  expect(readsAsked()).toHaveLength(1)
})

describe('links from the Content list', () => {
  test.each([
    ['signed out', { state: 'signed-out' }],
    ['an unconnected channel', { state: 'channel-not-in-stillstats' }],
    ['a reconnect refusal', { state: 'refused', refusal: 'connection_revoked' }],
    ['a try again refusal', { state: 'refused', refusal: 'quota_reserved' }],
  ] satisfies [string, VideosRead][])(
    'the %s line links the web app in a new tab',
    async (_, read) => {
      await showList(read)

      const links = [...(titleLineHost()?.shadowRoot?.querySelectorAll('a') ?? [])]
      expect(links).not.toHaveLength(0)
      for (const link of links) {
        expect(link.getAttribute('href')).toBe(`${origin}/app`)
        expect(link.target).toBe('_blank')
        expect(link.rel.split(' ')).toContain('noopener')
      }
    },
  )
})

describe("the Content list's line clicks", () => {
  /** The link in the line under Studio's page title whose text is `text`. */
  const lineLink = (text: string) =>
    [...(titleLineHost()?.shadowRoot?.querySelectorAll('a') ?? [])].find(
      (link) => link.textContent === text,
    )

  test.each(clicks)(
    '%s on the sign-in line asks for nothing while signed out, then extension_sign_in_clicked on the Content list once a read shows the creator signed in',
    async (_, click) => {
      let read: VideosRead = { state: 'signed-out' }
      await showListFor(giveUpAfterMs, (ids) => (read.state === 'read' ? answerForRows(ids) : read))
      lineLink('Sign in at stillstats.com')?.dispatchEvent(click())
      await readAgain()
      expect(clicksAsked()).toEqual([])

      read = answerForRows([])
      await readAgain()

      expect(clicksAsked()).toEqual([
        { name: 'extension_sign_in_clicked', surface: 'content_list' },
      ])
    },
  )

  test('two sign-in clicks before the creator signs in send one event, though the page reads in two requests', async () => {
    addRows(51 - studioRows().length)
    let read: VideosRead = { state: 'signed-out' }
    await showListFor(giveUpAfterMs, (ids) => (read.state === 'read' ? answerForRows(ids) : read))
    for (const [, click] of clicks) lineLink('Sign in at stillstats.com')?.dispatchEvent(click())

    read = answerForRows([])
    await readAgain()
    await readAgain()

    expect(readsAsked().length).toBeGreaterThan(2)
    expect(clicksAsked()).toEqual([{ name: 'extension_sign_in_clicked', surface: 'content_list' }])
  })

  test.each(clicks)(
    '%s on "Connect it" asks for extension_connect_channel_clicked on the Content list',
    async (_, click) => {
      await showList({ state: 'channel-not-in-stillstats' })
      lineLink('Connect it')?.dispatchEvent(click())

      expect(clicksAsked()).toEqual([
        { name: 'extension_connect_channel_clicked', surface: 'content_list' },
      ])
    },
  )

  test.each([
    ['Reconnect in Stillstats', { state: 'refused', refusal: 'connection_revoked' }],
    ['Try again later', { state: 'refused', refusal: 'quota_reserved' }],
    ['Try again later', { state: 'failed' }],
  ] satisfies [string, VideosRead][])(
    'a click and a middle-click on "%s" (%o) each ask for extension_web_app_opened on the Content list',
    async (line, read) => {
      await showList(read)
      for (const [, click] of clicks) lineLink(line)?.dispatchEvent(click())

      expect(clicksAsked()).toEqual([
        { name: 'extension_web_app_opened', surface: 'content_list' },
        { name: 'extension_web_app_opened', surface: 'content_list' },
      ])
    },
  )
})

describe('when Studio drops the Views heading, its line that holds the word Views, or its page title after the figures show', () => {
  test.each([
    ['its Views heading', () => viewsHeading()?.remove(), viewsWordLine],
    [
      'the line of its Views heading that holds the word Views',
      () => viewsWordLine()?.remove(),
      viewsWordLine,
    ],
    // The page's elements come down together: the line under the title says the day of figures
    // that the pill names, and the pill names figures the line dates.
    ['its page title', () => pageTitle()?.remove(), pageTitle],
  ])(
    'Studio takes %s away, and the page shows no line, no pill, and no figure in any row',
    async (_, takeAway, taken) => {
      await showList()
      expect(seenIn(cellHostsOf(studioRows()[0] as Element)[0])).toEqual([
        'icon',
        shownFigureFor(0),
      ])
      expect(pageHosts()).toHaveLength(2)

      // Studio takes it away and keeps the rows and the rest of the page.
      takeAway()
      studioChanges()
      await vi.advanceTimersByTimeAsync(4 * passEveryMs)
      // And on long after, past a give-up time and a Studio change after it.
      await vi.advanceTimersByTimeAsync(giveUpAfterMs)
      studioChanges()
      await vi.advanceTimersByTimeAsync(4 * passEveryMs)

      expect(document.querySelector('#table-header')).not.toBeNull()
      expect(taken()).toBeNull()
      const figures = studioRows().filter((row) => cellHostsOf(row).length > 0)
      expect({ page: pageHosts().length, figures: figures.length }).toEqual({ page: 0, figures: 0 })
    },
  )

  test("a settled re-read of the same rows that goes out while Studio's Views heading has no line holding the word Views shows no line, no pill, and no figure in any row while it is out", async () => {
    const reRead = await showListWithLaterReadsHeld()
    expect(pageHosts()).toHaveLength(2)
    // A re-sort Studio draws on the same rows: they are read again once the navigation settles.
    studioUrl = fixtureUrl.replace('DESCENDING', 'ASCENDING')
    navigate()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs - passEveryMs / 2)
    expect(readsAsked()).toHaveLength(1)
    // Studio takes the h3 away just before the settled pass, so no pass on the kept answer sees it gone.
    viewsWordLine()?.remove()
    await vi.advanceTimersByTimeAsync(passEveryMs)
    expect(readsAsked()).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(4 * passEveryMs)

    const figures = studioRows().filter((row) => cellHostsOf(row).length > 0)
    expect({
      line: titleLineHost(),
      pill: headingHosts().length,
      figures: figures.length,
    }).toEqual({ line: null, pill: 0, figures: 0 })
    reRead.resolve(answerForRows(studioRows().map(rowId)))
  })

  test.each([
    ['its Views heading', viewsHeading],
    ['the line of its Views heading that holds the word Views', viewsWordLine],
    ['its page title', pageTitle],
  ])(
    "once Studio draws %s again, the line under the title, the pill and every row's figure come back with no second read",
    async (_, studioElement) => {
      await showList()
      const taken = studioElement() as Element
      const parent = taken.parentElement as Element
      // Studio's node before it, since the extension's line may be the one after.
      const before = taken.previousSibling
      taken.remove()
      studioChanges()
      await vi.advanceTimersByTimeAsync(4 * passEveryMs)
      expect(studioRows().filter((row) => cellHostsOf(row).length > 0)).toEqual([])

      // Studio draws it anew, a copy of the one it took away.
      const redrawn = taken.cloneNode(true)
      if (before) before.after(redrawn)
      else parent.prepend(redrawn)
      studioChanges()
      await vi.advanceTimersByTimeAsync(4 * passEveryMs)

      expect(seenIn(titleLineHost())).toEqual(['icon', 'Data from Stillstats as of 7 Oct.'])
      expect(seenInHeading()).toEqual(['icon', 'engaged views'])
      expect(pageHosts()).toHaveLength(2)
      expect(
        studioRows().map((row, index) => seenIn(cellHostsOf(row)[0])[1] === shownFigureFor(index)),
      ).toEqual(studioRows().map(() => true))
      expect(readsAsked()).toHaveLength(1)
    },
  )
})

// A line state's line (signed out, not connected, a refusal) goes under Studio's page title and
// stands on no label, so a Views heading drawn without its sort control, or without the line that
// holds it, still shows the line.
describe("a line state on the Content list and Studio's Views heading", () => {
  test.each([
    ["the sort control that holds the Views heading's word", () => sortControl()?.remove()],
    ["the Views heading's line that holds the word Views", () => viewsWordLine()?.remove()],
  ])(
    'a signed-out list whose Views heading is drawn without %s shows the sign-in line',
    async (_, takeAway) => {
      takeAway()
      await showList({ state: 'signed-out' })

      expect(viewsHeading()).not.toBeNull()
      expect(sortControl()).toBeNull()
      expect({ line: textOf(titleLineHost()), reads: readsAsked().length }).toEqual({
        line: expect.stringContaining('Sign in at stillstats.com'),
        reads: 1,
      })
    },
  )

  test.each([
    ["the Views heading's sort control", () => sortControl()?.remove()],
    ["the Views heading's line that holds the word Views", () => viewsWordLine()?.remove()],
  ])('a sign-in line stays up when Studio takes %s away', async (_, takeAway) => {
    await showList({ state: 'signed-out' })
    expect(textOf(titleLineHost())).toContain('Sign in at stillstats.com')

    takeAway()
    studioChanges()
    await vi.advanceTimersByTimeAsync(4 * passEveryMs)

    expect(viewsHeading()).not.toBeNull()
    expect(textOf(titleLineHost())).toContain('Sign in at stillstats.com')
  })
})

describe('the Content list word line drawn after a cold read', () => {
  for (const between of [false, true])
    test(`the "Views" line Studio draws after a cold 1,200 ms read, with a pass between: ${between}, is timed from the pass that found the list, as a cold read`, async () => {
      const line = viewsWordLine() as Element
      const parent = line.parentElement as Element
      const next = line.nextSibling
      line.remove()
      let reads = 0
      await showListFor(passEveryMs + 1_210, async (ids) => {
        reads += 1
        if (reads === 1) await new Promise((resolve) => setTimeout(resolve, 1_200))
        return fromCacheIn(answerForRows(ids), reads > 1)
      })
      if (between) {
        document.body.append(document.createElement('div'))
        await vi.advanceTimersByTimeAsync(2 * passEveryMs)
      }
      parent.insertBefore(line, next)
      await vi.advanceTimersByTimeAsync(giveUpAfterMs)

      expect(eventsAsked()).toEqual([
        {
          name: 'extension_surface_shown',
          surface: 'content_list',
          ms: expect.toSatisfy((ms: number) => ms >= 1_200),
          fromCache: false,
        },
      ])
    })
})

describe('the Content list drawn after Studio takes its Views heading or page title away during a cold read', () => {
  for (const missing of ['Views heading', 'page title'] as const)
    for (const passesBetween of [0, 2])
      test(`with the ${missing} back after ${passesBetween} more passes, is timed from the pass that found the list, as a cold read`, async () => {
        const element = (missing === 'Views heading' ? viewsHeading() : pageTitle()) as Element
        const parent = element.parentElement as Element
        const next = element.nextSibling
        let reads = 0
        await showListFor(passEveryMs + 1_210, async (ids) => {
          reads += 1
          if (reads === 1) {
            await new Promise((resolve) => setTimeout(resolve, 600))
            element.remove()
            await new Promise((resolve) => setTimeout(resolve, 600))
          }
          return fromCacheIn(answerForRows(ids), reads > 1)
        })
        for (let pass = 0; pass < passesBetween; pass += 1) {
          document.body.append(document.createElement('div'))
          await vi.advanceTimersByTimeAsync(2 * passEveryMs)
        }
        parent.insertBefore(element, next)
        await vi.advanceTimersByTimeAsync(giveUpAfterMs)

        expect(reads).toBe(1)
        expect(eventsAsked()).toEqual([
          {
            name: 'extension_surface_shown',
            surface: 'content_list',
            ms: expect.toSatisfy((ms: number) => ms >= 1_200),
            fromCache: false,
          },
        ])
      })
})

describe('the Content list drawn after Studio redraws its page during a cold read', () => {
  const tableHeader = () => document.querySelector('#table-header') as Element
  /** Takes `element` off the page, and returns the function that puts it back where it was. */
  function takeAway(element: Element): () => void {
    const parent = element.parentElement as Element
    const next = element.nextSibling
    element.remove()
    return () => parent.insertBefore(element, next)
  }
  /**
   * Shows the list for `passEveryMs + 1_210`, its first read held 1,200 ms with `change` made
   * halfway and answering `first`, every later read answering from the cache. Returns the count of
   * reads.
   */
  async function showListChangedDuringRead(
    change: () => void,
    first: (ids: string[]) => VideosRead = answerForRows,
  ): Promise<() => number> {
    let reads = 0
    await showListFor(passEveryMs + 1_210, async (ids) => {
      reads += 1
      if (reads > 1) return fromCacheIn(answerForRows(ids), true)
      await new Promise((resolve) => setTimeout(resolve, 600))
      change()
      await new Promise((resolve) => setTimeout(resolve, 600))
      return first(ids)
    })
    return () => reads
  }
  const failed = (): VideosRead => ({ state: 'failed' })
  const shownEvents = () => eventsAsked().filter(({ name }) => name === 'extension_surface_shown')
  const timedFromTheColdRead = {
    name: 'extension_surface_shown',
    surface: 'content_list',
    ms: expect.toSatisfy((ms: number) => ms >= 1_200),
    fromCache: false,
  }
  const timedFromItsOwnPass = {
    name: 'extension_surface_shown',
    surface: 'content_list',
    ms: expect.toSatisfy((ms: number) => ms < 1_200),
    fromCache: true,
  }

  test('with its column headings redrawn, is timed from the pass that found the list, as a cold read', async () => {
    await showListChangedDuringRead(() => tableHeader().replaceWith(tableHeader().cloneNode(true)))
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(shownEvents()).toEqual([timedFromTheColdRead])
  })

  test('with its column headings redrawn during a read that failed, is timed from the pass that read again', async () => {
    await showListChangedDuringRead(
      () => tableHeader().replaceWith(tableHeader().cloneNode(true)),
      failed,
    )
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(shownEvents()).toEqual([timedFromItsOwnPass])
  })

  test('with its Views heading taken away during a read that failed, is timed from the pass that read again once the heading is back', async () => {
    let putBack = () => {}
    await showListChangedDuringRead(() => {
      putBack = takeAway(viewsHeading() as Element)
    }, failed)
    putBack()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(shownEvents()).toEqual([timedFromItsOwnPass])
  })

  test('with its Views heading taken away, then its rows pointed at other videos before the heading is back, is timed from the pass that read those videos', async () => {
    let putBack = () => {}
    const reads = await showListChangedDuringRead(() => {
      putBack = takeAway(viewsHeading() as Element)
    })
    for (const [index, row] of studioRows().entries()) pointRowAt(row, otherId(index))
    await vi.advanceTimersByTimeAsync(2 * passEveryMs)
    putBack()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(reads()).toBe(2)
    expect(shownEvents()).toEqual([timedFromItsOwnPass])
  })

  test('with its Views heading taken away, and a navigation WXT reports before the heading is back, is timed on that navigation from the pass that read again', async () => {
    let putBack = () => {}
    const reads = await showListChangedDuringRead(() => {
      putBack = takeAway(viewsHeading() as Element)
    })
    navigate()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)
    putBack()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(reads()).toBe(2)
    expect(shownEvents()).toEqual([timedFromItsOwnPass])
  })

  test('with its "Views" line taken away, and a navigation WXT reports before the line is back, is timed on that navigation from its own read', async () => {
    let putBack = () => {}
    const reads = await showListChangedDuringRead(() => {
      putBack = takeAway(viewsWordLine() as Element)
    })
    navigate()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)
    putBack()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(reads()).toBe(2)
    expect(shownEvents()).toEqual([
      {
        name: 'extension_surface_shown',
        surface: 'content_list',
        ms: expect.any(Number),
        fromCache: true,
      },
    ])
  })
  test("with its Views heading taken away during a read ahead of WXT's report, and still away a line's time after the report, is timed from the pass that found the list", async () => {
    const dashboard = `https://studio.youtube.com/channel/${channelId}/dashboard`
    let putBack = () => {}
    let reads = 0
    await showListFor(
      1_000,
      async (ids) => {
        reads += 1
        if (reads > 1) return fromCacheIn(answerForRows(ids), true)
        await new Promise((resolve) => setTimeout(resolve, 600))
        putBack = takeAway(viewsHeading() as Element)
        await new Promise((resolve) => setTimeout(resolve, 600))
        return answerForRows(ids)
      },
      dashboard,
    )
    // The URL moves to the Content list and Studio draws it; WXT's location poll reports it later.
    studioUrl = fixtureUrl
    studioChanges()
    await vi.advanceTimersByTimeAsync(passEveryMs + 1_210)
    navigate()
    await vi.advanceTimersByTimeAsync(signedInReadKeptMs)
    studioChanges()
    await vi.advanceTimersByTimeAsync(2 * passEveryMs)
    putBack()
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(reads).toBe(1)
    expect(shownEvents()).toEqual([
      {
        name: 'extension_surface_shown',
        surface: 'content_list',
        ms: expect.toSatisfy((ms: number) => ms >= signedInReadKeptMs),
        fromCache: false,
      },
    ])
  })
})
