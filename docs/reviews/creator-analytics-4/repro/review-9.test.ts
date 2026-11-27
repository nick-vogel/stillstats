// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://studio.youtube.com/"}
// Pre-PR review 9 of creator-analytics#4, finding 1. Each test states the correct behaviour, so it
// is red until the finding is fixed: once Studio no longer shows the Content list's videos, the
// line under Studio's page title, which dates their figures, comes down with them.
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
const hosts = () => [...document.querySelectorAll('[data-stillstats-surface="content_list"]')]
const titleLine = () =>
  document.querySelector('ytcp-content-section#video-list > ytcp-entity-page-header')
    ?.nextElementSibling ?? null

beforeEach(() => {
  vi.useFakeTimers()
  const page = new DOMParser().parseFromString(fixture, 'text/html')
  document.replaceChild(document.importNode(page.documentElement, true), document.documentElement)
  url = fixtureUrl
  const ask = (async (request: BackgroundRequest) =>
    request.type === 'read-videos'
      ? readOf('ids' in request ? request.ids : [])
      : true) as AskBackground
  const options = { ask, origin: 'https://stillstats.example', locale: 'en-GB' }
  watcher = watchStudio({
    document,
    url: () => url,
    surfaces: [contentList({ ...options, lineClicks: lineClicks(ask) })],
    report: reportThrough(ask),
  })
})

afterEach(() => {
  watcher.stop()
  vi.useRealTimers()
})

test.each([
  ['a move to the Playlists tab', '/videos/playlists'],
  ['Studio taking the Videos tab page away', undefined],
])(
  'finding 1: after %s, which takes the rows away, no line of the extension stays under the page title',
  async (_, tabPath) => {
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)
    expect(titleLine()?.matches('[data-stillstats-surface="content_list"]')).toBe(true)

    if (tabPath) {
      url = fixtureUrl.replace(/\/videos\/upload.*$/, tabPath)
      watcher.navigated(url)
    }
    document
      .querySelector('ytcp-video-section')
      ?.replaceWith(document.createElement('ytcp-playlist-section'))
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(hosts()).toEqual([])
  },
)
