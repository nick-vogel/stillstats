// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://studio.youtube.com/"}
// Pre-PR review 10 of creator-analytics#4, finding 3. The test states the correct behaviour, so it
// is red until the finding is fixed: a video list Studio takes away for one pass, while the settled
// re-read of the same rows is out, keeps the line under the title and the pill in the Views heading
// up, as rows taken away for a pass do. Whether real Studio detaches the list on a re-sort is a
// creator-analytics#99 check.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { AskBackground, BackgroundRequest } from '../../../../apps/extension/src/messages.ts'
import type { VideosRead } from '../../../../apps/extension/src/product-api.ts'
import { contentList } from '../../../../apps/extension/src/surfaces/content-list.ts'
import { lineClicks } from '../../../../apps/extension/src/surfaces/line-clicks.ts'
import {
  giveUpAfterMs,
  reportThrough,
  watchStudio,
} from '../../../../apps/extension/src/surfaces/watch.ts'
import type { VideoListAnswer, VideoRow } from '../../../../packages/api-types/src/index.ts'

const fixture = readFileSync(
  join(import.meta.dirname, '../../../../apps/extension/test/fixtures/studio/content-list.html'),
  'utf8',
)
const fixtureUrl = /^<!-- (\S+) /.exec(fixture)?.[1] ?? ''

const videoOf = (id: string): VideoRow => ({
  id,
  title: 'A video',
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
})
const readOf = (ids: readonly string[]): VideosRead => {
  const answer: VideoListAnswer = {
    videos: ids.map(videoOf),
    window: 'lifetime',
    page: 1,
    pageSize: ids.length,
    pageCount: 1,
    lastProcessedDay: '2026-10-07',
    creationDay: null,
    fetchedAt: '2026-10-10T12:00:00Z',
    fromCache: false,
  }
  return { state: 'read', channelId: 'channel-1', answer }
}

let url = fixtureUrl
let watcher: { navigated(to: string): void; stop(): void }
let reads = 0
let release: (read: VideosRead) => void = () => {}
const pageHosts = () =>
  [...document.querySelectorAll('[data-stillstats-surface="content_list"]')].filter(
    (host) => !host.closest('ytcp-video-row'),
  )

beforeEach(() => {
  vi.useFakeTimers()
  const page = new DOMParser().parseFromString(fixture, 'text/html')
  document.replaceChild(document.importNode(page.documentElement, true), document.documentElement)
  url = fixtureUrl
  reads = 0
  const ask = (async (request: BackgroundRequest) => {
    if (request.type !== 'read-videos') return true
    reads += 1
    const ids = 'ids' in request ? request.ids : []
    if (reads === 1) return readOf(ids)
    return new Promise<VideosRead>((done) => {
      release = done
    })
  }) as AskBackground
  const options = { ask, origin: 'https://stillstats.example', locale: 'en-GB' }
  watcher = watchStudio({
    document,
    url: () => url,
    surfaces: [contentList({ ...options, lineClicks: lineClicks(ask) })],
    report: reportThrough(ask),
  })
})

afterEach(() => {
  release(readOf([]))
  watcher.stop()
  vi.useRealTimers()
})

test('finding 3: a video list Studio takes away for one pass while the settled re-read of the same rows is out keeps the line under the title and the pill up', async () => {
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)
  expect(pageHosts()).toHaveLength(2)
  url = fixtureUrl.replace('DESCENDING', 'ASCENDING')
  watcher.navigated(url)
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)
  expect(reads).toBe(2)

  const list = document.querySelector('ytcp-video-section-content#video-list') as Element
  const parent = list.parentElement as Element
  const next = list.nextSibling
  list.remove()
  await vi.advanceTimersByTimeAsync(300)
  parent.insertBefore(list, next)
  await vi.advanceTimersByTimeAsync(1_000)

  expect(pageHosts()).toHaveLength(2)
})
