// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://www.youtube.com/channel/UC8mOjhMBTyPPScCF9vYtwFg/videos"}
// Limits: jsdom has no real `runtime.onMessage`, so this runs `youtube.content.ts`'s own `main` in a
// real WXT context over a fake extension runtime: the background's asks answered by a fake, and its
// messages delivered by hand. It cannot see that Chrome and Firefox deliver the message to an open
// www.youtube.com tab once the grant is gone: creator-analytics#143 walks the removal in real Chrome
// and Firefox. src/youtube-access.test.ts holds that the background sends the message on removal,
// and src/background-answer.test.ts that it answers a www.youtube.com tab nothing without the grant.
// jsdom has no back/forward cache either, so the restore tests dispatch the `pageshow` a restore
// fires, with `persisted` set. They cannot see that a real Chrome or Firefox restore fires that
// `pageshow` at the live content script, or that its ask reaches the background, and no walk drives a
// real restore yet: creator-analytics#143's removal step removes access only while the tab is live.
import type { ListedChannel } from '@creator-analytics/api-types'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { AskBackground, BackgroundRequest } from './messages.ts'
import { giveUpAfterMs } from './surfaces/page-watcher.ts'
import {
  fakeYouTubeBackground,
  loadYouTubePage,
  savedVideoIds,
  studioChanges,
  videoIdsSentIn,
} from './surfaces/testing.ts'
import { youtubeAccessRemovedMessage } from './youtube-access.ts'

const nick: ListedChannel = {
  id: 'channel-1',
  youtubeChannelId: 'UC8mOjhMBTyPPScCF9vYtwFg',
  title: 'Nick Vogel',
  handle: '@nick_vogel',
  revenueConsentedAt: null,
}

const pills = () => [...document.querySelectorAll('[data-stillstats-surface]')]
const reads = (asked: BackgroundRequest[]) =>
  asked.filter(
    ({ type }) => type === 'read-uploads' || type === 'read-videos' || type === 'read-channels',
  )

/** The creator's uploads: the saved Videos tab's videos, and the ones YouTube draws later. */
const myUploads = [
  ...savedVideoIds('channel-videos'),
  ...Array.from({ length: 5 }, (_, index) => `other${String(index).padStart(6, '0')}`),
]

/** YouTube draws `count` more tiles on the tab, copies of its first tile linking other videos. */
function youtubeDrawsTiles(count: number): void {
  const first = document.querySelector(
    'ytd-browse[page-subtype="channels"]:not([hidden]) yt-lockup-view-model',
  ) as Element
  for (let index = 0; index < count; index += 1) {
    const copy = first.cloneNode(true) as Element
    for (const host of copy.querySelectorAll('[data-stillstats-surface]')) host.remove()
    for (const link of copy.querySelectorAll('a[href^="/watch?v="]'))
      link.setAttribute('href', `/watch?v=other${String(index).padStart(6, '0')}`)
    first.parentElement?.append(copy)
  }
}

let stop: () => void = () => {}

/**
 * The youtube.com content script, `youtube.content.ts` as WXT runs it, on the creator's channel
 * page past the give-up time, listening for the background's messages through a fake
 * `runtime.onMessage`.
 */
async function showChannelPage() {
  const listeners = new Set<(message: unknown) => void>()
  const fake = fakeYouTubeBackground({
    channels: [nick],
    uploads: { [nick.youtubeChannelId]: myUploads },
  })
  // The background's answer to whether YouTube access is granted, which a restore asks.
  const access = { granted: true }
  const background = {
    asked: fake.asked,
    ask: (async (request: BackgroundRequest) => {
      if (request.type !== 'youtube-access') return fake.ask(request)
      fake.asked.push(request)
      return access.granted
    }) as AskBackground,
  }
  // `wxt/browser` reads the runtime as its module loads, and WXT treats a context as valid while
  // the runtime has an id, so the modules are reset and imported afresh.
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'stillstats-test',
      sendMessage: background.ask,
      onMessage: {
        addListener: (listener: (message: unknown) => void) => void listeners.add(listener),
        removeListener: (listener: (message: unknown) => void) => void listeners.delete(listener),
      },
    },
  })
  vi.resetModules()
  const { ContentScriptContext } = await import('wxt/utils/content-script-context')
  const { default: youtubeContent } = await import('./entrypoints/youtube.content.ts')
  const ctx = new ContentScriptContext('youtube')
  youtubeContent.main(ctx)
  stop = () => {
    ctx.abort()
    vi.unstubAllGlobals()
  }
  await vi.advanceTimersByTimeAsync(giveUpAfterMs)
  return {
    asked: background.asked,
    /** YouTube access is removed while the page is away, so no message reaches it. */
    removeAccessWhileAway() {
      access.granted = false
    },
    /** The background's message reaches the tab. */
    deliver(message: unknown) {
      for (const listener of listeners) listener(message)
    },
  }
}

/** The browser restores the page from its back/forward cache. */
async function browserRestoresThePage(): Promise<void> {
  window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }))
  await vi.advanceTimersByTimeAsync(0)
}

/** YouTube keeps changing the page and draws new tiles, past the watch's give-up time. */
async function youtubeKeepsChanging(): Promise<void> {
  youtubeDrawsTiles(5)
  for (let at = 0; at <= giveUpAfterMs; at += 1_000) {
    studioChanges()
    await vi.advanceTimersByTimeAsync(1_000)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  history.replaceState(null, '', loadYouTubePage('channel-videos'))
})

afterEach(() => {
  stop()
  vi.useRealTimers()
})

test('once YouTube access is removed, an open www.youtube.com tab takes its pills down without a reload, and reads nothing after', async () => {
  const tab = await showChannelPage()
  expect(pills()).not.toEqual([])
  const readsBefore = reads(tab.asked).length
  expect(readsBefore).toBeGreaterThan(0)

  tab.deliver(youtubeAccessRemovedMessage)

  expect(pills()).toEqual([])
  await youtubeKeepsChanging()
  expect(pills()).toEqual([])
  expect(reads(tab.asked)).toHaveLength(readsBefore)
})

test('with YouTube access kept, the same changes draw pills on the new tiles from the uploads already read, sending no video id', async () => {
  const tab = await showChannelPage()
  const shown = pills().length

  await youtubeKeepsChanging()

  expect(pills()).toHaveLength(shown + 5)
  expect(reads(tab.asked).filter(({ type }) => type === 'read-uploads')).toEqual([
    { type: 'read-uploads', youtubeChannelId: nick.youtubeChannelId },
  ])
  expect(videoIdsSentIn(tab.asked)).toEqual([])
})

test.each([
  ['a usage event answer', true],
  ['another message', { type: 'read-videos' }],
])('%s from the background leaves the pills up', async (_, message) => {
  const tab = await showChannelPage()
  const shown = pills().length

  tab.deliver(message)

  expect(pills()).toHaveLength(shown)
})

test('a www.youtube.com page restored from the back/forward cache after YouTube access was removed takes its pills down, and reads nothing after', async () => {
  const tab = await showChannelPage()
  expect(pills()).not.toEqual([])
  const readsBefore = reads(tab.asked).length

  tab.removeAccessWhileAway()
  await browserRestoresThePage()

  expect(tab.asked).toContainEqual({ type: 'youtube-access' })
  expect(pills()).toEqual([])
  await youtubeKeepsChanging()
  expect(pills()).toEqual([])
  expect(reads(tab.asked)).toHaveLength(readsBefore)
})

test('a page restored with YouTube access kept leaves every pill up', async () => {
  const tab = await showChannelPage()
  const shown = pills().length
  expect(shown).toBeGreaterThan(0)

  await browserRestoresThePage()

  expect(tab.asked).toContainEqual({ type: 'youtube-access' })
  expect(pills()).toHaveLength(shown)
})
