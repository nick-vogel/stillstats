// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://studio.youtube.com/"}
// Pre-PR review 11 of creator-analytics#4, finding 2. The test states the correct behaviour, so it
// is red until the finding is fixed: a move from the Videos tab to the Collabs tab, which the
// extension does not run on (isContentList), takes the line under the page title and the pill in
// the Views heading down, even while Studio keeps a video list of rows that carry ids on the page.
// Whether real Studio draws the Collabs tab in the same video list element is a
// creator-analytics#99 check.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { AskBackground, BackgroundRequest } from '../../../../apps/extension/src/messages.ts'
import type { VideosRead } from '../../../../apps/extension/src/product-api.ts'
import { contentList } from '../../../../apps/extension/src/surfaces/content-list.ts'
import { lineClicks } from '../../../../apps/extension/src/surfaces/line-clicks.ts'
import { clicksIn, eventsIn } from '../../../../apps/extension/src/surfaces/testing.ts'
import {
  giveUpAfterMs,
  reportThrough,
  watchStudio,
} from '../../../../apps/extension/src/surfaces/watch.ts'
import type { VideoListAnswer, VideoRow } from '../../../../packages/api-types/src/index.ts'

const origin = 'https://stillstats.example'

const fixture = readFileSync(
  join(import.meta.dirname, '../../../../apps/extension/test/fixtures/studio/content-list.html'),
  'utf8',
)
/** The first line of each fixture records the Studio URL it was saved from. */
const fixtureUrl = /^<!-- (\S+) /.exec(fixture)?.[1] ?? ''
const _channelId = 'UC8mOjhMBTyPPScCF9vYtwFg'

/** Puts the saved Content list in the jsdom document, as Chrome drew it. */
function loadContentList(): void {
  const page = new DOMParser().parseFromString(fixture, 'text/html')
  document.replaceChild(document.importNode(page.documentElement, true), document.documentElement)
}

const _studioList = () => document.querySelector('#video-list')
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
function _addRows(count: number): void {
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
function _pillOf(host: Element | null | undefined) {
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
const _cellHostsOf = (row: Element) => [
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
const _afterTableHeader = () =>
  hosts().filter((host) => host.previousElementSibling?.id === 'table-header')
/** The extension's elements for the page, wherever they are: everything not in a row. */
const _pageHosts = () => hosts().filter((host) => !host.closest('ytcp-video-row'))
/** What a screen reader hears of the extension's in Studio's table, its heading and its rows. */
const _tableText = () =>
  hosts()
    .filter((host) => host.closest('ytcp-video-section-content'))
    .map(textOf)
    .join(' ')
/** Studio's Views column heading. */
const viewsHeading = () =>
  document.querySelector('#table-header [role="columnheader"].tablecell-views')
/** The line of Studio's Views heading that holds its sort control and the word "Views". */
const _viewsWordLine = () => viewsHeading()?.querySelector('h3') ?? null
/** Studio's sort control on that line, the button that holds the word "Views". */
const _sortControl = () => viewsHeading()?.querySelector('#views-header-name') ?? null
/**
 * The extension's elements anywhere in Studio's Views column heading: for a page with figures, the
 * anchor that draws the pill.
 */
const headingHosts = () => [
  ...(viewsHeading()?.querySelectorAll('[data-stillstats-surface="content_list"]') ?? []),
]
/** What the creator sees of the extension's in Studio's Views heading, in order. */
const _seenInHeading = () => headingHosts().flatMap(seenIn)
/** The names a screen reader hears for the icons in one of the extension's elements. */
const _iconNamesIn = (host: Element | null | undefined) =>
  [...(host?.shadowRoot?.querySelectorAll('[aria-label]') ?? [])].map((node) =>
    node.getAttribute('aria-label'),
  )
/** Whether `now` holds the very elements `before` held, in order, and not copies Studio drew. */
const _sameElements = (now: Element[], before: Element[]) =>
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
const _shownFigureFor = (index: number, thousands = 10) =>
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

/** The API's answer for the ids asked, with the video in row `index` not yet processed by YouTube. */
const _answerWaitingAt =
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
function _heldAnswer() {
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
  const watcher = watchStudio({
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

/** The content list's reads, each of a page's ids. */
const _readsAsked = () =>
  asked.flatMap((request) => (request.type === 'read-videos' && 'ids' in request ? [request] : []))
const _eventsAsked = () => eventsIn(asked)
const _clicksAsked = () => clicksIn(asked)

beforeEach(() => {
  vi.useFakeTimers()
  loadContentList()
})

afterEach(() => {
  stop()
  vi.useRealTimers()
})

test('a move to the Collabs tab, whose list Studio draws with rows of other ids, leaves no line under the title and no pill', async () => {
  await showList()
  expect(textOf(titleLineHost())).toContain('as of 7 Oct')

  studioUrl = fixtureUrl.replace(/\/videos\/upload.*$/, '/videos/collabs')
  navigate()
  for (const [index, row] of studioRows().entries()) pointRowAt(row, otherId(index))
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)

  expect(hosts()).toEqual([])
})
