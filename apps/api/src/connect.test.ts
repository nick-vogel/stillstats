// Limits: these tests connect against the fake Google server, so they cannot prove Google's real
// consent screen, its channel picker for a Google account with several channels, or the exact
// scope strings Google grants. Nick connecting his own channel on the deployed product covers
// them.
import { connections, reportingJobs, type WebDatabase } from '@creator-analytics/database'
import { test } from '@creator-analytics/database/testing'
import { googleCallTimeoutMs } from '@creator-analytics/token-vault'
import { describe, expect } from 'vitest'
import { channelsOf, connect, signIn, userIdOf } from '../test/flows.ts'
import { startApi } from '../test/start-api.ts'

const creator = { sub: '104729', email: 'creator@example.com', name: 'A Creator' }
const otherCreator = { sub: '204729', email: 'other@example.com', name: 'Another Creator' }
const youtubeReadonly = 'https://www.googleapis.com/auth/youtube.readonly'
const analyticsReadonly = 'https://www.googleapis.com/auth/yt-analytics.readonly'

/** The stored connection of the user who signed in with this email, read in their user scope. */
async function connectionOf(web: WebDatabase, email: string) {
  const userId = await userIdOf(web, email)
  const [connection] = await web.asUser(userId, (tx) => tx.sql.select().from(connections))
  return connection
}

describe('seam 1: connect a channel', () => {
  test('a creator connects a channel and sees it listed as theirs', async ({ web }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')

    const landedOn = await connect(browser)

    expect(landedOn.toString()).toBe(`${api.origin}/app?connected=1`)
    expect(await channelsOf(browser)).toEqual({
      channels: [
        {
          id: expect.any(String),
          youtubeChannelId: 'UC-creator',
          title: null,
          handle: null,
          revenueConsentedAt: null,
        },
      ],
    })
  })

  test('the connection consent asks Google for youtube.readonly, yt-analytics.readonly, openid and email only', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')

    await connect(browser)

    const consent = api.google.authorizationRequests.at(-1)
    expect(consent?.get('scope')?.split(' ').sort()).toEqual(
      ['email', 'openid', youtubeReadonly, analyticsReadonly].sort(),
    )
  })

  test("a connect from Settings or the empty state opens Google's account chooser, with no login_hint", async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')

    await connect(browser)

    const consent = api.google.authorizationRequests.at(-1)
    expect(consent?.has('login_hint')).toBe(false)
    expect(consent?.get('prompt')).toBe('select_account consent')
  })

  // The upgrade screen's empty state, where a signed-in creator with no channel lands from the
  // homepage's "Subscribe" (creator-analytics#907).
  test('a connect from the upgrade screen lands on the upgrade screen for the channel just connected', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')

    const landedOn = await connect(browser, '/api/channels/connect?landing=upgrade')

    const { channels } = await channelsOf(browser)
    expect(landedOn.toString()).toBe(
      `${api.origin}/app/upgrade?channel=${channels[0]?.id}&connected=1`,
    )
  })

  test('a refused connect from the upgrade screen lands on the upgrade screen with the refusal', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.refuseConsent()

    const landedOn = await connect(browser, '/api/channels/connect?landing=upgrade')

    expect(landedOn.toString()).toBe(`${api.origin}/app/upgrade?connect_error=consent_denied`)
  })

  test.for(['https://elsewhere.example', 'settings', ''])(
    'a connect with the landing %j lands on the web app as any connect does',
    async (landing, { web }) => {
      const api = await startApi(web)
      const browser = await signIn(api, creator)
      api.google.pickChannel('UC-creator')

      const landedOn = await connect(
        browser,
        `/api/channels/connect?landing=${encodeURIComponent(landing)}`,
      )

      expect(landedOn.toString()).toBe(`${api.origin}/app?connected=1`)
    },
  )

  test('a channel another user holds is refused with channel_held_elsewhere and nothing is stored', async ({
    web,
  }) => {
    const api = await startApi(web)
    const holder = await signIn(api, otherCreator)
    api.google.pickChannel('UC-shared')
    await connect(holder)
    const held = await channelsOf(holder)
    const heldConnection = await connectionOf(web, otherCreator.email)
    expect(heldConnection).toBeDefined()

    const browser = await signIn(api, creator)
    const landedOn = await connect(browser)

    expect(landedOn.pathname).toBe('/app')
    expect(landedOn.searchParams.get('connect_error')).toBe('channel_held_elsewhere')
    expect(await channelsOf(browser)).toEqual({ channels: [] })
    expect(await channelsOf(holder)).toEqual(held)
    expect(await connectionOf(web, otherCreator.email)).toEqual(heldConnection)
  })

  test("a reconnect of a channel still waiting for its deletion after a disconnect is refused with channel_disconnecting, not as another user's", async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')
    await connect(browser)
    const [disconnected] = (await channelsOf(browser)).channels
    await browser.fetch(`/api/channels/${disconnected?.id}/disconnect`, { method: 'POST' })

    const landedOn = await connect(browser)

    expect(landedOn.pathname).toBe('/app')
    expect(landedOn.searchParams.get('connect_error')).toBe('channel_disconnecting')
    expect(await channelsOf(browser)).toEqual({ channels: [] })
  })

  test('a refused consent stores nothing', async ({ web }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')
    api.google.refuseConsent()

    const landedOn = await connect(browser)

    expect(landedOn.searchParams.get('connect_error')).toBe('consent_denied')
    expect(await channelsOf(browser)).toEqual({ channels: [] })
  })

  test('a consent with a connection scope unchecked is refused with scopes_missing and stores nothing', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')
    api.google.uncheckScopes([analyticsReadonly])

    const landedOn = await connect(browser)

    expect(landedOn.searchParams.get('connect_error')).toBe('scopes_missing')
    expect(await channelsOf(browser)).toEqual({ channels: [] })
  })

  // A refusal is the creator's or the consent's, not Google's: only google_failed is an outage.
  test.for(['consent_denied', 'scopes_missing'] as const)(
    'a consent refused with %s is not logged as a token endpoint outage',
    async (refusal, { web }) => {
      const api = await startApi(web)
      const browser = await signIn(api, creator)
      api.google.pickChannel('UC-creator')
      if (refusal === 'consent_denied') api.google.refuseConsent()
      else api.google.uncheckScopes([analyticsReadonly])

      const landedOn = await connect(browser)

      expect(landedOn.searchParams.get('connect_error')).toBe(refusal)
      expect(api.logs.map((line) => JSON.parse(line).message)).not.toContain(
        "Google's token endpoint did not answer a call",
      )
    },
  )

  test('a Google account with no channel is refused with no_channel and stores nothing', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)

    const landedOn = await connect(browser)

    expect(landedOn.searchParams.get('connect_error')).toBe('no_channel')
    expect(await channelsOf(browser)).toEqual({ channels: [] })
  })

  // The test's timeout is half production's bound, and the held call never answers, so only the
  // API's bound on a Google call can end the connect in time.
  test('a connect whose channels.list Google holds open past the bound lands on google_failed and stores nothing', {
    timeout: googleCallTimeoutMs / 2,
  }, async ({ web }) => {
    const api = await startApi(web, { googleCallTimeoutMs: 500 })
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')
    api.google.holdDataApi('/youtube/v3/channels')

    const landedOn = await connect(browser)

    expect(landedOn.toString()).toBe(`${api.origin}/app?connect_error=google_failed`)
    expect(await channelsOf(browser)).toEqual({ channels: [] })
    expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
      level: 'error',
      message: 'The YouTube data API did not answer a call',
    })
  })

  test('a connect whose code exchange Google answers with a 503 lands on google_failed and stores nothing', async ({
    web,
  }) => {
    const api = await startApi(web, { googleCallTimeoutMs: 500 })
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')
    api.google.failTokenEndpoint(503)

    const landedOn = await connect(browser)

    expect(landedOn.toString()).toBe(`${api.origin}/app?connect_error=google_failed`)
    expect(await channelsOf(browser)).toEqual({ channels: [] })
    expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
      level: 'error',
      message: "Google's token endpoint did not answer a call",
    })
  })

  test('a connect whose code exchange Google answers without a refresh token lands on google_failed and stores nothing', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')
    api.google.withholdRefreshToken()

    const landedOn = await connect(browser)

    expect(landedOn.toString()).toBe(`${api.origin}/app?connect_error=google_failed`)
    expect(await channelsOf(browser)).toEqual({ channels: [] })
    expect(await connectionOf(web, creator.email)).toBeUndefined()
    const logged = api.logs.map((line) => JSON.parse(line))
    expect(logged).toContainEqual({
      level: 'error',
      message:
        "Google's token endpoint answered a consent without a refresh token or an ID token subject",
    })
    expect(logged).not.toContainEqual({
      level: 'error',
      message: "Google's token endpoint did not answer a call",
    })
  })

  test('a connect whose code exchange Google answers with an ID token without a subject lands on google_failed and stores nothing', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')
    api.google.withholdIdTokenSubject()

    const landedOn = await connect(browser)

    expect(landedOn.toString()).toBe(`${api.origin}/app?connect_error=google_failed`)
    expect(await channelsOf(browser)).toEqual({ channels: [] })
    expect(await connectionOf(web, creator.email)).toBeUndefined()
    const logged = api.logs.map((line) => JSON.parse(line))
    expect(logged).toContainEqual({
      level: 'error',
      message:
        "Google's token endpoint answered a consent without a refresh token or an ID token subject",
    })
    expect(logged).not.toContainEqual({
      level: 'error',
      message: "Google's token endpoint did not answer a call",
    })
  })

  test('a connect whose code exchange Google answers with an ID token whose payload is not JSON lands on google_failed and stores nothing', async ({
    web,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')
    api.google.malformIdToken('not_json')

    const landedOn = await connect(browser)

    expect(landedOn.toString()).toBe(`${api.origin}/app?connect_error=google_failed`)
    expect(await channelsOf(browser)).toEqual({ channels: [] })
    expect(await connectionOf(web, creator.email)).toBeUndefined()
    const logged = api.logs.map((line) => JSON.parse(line))
    expect(logged).toContainEqual({
      level: 'error',
      message:
        "Google's token endpoint answered a consent without a refresh token or an ID token subject",
    })
    expect(logged).not.toContainEqual({
      level: 'error',
      message: "Google's token endpoint did not answer a call",
    })
  })

  // The test's timeout is half production's bound, and the held call never answers, so only the
  // API's bound on a Google call can end the connect in time.
  test('a connect whose code exchange Google holds open past the bound lands on google_failed and stores nothing', {
    timeout: googleCallTimeoutMs / 2,
  }, async ({ web }) => {
    const api = await startApi(web, { googleCallTimeoutMs: 500 })
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')
    api.google.holdTokenEndpoint()

    const landedOn = await connect(browser)

    expect(landedOn.toString()).toBe(`${api.origin}/app?connect_error=google_failed`)
    expect(await channelsOf(browser)).toEqual({ channels: [] })
    expect(api.logs.map((line) => JSON.parse(line))).toContainEqual({
      level: 'error',
      message: "Google's token endpoint did not answer a call",
    })
  })

  test("a callback with another user's consent state is refused with state_invalid", async ({
    web,
  }) => {
    const api = await startApi(web)
    const victim = await signIn(api, creator)
    api.google.pickChannel('UC-attacker')
    const started = await victim.fetch('/api/channels/connect', { method: 'POST' })
    const { url } = (await started.json()) as { url: string }
    const attacker = await signIn(api, otherCreator)

    const landedOn = (await attacker.navigate(url)).url

    expect(landedOn.searchParams.get('connect_error')).toBe('state_invalid')
    expect(await channelsOf(attacker)).toEqual({ channels: [] })
    expect(api.logs.map((line) => JSON.parse(line).message)).not.toContain(
      "Google's token endpoint did not answer a call",
    )
  })

  test("connecting a channel creates its reporting job for the daily reach report, through the connect's job", async ({
    web,
    worker,
    findJobs,
  }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')
    await connect(browser)
    const [job] = await findJobs('ensureReportingJob')
    if (!job) throw new Error('The connect enqueued no reporting job')
    const channelId = job.data.channelId ?? ''

    await worker.forChannel(channelId, (tx) => api.gateway.ensureReportingJob(tx, channelId))

    const atGoogle = api.google.reportingJobsOf('UC-creator')
    const stored = await worker.forChannel(channelId, (tx) =>
      tx.sql.select({ jobId: reportingJobs.jobId }).from(reportingJobs),
    )
    expect(atGoogle.map((created) => created.reportTypeId)).toEqual(['channel_reach_combined_a1'])
    expect(stored).toEqual(atGoogle.map((created) => ({ jobId: created.id })))
  })

  test('a creator who connects the same channel again still holds it once', async ({ web }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')
    await connect(browser)

    const landedOn = await connect(browser)

    expect(landedOn.toString()).toBe(`${api.origin}/app?connected=1`)
    expect(await channelsOf(browser)).toEqual({
      channels: [
        {
          id: expect.any(String),
          youtubeChannelId: 'UC-creator',
          title: null,
          handle: null,
          revenueConsentedAt: null,
        },
      ],
    })
  })

  test('no connect route answers with a token, a ciphertext or a key version', async ({ web }) => {
    const api = await startApi(web)
    const browser = await signIn(api, creator)
    api.google.pickChannel('UC-creator')
    const started = await browser.fetch('/api/channels/connect', { method: 'POST' })
    const startBody = await started.text()
    const { url } = JSON.parse(startBody) as { url: string }
    const hops: string[] = [startBody]
    let next = new URL(url)
    for (let hop = 0; hop < 10; hop++) {
      const response = await browser.fetch(next.toString())
      hops.push(response.headers.get('location') ?? '', await response.text())
      const location = response.headers.get('location')
      if (!location) break
      next = new URL(location, next)
    }
    hops.push(JSON.stringify(await channelsOf(browser)))
    const stored = await connectionOf(web, creator.email)

    const answered = hops.join('\n')
    const secrets = [
      ...api.google.issuedAccessTokens,
      ...api.google.issuedRefreshTokens,
      stored?.accessToken,
      stored?.refreshToken,
    ]
    expect(stored).toBeDefined()
    expect(secrets.filter((secret) => secret && answered.includes(secret))).toEqual([])
    expect(answered).not.toContain('keyVersion')
  })
})
