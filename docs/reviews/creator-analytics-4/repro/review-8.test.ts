// @vitest-environment jsdom
// Pre-PR review 8 of creator-analytics#4, finding 1. Each test states the correct behaviour, so it
// is red until the finding is fixed: when Studio draws a new key metric card for another period or
// video, nothing of the page before stays on screen while the background answers for the new one.
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
const readOf = (id: string): VideosRead => {
  const answer: VideoListAnswer = {
    videos: [videoOf(id)],
    window: 'last90',
    page: 1,
    pageSize: 1,
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
/** Reads after the first wait here until the test answers them. */
const pending: (() => void)[] = []
const hosts = () => [...document.querySelectorAll('[data-stillstats-surface="analytics"]')]
const linksUp = () =>
  hosts().flatMap((host) =>
    [...(host.shadowRoot?.querySelectorAll('a') ?? [])].map((link) => link.href),
  )

beforeEach(() => {
  vi.useFakeTimers()
  const page = new DOMParser().parseFromString(fixture, 'text/html')
  document.replaceChild(document.importNode(page.documentElement, true), document.documentElement)
  url = fixtureUrl
  pending.length = 0
  let reads = 0
  const ask = (async (request: BackgroundRequest) => {
    if (request.type !== 'read-videos') return true
    const id = 'ids' in request ? (request.ids[0] ?? '') : ''
    reads += 1
    if (reads === 1) return readOf(id)
    return new Promise<VideosRead>((resolve) => pending.push(() => resolve(readOf(id))))
  }) as AskBackground
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
  ['another period', () => fixtureUrl.replace(/period-quarter$/, 'period-week'), 'window=last90'],
  ['another video', () => fixtureUrl.replace('NDha0z6zDA8', 'AAAAAAAAAAA'), 'NDha0z6zDA8'],
])(
  'finding 1: a move to %s that redraws the whole key metric card leaves no link of the page before up while the new read is out',
  async (_, next, before) => {
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)
    expect(linksUp().some((href) => href.includes(before))).toBe(true)

    const card = document.querySelector('yta-key-metric-card')
    card?.replaceWith(card.cloneNode(true))
    url = next()
    watcher.navigated(url)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(pending).toHaveLength(1)
    expect(linksUp().filter((href) => href.includes(before))).toEqual([])
  },
)
