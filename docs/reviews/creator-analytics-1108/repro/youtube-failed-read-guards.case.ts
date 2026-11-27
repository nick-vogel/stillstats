// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://www.youtube.com/"}
// Pre-PR review 1, finding 2: disproves the claim in `mutation-run.md` that the five YouTube
// failed-read guard mutants (`WP-guard`, `SH-tiles-guard`, `SH-player-guard`, `FD-guard`,
// `CP-guard`) are equivalent. With two held channels, channel 1 fails immediately (starting its
// 30 s keep at t = 250 ms) while channel 2 fails after `signedInReadKeptMs` with a redraw halfway.
// On pass 2, channel 1's keep has expired so it retries and succeeds in 100 ms.
// At HEAD 0a24108c (guards intact): all 5 cases report ms: 25350 (from the give-up pass ask at 5 s).
// Under each mutant (guard removed): all 5 cases report ms: 30100 (from pass 1 at 250 ms).
//
// Run by copying into `apps/extension/src/surfaces/` (as a `.test.ts`) or by running each case's
// setup inside its own surface test file with `node docs/reviews/creator-analytics-1108/mutants.mjs . WP-guard SH-tiles-guard SH-player-guard FD-guard CP-guard`.
import type { ListedChannel } from '@creator-analytics/api-types'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { signedInReadKeptMs } from '../../../../apps/extension/src/kept.ts'
import {
  shortsChannelBarIn,
  shortsPlayerIn,
} from '../../../../apps/extension/src/selectors/shorts.ts'
import { channelPage } from '../../../../apps/extension/src/surfaces/channel-page.ts'
import { feed } from '../../../../apps/extension/src/surfaces/feed.ts'
import { lineClicks } from '../../../../apps/extension/src/surfaces/line-clicks.ts'
import {
  giveUpAfterMs,
  passEveryMs,
  reportThrough,
  type Surface,
  type SurfaceOptions,
  watchPage,
} from '../../../../apps/extension/src/surfaces/page-watcher.ts'
import { shorts } from '../../../../apps/extension/src/surfaces/shorts.ts'
import {
  eventsIn,
  fakeYouTubeBackground,
  loadYouTubePage,
  shownOn,
  uploadsOf,
  type YouTubePage,
} from '../../../../apps/extension/src/surfaces/testing.ts'
import { watchPageSurface } from '../../../../apps/extension/src/surfaces/watch-page.ts'

const nickId = 'UC8mOjhMBTyPPScCF9vYtwFg'
const otherChId = 'UCaaaaaaaaaaaaaaaaaaaaaa'
const nick: ListedChannel = {
  id: 'channel-1',
  youtubeChannelId: nickId,
  title: 'Nick Vogel',
  handle: '@nick_vogel',
  revenueConsentedAt: null,
}
const otherCh: ListedChannel = {
  id: 'channel-2',
  youtubeChannelId: otherChId,
  title: 'Other channel',
  handle: '@other_channel',
  revenueConsentedAt: null,
}
const otherId = (index: number) => `other${String(index).padStart(6, '0')}`
const otherIds = Array.from({ length: 50 }, (_, index) => otherId(index))

let stop: (() => void) | undefined
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  stop?.()
  stop = undefined
  vi.useRealTimers()
})

async function runTwoChannelFailedReadRedraw({
  page,
  url,
  surface,
  uploadsOnRetry,
  redraw,
}: {
  page: YouTubePage
  url: string
  surface: (options: SurfaceOptions) => Surface
  uploadsOnRetry: string[]
  redraw: () => void
}) {
  loadYouTubePage(page)
  history.replaceState(null, '', url)
  const { ask, asked } = fakeYouTubeBackground({
    channels: [nick, otherCh],
    uploads: {
      [nickId]: async (call) => {
        if (call === 1) return { state: 'failed' }
        await new Promise((resolve) => setTimeout(resolve, 100))
        return uploadsOf(uploadsOnRetry, { fromCache: false })
      },
      [otherChId]: async () => {
        await new Promise((resolve) => setTimeout(resolve, signedInReadKeptMs / 2))
        redraw()
        await new Promise((resolve) => setTimeout(resolve, signedInReadKeptMs / 2))
        return { state: 'failed' }
      },
    },
  })
  const watcher = watchPage({
    document,
    url: () => location.href,
    surfaces: [
      surface({
        ask,
        origin: 'https://stillstats.example',
        locale: 'en-GB',
        lineClicks: lineClicks(ask),
      }),
    ],
    report: reportThrough(ask),
  })
  stop = watcher.stop
  await vi.advanceTimersByTimeAsync(passEveryMs + signedInReadKeptMs + giveUpAfterMs)
  return eventsIn(asked).filter((event) => event.name === 'extension_surface_shown')
}

describe('repro: the five YouTube failed-read guards are observable with two held channels', () => {
  test('WP-guard: watch_page', async () => {
    const events = await runTwoChannelFailedReadRedraw({
      page: 'watch',
      url: '/watch?v=9SvyFna2XGM',
      surface: watchPageSurface,
      uploadsOnRetry: ['9SvyFna2XGM'],
      redraw: () => {
        const meta = document.querySelector(
          'ytd-watch-flexy:not([hidden]) ytd-watch-metadata',
        ) as Element
        meta.replaceWith(meta.cloneNode(true))
      },
    })
    expect(events).toEqual([shownOn('watch_page', { ms: 25_350, fromCache: false })])
  })

  test('SH-tiles-guard: shorts tab', async () => {
    const events = await runTwoChannelFailedReadRedraw({
      page: 'channel-shorts',
      url: `/channel/${nickId}/shorts`,
      surface: shorts,
      uploadsOnRetry: otherIds,
      redraw: () => {
        const tiles = [
          ...document.querySelectorAll('ytd-browse:not([hidden]) ytm-shorts-lockup-view-model'),
        ]
        for (const [index, tile] of tiles.entries()) {
          for (const link of tile.querySelectorAll('a[href*="/shorts/"]'))
            link.setAttribute('href', `/shorts/${otherId(index)}`)
        }
      },
    })
    expect(events).toEqual([shownOn('shorts', { ms: 25_350, fromCache: false })])
  })

  test('SH-player-guard: shorts player', async () => {
    const events = await runTwoChannelFailedReadRedraw({
      page: 'shorts-player',
      url: '/shorts/h1jr1K82xuQ',
      surface: shorts,
      uploadsOnRetry: ['h1jr1K82xuQ'],
      redraw: () => {
        const player = shortsPlayerIn(document) as Element
        const bar = shortsChannelBarIn(player) as Element
        bar.replaceWith(bar.cloneNode(true))
      },
    })
    expect(events).toEqual([shownOn('shorts', { ms: 25_350, fromCache: false })])
  })

  test('FD-guard: feed (search)', async () => {
    const events = await runTwoChannelFailedReadRedraw({
      page: 'search',
      url: '/results?search_query=nick',
      surface: feed,
      uploadsOnRetry: otherIds,
      redraw: () => {
        const list = document.querySelector(
          'ytd-search:not([hidden]) ytd-section-list-renderer',
        ) as Element
        const tiles = [
          ...list.querySelectorAll('ytd-video-renderer'),
          ...list.querySelectorAll('ytd-grid-video-renderer'),
          ...list.querySelectorAll('yt-lockup-view-model'),
        ]
        for (const [index, tile] of tiles.entries()) {
          for (const link of tile.querySelectorAll('a[href*="/watch"]'))
            link.setAttribute('href', `/watch?v=${otherId(index)}`)
        }
      },
    })
    expect(events).toEqual([shownOn('feed', { ms: 25_350, fromCache: false })])
  })

  test('CP-guard: channel_page', async () => {
    const events = await runTwoChannelFailedReadRedraw({
      page: 'channel-videos',
      url: `/channel/${nickId}/videos`,
      surface: channelPage,
      uploadsOnRetry: otherIds,
      redraw: () => {
        const tiles = [
          ...document.querySelectorAll(
            'ytd-browse:not([hidden]) ytd-rich-grid-renderer yt-lockup-view-model',
          ),
        ]
        for (const [index, tile] of tiles.entries()) {
          for (const link of tile.querySelectorAll('a[href*="/watch"]'))
            link.setAttribute('href', `/watch?v=${otherId(index)}`)
        }
      },
    })
    expect(events).toEqual([shownOn('channel_page', { ms: 25_350, fromCache: false })])
  })
})
