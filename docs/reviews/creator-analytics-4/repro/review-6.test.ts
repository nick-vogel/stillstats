// @vitest-environment jsdom
// Pre-PR review 6 of creator-analytics#4, finding 1. Each test states the correct behaviour, so it
// is red until the finding is fixed: once the analytics page moves to another period or video and
// the extension cannot find where its figure goes, it shows nothing of the page before.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { AskBackground, BackgroundRequest } from '../../../../apps/extension/src/messages.ts'
import type { VideosRead } from '../../../../apps/extension/src/product-api.ts'
import { videoAnalyticsPage } from '../../../../apps/extension/src/surfaces/analytics.ts'
import { lineClicks } from '../../../../apps/extension/src/surfaces/line-clicks.ts'
import {
  giveUpAfterMs,
  reportThrough,
  watchStudio,
} from '../../../../apps/extension/src/surfaces/watch.ts'
import type { VideoListAnswer, VideoRow } from '../../../../packages/api-types/src/index.ts'

const fixture = readFileSync(
  join(import.meta.dirname, '../../../../apps/extension/test/fixtures/studio/video-analytics.html'),
  'utf8',
)
const fixtureUrl = /^<!-- (\S+) /.exec(fixture)?.[1] ?? ''

const video: VideoRow = {
  id: 'NDha0z6zDA8',
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
}
const answer: VideoListAnswer = {
  videos: [video],
  window: 'last90',
  page: 1,
  pageSize: 1,
  pageCount: 1,
  lastProcessedDay: '2026-10-07',
  creationDay: null,
  fetchedAt: '2026-10-10T12:00:00Z',
  fromCache: false,
}
const read = { state: 'read', channelId: 'channel-1', answer } satisfies VideosRead

let url = fixtureUrl
let watcher: { navigated(to: string): void; stop(): void }
const hosts = () => [...document.querySelectorAll('[data-stillstats-surface="analytics"]')]

beforeEach(() => {
  vi.useFakeTimers()
  const page = new DOMParser().parseFromString(fixture, 'text/html')
  document.replaceChild(document.importNode(page.documentElement, true), document.documentElement)
  url = fixtureUrl
  const ask = (async (request: BackgroundRequest) =>
    request.type === 'read-videos' ? read : true) as AskBackground
  const options = { ask, origin: 'https://stillstats.example', locale: 'en-GB' }
  watcher = watchStudio({
    document,
    url: () => url,
    surfaces: [videoAnalyticsPage({ ...options, lineClicks: lineClicks(ask) })],
    report: reportThrough(ask),
  })
})

afterEach(() => {
  watcher.stop()
  vi.useRealTimers()
})

test.each([
  ['another period', () => fixtureUrl.replace(/period-quarter$/, 'period-week'), ['last7']],
  ['another video', () => fixtureUrl.replace('NDha0z6zDA8', 'AAAAAAAAAAA'), []],
])(
  'finding 1: a move to %s while Studio has not drawn the Views number leaves nothing of the page before',
  async (_, next, windowsUp) => {
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)
    expect(hosts()).toHaveLength(2)

    document.querySelector('#EXTERNAL_VIEWS-tab #metric-total')?.parentElement?.remove()
    url = next()
    watcher.navigated(url)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(
      document.querySelector('#EXTERNAL_VIEWS-tab [data-stillstats-surface="analytics"]'),
    ).toBeNull()
    expect(
      hosts().flatMap((host) =>
        [...(host.shadowRoot?.querySelectorAll('a') ?? [])].map((link) =>
          new URL(link.href).searchParams.get('window'),
        ),
      ),
    ).toEqual(windowsUp)
  },
)
