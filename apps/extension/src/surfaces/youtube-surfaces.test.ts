// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://www.youtube.com/channel/UC8mOjhMBTyPPScCF9vYtwFg/shorts"}
// Limits: these run the watch over the surfaces the youtube.com content script registers, on one
// saved Shorts tab, one saved Shorts player, the saved home feed and the saved watch page, so they
// show that the Shorts and feed surfaces are among them, and place two surfaces on one document to
// show they share the page's reads.
// What each surface draws is held by its own test file, and src/youtube-access-removed.test.ts runs
// the content script itself; creator-analytics#143 walks real youtube.com.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ExtensionSurface, ListedChannel } from '@creator-analytics/api-types'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { UploadsRead } from '../product-api.ts'
import { giveUpAfterMs, passEveryMs, reportThrough, shownFrom, watchPage } from './page-watcher.ts'
import {
  eventsIn,
  fakeYouTubeBackground,
  loadYouTubePage,
  savedVideoIds,
  shownOn,
  uploadsAskedIn,
  uploadsOf,
  videoIdsSentIn,
} from './testing.ts'
import { youtubeSurfaces } from './youtube-surfaces.ts'

const nick: ListedChannel = {
  id: 'channel-1',
  youtubeChannelId: 'UC8mOjhMBTyPPScCF9vYtwFg',
  title: 'Nick Vogel',
  handle: '@nick_vogel',
  revenueConsentedAt: null,
}
const someoneElse: ListedChannel = {
  id: 'channel-2',
  youtubeChannelId: 'UCaaaaaaaaaaaaaaaaaaaaaa',
  title: 'Someone else',
  handle: '@someone_else',
  revenueConsentedAt: null,
}

let stop: () => void = () => {}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  stop()
  vi.useRealTimers()
})

test.each([
  ['Shorts tab', 'channel-shorts'],
  ['Shorts player', 'shorts-player'],
] as const)("the creator's %s shows the Shorts pill", async (_, name) => {
  history.replaceState(null, '', loadYouTubePage(name))
  const { ask, asked } = fakeYouTubeBackground({
    channels: [nick],
    // The player's Short is the one its URL plays, which no link in the save names.
    uploads: { [nick.youtubeChannelId]: [...savedVideoIds(name), 'h1jr1K82xuQ'] },
  })

  const watcher = watchPage({
    document,
    url: () => location.href,
    surfaces: youtubeSurfaces({ ask, origin: '', locale: 'en-US' }),
    report: reportThrough(ask),
  })
  stop = watcher.stop
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)

  expect(document.querySelectorAll('[data-stillstats-surface="shorts"]')).not.toHaveLength(0)
  expect(videoIdsSentIn(asked)).toEqual([])
})

/** Runs the watch over the registered surfaces past the give-up time. */
async function watchRegistered(ask: Parameters<typeof youtubeSurfaces>[0]['ask']): Promise<void> {
  const watcher = watchPage({
    document,
    url: () => location.href,
    surfaces: youtubeSurfaces({ ask, origin: '', locale: 'en-US' }),
    report: reportThrough(ask),
  })
  stop = watcher.stop
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)
}

const feedPills = () => document.querySelectorAll('[data-stillstats-surface="feed"]')

test("the home feed, one of its videos among the creator's uploads, shows the feed pill", async () => {
  history.replaceState(null, '', loadYouTubePage('home-feed'))
  const { ask, asked } = fakeYouTubeBackground({
    channels: [nick],
    uploads: { [nick.youtubeChannelId]: ['j3QaHCS3KB0'] },
  })

  await watchRegistered(ask)

  expect(feedPills()).toHaveLength(1)
  expect(videoIdsSentIn(asked)).toEqual([])
})

test("the watch page shows its own pill and the sidebar's, reading each held channel's uploads once and sending no id", async () => {
  history.replaceState(null, '', loadYouTubePage('watch'))
  const { ask, asked } = fakeYouTubeBackground({
    channels: [nick, someoneElse],
    uploads: {
      [nick.youtubeChannelId]: ['9SvyFna2XGM', 'YZ8MdtxvqiM', 'Mzjtul0G5T4'],
      [someoneElse.youtubeChannelId]: ['HTLu3CX1Ysw'],
    },
  })

  await watchRegistered(ask)

  expect(document.querySelectorAll('[data-stillstats-surface="watch_page"]')).toHaveLength(1)
  expect(feedPills()).toHaveLength(3)
  expect(uploadsAskedIn(asked)).toEqual([nick.youtubeChannelId, someoneElse.youtubeChannelId])
  expect(videoIdsSentIn(asked)).toEqual([])
})

test("the surfaces share one read of the held channels' uploads per navigation", async () => {
  // A watch page with the channel's Videos tab drawn beside it, so two surfaces have ids to match.
  history.replaceState(null, '', loadYouTubePage('watch'))
  const fixture = readFileSync(
    join(import.meta.dirname, '../../test/fixtures/youtube/channel-videos.html'),
    'utf8',
  )
  const tab = new DOMParser()
    .parseFromString(fixture, 'text/html')
    .querySelector('ytd-browse[page-subtype="channels"]')
  document.body.append(document.importNode(tab as Element, true))
  const { ask, asked } = fakeYouTubeBackground({
    channels: [nick],
    uploads: {
      [nick.youtubeChannelId]: [...savedVideoIds('watch'), ...savedVideoIds('channel-videos')],
    },
    answer: { fromCache: true },
  })
  const [channelPage, watchPageSurface] = youtubeSurfaces({ ask, origin: '', locale: 'en-US' })
  const page = (url: string, navigation: number) => ({
    document,
    url,
    navigation,
    ahead: false,
    settled: false,
    current: () => true,
    passAgain: () => {},
  })

  const placed = await Promise.all([
    channelPage?.place(page(`https://www.youtube.com/channel/${nick.youtubeChannelId}/videos`, 1)),
    watchPageSurface?.place(page('https://www.youtube.com/watch?v=9SvyFna2XGM', 1)),
  ])
  // Both are drawn from the one read, so both carry its cache result.
  expect(placed).toEqual([shownFrom(true), shownFrom(true)])
  expect(uploadsAskedIn(asked)).toEqual([nick.youtubeChannelId])

  await watchPageSurface?.place(page('https://www.youtube.com/watch?v=9SvyFna2XGM', 2))
  expect(uploadsAskedIn(asked)).toEqual([nick.youtubeChannelId, nick.youtubeChannelId])
  expect(videoIdsSentIn(asked)).toEqual([])
})

test.each([
  'channel-videos',
  'channel-home',
  'channel-shorts',
  'channel-streams',
  'watch',
  'home-feed',
  'search',
  'shorts-player',
] as const)(
  "every surface on the saved %s page's URL says its element is there, and none says so once the page shows nothing",
  (name) => {
    const url = loadYouTubePage(name)
    const { ask } = fakeYouTubeBackground({ channels: [nick] })
    const surfaces = youtubeSurfaces({ ask, origin: '', locale: 'en-US' }).filter((surface) =>
      surface.isOn(url),
    )

    expect(surfaces).not.toEqual([])
    expect(surfaces.filter((surface) => !surface.found?.(document, url))).toEqual([])
    document.body.replaceChildren()
    expect(surfaces.filter((surface) => surface.found?.(document, url))).toEqual([])
  },
)

test.each([
  ['channel-videos', ['channel_page']],
  ['watch', ['watch_page', 'feed']],
  ['home-feed', ['feed']],
  ['channel-shorts', ['shorts']],
  ['shorts-player', ['shorts']],
] as const satisfies readonly (readonly [string, readonly ExtensionSurface[]])[])(
  "on the saved %s page, a cold read a pass ahead of WXT's report started, which the report cut short, times %j from the ahead pass's start",
  async (name, surfaces) => {
    const savedUrl = loadYouTubePage(name)
    // The page is drawn while the URL is still one no surface is on, as WXT's 1 s poll lets it be.
    history.replaceState(null, '', '/account')
    const ids = [...savedVideoIds(name), '9SvyFna2XGM', 'h1jr1K82xuQ']
    const { ask, asked } = fakeYouTubeBackground({
      channels: [nick],
      uploads: {
        [nick.youtubeChannelId]: (call) =>
          call === 1
            ? new Promise<UploadsRead>((resolve) =>
                setTimeout(() => resolve(uploadsOf(ids)), 1_000),
              )
            : ids,
      },
    })
    const watcher = watchPage({
      document,
      url: () => location.href,
      surfaces: youtubeSurfaces({ ask, origin: '', locale: 'en-US' }),
      report: reportThrough(ask),
    })
    stop = watcher.stop
    await vi.advanceTimersByTimeAsync(passEveryMs)

    history.replaceState(null, '', savedUrl)
    document.body.append(document.createElement('div'))
    // The ahead pass starts within `passEveryMs` and reads the uploads for 1,000 ms; WXT reports
    // 400 ms in, and the navigation's own pass shows from that read once it lands.
    await vi.advanceTimersByTimeAsync(passEveryMs + 400)
    watcher.navigated(savedUrl)
    await vi.advanceTimersByTimeAsync(giveUpAfterMs)

    expect(eventsIn(asked)).toEqual(
      surfaces.map((surface) => shownOn(surface, { ms: 1_000, fromCache: false })),
    )
    expect(videoIdsSentIn(asked)).toEqual([])
  },
)
