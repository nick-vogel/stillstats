// @vitest-environment jsdom
// Pre-PR review 1 of creator-analytics#4, findings 2, 3 and 4. Each test states the correct behaviour, so it is red until the finding is fixed.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VideoListAnswer, VideoRow } from '@creator-analytics/api-types'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { AskBackground, BackgroundRequest } from '../../../../apps/extension/src/messages.ts'
import type { VideosRead } from '../../../../apps/extension/src/product-api.ts'
import { contentList } from '../../../../apps/extension/src/surfaces/content-list.ts'
import { lineClicks } from '../../../../apps/extension/src/surfaces/line-clicks.ts'
import { studioSurfaces } from '../../../../apps/extension/src/surfaces/studio-surfaces.ts'
import {
  giveUpAfterMs,
  reportThrough,
  watchStudio,
} from '../../../../apps/extension/src/surfaces/watch.ts'

const origin = 'https://stillstats.example'

const fixture = readFileSync(
  join(import.meta.dirname, '../../../../apps/extension/test/fixtures/studio/content-list.html'),
  'utf8',
)
const fixtureUrl = /^<!-- (\S+) /.exec(fixture)?.[1] ?? ''
const channelId = 'UC8mOjhMBTyPPScCF9vYtwFg'

function loadContentList(): void {
  const page = new DOMParser().parseFromString(fixture, 'text/html')
  document.replaceChild(document.importNode(page.documentElement, true), document.documentElement)
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

function answerForRows(ids: string[]): VideosRead {
  const order = studioRows().map(rowId)
  const videos = ids.flatMap((id) => {
    const index = order.indexOf(id)
    return index === -1 ? [] : [videoOf(id, 10_000 + index)]
  })
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

test('finding 2: once the watch stops, no figure it placed stays in Studio', async () => {
  loadContentList()
  const ask = (async (request: BackgroundRequest) => {
    if (request.type !== 'read-videos') return true
    return answerForRows('ids' in request ? request.ids : [])
  }) as AskBackground
  const watcher = watchStudio({
    document,
    url: () => fixtureUrl,
    surfaces: [contentList({ ask, origin, locale: 'en-GB', lineClicks: lineClicks(ask) })],
    report: reportThrough(ask),
  })
  stop = watcher.stop
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)
  const row = studioRows()[0] as Element
  expect(cellPillTextsOf(row)).toEqual(['10,000 engaged views'])

  watcher.stop()

  expect
    .soft(document.querySelectorAll('[data-stillstats-surface]').length, 'hosts left after stop()')
    .toBe(0)
  pointRowAt(row, 'zzzzzzzzzzz')
  await vi.advanceTimersByTimeAsync(1_000)
  expect(cellPillTextsOf(row), "row 0's figure once it shows zzzzzzzzzzz").toEqual([])
})

test('finding 4: the give-up of a navigation does not report a surface missing on the page the creator has just moved to', async () => {
  document.documentElement.innerHTML = '<head></head><body></body>'
  const ask = (async () => true) as unknown as AskBackground
  const report = vi.fn()
  let studioUrl = `https://studio.youtube.com/channel/${channelId}/dashboard`
  const watcher = watchStudio({
    document,
    url: () => studioUrl,
    surfaces: studioSurfaces({ ask, origin, locale: 'en-GB' }),
    report,
  })
  stop = watcher.stop
  await vi.advanceTimersByTimeAsync(giveUpAfterMs - 1)

  studioUrl = fixtureUrl
  await vi.advanceTimersByTimeAsync(200)

  expect(report).not.toHaveBeenCalledWith({
    name: 'extension_surface_missing',
    surface: 'content_list',
  })
})

test('finding 3: a Content list read that lands after the watch stops draws nothing', async () => {
  loadContentList()
  let land: () => void = () => {}
  const ask = (async (request: BackgroundRequest) => {
    if (request.type !== 'read-videos') return true
    const ids = 'ids' in request ? request.ids : []
    return new Promise<VideosRead>((resolve) => {
      land = () => resolve(answerForRows(ids))
    })
  }) as AskBackground
  const watcher = watchStudio({
    document,
    url: () => fixtureUrl,
    surfaces: [contentList({ ask, origin, locale: 'en-GB', lineClicks: lineClicks(ask) })],
    report: reportThrough(ask),
  })
  stop = watcher.stop
  await vi.advanceTimersByTimeAsync(1_000)
  expect(document.querySelectorAll('[data-stillstats-surface]')).toHaveLength(0)

  watcher.stop()
  land()
  await vi.advanceTimersByTimeAsync(1_000)

  expect(
    document.querySelectorAll('[data-stillstats-surface]').length,
    'hosts drawn by a read that landed after stop()',
  ).toBe(0)
})
