// @vitest-environment jsdom
// Limits: jsdom swaps one saved Studio page for another and calls the watch's `navigated` itself, so
// these tests cannot show that WXT reports Studio's real in-page navigation from the dashboard to the
// Content list, or that the content script keeps one holder for the tab's life in Chrome and Firefox.
// creator-analytics#99 walks real Studio in Chrome and Firefox.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { VideoListAnswer } from '@creator-analytics/api-types'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { AskBackground, BackgroundRequest } from '../messages.ts'
import type { VideosRead } from '../product-api.ts'
import { giveUpAfterMs, reportThrough, watchPage } from './page-watcher.ts'
import { studioSurfaces } from './studio-surfaces.ts'
import { clicks, clicksIn } from './testing.ts'

const fixtureOf = (name: string) =>
  readFileSync(join(import.meta.dirname, `../../test/fixtures/studio/${name}`), 'utf8')
/** The first line of each fixture records the Studio URL it was saved from. */
const urlOf = (fixture: string) => /^<!-- (\S+) /.exec(fixture)?.[1] ?? ''

const dashboard = fixtureOf('dashboard.html')
const contentListPage = fixtureOf('content-list.html')

/** Puts a saved Studio page in the jsdom document, as Chrome drew it. */
function load(fixture: string): void {
  const page = new DOMParser().parseFromString(fixture, 'text/html')
  document.replaceChild(document.importNode(page.documentElement, true), document.documentElement)
}

/** A signed-in read of a channel whose videos the API has no figures for yet. */
const signedIn: VideosRead = {
  state: 'read',
  channelId: 'channel-1',
  answer: {
    videos: [],
    window: 'lifetime',
    page: 1,
    pageSize: 0,
    pageCount: 1,
    revenue: { refusal: 'consent_missing' },
    lastProcessedDay: '2026-10-07',
    creationDay: null,
    fetchedAt: '2026-10-10T12:00:00Z',
    fromCache: false,
  } satisfies VideoListAnswer,
}

let stop: () => void

beforeEach(() => {
  vi.useFakeTimers()
  load(dashboard)
})

afterEach(() => {
  stop()
  vi.useRealTimers()
})

/** The card's line link whose text is `text`. */
const cardLink = (text: string) =>
  [
    ...(document
      .querySelector('[data-stillstats-surface="card"]')
      ?.shadowRoot?.querySelectorAll('a') ?? []),
  ].find((link) => link.textContent === text)

test.each(clicks)(
  "%s on the card's sign-in line is sent as extension_sign_in_clicked on the card by the Content list's signed-in read",
  async (_, click) => {
    const asked: BackgroundRequest[] = []
    let read: VideosRead = { state: 'signed-out' }
    const ask = (async (request: BackgroundRequest) => {
      asked.push(request)
      return request.type === 'read-videos' ? read : true
    }) as AskBackground
    let url = urlOf(dashboard)
    const watcher = watchPage({
      document,
      url: () => url,
      surfaces: studioSurfaces({ ask, origin: 'https://stillstats.example', locale: 'en-GB' }),
      report: reportThrough(ask),
    })
    stop = watcher.stop
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)
    cardLink('Sign in at stillstats.com')?.dispatchEvent(click())
    expect(clicksIn(asked)).toEqual([])

    read = signedIn
    load(contentListPage)
    url = urlOf(contentListPage)
    watcher.navigated(url)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(clicksIn(asked)).toEqual([{ name: 'extension_sign_in_clicked', surface: 'card' }])
  },
)

test.each(['dashboard.html', 'content-list.html', 'video-analytics.html'])(
  "the surface on the saved %s page's URL says its element is there, and none says so once the page shows nothing",
  (name) => {
    stop = () => {}
    const fixture = fixtureOf(name)
    load(fixture)
    const url = urlOf(fixture)
    const ask = (async () => true) as AskBackground
    const surfaces = studioSurfaces({ ask, origin: 'https://stillstats.example', locale: 'en-GB' })
    const on = surfaces.filter((surface) => surface.isOn(url))

    expect(on).toHaveLength(1)
    expect(on.filter((surface) => !surface.found?.(document, url))).toEqual([])
    document.body.replaceChildren()
    expect(on.filter((surface) => surface.found?.(document, url))).toEqual([])
  },
)
