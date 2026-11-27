// Limits: these tests give consent against the fake Google server, so they cannot prove Google's
// real incremental consent screen, the scope strings it grants, or real revenue figures. Nick giving
// revenue consent for his own channel on the deployed product covers them.
import type { ChannelSummaryAnswer } from '@creator-analytics/api-types'
import { connections, type WebDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import { scopeUrls } from '@creator-analytics/token-vault'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { channelsOf, connect, giveRevenueConsent, signIn, userIdOf } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'

// Emails no other test file signs in with. Test files run in parallel against one database, and
// two files that sign in the same emails in a different order deadlock on the unique email index.
const creator = { sub: '504729', email: 'earner@example.com', name: 'An Earner' }
const otherCreator = { sub: '604729', email: 'other-earner@example.com', name: 'Another Earner' }

/** Signs the creator in and connects their channel, which earns 12.34 USD of estimated revenue. */
async function connectedCreator(api: StartedApi) {
  const browser = await signIn(api, creator)
  api.google.pickChannel('UC-earner')
  api.google.setChannel('UC-earner', { createdAt: '2019-03-01T06:00:00Z', uploads: [] })
  api.google.setRevenue('UC-earner', { estimatedRevenue: 12.34 })
  await connect(browser)
  const { channels } = await channelsOf(browser)
  const channelId = channels[0]?.id
  if (!channelId) throw new Error('The creator has no connected channel')
  return { browser, channelId }
}

/** The stored connection of the user who signed in with this email, read in their user scope. */
async function connectionOf(web: WebDatabase, email: string) {
  const userId = await userIdOf(web, email)
  const [connection] = await web.asUser(userId, (tx) => tx.sql.select().from(connections))
  return connection
}

/** The estimated revenue the channel summary carries, or undefined when it carries none. */
async function summaryRevenueOf(browser: Browser, channelId: string) {
  const response = await browser.fetch(`/api/channels/${channelId}/summary`)
  const { revenue } = (await response.json()) as ChannelSummaryAnswer
  return 'estimatedRevenue' in revenue ? revenue.estimatedRevenue : undefined
}

describe('seam 1: revenue consent', () => {
  test('a creator gives revenue consent and sees it recorded on the channel', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    const landedOn = await giveRevenueConsent(browser, channelId)

    expect(landedOn.toString()).toBe(`${api.origin}/app?revenue_consented=1`)
    expect(await channelsOf(browser)).toEqual({
      channels: [
        {
          id: channelId,
          youtubeChannelId: 'UC-earner',
          title: null,
          handle: null,
          revenueConsentedAt: expect.any(String),
        },
      ],
    })
  })

  test('the revenue consent asks for the monetary scope, openid and email only, through incremental authorization', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    await giveRevenueConsent(browser, channelId)

    const consent = api.google.authorizationRequests.at(-1)
    expect(consent?.get('scope')?.split(' ').sort()).toEqual(
      ['email', 'openid', scopeUrls['yt-analytics-monetary.readonly']].sort(),
    )
    expect(consent?.get('include_granted_scopes')).toBe('true')
  })

  test("the revenue consent opens Google's account chooser, with no login_hint", async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    await giveRevenueConsent(browser, channelId)

    const consent = api.google.authorizationRequests.at(-1)
    expect(consent?.has('login_hint')).toBe(false)
    expect(consent?.get('prompt')).toBe('select_account consent')
  })

  test("the channel lists its revenue consent at the monetary scope's grant time", async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)

    await giveRevenueConsent(browser, channelId)

    const stored = await connectionOf(web, creator.email)
    const monetary = stored?.scopes.find(({ name }) => name === 'yt-analytics-monetary.readonly')
    expect(monetary?.grantedAt).toEqual(expect.any(String))
    const { channels } = await channelsOf(browser)
    expect(channels[0]?.revenueConsentedAt).toBe(monetary?.grantedAt)
  })

  test('picking a different channel on the revenue step is refused with channel_mismatch and nothing changes', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const before = await connectionOf(web, creator.email)
    const listed = await channelsOf(browser)
    api.google.pickChannel('UC-another')

    const landedOn = await giveRevenueConsent(browser, channelId)

    expect(landedOn.pathname).toBe('/app')
    expect(landedOn.searchParams.get('revenue_error')).toBe('channel_mismatch')
    expect(await connectionOf(web, creator.email)).toEqual(before)
    expect(await channelsOf(browser)).toEqual(listed)
  })

  test('a revenue consent with the monetary scope unchecked is refused with scopes_missing and nothing changes', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const before = await connectionOf(web, creator.email)
    api.google.uncheckScopes([scopeUrls['yt-analytics-monetary.readonly']])

    const landedOn = await giveRevenueConsent(browser, channelId)

    expect(landedOn.searchParams.get('revenue_error')).toBe('scopes_missing')
    expect(await connectionOf(web, creator.email)).toEqual(before)
  })

  test('a refused revenue consent is refused with consent_denied and nothing changes', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const before = await connectionOf(web, creator.email)
    api.google.refuseConsent()

    const landedOn = await giveRevenueConsent(browser, channelId)

    expect(landedOn.searchParams.get('revenue_error')).toBe('consent_denied')
    expect(await connectionOf(web, creator.email)).toEqual(before)
  })

  test('a revenue consent whose code exchange Google answers with a 503 lands on google_failed and nothing changes', async ({
    web,
  }) => {
    const api = await startApi(web, { googleCallTimeoutMs: 500 })
    const { browser, channelId } = await connectedCreator(api)
    const before = await connectionOf(web, creator.email)
    api.google.failTokenEndpoint(503)

    const landedOn = await giveRevenueConsent(browser, channelId)

    expect(landedOn.pathname).toBe('/app')
    expect(landedOn.searchParams.get('revenue_error')).toBe('google_failed')
    expect(await connectionOf(web, creator.email)).toEqual(before)
  })

  test('a revenue consent whose code exchange Google answers with a 503 is logged as a token endpoint outage', async ({
    web,
  }) => {
    const api = await startApi(web, { googleCallTimeoutMs: 500 })
    const { browser, channelId } = await connectedCreator(api)
    api.google.failTokenEndpoint(503)

    const landedOn = await giveRevenueConsent(browser, channelId)

    expect(landedOn.searchParams.get('revenue_error')).toBe('google_failed')
    expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
      level: 'error',
      message: "Google's token endpoint did not answer a call",
    })
  })

  test('a revenue consent whose code exchange Google answers without a refresh token lands on google_failed and nothing changes', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const before = await connectionOf(web, creator.email)
    api.google.withholdRefreshToken()

    const landedOn = await giveRevenueConsent(browser, channelId)

    expect(landedOn.pathname).toBe('/app')
    expect(landedOn.searchParams.get('revenue_error')).toBe('google_failed')
    expect(await connectionOf(web, creator.email)).toEqual(before)
    expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
      level: 'error',
      message:
        "Google's token endpoint answered a consent without a refresh token or an ID token subject",
    })
  })

  test('a revenue consent whose code exchange Google answers with an ID token without a subject lands on google_failed and nothing changes', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const before = await connectionOf(web, creator.email)
    api.google.withholdIdTokenSubject()

    const landedOn = await giveRevenueConsent(browser, channelId)

    expect(landedOn.pathname).toBe('/app')
    expect(landedOn.searchParams.get('revenue_error')).toBe('google_failed')
    expect(await connectionOf(web, creator.email)).toEqual(before)
    expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
      level: 'error',
      message:
        "Google's token endpoint answered a consent without a refresh token or an ID token subject",
    })
  })

  test('a revenue consent whose code exchange Google answers with an ID token whose payload is not JSON lands on google_failed and nothing changes', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const before = await connectionOf(web, creator.email)
    api.google.malformIdToken('not_json')

    const landedOn = await giveRevenueConsent(browser, channelId)

    expect(landedOn.pathname).toBe('/app')
    expect(landedOn.searchParams.get('revenue_error')).toBe('google_failed')
    expect(await connectionOf(web, creator.email)).toEqual(before)
    expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
      level: 'error',
      message:
        "Google's token endpoint answered a consent without a refresh token or an ID token subject",
    })
  })

  test("a revenue consent for another user's channel is refused with not_connected before Google", async ({
    web,
  }) => {
    const api = await startApi(web)
    const { channelId } = await connectedCreator(api)
    const other = await signIn(api, otherCreator)
    const requests = api.google.authorizationRequests.length

    const started = await other.fetch(`/api/channels/${channelId}/revenue-consent`, {
      method: 'POST',
    })

    expect(started.status).toBe(404)
    expect(await started.json()).toEqual({ refusal: 'not_connected' })
    expect(api.google.authorizationRequests.length).toBe(requests)
  })

  test('a revenue consent that completes after a disconnect is refused with not_connected', async ({
    web,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    const started = await browser.fetch(`/api/channels/${channelId}/revenue-consent`, {
      method: 'POST',
    })
    const { url } = (await started.json()) as { url: string }
    await browser.fetch(`/api/channels/${channelId}/disconnect`, { method: 'POST' })

    const landedOn = (await browser.navigate(url)).url

    expect(landedOn.searchParams.get('revenue_error')).toBe('not_connected')
    expect(await channelsOf(browser)).toEqual({ channels: [] })
  })

  test('a reconnect keeps the revenue consent', async ({ web }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedCreator(api)
    await giveRevenueConsent(browser, channelId)
    const consented = await channelsOf(browser)

    const landedOn = await connect(browser)

    expect(landedOn.toString()).toBe(`${api.origin}/app?connected=1`)
    expect(consented.channels[0]?.revenueConsentedAt).toEqual(expect.any(String))
    expect(await channelsOf(browser)).toEqual(consented)
    expect(await summaryRevenueOf(browser, channelId)).toBe(12.34)
  })
})
