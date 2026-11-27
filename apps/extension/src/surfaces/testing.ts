import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  ExtensionEvent,
  ExtensionSurface,
  ListedChannel,
  VideoRow,
} from '@creator-analytics/api-types'
import { expect, vi } from 'vitest'
import { signedInReadKeptMs } from '../kept.ts'
import {
  type AskBackground,
  type BackgroundRequest,
  type SurfaceEvent,
  surfaceEventNames,
} from '../messages.ts'
import type { ChannelsRead, UploadsRead } from '../product-api.ts'
import { giveUpAfterMs, passEveryMs, type Surface, watchPage } from './page-watcher.ts'

/** The two ways a creator opens a link: a click, and a middle-click, which fires `auxclick`. */
export const clicks = [
  ['a click', () => new MouseEvent('click', { bubbles: true, cancelable: true })],
  [
    'a middle-click',
    () => new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }),
  ],
] as const

/** The usage events among `asked`: the watch's surface events, and the links' clicks. */
export const eventsIn = (asked: BackgroundRequest[]): ExtensionEvent[] =>
  asked.flatMap((request) => (request.type === 'usage-event' ? [request.event] : []))

const watchEventNames: readonly ExtensionEvent['name'][] = surfaceEventNames

/**
 * The shown event the watch reports for `surface`, with `fromCache`, and `ms` when the test is about
 * the time, else any time.
 */
export const shownOn = (
  surface: ExtensionSurface,
  { ms, fromCache }: { ms?: number; fromCache: boolean },
) => ({
  name: 'extension_surface_shown' as const,
  surface,
  ms: ms ?? expect.any(Number),
  fromCache,
})

/** The usage events among `asked` that the links sent, not the watch. */
export const clicksIn = (asked: BackgroundRequest[]): ExtensionEvent[] =>
  eventsIn(asked).filter(({ name }) => !watchEventNames.includes(name))

/**
 * The declarations of the rule for `selector` in one of the extension's shadow stylesheets, read
 * from the sheet itself where jsdom's computed style does not reach (`:host`) or resolves the value
 * away (`lh`).
 */
export function declaredFor(host: Element | null | undefined, selector: string) {
  const sheet = host?.shadowRoot?.querySelector('style')?.sheet
  return [...(sheet?.cssRules ?? [])].find(
    (rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && rule.selectorText === selector,
  )?.style
}

/**
 * Every `background*`, `border*` and `padding*` declaration in any rule of the host's shadow
 * stylesheet, as `selector { property: value }`: what would draw a capsule around the pill. Read
 * from the sheet, as `declaredFor` does, since jsdom's computed style does not reach `:host`. Empty
 * when the host draws no capsule.
 */
export function capsuleOf(host: Element | null | undefined): string[] {
  const sheet = host?.shadowRoot?.querySelector('style')?.sheet
  return [...(sheet?.cssRules ?? [])].flatMap((rule) =>
    rule instanceof CSSStyleRule
      ? [...rule.style]
          .filter((property) => /^(?:background|border|padding)/.test(property))
          .map(
            (property) =>
              `${rule.selectorText} { ${property}: ${rule.style.getPropertyValue(property)} }`,
          )
      : [],
  )
}

/**
 * The element the host's shadow root draws before the pill, or undefined when the pill opens the
 * shadow root. Its text is the test file's to read: test/page-boundary.test.ts scans this file
 * with the surfaces, so it reads no text here.
 */
export function separatorBefore(host: Element | null | undefined): Element | undefined {
  const before = host?.shadowRoot?.querySelector('.pill')?.previousElementSibling
  return before && before.localName !== 'style' ? before : undefined
}

/** Studio keeps changing its page, and each change runs a pass. */
export const studioChanges = () => document.body.append(document.createElement('div'))

/** Studio keeps changing its page for `ms`, as it does while it animates. */
export async function studioKeepsChangingFor(ms: number): Promise<void> {
  for (let at = 0; at < ms; at += passEveryMs) {
    studioChanges()
    await vi.advanceTimersByTimeAsync(passEveryMs)
  }
}

/**
 * `vi.advanceTimersByTimeAsync` for a test that runs long, which throws once vitest has aborted the
 * test's `signal`. Vitest cannot stop the body of a test that timed out: it would go on advancing
 * the fake timers, which are shared, and drive the next test's watch through minutes it never asked
 * for. Thrown before and after each advance, so the body touches nothing of the next test's page.
 */
export function advanceWhileRunning(signal: AbortSignal): (ms: number) => Promise<void> {
  return async (ms) => {
    signal.throwIfAborted()
    await vi.advanceTimersByTimeAsync(ms)
    signal.throwIfAborted()
  }
}

/** Lets the line's keep time pass, then has Studio change its page, so the surface reads again. */
export async function readAgain(): Promise<void> {
  await vi.advanceTimersByTimeAsync(signedInReadKeptMs)
  studioChanges()
  await vi.advanceTimersByTimeAsync(1_000)
}

/** Has Studio change its page at the moment that makes the pass it starts run at `time`. */
export async function passAt(time: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(time - passEveryMs - Date.now())
  studioChanges()
  await vi.advanceTimersByTimeAsync(passEveryMs)
}

/**
 * Studio's content script as WXT 0.21.4 runs it, wired as `studio.content.ts` wires it: the watch
 * over `surfaces` on `location.href`, told of each navigation by WXT's own location watcher through
 * `wxt:locationchange`, and stopped when WXT's context is. With `navigationApi`, WXT listens for
 * the Navigation API's `navigate` events, which a fake `navigation` dispatches here; without, it
 * polls `location.href` every second on the test's timers. The jsdom page must be on a
 * studio.youtube.com URL (the test file's `@vitest-environment-options`), where the watch starts.
 *
 * WXT reads whether the Navigation API is there when its module loads, so the modules are reset
 * and WXT's imported afresh. The root `vitest.config.ts` runs WXT's runtime modules through Vite,
 * which gives them the `import.meta.env` WXT's build would.
 */
export async function watchThroughWxt({
  surfaces,
  report,
  navigationApi,
}: {
  surfaces: Surface[]
  report: (event: SurfaceEvent) => void
  navigationApi: boolean
}): Promise<{
  /**
   * A Navigation API `navigate` to `url`, which WXT reports at once, before the URL moves. Alone,
   * it is a navigate that never commits: cancelled, a download, or a 204.
   */
  navigateEvent(url: string): void
  /** The URL moves to `url` in the page, as Studio's router moves it with `pushState`. */
  moveTo(url: string): void
  /** WXT invalidates the content script, as an update or a disable does. */
  stop(): void
}> {
  const navigation = navigationApi ? new EventTarget() : undefined
  vi.stubGlobal('navigation', navigation)
  // WXT treats a context as valid while the extension's runtime has an id.
  vi.stubGlobal('chrome', { runtime: { id: 'stillstats-test' } })
  vi.resetModules()
  const { ContentScriptContext } = await import('wxt/utils/content-script-context')
  const ctx = new ContentScriptContext('studio')
  const watcher = watchPage({ document, url: () => location.href, surfaces, report })
  ctx.addEventListener(window, 'wxt:locationchange', (event) =>
    watcher.navigated(event.newUrl.href),
  )
  ctx.onInvalidated(watcher.stop)
  const navigateEvent = (url: string) => {
    const event = Object.assign(new Event('navigate'), { destination: { url } })
    navigation?.dispatchEvent(event)
  }
  return {
    navigateEvent,
    moveTo(url) {
      // The Navigation API fires `navigate` for a `pushState` too.
      navigateEvent(new URL(url, location.href).href)
      history.pushState(null, '', url)
    },
    stop() {
      ctx.abort()
      vi.unstubAllGlobals()
    },
  }
}

/** The saved youtube.com pages in `test/fixtures/youtube`, by file name without `.html`. */
export type YouTubePage =
  | 'channel-videos'
  | 'channel-home'
  | 'channel-shorts'
  | 'channel-streams'
  | 'watch'
  | 'home-feed'
  | 'search'
  | 'shorts-player'

/**
 * Puts the saved youtube.com page in the jsdom document, as Chrome drew it, and answers the URL it
 * was saved from, which the first line of each fixture records.
 */
export function loadYouTubePage(name: YouTubePage): string {
  const fixture = readFileSync(
    join(import.meta.dirname, `../../test/fixtures/youtube/${name}.html`),
    'utf8',
  )
  const page = new DOMParser().parseFromString(fixture, 'text/html')
  document.replaceChild(document.importNode(page.documentElement, true), document.documentElement)
  return /^<!-- (\S+) /.exec(fixture)?.[1] ?? ''
}

/** A video the API answers with `engagedViews`. */
export function videoOf(id: string, engagedViews: number): VideoRow {
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

/** The ids of every video and Short a saved youtube.com page links, each once, in page order. */
export function savedVideoIds(name: YouTubePage): string[] {
  const fixture = readFileSync(
    join(import.meta.dirname, `../../test/fixtures/youtube/${name}.html`),
    'utf8',
  )
  const ids = [...fixture.matchAll(/href="\/(?:watch\?v=|shorts\/)([\w-]{11})/g)].map(
    ([, id]) => id as string,
  )
  return [...new Set(ids)]
}

/** How the fake background answers a held channel's uploads given as ids. */
export interface UploadsAnswer {
  /** Each video's engaged views; 334,212 for all of them unless set. */
  engagedViews?: (id: string) => number
  /** Ids YouTube has not processed yet. */
  awaiting?: readonly string[]
  lastProcessedDay?: string
  /** Whether every page of the read came from the cache; false unless set. */
  fromCache?: boolean
}

/**
 * Two held channels' uploads, the first's read failing at once and the second's failing a failed
 * read's keep later, with `redraw` halfway. The first's failed read no longer stands when the pass
 * answers, so the next pass reads it again, answering `retried` in 100 ms: `shownMs` is the figure's
 * time when the failed pass carries no start, from the pass the watch's give-up asks for.
 */
export function failingAcrossTheKeep(
  [first, second]: readonly [string, string],
  redraw: () => void,
  retried: readonly string[],
): { uploads: Record<string, UploadsOfChannel>; shownMs: number } {
  const failed: UploadsRead = { state: 'failed' }
  return {
    uploads: {
      [first]: async (call: number): Promise<UploadsRead> => {
        if (call === 1) return failed
        await new Promise((resolve) => setTimeout(resolve, 100))
        return uploadsOf(retried)
      },
      [second]: async (): Promise<UploadsRead> => {
        await new Promise((resolve) => setTimeout(resolve, signedInReadKeptMs / 2))
        redraw()
        await new Promise((resolve) => setTimeout(resolve, signedInReadKeptMs / 2))
        return failed
      },
    },
    shownMs: passEveryMs + signedInReadKeptMs + 100 - giveUpAfterMs,
  }
}

/** A held channel's uploads read holding `ids`. */
export function uploadsOf(
  ids: readonly string[],
  {
    engagedViews = () => 334_212,
    awaiting = [],
    lastProcessedDay = '2026-10-07',
    fromCache = false,
  }: UploadsAnswer = {},
): UploadsRead {
  const videos = ids.map((id) => ({
    ...videoOf(id, engagedViews(id)),
    awaitingProcessing: awaiting.includes(id),
  }))
  return { state: 'read', channelId: 'channel-1', videos, lastProcessedDay, fromCache }
}

/**
 * What the fake background answers one held channel's uploads read: the channel's upload ids, a
 * whole read, or, per call from 1, either of them or one the test holds out or fails.
 */
export type UploadsOfChannel =
  | readonly string[]
  | UploadsRead
  | ((call: number) => readonly string[] | UploadsRead | Promise<UploadsRead>)

/**
 * Every video id a youtube.com tab sent the background: the ids of a read of videos, and any
 * request's `videoId`. A public page sends none (creator-analytics#520), so the tests expect `[]`.
 */
export function videoIdsSentIn(asked: readonly BackgroundRequest[]): string[] {
  return asked.flatMap((request) => {
    const ids = Reflect.get(request, 'ids')
    const videoId = Reflect.get(request, 'videoId')
    return [
      ...(Array.isArray(ids) ? ids.map(String) : []),
      ...(typeof videoId === 'string' ? [videoId] : []),
    ]
  })
}

/**
 * A fake background's `through` that holds each uploads read `ms` of the test's time before it is
 * answered, and lets every other request through at once.
 */
export const uploadsAnsweredAfter =
  (ms: number) =>
  (request: BackgroundRequest): Promise<unknown> =>
    request.type === 'read-uploads'
      ? new Promise((resolve) => setTimeout(resolve, ms))
      : Promise.resolve()

/** The uploads reads among `asked`, by the channel each asks for. */
export const uploadsAskedIn = (asked: readonly BackgroundRequest[]): string[] =>
  asked.flatMap((request) => (request.type === 'read-uploads' ? [request.youtubeChannelId] : []))

/**
 * A fake background for a youtube.com tab: it answers `read-channels` with `channels`, a channel
 * list or a whole read, each `read-uploads` with that channel's `uploads` (a held channel not in
 * `uploads` has none), with the `answer` knobs for uploads given as ids, and every usage event as
 * settled, recording each request in `asked`. It answers `read-videos` failed, as the background
 * answers a youtube.com tab's, so a surface that asks for ids shows nothing and its test fails on
 * `videoIdsSentIn`.
 */
export function fakeYouTubeBackground({
  channels,
  uploads = {},
  answer,
}: {
  channels: ListedChannel[] | ChannelsRead
  uploads?: Readonly<Record<string, UploadsOfChannel>>
  answer?: UploadsAnswer | undefined
}): { ask: AskBackground; asked: BackgroundRequest[] } {
  const asked: BackgroundRequest[] = []
  const calls = new Map<string, number>()
  const channelsRead: ChannelsRead = Array.isArray(channels)
    ? { state: 'signed-in', channels }
    : channels
  const read = (given: readonly string[] | UploadsRead): UploadsRead =>
    'state' in given ? given : uploadsOf(given as readonly string[], answer)
  const ask = (async (request: BackgroundRequest) => {
    asked.push(request)
    if (request.type === 'read-channels') return channelsRead
    if (request.type === 'read-videos') return { state: 'failed' }
    if (request.type === 'read-uploads') {
      const { youtubeChannelId } = request
      const call = (calls.get(youtubeChannelId) ?? 0) + 1
      calls.set(youtubeChannelId, call)
      const given = uploads[youtubeChannelId] ?? []
      if (typeof given !== 'function') return read(given)
      const answered = await given(call)
      return read(answered)
    }
    return true
  }) as AskBackground
  return { ask, asked }
}
