// @vitest-environment jsdom
// Pre-PR review 3 of creator-analytics#4, findings 1 and 2. Each test states the correct behaviour, so it is red until the finding is fixed.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VideoListAnswer, VideoRow } from '@creator-analytics/api-types'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { signedInReadKeptMs } from '../../../../apps/extension/src/kept.ts'
import type { AskBackground, BackgroundRequest } from '../../../../apps/extension/src/messages.ts'
import type { VideosRead } from '../../../../apps/extension/src/product-api.ts'
import { latestVideoCard } from '../../../../apps/extension/src/surfaces/card.ts'
import { contentList } from '../../../../apps/extension/src/surfaces/content-list.ts'
import { lineClicks } from '../../../../apps/extension/src/surfaces/line-clicks.ts'
import {
  giveUpAfterMs,
  reportThrough,
  watchStudio,
} from '../../../../apps/extension/src/surfaces/watch.ts'

const origin = 'https://stillstats.example'
const fixtures = join(import.meta.dirname, '../../../../apps/extension/test/fixtures/studio')

function load(name: string): string {
  const html = readFileSync(join(fixtures, name), 'utf8')
  const page = new DOMParser().parseFromString(html, 'text/html')
  document.replaceChild(document.importNode(page.documentElement, true), document.documentElement)
  return /^<!-- (\S+) /.exec(html)?.[1] ?? ''
}

const studioRows = () => [...document.querySelectorAll('ytcp-video-row')]

function rowId(row: Element): string {
  const href = row.querySelector('a#video-title')?.getAttribute('href') ?? ''
  return /^\/video\/([\w-]{11})\//.exec(href)?.[1] ?? ''
}

function pointRowAt(row: Element, id: string): void {
  for (const link of row.querySelectorAll('a#video-title, a#thumbnail-anchor')) {
    link.setAttribute('href', `/video/${id}/edit`)
  }
}

const cellPillTextsOf = (row: Element) =>
  [
    ...(row
      .querySelector('.tablecell-views')
      ?.querySelectorAll('[data-stillstats-surface="content_list"]') ?? []),
  ].map((host) => host.shadowRoot?.querySelector('.pill')?.textContent)

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

function readOf(videos: VideoRow[]): VideosRead {
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
  return { state: 'read', channelId: 'channel-1', answer }
}

let stop = () => {}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  stop()
  vi.useRealTimers()
})

test('finding 1: a row Studio points at another video while a read is in flight loses its figure at once', async () => {
  const url = load('content-list.html')
  const order = studioRows().map(rowId)
  let held = false
  const ask = (async (request: BackgroundRequest) => {
    if (request.type !== 'read-videos') return true
    const ids = 'ids' in request ? (request.ids ?? []) : []
    const read = readOf(
      ids.flatMap((id) => (order.includes(id) ? [videoOf(id, 10_000 + order.indexOf(id))] : [])),
    )
    if (!held) return read
    return new Promise<VideosRead>(() => {})
  }) as AskBackground
  const watcher = watchStudio({
    document,
    url: () => url,
    surfaces: [contentList({ ask, origin, locale: 'en-GB', lineClicks: lineClicks(ask) })],
    report: reportThrough(ask),
  })
  stop = watcher.stop
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)
  const [first, second] = studioRows() as [Element, Element]
  expect(cellPillTextsOf(second)).toEqual(['10,001 engaged views'])

  // Studio shows another video in the first row, so a read for the new page goes out and hangs.
  held = true
  pointRowAt(first, 'zzzzzzzzzz0')
  await vi.advanceTimersByTimeAsync(1_000)
  // Studio then shows another video in the second row, which still carries its figure.
  pointRowAt(second, 'zzzzzzzzzz1')
  await vi.advanceTimersByTimeAsync(3_000)

  expect(cellPillTextsOf(second), "the second row's figure once it shows zzzzzzzzzz1").toEqual([])
})

test("finding 2: a card whose format read failed asks for its comparison row again once a line's time has passed", async () => {
  const url = load('dashboard.html')
  const card: VideoRow = {
    ...videoOf('NDha0z6zDA8', 1234),
    format: 'video',
    engagedViewsByDay: [1234, 0],
  }
  let formatReads = 0
  const ask = (async (request: BackgroundRequest) => {
    if (request.type !== 'read-videos') return true
    if ('ids' in request && request.ids) return readOf([card])
    formatReads += 1
    return formatReads === 1
      ? ({ state: 'failed' } satisfies VideosRead)
      : readOf([card, { ...videoOf('older000001', 99), engagedViewsByDay: [99, 0] }])
  }) as AskBackground
  const watcher = watchStudio({
    document,
    url: () => url,
    surfaces: [latestVideoCard({ ask, origin, locale: 'en-GB', lineClicks: lineClicks(ask) })],
    report: reportThrough(ask),
  })
  stop = watcher.stop
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)
  const textOfCard = () =>
    document.querySelector('[data-stillstats-surface="card"]')?.shadowRoot?.textContent ?? ''
  expect(textOfCard()).toContain('1,234')
  expect(textOfCard()).not.toContain('by engaged views')

  await vi.advanceTimersByTimeAsync(signedInReadKeptMs + 1_000)
  document.body.append(document.createElement('div'))
  await vi.advanceTimersByTimeAsync(1_000)

  expect(formatReads, 'format reads asked').toBeGreaterThan(1)
  expect(textOfCard()).toContain('1 of 2 Videos by engaged views')
})

test('finding 3: a Content list tab Studio draws with no rows keeps no engaged views line from the tab before', async () => {
  const videosTab = load('content-list.html')
  const order = studioRows().map(rowId)
  const ask = (async (request: BackgroundRequest) => {
    if (request.type !== 'read-videos') return true
    const ids = 'ids' in request ? (request.ids ?? []) : []
    return readOf(ids.map((id) => videoOf(id, 10_000 + order.indexOf(id))))
  }) as AskBackground
  let url = videosTab
  const watcher = watchStudio({
    document,
    url: () => url,
    surfaces: [contentList({ ask, origin, locale: 'en-GB', lineClicks: lineClicks(ask) })],
    report: reportThrough(ask),
  })
  stop = watcher.stop
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)
  expect(
    document.querySelectorAll('[data-stillstats-surface="content_list"]').length,
  ).toBeGreaterThan(1)

  // The creator opens the Live tab, which has no uploads: Studio keeps the list and its headings.
  url = `https://studio.youtube.com/channel/UC8mOjhMBTyPPScCF9vYtwFg/videos/live`
  watcher.navigated(url)
  for (const row of studioRows()) row.remove()
  await vi.advanceTimersByTimeAsync(3 * giveUpAfterMs)

  expect(
    document.querySelectorAll('[data-stillstats-surface="content_list"]').length,
    'engaged views elements left on a tab with no rows',
  ).toBe(0)
})
