// Limits: these tests relay to a fake OpenPanel receiver, so they cannot prove that the self-hosted
// OpenPanel accepts the request, that the forwarded IP is the creator's behind the production
// proxy, or that OpenPanel derives the same device id for an extension event as for the web app's.
// The fake applies no IP_HEADER_ORDER, so the IP tests prove which IP the relay sends and under
// which headers, not that OpenPanel picks it over a cf-connecting-ip a proxy in front of OpenPanel
// sets. Nick seeing an extension event in OpenPanel next to the web app's events covers the rest,
// and checking that event's country in OpenPanel matches the creator's, not the API server's,
// covers the IP.
import type { WebDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import { startFakeOpenPanel } from '@creator-analytics/event-relay/testing'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { signIn } from '../test/flows.ts'
import { startApi } from '../test/start-api.ts'
import { eventLimitPerWindow, eventWindowMs } from './event-limit.ts'

// An email no other test file signs in with. Test files run in parallel against one database, and
// two files that sign in the same emails in a different order deadlock on the unique email index.
const creator = { sub: '489001', email: 'relayer@example.com', name: 'A Relayer' }
const otherCreator = { sub: '489002', email: 'other-relayer@example.com', name: 'Another Relayer' }

const studioUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

async function signedInRelaying(web: WebDatabase, options: Parameters<typeof startApi>[1] = {}) {
  const api = await startApi(web, options)
  return { api, browser: await signIn(api, creator) }
}

function postEvent(browser: Browser, body: unknown, headers: Record<string, string> = {}) {
  return browser.fetch('/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': studioUserAgent, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('seam 1: the API relays the Studio extension events to OpenPanel', () => {
  test.for([
    ['extension_installed', {}],
    ['extension_sign_in_clicked', { surface: 'card' }],
    ['extension_sign_in_clicked', { surface: 'content_list' }],
    ['extension_sign_in_clicked', { surface: 'analytics' }],
    ['extension_connect_channel_clicked', { surface: 'card' }],
    ['extension_connect_channel_clicked', { surface: 'content_list' }],
    ['extension_connect_channel_clicked', { surface: 'analytics' }],
    ['extension_surface_shown', { surface: 'card' }],
    ['extension_surface_shown', { surface: 'content_list' }],
    ['extension_surface_shown', { surface: 'analytics' }],
    ['extension_surface_missing', { surface: 'card' }],
    ['extension_surface_missing', { surface: 'content_list' }],
    ['extension_surface_missing', { surface: 'analytics' }],
    ['extension_surface_shown', { surface: 'channel_page' }],
    ['extension_surface_shown', { surface: 'watch_page' }],
    ['extension_surface_shown', { surface: 'feed' }],
    ['extension_surface_shown', { surface: 'shorts' }],
    ['extension_surface_missing', { surface: 'channel_page' }],
    ['extension_surface_missing', { surface: 'watch_page' }],
    ['extension_surface_missing', { surface: 'feed' }],
    ['extension_surface_missing', { surface: 'shorts' }],
    ['extension_web_app_opened', { surface: 'card' }],
    ['extension_web_app_opened', { surface: 'content_list' }],
    ['extension_web_app_opened', { surface: 'analytics' }],
    ['extension_popup_web_app_opened', {}],
    ['extension_popup_feedback_opened', {}],
    ['extension_popup_sign_in_clicked', {}],
    ['extension_youtube_access_granted', {}],
    ['extension_youtube_access_removed', {}],
    ['extension_surface_shown', { surface: 'card', ms: 1200, fromCache: false }],
    ['extension_surface_shown', { surface: 'content_list', ms: 0, fromCache: true }],
    ['extension_surface_shown', { surface: 'channel_page', ms: 4300, fromCache: false }],
    ['extension_surface_shown', { surface: 'shorts', ms: 85, fromCache: true }],
  ] as const)(
    '%s with %o reaches OpenPanel with those values and nothing more',
    async ([name, properties], { web }) => {
      const openPanel = await startFakeOpenPanel()
      const { browser } = await signedInRelaying(web, { openPanel })

      const response = await postEvent(browser, { name, ...properties })

      expect(response.status).toBe(204)
      expect(openPanel.received).toEqual([
        {
          method: 'POST',
          path: '/track',
          headers: expect.objectContaining({
            'openpanel-client-id': openPanel.clientId,
            'openpanel-client-secret': openPanel.clientSecret,
            'user-agent': studioUserAgent,
          }),
          body: { type: 'track', payload: { name, properties } },
        },
      ])
    },
  )

  test.for([
    ['an unknown name', { name: 'extension_uninstalled' }],
    ['a missing value', { name: 'extension_surface_shown' }],
    ['a sign-in click with no surface', { name: 'extension_sign_in_clicked' }],
    [
      "a surface on the popup's sign-in click",
      { name: 'extension_popup_sign_in_clicked', surface: 'card' },
    ],
    [
      'a surface on the YouTube access grant',
      { name: 'extension_youtube_access_granted', surface: 'card' },
    ],
    [
      'a surface on the YouTube access removal',
      { name: 'extension_youtube_access_removed', surface: 'card' },
    ],
    ['an unknown value', { name: 'extension_surface_shown', surface: 'comments' }],
    ['a value on an event that takes none', { name: 'extension_installed', surface: 'card' }],
    ['an extra key', { name: 'extension_surface_shown', surface: 'card', videoId: 'dQw4w9WgXcQ' }],
    ['a body that is not an event', ['extension_installed']],
    ['a body that is not JSON', '{"name":'],
  ] as const)('%s answers 400 invalid_event and sends nothing', async ([, body], { web }) => {
    const openPanel = await startFakeOpenPanel()
    const { browser } = await signedInRelaying(web, { openPanel })

    const response = await postEvent(browser, body)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_event' })
    expect(openPanel.received).toEqual([])
  })

  // Each malformed time or cache result beside a timed shown event the relay accepts, so the 400
  // is the malformed value's and not the timing's.
  test.for([
    ['a time with no cache result', { name: 'extension_surface_shown', surface: 'card', ms: 1200 }],
    [
      'a cache result with no time',
      { name: 'extension_surface_shown', surface: 'card', fromCache: true },
    ],
    [
      'a negative time',
      { name: 'extension_surface_shown', surface: 'card', ms: -1, fromCache: false },
    ],
    [
      'a fractional time',
      { name: 'extension_surface_shown', surface: 'card', ms: 12.5, fromCache: false },
    ],
    [
      'a time as a string',
      { name: 'extension_surface_shown', surface: 'card', ms: '1200', fromCache: false },
    ],
    [
      'a time past the safe integers',
      { name: 'extension_surface_shown', surface: 'card', ms: 2 ** 53, fromCache: false },
    ],
    [
      'a cache result that is not a boolean',
      { name: 'extension_surface_shown', surface: 'card', ms: 1200, fromCache: 'true' },
    ],
    [
      'a time and cache result with no surface',
      { name: 'extension_surface_shown', ms: 1200, fromCache: false },
    ],
    [
      'a time on a missing surface',
      { name: 'extension_surface_missing', surface: 'card', ms: 1200, fromCache: false },
    ],
    [
      'a time on a click',
      { name: 'extension_web_app_opened', surface: 'card', ms: 1200, fromCache: false },
    ],
    [
      'a time on an event that takes no value',
      { name: 'extension_installed', ms: 1200, fromCache: false },
    ],
    [
      'an ID beside the time',
      {
        name: 'extension_surface_shown',
        surface: 'watch_page',
        ms: 1200,
        fromCache: false,
        videoId: 'dQw4w9WgXcQ',
      },
    ],
  ] as const)(
    '%s answers 400 invalid_event and sends nothing, where a well-formed time relays',
    async ([, body], { web }) => {
      const openPanel = await startFakeOpenPanel()
      const { browser } = await signedInRelaying(web, { openPanel })
      const timed = { name: 'extension_surface_shown', surface: 'card', ms: 1200, fromCache: false }

      const response = await postEvent(browser, body)
      const timedResponse = await postEvent(browser, timed)

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'invalid_event' })
      expect(timedResponse.status).toBe(204)
      expect(openPanel.received.map(({ body }) => body)).toEqual([
        {
          type: 'track',
          payload: {
            name: timed.name,
            properties: { surface: 'card', ms: 1200, fromCache: false },
          },
        },
      ])
    },
  )

  test('a signed-out request answers 401 and sends nothing', async ({ web }) => {
    const openPanel = await startFakeOpenPanel()
    const { browser } = await signedInRelaying(web, { openPanel })
    const signedInResponse = await postEvent(browser, { name: 'extension_installed' })
    await browser.postJson('/api/auth/sign-out', {})

    const response = await postEvent(browser, { name: 'extension_installed' })

    expect(signedInResponse.status).toBe(204)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'unauthenticated' })
    expect(openPanel.received).toHaveLength(1)
  })

  test.for([
    'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
    'moz-extension://2c127fa4-62c7-7e4f-90e5-472b45eecfdc',
  ])('a signed-in request from %s is relayed', async (origin, { web }) => {
    const openPanel = await startFakeOpenPanel()
    const { browser } = await signedInRelaying(web, { openPanel })

    const response = await postEvent(browser, { name: 'extension_installed' }, { origin })

    expect(response.status).toBe(204)
    expect(openPanel.received).toHaveLength(1)
  })

  // Cloudflare keeps an X-Forwarded-For the client sent and appends to it, so only the
  // CF-Connecting-IP it sets is the creator's.
  test("the creator's IP from Cloudflare reaches OpenPanel, not one the client chose", async ({
    web,
  }) => {
    const openPanel = await startFakeOpenPanel()
    const { browser } = await signedInRelaying(web, { openPanel })

    await postEvent(
      browser,
      { name: 'extension_installed' },
      { 'x-forwarded-for': '198.51.100.9, 203.0.113.7', 'cf-connecting-ip': '203.0.113.7' },
    )

    expect(openPanel.received[0]?.headers['openpanel-client-ip']).toBe('203.0.113.7')
  })

  // An OpenPanel older than 2025-11-17 ignores openpanel-client-ip and reads x-client-ip first.
  test("the creator's IP also reaches OpenPanel as x-client-ip, for an OpenPanel too old to read openpanel-client-ip", async ({
    web,
  }) => {
    const openPanel = await startFakeOpenPanel()
    const { browser } = await signedInRelaying(web, { openPanel })

    await postEvent(browser, { name: 'extension_installed' }, { 'cf-connecting-ip': '203.0.113.7' })

    expect(openPanel.received[0]?.headers['x-client-ip']).toBe('203.0.113.7')
  })

  test('with no proxy, the socket address reaches OpenPanel as the client IP', async ({ web }) => {
    const openPanel = await startFakeOpenPanel()
    const { browser } = await signedInRelaying(web, { openPanel })

    await postEvent(browser, { name: 'extension_installed' })

    expect(openPanel.received[0]?.headers['openpanel-client-ip']).toMatch(
      /^(::1|(::ffff:)?127\.0\.0\.1)$/,
    )
  })

  test('with OpenPanel unset, a valid event answers 204 and reports nothing', async ({ web }) => {
    const { api, browser } = await signedInRelaying(web)

    const response = await postEvent(browser, { name: 'extension_installed' })

    expect(response.status).toBe(204)
    expect(api.reporter.reports).toEqual([])
  })

  test('an event OpenPanel refuses still answers 204, and the refusal is reported', async ({
    web,
  }) => {
    const openPanel = await startFakeOpenPanel()
    openPanel.answerWith(500)
    const { api, browser } = await signedInRelaying(web, { openPanel })

    const response = await postEvent(browser, { name: 'extension_installed' })

    expect(response.status).toBe(204)
    expect(api.reporter.reports).toEqual([
      { message: 'OpenPanel refused a relayed event', context: { status: '500' } },
    ])
  })

  test('an event whose connection OpenPanel drops still answers 204, and the failure is reported', async ({
    web,
  }) => {
    const openPanel = await startFakeOpenPanel()
    openPanel.dropEveryRequest()
    const { api, browser } = await signedInRelaying(web, { openPanel })

    const response = await postEvent(browser, { name: 'extension_installed' })

    expect(response.status).toBe(204)
    expect(api.reporter.reports).toEqual([
      { message: 'The event relay could not reach OpenPanel', error: expect.any(Error) },
    ])
  })
})

describe('seam 1: the API limits how many events one user relays in a window', () => {
  // The start of a window, so no test's events straddle a window boundary.
  const windowStart = new Date(
    Math.ceil(Date.parse('2026-10-10T12:00:00Z') / eventWindowMs) * eventWindowMs,
  )

  async function postEvents(browser: Browser, count: number): Promise<number[]> {
    const statuses: number[] = []
    for (let i = 0; i < count; i++) {
      statuses.push((await postEvent(browser, { name: 'extension_installed' })).status)
    }
    return statuses
  }

  test('the 61st event in one clock minute answers 429 rate_limited and sends nothing', async ({
    web,
    clock,
  }) => {
    clock.set(windowStart)
    const openPanel = await startFakeOpenPanel()
    const { browser } = await signedInRelaying(web, { openPanel, clock: clock.now })

    const accepted = await postEvents(browser, 60)
    const response = await postEvent(browser, { name: 'extension_installed' })

    expect(accepted).toEqual(Array(60).fill(204))
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ error: 'rate_limited' })
    expect(openPanel.received).toHaveLength(60)
  })
  test('invalid events count toward the limit, so a valid event after a full window of them answers 429', async ({
    web,
    clock,
  }) => {
    clock.set(windowStart)
    const openPanel = await startFakeOpenPanel()
    const { browser } = await signedInRelaying(web, { openPanel, clock: clock.now })

    const refused: number[] = []
    for (let i = 0; i < eventLimitPerWindow; i++) {
      refused.push((await postEvent(browser, { name: 'extension_uninstalled' })).status)
    }
    const response = await postEvent(browser, { name: 'extension_installed' })

    expect(refused).toEqual(Array(eventLimitPerWindow).fill(400))
    expect(response.status).toBe(429)
    expect(openPanel.received).toEqual([])
  })
  test("once the window passes, the user's next event is relayed", async ({ web, clock }) => {
    clock.set(windowStart)
    const openPanel = await startFakeOpenPanel()
    const { browser } = await signedInRelaying(web, { openPanel, clock: clock.now })
    await postEvents(browser, eventLimitPerWindow + 1)

    clock.advance(eventWindowMs)
    const response = await postEvent(browser, { name: 'extension_installed' })

    expect(response.status).toBe(204)
    expect(openPanel.received).toHaveLength(eventLimitPerWindow + 1)
  })
  test("one user's limit does not refuse another user's events", async ({ web, clock }) => {
    clock.set(windowStart)
    const openPanel = await startFakeOpenPanel()
    const { api, browser } = await signedInRelaying(web, { openPanel, clock: clock.now })
    const otherBrowser = await signIn(api, otherCreator)
    await postEvents(browser, eventLimitPerWindow)

    const refused = await postEvent(browser, { name: 'extension_installed' })
    const response = await postEvent(otherBrowser, { name: 'extension_installed' })

    expect(refused.status).toBe(429)
    expect(response.status).toBe(204)
    expect(openPanel.received).toHaveLength(eventLimitPerWindow + 1)
  })
})
