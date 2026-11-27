// Limits: these tests check the fake Google server against the rules it takes from Google's
// documentation, so they cannot prove Google answers the same: its consent screen, the scope
// strings it grants, the row order and numbers of its reports, which reports it serves, or a
// change on Google's side. Nick signing in and reading his own channel on the deployed product
// covers those. Nor can they show the Reporting API's real rate limit, its window, or whether a
// real 429 carries a Retry-After, which `limitReportDownloads` and `limitReportLists` model from
// Google Cloud's quota documentation: Nick's staging check of #1043, a new Pro channel's whole
// history stored within minutes of Checkout with no hand-queued run, covers those. A held request
// is watched for 200 ms, so these tests show it unanswered that long, not forever; the fake's held
// handler writes nothing at all, which is what "never" rests on.
import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose'
import { describe, expect, onTestFinished, test } from 'vitest'
import { type FakeChannel, type FakeGoogle, type FakeUpload, startFakeGoogle } from './index.ts'

const creator = { sub: '104729', email: 'creator@example.com', name: 'A Creator' }
const redirectUri = 'http://localhost/callback'
const youtube = 'https://www.googleapis.com/auth/youtube.readonly'

async function signedInGoogle(): Promise<FakeGoogle> {
  const google = await startFakeGoogle()
  onTestFinished(() => google.close())
  google.signInAs(creator)
  return google
}

/** Runs one authorization code grant the way a client does, and returns the token response. */
async function grant(
  google: FakeGoogle,
  query: Record<string, string>,
  verifier?: string,
): Promise<{ access_token: string; scope: string; refresh_token?: string }> {
  const authorization = new URL('/o/oauth2/v2/auth', google.origin)
  authorization.search = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    ...query,
  }).toString()
  const consent = await fetch(authorization, { redirect: 'manual' })
  const code = new URL(consent.headers.get('location') ?? '').searchParams.get('code') ?? ''
  const exchange = await fetch(new URL('/token', google.origin), {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: google.clientId,
      client_secret: google.clientSecret,
      ...(verifier ? { code_verifier: verifier } : {}),
    }),
  })
  expect(exchange.status).toBe(200)
  return (await exchange.json()) as { access_token: string; scope: string; refresh_token?: string }
}

function consentRedirect(google: FakeGoogle): Promise<URL> {
  const authorization = new URL('/o/oauth2/v2/auth', google.origin)
  authorization.search = new URLSearchParams({
    client_id: google.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: youtube,
    state: 'a-state',
  }).toString()
  return fetch(authorization, { redirect: 'manual' }).then(
    (response) => new URL(response.headers.get('location') ?? ''),
  )
}

function refresh(google: FakeGoogle, refreshToken: string): Promise<Response> {
  return fetch(new URL('/token', google.origin), {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: google.clientId,
      client_secret: google.clientSecret,
    }),
  })
}

function myChannels(google: FakeGoogle, accessToken: string): Promise<Response> {
  return fetch(new URL('/youtube/v3/channels?part=id&mine=true', google.origin), {
    headers: { authorization: `Bearer ${accessToken}` },
  })
}

function userinfo(google: FakeGoogle, accessToken: string): Promise<Response> {
  return fetch(new URL('/v1/userinfo', google.origin), {
    headers: { authorization: `Bearer ${accessToken}` },
  })
}

function revoke(google: FakeGoogle, token: string): Promise<Response> {
  return fetch(new URL('/revoke', google.origin), {
    method: 'POST',
    body: new URLSearchParams({ token }),
  })
}

async function riscConfiguration(google: FakeGoogle) {
  const response = await fetch(google.riscConfigurationUrl)
  return (await response.json()) as { issuer: string; jwks_uri: string }
}

describe('the fake Google server', () => {
  test('an access token reads the userinfo of the Google user who granted it', async () => {
    const google = await signedInGoogle()
    const { access_token } = await grant(google, {})

    const response = await userinfo(google, access_token)

    expect(await response.json()).toEqual({
      sub: creator.sub,
      email: creator.email,
      email_verified: true,
      name: creator.name,
    })
  })

  test('a revoked access token no longer reads userinfo', async () => {
    const google = await signedInGoogle()
    const { access_token } = await grant(google, {})

    const revoked = await revoke(google, access_token)

    expect(revoked.status).toBe(200)
    expect(google.revokedTokens).toEqual([access_token])
    expect((await userinfo(google, access_token)).status).toBe(401)
  })

  test('a revocation held with holdRevocation has not answered it 200 ms on', async () => {
    const google = await signedInGoogle()
    const { access_token } = await grant(google, {})
    google.holdRevocation()

    const held = revoke(google, access_token)

    expect(await stillPendingAfter(held, 200)).toBe(true)
    expect(google.revokedTokens).toEqual([])
  })

  test('revoking a token Google never issued answers 400 invalid_token', async () => {
    const google = await signedInGoogle()

    const response = await revoke(google, 'never-issued')

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_token' })
  })

  test('a plain code challenge is met by a verifier equal to it', async () => {
    const google = await signedInGoogle()
    const verifier = 'a-plain-code-verifier-that-is-at-least-forty-three-characters'

    const token = await grant(
      google,
      { code_challenge: verifier, code_challenge_method: 'plain' },
      verifier,
    )

    expect(token.access_token).toBeTruthy()
  })

  test('with include_granted_scopes the token adds the scopes granted earlier', async () => {
    const google = await signedInGoogle()
    google.grantedEarlier([youtube])

    const { scope } = await grant(google, { include_granted_scopes: 'true' })

    expect(scope.split(' ').sort()).toEqual([youtube, 'email', 'openid', 'profile'].sort())
  })

  test('without include_granted_scopes the token holds the requested scopes only', async () => {
    const google = await signedInGoogle()
    google.grantedEarlier([youtube])

    const { scope } = await grant(google, {})

    expect(scope.split(' ').sort()).toEqual(['email', 'openid', 'profile'])
  })

  test('a refresh held with holdTokenEndpoint has not answered it 200 ms on', async () => {
    const google = await signedInGoogle()
    const first = await grant(google, { scope: youtube, access_type: 'offline' })
    google.holdTokenEndpoint()

    const held = refresh(google, first.refresh_token ?? '')

    expect(await stillPendingAfter(held, 200)).toBe(true)
    expect(google.issuedAccessTokens).toEqual([first.access_token])
  })

  test('a refresh stalled with stallTokenEndpointBody answers 200 and its body has not ended 200 ms on', async () => {
    const google = await signedInGoogle()
    const first = await grant(google, { scope: youtube, access_type: 'offline' })
    google.stallTokenEndpointBody()

    const stalled = await refresh(google, first.refresh_token ?? '')

    expect(stalled.status).toBe(200)
    expect(stalled.headers.get('content-type')).toBe('application/json')
    expect(await stillPendingAfter(stalled.json(), 200)).toBe(true)
  })

  test('a refresh failed with failTokenEndpoint answers that status and issues no access token', async () => {
    const google = await signedInGoogle()
    const first = await grant(google, { scope: youtube, access_type: 'offline' })
    google.failTokenEndpoint(503)

    const failed = await refresh(google, first.refresh_token ?? '')

    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({ error: 'backend_error' })
    expect(google.issuedAccessTokens).toEqual([first.access_token])
  })

  test("a report failed with failAnalytics and a reason answers that status with Google's error body", async () => {
    const google = await signedInGoogle()
    const message = 'The request cannot be completed because you have exceeded your quota.'
    google.failAnalytics(403, { reason: 'quotaExceeded', message })

    const failed = await fetch(new URL('/v2/reports', google.origin))

    expect(failed.status).toBe(403)
    expect(await failed.json()).toEqual({
      error: {
        code: 403,
        message,
        errors: [{ message, domain: 'global', reason: 'quotaExceeded' }],
      },
    })
  })

  test('an offline grant carries a refresh token that refreshes to an access token with the same scopes', async () => {
    const google = await signedInGoogle()
    const first = await grant(google, { scope: youtube, access_type: 'offline' })
    expect(first.refresh_token).toBeTruthy()

    const refreshed = await refresh(google, first.refresh_token ?? '')

    const body = (await refreshed.json()) as { access_token: string; scope: string }
    expect(body.scope).toBe(youtube)
    expect(google.issuedAccessTokens).toEqual([first.access_token, body.access_token])
  })

  test('an online grant carries no refresh token', async () => {
    const google = await signedInGoogle()

    expect((await grant(google, { scope: youtube })).refresh_token).toBeUndefined()
  })

  test('an offline grant after withholdRefreshToken carries no refresh token and records none issued', async () => {
    const google = await signedInGoogle()
    google.withholdRefreshToken()

    const token = await grant(google, { scope: `openid ${youtube}`, access_type: 'offline' })

    expect(token.refresh_token).toBeUndefined()
    expect(token.scope.split(' ').sort()).toEqual([youtube, 'openid'].sort())
    expect(google.issuedRefreshTokens).toEqual([])
  })

  test('a grant after withholdIdTokenSubject carries a signed ID token with no subject', async () => {
    const google = await signedInGoogle()
    google.withholdIdTokenSubject()

    const token = (await grant(google, {
      scope: `openid email ${youtube}`,
      access_type: 'offline',
    })) as { id_token?: string; refresh_token?: string }

    const keys = createRemoteJWKSet(new URL('/oauth2/v3/certs', google.origin))
    const { payload } = await jwtVerify(token.id_token ?? '', keys, {
      issuer: google.origin,
      audience: google.clientId,
    })
    expect(payload.sub).toBeUndefined()
    expect(payload.email).toBe(creator.email)
    expect(token.refresh_token).toBeTruthy()
  })

  test("a grant after malformIdToken('not_json') carries an ID token whose payload is not JSON", async () => {
    const google = await signedInGoogle()
    google.malformIdToken('not_json')

    const token = (await grant(google, {
      scope: `openid email ${youtube}`,
      access_type: 'offline',
    })) as { id_token?: string; refresh_token?: string }

    expect(token.id_token).toBe('a.not-json.b')
    expect(token.refresh_token).toBeTruthy()
  })

  test("a grant after malformIdToken('null') carries an ID token whose payload decodes to null", async () => {
    const google = await signedInGoogle()
    google.malformIdToken('null')

    const token = (await grant(google, {
      scope: `openid email ${youtube}`,
      access_type: 'offline',
    })) as { id_token?: string; refresh_token?: string }

    const payload = (token.id_token ?? '').split('.')[1] ?? ''
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toBeNull()
    expect(token.refresh_token).toBeTruthy()
  })

  test('a code exchange after answerTokenEndpointWithNull answers 200 with a JSON body of null', async () => {
    const google = await signedInGoogle()
    google.answerTokenEndpointWithNull()
    const code = (await consentRedirect(google)).searchParams.get('code') ?? ''

    const exchange = await fetch(new URL('/token', google.origin), {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: google.clientId,
        client_secret: google.clientSecret,
      }),
    })

    expect(exchange.status).toBe(200)
    expect(exchange.headers.get('content-type')).toBe('application/json')
    expect(await exchange.json()).toBeNull()
  })

  test('a refresh token Google never issued answers 400 invalid_grant', async () => {
    const google = await signedInGoogle()

    const response = await refresh(google, 'never-issued')

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_grant' })
  })

  test('a refused consent redirects with access_denied and the state, and no code', async () => {
    const google = await signedInGoogle()
    google.refuseConsent()

    const callback = await consentRedirect(google)

    expect(Object.fromEntries(callback.searchParams)).toEqual({
      error: 'access_denied',
      state: 'a-state',
    })
  })

  test('the token holds only the scopes left checked on the consent screen', async () => {
    const google = await signedInGoogle()
    google.uncheckScopes(['profile'])

    const { scope } = await grant(google, {})

    expect(scope.split(' ').sort()).toEqual(['email', 'openid'])
  })

  test("channels.list with mine=true returns the channel picked on Google's screen", async () => {
    const google = await signedInGoogle()
    google.pickChannel('UC-picked')
    const { access_token } = await grant(google, { scope: youtube })

    const response = await myChannels(google, access_token)

    expect(await response.json()).toEqual({
      kind: 'youtube#channelListResponse',
      items: [{ kind: 'youtube#channel', id: 'UC-picked' }],
    })
  })

  test('channels.list with mine=true returns no item for a Google user with no channel', async () => {
    const google = await signedInGoogle()
    const { access_token } = await grant(google, { scope: youtube })

    const response = await myChannels(google, access_token)

    expect(await response.json()).toEqual({ kind: 'youtube#channelListResponse', items: [] })
  })

  test('channels.list refuses an access token without a YouTube scope with 403', async () => {
    const google = await signedInGoogle()
    const { access_token } = await grant(google, {})

    expect((await myChannels(google, access_token)).status).toBe(403)
  })

  test('the RISC configuration names the issuer of security events and their signing keys', async () => {
    const google = await signedInGoogle()

    expect(await riscConfiguration(google)).toEqual({
      issuer: `${google.origin}/`,
      jwks_uri: `${google.origin}/oauth2/v3/certs`,
    })
  })

  test('a tokens-revoked event is signed by the RISC keys, for the client, about the Google subject', async () => {
    const google = await signedInGoogle()
    const { issuer, jwks_uri } = await riscConfiguration(google)

    const token = await google.securityEventToken({ type: 'tokens-revoked', sub: creator.sub })

    const { payload } = await jwtVerify(token, createRemoteJWKSet(new URL(jwks_uri)), {
      issuer,
      audience: google.clientId,
    })
    expect(payload.events).toEqual({
      'https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked': {
        subject: { subject_type: 'iss-sub', iss: issuer, sub: creator.sub },
      },
    })
    expect(payload.jti).toEqual(expect.any(String))
  })

  test('a token-revoked event names the refresh token by its first 16 characters or its double SHA-512 hash', async () => {
    const google = await signedInGoogle()
    const { refresh_token = '' } = await grant(google, { access_type: 'offline' })
    const sha512 = (value: string | Buffer) => createHash('sha512').update(value).digest()

    const byPrefix = await google.securityEventToken({
      type: 'token-revoked',
      refreshToken: refresh_token,
      identifier: 'prefix',
    })
    const byHash = await google.securityEventToken({
      type: 'token-revoked',
      refreshToken: refresh_token,
      identifier: 'hash_base64_sha512_sha512',
    })

    const subjectOf = (token: string) =>
      (decodeJwt(token).events as Record<string, { subject: unknown }>)[
        'https://schemas.openid.net/secevent/oauth/event-type/token-revoked'
      ]?.subject
    expect(subjectOf(byPrefix)).toEqual({
      subject_type: 'oauth_token',
      token_type: 'refresh_token',
      token_identifier_alg: 'prefix',
      token: refresh_token.slice(0, 16),
    })
    expect(subjectOf(byHash)).toEqual({
      subject_type: 'oauth_token',
      token_type: 'refresh_token',
      token_identifier_alg: 'hash_base64_sha512_sha512',
      token: sha512(sha512(refresh_token)).toString('base64'),
    })
  })

  test.each([
    ['signed by a key Google does not hold', { signing: 'foreign-key' }],
    ['signed under a key id Google does not publish', { signing: 'unknown-key-id' }],
    ['without a key id', { signing: 'no-key-id' }],
    ['unsigned', { signing: 'unsigned' }],
    ['from another issuer', { issuer: 'https://attacker.example/' }],
    ['for another client', { audience: 'another-client.apps.googleusercontent.com' }],
  ] as const)('a security event %s fails verification', async (_, forgery) => {
    const google = await signedInGoogle()
    const { issuer, jwks_uri } = await riscConfiguration(google)

    const token = await google.securityEventToken(
      { type: 'tokens-revoked', sub: creator.sub },
      forgery,
    )

    await expect(
      jwtVerify(token, createRemoteJWKSet(new URL(jwks_uri)), {
        issuer,
        audience: google.clientId,
      }),
    ).rejects.toThrow()
  })
})

const analytics = 'https://www.googleapis.com/auth/yt-analytics.readonly'
const monetary = 'https://www.googleapis.com/auth/yt-analytics-monetary.readonly'

/** A Google whose signed-in user picked a channel with these uploads, and a token that reads it. */
async function signedInChannel(
  uploads: FakeUpload[],
  channel: Partial<FakeChannel> = {},
  scope = `${youtube} ${analytics}`,
) {
  const google = await signedInGoogle()
  google.pickChannel('UC-uploader')
  google.setChannel('UC-uploader', { createdAt: '2019-03-01T06:00:00Z', uploads, ...channel })
  const { access_token } = await grant(google, { scope })
  const get = async (path: string, query: Record<string, string>) => {
    const url = new URL(path, google.origin)
    url.search = new URLSearchParams(query).toString()
    const response = await fetch(url, { headers: { authorization: `Bearer ${access_token}` } })
    return { status: response.status, body: (await response.json()) as Record<string, unknown> }
  }
  return { google, get }
}

function numbered(n: number): FakeUpload {
  return {
    videoId: `v${n}`,
    title: `Video ${n}`,
    publishedAt: '2026-01-01T00:00:00Z',
    metrics: { engagedViews: n, views: 2 * n, averageViewPercentage: 50, subscribersGained: 0 },
  }
}

/**
 * Whether the request has neither answered nor failed after the wait. The fake's close ends a held
 * request, so its later failure is caught here rather than left unhandled.
 */
async function stillPendingAfter(request: Promise<unknown>, ms: number): Promise<boolean> {
  const pending = Symbol('pending')
  const settled = request.then(
    () => 'answered',
    () => 'failed',
  )
  return (await Promise.race([settled, delay(ms, pending)])) === pending
}

/** A channel of 60 uploads, and a read of its uploads playlist 50 at a time. */
async function sixtyUploads() {
  const { get } = await signedInChannel(Array.from({ length: 60 }, (_, i) => numbered(i)))
  const page = (pageToken?: string) =>
    get('/youtube/v3/playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: 'uploads-of-UC-uploader',
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    })
  return { get, page }
}

// The channel's createdAt, 2019-03-01T06:00:00Z, falls on 2019-02-28 in Pacific Time.
const lifetime = { ids: 'channel==MINE', startDate: '2019-02-28', endDate: '2026-10-07' }
const fourMetrics = 'engagedViews,views,averageViewPercentage,subscribersGained'

describe('the fake YouTube APIs', () => {
  test("channels.list with snippet and contentDetails answers the channel's creation date and uploads playlist", async () => {
    const { get } = await signedInChannel([])

    const listed = await get('/youtube/v3/channels', {
      part: 'snippet,contentDetails',
      mine: 'true',
    })

    expect(listed.body.items).toEqual([
      {
        kind: 'youtube#channel',
        id: 'UC-uploader',
        snippet: { publishedAt: '2019-03-01T06:00:00Z' },
        contentDetails: { relatedPlaylists: { uploads: 'uploads-of-UC-uploader' } },
      },
    ])
  })

  test('playlistItems.list answers 50 uploads a page at maxResults=50', async () => {
    const { page } = await sixtyUploads()

    const first = await page()

    expect(first.body.items).toHaveLength(50)
  })

  test('the last page of playlistItems.list carries no nextPageToken', async () => {
    const { page } = await sixtyUploads()

    const first = await page()
    const last = await page(first.body.nextPageToken as string)

    expect(last.body.nextPageToken).toBeUndefined()
  })

  test('playlistItems.list answers maxResults=51 with 400', async () => {
    const { get } = await sixtyUploads()

    const tooLarge = await get('/youtube/v3/playlistItems', {
      part: 'contentDetails',
      playlistId: 'uploads-of-UC-uploader',
      maxResults: '51',
    })

    expect(tooLarge.status).toBe(400)
  })

  test("playlistItems.list answers an upload's thumbnails in the sizes it holds, and Google's default three when it sets none", async () => {
    const { get } = await signedInChannel([
      { ...numbered(1), thumbnailSizes: ['medium', 'maxres'] },
      { ...numbered(2), thumbnailSizes: [] },
      numbered(3),
    ])

    const listed = await get('/youtube/v3/playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: 'uploads-of-UC-uploader',
      maxResults: '50',
    })

    const thumbnails = (listed.body.items as { snippet: { thumbnails: unknown } }[]).map(
      (item) => item.snippet.thumbnails,
    )
    expect(thumbnails).toEqual([
      {
        medium: { url: 'https://i.ytimg.com/vi/v1/mqdefault.jpg', width: 320, height: 180 },
        maxres: { url: 'https://i.ytimg.com/vi/v1/maxresdefault.jpg', width: 1280, height: 720 },
      },
      {},
      {
        default: { url: 'https://i.ytimg.com/vi/v3/default.jpg', width: 120, height: 90 },
        medium: { url: 'https://i.ytimg.com/vi/v3/mqdefault.jpg', width: 320, height: 180 },
        high: { url: 'https://i.ytimg.com/vi/v3/hqdefault.jpg', width: 480, height: 360 },
      },
    ])
  })

  test('playlistItems.list answers standard as sddefault at 640 by 480', async () => {
    const { get } = await signedInChannel([{ ...numbered(1), thumbnailSizes: ['standard'] }])

    const listed = await get('/youtube/v3/playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: 'uploads-of-UC-uploader',
      maxResults: '50',
    })

    const [item] = listed.body.items as { snippet: { thumbnails: unknown } }[]
    expect(item?.snippet.thumbnails).toEqual({
      standard: { url: 'https://i.ytimg.com/vi/v1/sddefault.jpg', width: 640, height: 480 },
    })
  })

  test('videos.list with part=status,contentDetails marks a scheduled video private with its publishAt, beside its duration', async () => {
    const { get } = await signedInChannel([
      { ...numbered(1), duration: 'PT4M30S' },
      { videoId: 'v2', title: 'Soon', scheduledFor: '2027-01-01T17:00:00Z' },
    ])

    const listed = await get('/youtube/v3/videos', { part: 'status,contentDetails', id: 'v1,v2' })

    expect(listed.body.items).toEqual([
      {
        kind: 'youtube#video',
        id: 'v1',
        status: { privacyStatus: 'public' },
        contentDetails: { duration: 'PT4M30S' },
      },
      {
        kind: 'youtube#video',
        id: 'v2',
        status: { privacyStatus: 'private', publishAt: '2027-01-01T17:00:00Z' },
        contentDetails: {},
      },
    ])
  })

  test('videos.list answers each video with only the parts asked', async () => {
    const { get } = await signedInChannel([{ ...numbered(1), duration: 'PT4M30S' }])

    const status = await get('/youtube/v3/videos', { part: 'status', id: 'v1' })
    const contentDetails = await get('/youtube/v3/videos', { part: 'contentDetails', id: 'v1' })

    expect(status.body.items).toEqual([
      { kind: 'youtube#video', id: 'v1', status: { privacyStatus: 'public' } },
    ])
    expect(contentDetails.body.items).toEqual([
      { kind: 'youtube#video', id: 'v1', contentDetails: { duration: 'PT4M30S' } },
    ])
  })

  test("videos.list with part=status answers an unlisted and a private upload's privacy status", async () => {
    const { get } = await signedInChannel([
      { ...numbered(1), privacyStatus: 'unlisted' },
      { ...numbered(2), privacyStatus: 'private' },
    ])

    const listed = await get('/youtube/v3/videos', { part: 'status', id: 'v1,v2' })

    expect(listed.body.items).toEqual([
      { kind: 'youtube#video', id: 'v1', status: { privacyStatus: 'unlisted' } },
      { kind: 'youtube#video', id: 'v2', status: { privacyStatus: 'private' } },
    ])
  })

  test("videos.list with part=status answers an upload's embeddable and madeForKids only when the upload sets them", async () => {
    const { get } = await signedInChannel([
      { ...numbered(1), embeddable: false, madeForKids: true },
      numbered(2),
    ])

    const listed = await get('/youtube/v3/videos', { part: 'status', id: 'v1,v2' })

    expect(listed.body.items).toEqual([
      {
        kind: 'youtube#video',
        id: 'v1',
        status: { privacyStatus: 'public', embeddable: false, madeForKids: true },
      },
      { kind: 'youtube#video', id: 'v2', status: { privacyStatus: 'public' } },
    ])
  })

  test('videos.list answers id, status and contentDetails, alone or together, and 400 to any other part or none', async () => {
    const { get } = await signedInChannel([numbered(1)])
    const statusOf = async (part?: string) =>
      (await get('/youtube/v3/videos', { ...(part === undefined ? {} : { part }), id: 'v1' }))
        .status

    expect({
      id: await statusOf('id'),
      idStatus: await statusOf('id,status'),
      status: await statusOf('status'),
      contentDetails: await statusOf('contentDetails'),
      both: await statusOf('status,contentDetails'),
      snippet: await statusOf('snippet'),
      mixed: await statusOf('status,snippet'),
      none: await statusOf(),
    }).toEqual({
      id: 200,
      idStatus: 200,
      status: 200,
      contentDetails: 200,
      both: 200,
      snippet: 400,
      mixed: 400,
      none: 400,
    })
  })

  test('videos.list with part=id answers only the asked ids the channel uploads, a private and an unlisted upload included, and leaves out an id it does not hold', async () => {
    const { get } = await signedInChannel([
      numbered(1),
      { ...numbered(2), privacyStatus: 'private' },
      { ...numbered(3), privacyStatus: 'unlisted' },
      numbered(4),
    ])

    const listed = await get('/youtube/v3/videos', { part: 'id', id: 'v1,v2,v3,gone' })

    expect(listed.body.items).toEqual([
      { kind: 'youtube#video', id: 'v1' },
      { kind: 'youtube#video', id: 'v2' },
      { kind: 'youtube#video', id: 'v3' },
    ])
  })

  test('a dimensions=video report with a video== filter answers a row for each listed video that has numbers', async () => {
    const { get } = await signedInChannel([
      numbered(1),
      numbered(2),
      { videoId: 'v3', title: 'Unwatched' },
    ])

    const report = await get('/v2/reports', {
      ...lifetime,
      dimensions: 'video',
      filters: 'video==v1,v3',
      metrics: fourMetrics,
    })

    expect(report.body.rows).toEqual([['v1', 1, 2, 50, 0]])
  })

  test("a dimensions=video report answers no row to a range starting after the channel's creation day in Pacific Time", async () => {
    const { get } = await signedInChannel([numbered(1)])

    const report = await get('/v2/reports', {
      ...lifetime,
      startDate: '2019-03-01',
      dimensions: 'video',
      filters: 'video==v1',
      metrics: fourMetrics,
    })

    expect(report.body.rows).toBeUndefined()
  })

  test('a dimensions=video report answers the numbers a video holds for that exact date range', async () => {
    const lastWeek = { startDate: '2026-10-01', endDate: '2026-10-07' }
    const { get } = await signedInChannel([
      {
        ...numbered(1),
        rangeMetrics: [
          {
            ...lastWeek,
            metrics: {
              engagedViews: 7,
              views: 9,
              averageViewPercentage: 61.5,
              subscribersGained: 3,
            },
          },
        ],
      },
      numbered(2),
    ])
    const query = { dimensions: 'video', filters: 'video==v1,v2', metrics: fourMetrics }

    const week = await get('/v2/reports', { ...lifetime, ...lastWeek, ...query })
    const otherWeek = await get('/v2/reports', {
      ...lifetime,
      ...lastWeek,
      endDate: '2026-10-06',
      ...query,
    })

    expect(week.body.rows).toEqual([['v1', 7, 9, 61.5, 3]])
    expect(otherWeek.body.rows).toBeUndefined()
  })

  test('a dimensions=video,creatorContentType report answers each listed video that has numbers with its content type', async () => {
    const { get } = await signedInChannel([
      numbered(1),
      { ...numbered(2), creatorContentType: 'shorts' },
      { ...numbered(3), creatorContentType: 'liveStream' },
      { videoId: 'v4', title: 'Unwatched' },
    ])

    const report = await get('/v2/reports', {
      ...lifetime,
      dimensions: 'video,creatorContentType',
      filters: 'video==v1,v2,v4',
      metrics: 'views',
    })

    expect(report.body.rows).toEqual([
      ['v1', 'videoOnDemand', 2],
      ['v2', 'shorts', 4],
    ])
  })

  test('a dimensions=video,creatorContentType report answers a video split across content types with a row for each type', async () => {
    const { get } = await signedInChannel([
      { ...numbered(1), contentTypeViews: { liveStream: 5, videoOnDemand: 9 } },
    ])

    const report = await get('/v2/reports', {
      ...lifetime,
      dimensions: 'video,creatorContentType',
      filters: 'video==v1',
      metrics: 'views',
    })

    expect(report.body.rows).toEqual([
      ['v1', 'liveStream', 5],
      ['v1', 'videoOnDemand', 9],
    ])
  })

  test('a dimensions=video,day report answers each listed video its days in the range, up to the last processed day', async () => {
    const { google, get } = await signedInChannel([
      {
        ...numbered(1),
        days: [
          { day: '2026-10-01', engagedViews: 1, views: 2, subscribersGained: 1 },
          { day: '2026-10-03', engagedViews: 3, views: 4 },
          { day: '2026-10-06', engagedViews: 5, views: 6 },
        ],
      },
      { ...numbered(2), days: [{ day: '2026-10-02', engagedViews: 7, views: 8 }] },
      { ...numbered(3), days: [{ day: '2026-10-02', engagedViews: 9, views: 9 }] },
    ])
    google.setLastProcessedDay('2026-10-05')

    const report = await get('/v2/reports', {
      ...lifetime,
      startDate: '2026-10-02',
      dimensions: 'video,day',
      filters: 'video==v1,v2',
      metrics: 'engagedViews,views,subscribersGained',
    })

    expect((report.body.rows as unknown[][]).sort()).toEqual([
      ['v1', '2026-10-03', 3, 4, 0],
      ['v2', '2026-10-02', 7, 8, 0],
    ])
  })

  test('every report the channel summary, the list and the detail read answers estimatedMinutesWatched, and 0 where a fixture holds none', async () => {
    const { get } = await signedInChannel(
      [
        {
          ...numbered(1),
          metrics: {
            engagedViews: 1,
            views: 2,
            averageViewPercentage: 50,
            subscribersGained: 0,
            estimatedMinutesWatched: 738,
          },
          days: [
            { day: '2026-10-02', engagedViews: 1, views: 2, estimatedMinutesWatched: 30 },
            { day: '2026-10-03', engagedViews: 3, views: 4 },
          ],
        },
        numbered(2),
      ],
      {
        totals: { engagedViews: 120, views: 340, estimatedMinutesWatched: 4500 },
        days: {
          '2026-10-02': { engagedViews: 4, views: 6, estimatedMinutesWatched: 61 },
          '2026-10-03': { engagedViews: 1, views: 2 },
        },
      },
    )
    const threeMetrics = 'engagedViews,views,estimatedMinutesWatched'
    const week = { ...lifetime, startDate: '2026-10-02', endDate: '2026-10-03' }

    const reports = await Promise.all(
      [
        { ...lifetime, metrics: threeMetrics },
        { ...week, dimensions: 'day', metrics: threeMetrics },
        { ...lifetime, dimensions: 'video', filters: 'video==v1,v2', metrics: threeMetrics },
        { ...week, dimensions: 'video,day', filters: 'video==v1', metrics: threeMetrics },
        { ...week, dimensions: 'day', filters: 'video==v1', metrics: threeMetrics },
        { ...lifetime, filters: 'video==v2', metrics: threeMetrics },
      ].map(async (query) => {
        const report = await get('/v2/reports', query)
        return (report.body.rows as unknown[][]).toSorted()
      }),
    )

    expect(reports).toEqual([
      [[120, 340, 4500]],
      [
        ['2026-10-02', 4, 6, 61],
        ['2026-10-03', 1, 2, 0],
      ],
      [
        ['v1', 1, 2, 738],
        ['v2', 2, 4, 0],
      ],
      [
        ['v1', '2026-10-02', 1, 2, 30],
        ['v1', '2026-10-03', 3, 4, 0],
      ],
      [
        ['2026-10-02', 1, 2, 30],
        ['2026-10-03', 3, 4, 0],
      ],
      [[2, 4, 0]],
    ])
  })

  test('a dimensions=day report on a channel that holds no days answers 0 minutes for every day', async () => {
    const { get } = await signedInChannel([])

    const report = await get('/v2/reports', {
      ...lifetime,
      startDate: '2026-10-06',
      dimensions: 'day',
      metrics: 'engagedViews,views,estimatedMinutesWatched',
    })

    expect((report.body.rows as unknown[][]).toSorted()).toEqual([
      ['2026-10-06', 0, 0, 0],
      ['2026-10-07', 0, 0, 0],
    ])
  })

  test('a dimensions=day report ends its rows at the last processed day', async () => {
    const { google, get } = await signedInChannel([])
    google.setLastProcessedDay('2026-10-05')

    const report = await get('/v2/reports', {
      ...lifetime,
      startDate: '2026-10-03',
      dimensions: 'day',
      metrics: fourMetrics,
    })

    const days = (report.body.rows as string[][]).map(([day]) => day)
    expect(days.sort().at(-1)).toBe('2026-10-05')
  })

  test('a dimensions=day report on a channel that holds its days answers those days only', async () => {
    const { get } = await signedInChannel([], {
      days: {
        '2026-10-03': { engagedViews: 4, views: 6 },
        '2026-10-05': { engagedViews: 1, views: 2 },
      },
    })

    const report = await get('/v2/reports', {
      ...lifetime,
      startDate: '2026-10-03',
      dimensions: 'day',
      metrics: 'engagedViews,views',
    })

    expect((report.body.rows as unknown[][]).sort()).toEqual([
      ['2026-10-03', 4, 6],
      ['2026-10-05', 1, 2],
    ])
  })

  test.each(['videoOnDemand', 'shorts', 'liveStream'] as const)(
    "a channel totals report answers that format's totals filtered to creatorContentType==%s, and the channel's own with no filter",
    async (contentType) => {
      const { get } = await signedInChannel([], {
        totals: { engagedViews: 120, views: 340 },
        formats: { [contentType]: { totals: { engagedViews: 7, views: 9 } } },
      })

      const filtered = await get('/v2/reports', {
        ...lifetime,
        metrics: 'engagedViews,views',
        filters: `creatorContentType==${contentType}`,
      })
      const unfiltered = await get('/v2/reports', { ...lifetime, metrics: 'engagedViews,views' })

      expect([filtered, unfiltered]).toEqual([
        { status: 200, body: expect.objectContaining({ rows: [[7, 9]] }) },
        { status: 200, body: expect.objectContaining({ rows: [[120, 340]] }) },
      ])
    },
  )

  test('a channel totals report filtered to a format the channel holds no numbers for answers no row', async () => {
    const { get } = await signedInChannel([], { totals: { engagedViews: 120, views: 340 } })

    const report = await get('/v2/reports', {
      ...lifetime,
      metrics: 'engagedViews,views',
      filters: 'creatorContentType==liveStream',
    })

    expect(report.status).toBe(200)
    expect(report.body).not.toHaveProperty('rows')
  })

  test("a dimensions=day report filtered to a content type answers that format's days", async () => {
    const { get } = await signedInChannel([], {
      days: { '2026-10-04': { engagedViews: 1, views: 2 } },
      formats: { shorts: { days: { '2026-10-03': { engagedViews: 4, views: 6 } } } },
    })

    const report = await get('/v2/reports', {
      ...lifetime,
      startDate: '2026-10-03',
      dimensions: 'day',
      metrics: 'engagedViews,views',
      filters: 'creatorContentType==shorts',
    })

    expect(report.body.rows).toEqual([['2026-10-03', 4, 6]])
  })

  test("an estimated revenue report filtered to a content type answers that format's revenue", async () => {
    const { google, get } = await signedInChannel(
      [],
      { formats: { videoOnDemand: { estimatedRevenue: 3.21 } } },
      `${youtube} ${analytics} ${monetary}`,
    )
    google.setRevenue('UC-uploader', { estimatedRevenue: 12.34 })

    const report = await get('/v2/reports', {
      ...lifetime,
      metrics: 'estimatedRevenue',
      filters: 'creatorContentType==videoOnDemand',
    })

    expect(report.body.rows).toEqual([[3.21]])
  })

  // Google refused the uppercase values its docs list, on a live check on 2026-10-08.
  test.each([
    ['SHORTS', 'shorts'],
    ['VIDEO_ON_DEMAND', 'videoOnDemand'],
    ['LIVE_STREAM', 'liveStream'],
  ] as const)(
    'a channel report filtered to creatorContentType==%s answers 400, as Google refuses it, where %s answers',
    async (uppercase, lowercase) => {
      const { get } = await signedInChannel(
        [],
        { totals: { engagedViews: 120, views: 340 } },
        `${youtube} ${analytics} ${monetary}`,
      )
      const statusesFilteredTo = async (contentType: string) => {
        const filters = `creatorContentType==${contentType}`
        const reports = await Promise.all(
          [
            { metrics: 'engagedViews,views', filters },
            { dimensions: 'day', metrics: 'engagedViews,views', filters },
            { metrics: 'estimatedRevenue', filters },
          ].map((query) => get('/v2/reports', { ...lifetime, ...query })),
        )
        return reports.map(({ status }) => status)
      }

      expect({
        uppercase: await statusesFilteredTo(uppercase),
        lowercase: await statusesFilteredTo(lowercase),
      }).toEqual({ uppercase: [400, 400, 400], lowercase: [200, 200, 200] })
    },
  )

  test('a Data API path dropped with dropDataApi gets no answer to a later request', async () => {
    const { google, get } = await signedInChannel([numbered(1)])
    google.dropDataApi('/youtube/v3/playlistItems')

    const dropped = get('/youtube/v3/playlistItems', {
      part: 'contentDetails',
      playlistId: 'uploads-of-UC-uploader',
      maxResults: '50',
    })

    await expect(dropped).rejects.toThrow('fetch failed')
  })

  test('an Analytics report dropped with dropAnalyticsApi gets no answer to a later request', async () => {
    const { google, get } = await signedInChannel([numbered(1)])
    google.dropAnalyticsApi()

    const dropped = get('/v2/reports', { ...lifetime, metrics: 'engagedViews,views' })

    await expect(dropped).rejects.toThrow('fetch failed')
  })

  test('a Data API path held with holdDataApi takes a later request and has not answered it 200 ms on', async () => {
    const { google, get } = await signedInChannel([numbered(1)])
    google.holdDataApi('/youtube/v3/playlistItems')

    const held = get('/youtube/v3/playlistItems', {
      part: 'contentDetails',
      playlistId: 'uploads-of-UC-uploader',
      maxResults: '50',
    })

    expect(await stillPendingAfter(held, 200)).toBe(true)
    expect(google.dataApiRequests.map((url) => url.pathname)).toContain('/youtube/v3/playlistItems')
  })

  test('an Analytics report held with holdAnalyticsApi takes a later request and has not answered it 200 ms on', async () => {
    const { google, get } = await signedInChannel([numbered(1)])
    google.holdAnalyticsApi()

    const held = get('/v2/reports', { ...lifetime, metrics: 'engagedViews,views' })

    expect(await stillPendingAfter(held, 200)).toBe(true)
    expect(google.analyticsRequests.map((query) => query.get('metrics'))).toContain(
      'engagedViews,views',
    )
  })

  test('a report the fake does not support answers 400', async () => {
    const { get } = await signedInChannel([numbered(1)])

    const unsupported = await Promise.all(
      [
        { dimensions: 'video', metrics: fourMetrics },
        { dimensions: 'video', filters: 'video==v1', metrics: 'views,estimatedRevenue' },
        { dimensions: 'day', filters: 'video==v1', metrics: 'averageViewPercentage' },
        {
          dimensions: 'elapsedVideoTimeRatio',
          filters: 'video==v1,v2',
          metrics: 'audienceWatchRatio,relativeRetentionPerformance',
        },
        { dimensions: 'insightTrafficSourceType', filters: 'video==v1', metrics: 'views' },
        { dimensions: 'country', filters: 'video==v1', metrics: 'views' },
        {
          dimensions: 'video',
          filters: `video==${Array.from({ length: 501 }, (_, i) => `v${i}`).join(',')}`,
          metrics: 'views',
        },
      ].map((query) => get('/v2/reports', { ...lifetime, ...query })),
    )

    expect(unsupported.map(({ status }) => status)).toEqual([400, 400, 400, 400, 400, 400, 400])
  })
})

const nineMetrics =
  'views,engagedViews,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained'

describe("the fake sponsor report's figures, one video's nine numbers", () => {
  const firstWeek = { startDate: '2026-01-01', endDate: '2026-01-07' }
  const sponsored: FakeUpload = {
    ...numbered(1),
    // Midday Pacific Time on 2026-01-01, so the publish day is 2026-01-01.
    publishedAt: '2026-01-01T20:00:00Z',
    metrics: {
      engagedViews: 80,
      views: 100,
      averageViewPercentage: 45.5,
      subscribersGained: 6,
      estimatedMinutesWatched: 300,
      averageViewDuration: 184,
      likes: 12,
      comments: 4,
      shares: 2,
    },
    rangeMetrics: [
      {
        ...firstWeek,
        metrics: {
          engagedViews: 40,
          views: 50,
          averageViewPercentage: 51.25,
          subscribersGained: 3,
          estimatedMinutesWatched: 150,
          averageViewDuration: 190,
          likes: 7,
          comments: 2,
        },
      },
    ],
  }
  const query = { ids: 'channel==MINE', filters: 'video==v1', metrics: nineMetrics }

  test('a no-dimension report of the nine metrics answers the numbers the video holds for that exact range, an unset one as 0', async () => {
    const { get } = await signedInChannel([sponsored])

    const report = await get('/v2/reports', { ...query, ...firstWeek })

    expect(report.status).toBe(200)
    expect((report.body.columnHeaders as { name: string }[]).map(({ name }) => name)).toEqual(
      nineMetrics.split(','),
    )
    expect(report.body.rows).toEqual([[50, 40, 150, 190, 51.25, 7, 2, 0, 3]])
  })

  test('it answers the lifetime numbers to a range starting on the publish day, and no row to a range starting later that the video holds no numbers for', async () => {
    const { get } = await signedInChannel([sponsored])

    const lifetimeReport = await get('/v2/reports', {
      ...query,
      startDate: '2026-01-01',
      endDate: '2026-01-30',
    })
    const later = await get('/v2/reports', {
      ...query,
      startDate: '2026-01-02',
      endDate: '2026-01-07',
    })

    expect(lifetimeReport.body.rows).toEqual([[100, 80, 300, 184, 45.5, 12, 4, 2, 6]])
    expect(later.status).toBe(200)
    expect(later.body.rows).toBeUndefined()
  })

  test.each(['estimatedRevenue', 'cpm', 'adImpressions'])(
    'it answers 400 to the nine metrics with %s beside them',
    async (revenue) => {
      const { get } = await signedInChannel([sponsored])

      const report = await get('/v2/reports', {
        ...query,
        ...firstWeek,
        metrics: `${nineMetrics},${revenue}`,
      })

      expect(report.status).toBe(400)
    },
  )
})

describe('the fake US state and city reports', () => {
  const cities = {
    Chicago: { engagedViews: 40, views: 90 },
    Mumbai: { engagedViews: 70, views: 120 },
    Berlin: { engagedViews: 10, views: 30 },
  }
  const byCity = { dimensions: 'city', metrics: 'engagedViews,views' }
  const byState = { dimensions: 'province', metrics: 'engagedViews,views' }

  test('a city query answers 400 without a sort, without maxResults or with more than 250, or with a filter, as Google requires a sort and a cap of 250', async () => {
    const { get } = await signedInChannel([], { cities })

    const statuses = await Promise.all(
      [
        { ...byCity, maxResults: '250' },
        { ...byCity, sort: '-views', maxResults: '251' },
        { ...byCity, sort: '-views' },
        { ...byCity, sort: '-views', maxResults: '250', filters: 'creatorContentType==shorts' },
        { ...byCity, sort: '-views', maxResults: '250' },
      ].map(async (query) => (await get('/v2/reports', { ...lifetime, ...query })).status),
    )

    expect(statuses).toEqual([400, 400, 400, 400, 200])
  })

  test('a city query sorted by -views answers the cities with most views, most first, cut to maxResults', async () => {
    const { get } = await signedInChannel([], { cities })

    const report = await get('/v2/reports', {
      ...lifetime,
      ...byCity,
      sort: '-views',
      maxResults: '2',
    })

    expect(report.body.rows).toEqual([
      ['Mumbai', 70, 120],
      ['Chicago', 40, 90],
    ])
  })

  test('a province query answers 400 without the country==US filter, or with a format filter beside it, as Google reads states only within the United States', async () => {
    const usStates = { 'US-CA': { engagedViews: 557, views: 800 } }
    const { get } = await signedInChannel([], { usStates })

    const reports = await Promise.all(
      [
        byState,
        { ...byState, filters: 'country==US;creatorContentType==shorts' },
        { ...byState, filters: 'country==US' },
      ].map((query) => get('/v2/reports', { ...lifetime, ...query })),
    )

    expect(reports.map(({ status }) => status)).toEqual([400, 400, 200])
    expect(reports[2]?.body.rows).toEqual([['US-CA', 557, 800]])
  })
})

const revenueSources = 'estimatedRevenue,estimatedAdRevenue,estimatedRedPartnerRevenue'

/** A channel with revenue consent: its revenue, its formats' revenue and its revenue by day. */
async function earningChannel(channel: Partial<FakeChannel> = {}) {
  const signedIn = await signedInChannel([], channel, `${youtube} ${analytics} ${monetary}`)
  signedIn.google.setRevenue('UC-uploader', {
    estimatedRevenue: 42.8,
    estimatedAdRevenue: 30.5,
    estimatedRedPartnerRevenue: 4.25,
    days: {
      '2026-10-03': {
        estimatedRevenue: 2.5,
        estimatedAdRevenue: 2,
        estimatedRedPartnerRevenue: 0.25,
      },
      '2026-10-05': { estimatedRevenue: 1 },
    },
    noFormatRevenue: 5.4,
  })
  return signedIn
}

describe('the fake revenue reports', () => {
  test("a channel revenue report with the three revenue metrics answers the channel's revenue sources", async () => {
    const { get } = await earningChannel()

    const report = await get('/v2/reports', { ...lifetime, metrics: revenueSources })

    expect(report).toEqual({
      status: 200,
      body: expect.objectContaining({
        columnHeaders: [
          { name: 'estimatedRevenue', columnType: 'METRIC', dataType: 'FLOAT' },
          { name: 'estimatedAdRevenue', columnType: 'METRIC', dataType: 'FLOAT' },
          { name: 'estimatedRedPartnerRevenue', columnType: 'METRIC', dataType: 'FLOAT' },
        ],
        rows: [[42.8, 30.5, 4.25]],
      }),
    })
  })

  test('a channel whose revenue sets no source answers its revenue and zero from each source', async () => {
    const { google, get } = await signedInChannel([], {}, `${youtube} ${analytics} ${monetary}`)
    google.setRevenue('UC-uploader', { estimatedRevenue: 12.34 })

    const report = await get('/v2/reports', { ...lifetime, metrics: revenueSources })

    expect(report.body.rows).toEqual([[12.34, 0, 0]])
  })

  test("a channel revenue report filtered to a content type answers that format's revenue sources", async () => {
    const { get } = await earningChannel({
      formats: {
        shorts: {
          estimatedRevenue: 3.21,
          estimatedAdRevenue: 2.5,
          estimatedRedPartnerRevenue: 0.5,
        },
      },
    })

    const report = await get('/v2/reports', {
      ...lifetime,
      metrics: revenueSources,
      filters: 'creatorContentType==shorts',
    })

    expect(report.body.rows).toEqual([[3.21, 2.5, 0.5]])
  })

  test('a dimensions=day revenue report answers the days the channel holds revenue for, each source a zero when unset', async () => {
    const { get } = await earningChannel()

    const report = await get('/v2/reports', {
      ...lifetime,
      startDate: '2026-10-01',
      dimensions: 'day',
      metrics: revenueSources,
    })

    expect(report.status).toBe(200)
    expect((report.body.rows as unknown[][]).toSorted()).toEqual([
      ['2026-10-03', 2.5, 2, 0.25],
      ['2026-10-05', 1, 0, 0],
    ])
  })

  test("a dimensions=day revenue report filtered to a content type answers that format's revenue days", async () => {
    const { get } = await earningChannel({
      formats: {
        liveStream: {
          estimatedRevenue: 1,
          revenueDays: { '2026-10-04': { estimatedRevenue: 0.75, estimatedAdRevenue: 0.5 } },
        },
      },
    })

    const report = await get('/v2/reports', {
      ...lifetime,
      startDate: '2026-10-01',
      dimensions: 'day',
      metrics: revenueSources,
      filters: 'creatorContentType==liveStream',
    })

    expect(report.body.rows).toEqual([['2026-10-04', 0.75, 0.5, 0]])
  })

  test('a revenue report by creatorContentType answers each format the channel holds revenue for, and the revenue tied to no format', async () => {
    const { get } = await earningChannel({
      formats: { videoOnDemand: { estimatedRevenue: 30 }, shorts: { estimatedRevenue: 7.4 } },
    })

    const report = await get('/v2/reports', {
      ...lifetime,
      dimensions: 'creatorContentType',
      metrics: 'estimatedRevenue',
    })

    expect(report.status).toBe(200)
    expect((report.body.rows as unknown[][]).toSorted()).toEqual([
      ['creatorContentTypeUnspecified', 5.4],
      ['shorts', 7.4],
      ['videoOnDemand', 30],
    ])
  })

  test('a revenue report by creatorContentType answers no unspecified row for a channel with no revenue tied to no format', async () => {
    const { google, get } = await signedInChannel(
      [],
      { formats: { shorts: { estimatedRevenue: 7.4 } } },
      `${youtube} ${analytics} ${monetary}`,
    )
    google.setRevenue('UC-uploader', { estimatedRevenue: 7.4 })

    const report = await get('/v2/reports', {
      ...lifetime,
      dimensions: 'creatorContentType',
      metrics: 'estimatedRevenue',
    })

    expect(report.body.rows).toEqual([['shorts', 7.4]])
  })

  test('every revenue report answers 403 for a channel outside the YouTube Partner Program, and a views report still answers', async () => {
    const { google, get } = await earningChannel({ totals: { engagedViews: 120, views: 340 } })
    google.setPartnerProgram('UC-uploader', false)

    const statuses = await Promise.all(
      [
        { metrics: 'estimatedRevenue' },
        { metrics: revenueSources },
        { metrics: revenueSources, filters: 'creatorContentType==shorts' },
        { dimensions: 'day', metrics: revenueSources },
        { dimensions: 'creatorContentType', metrics: 'estimatedRevenue' },
        { metrics: 'engagedViews,views' },
      ].map(async (query) => (await get('/v2/reports', { ...lifetime, ...query })).status),
    )

    expect(statuses).toEqual([403, 403, 403, 403, 403, 200])
  })

  test("a revenue report's 403 for a channel outside the YouTube Partner Program carries Google's error reason", async () => {
    const { google, get } = await earningChannel()
    google.setPartnerProgram('UC-uploader', false)

    const refused = await get('/v2/reports', { ...lifetime, metrics: revenueSources })

    expect(refused.body).toEqual({
      error: {
        code: 403,
        message: 'Forbidden',
        errors: [{ message: 'Forbidden', domain: 'global', reason: 'forbidden' }],
      },
    })
  })

  test('a channel that joins the YouTube Partner Program answers its revenue again', async () => {
    const { google, get } = await earningChannel()
    google.setPartnerProgram('UC-uploader', false)
    const outside = await get('/v2/reports', { ...lifetime, metrics: revenueSources })

    google.setPartnerProgram('UC-uploader', true)
    const joined = await get('/v2/reports', { ...lifetime, metrics: revenueSources })

    expect([outside.status, joined.status]).toEqual([403, 200])
  })

  test('the revenue reports answer 400 to an uppercase content type filter, as Google refuses it', async () => {
    const { get } = await earningChannel()

    const statuses = await Promise.all(
      [{ metrics: revenueSources }, { dimensions: 'day', metrics: revenueSources }].map(
        async (query) =>
          (
            await get('/v2/reports', {
              ...lifetime,
              ...query,
              filters: 'creatorContentType==SHORTS',
            })
          ).status,
      ),
    )

    expect(statuses).toEqual([400, 400])
  })

  test('a revenue report takes a currency of three upper-case letters and answers 400 to any other, as Google refuses an unsupported currency, and a report with no revenue metric ignores it, as Google does', async () => {
    const { get } = await earningChannel({ totals: { engagedViews: 120, views: 340 } })

    const statuses = await Promise.all(
      [
        { metrics: revenueSources },
        { dimensions: 'day', metrics: revenueSources },
        { dimensions: 'creatorContentType', metrics: 'estimatedRevenue' },
        { metrics: 'engagedViews,views' },
      ].map((query) =>
        Promise.all(
          ['EUR', 'eur'].map(
            async (currency) =>
              (await get('/v2/reports', { ...lifetime, ...query, currency })).status,
          ),
        ),
      ),
    )

    expect(statuses).toEqual([
      [200, 400],
      [200, 400],
      [200, 400],
      [200, 200],
    ])
  })

  test('the revenue reports need the monetary scope', async () => {
    const { google, get } = await signedInChannel([])
    google.setRevenue('UC-uploader', { estimatedRevenue: 1 })

    const statuses = await Promise.all(
      [
        { metrics: revenueSources },
        { dimensions: 'day', metrics: revenueSources },
        { dimensions: 'creatorContentType', metrics: 'estimatedRevenue' },
      ].map(async (query) => (await get('/v2/reports', { ...lifetime, ...query })).status),
    )

    expect(statuses).toEqual([403, 403, 403])
  })

  test('the video revenue reports need the monetary scope, and answer 403 for a channel outside the YouTube Partner Program', async () => {
    const queries = videoRevenueQueries.map(({ query }) => query)
    const withoutScope = await signedInChannel([earningVideo])
    const outside = await earningChannel()
    outside.google.setPartnerProgram('UC-uploader', false)

    const statuses = await Promise.all(
      [withoutScope, outside].map(({ get }) =>
        Promise.all(
          queries.map(
            async (query) => (await get('/v2/reports', { ...lifetime, ...query })).status,
          ),
        ),
      ),
    )

    expect(statuses).toEqual([
      [403, 403, 403, 403, 403],
      [403, 403, 403, 403, 403],
    ])
  })
})

const videoOneNumbers = {
  engagedViews: 1,
  views: 2,
  averageViewPercentage: 50,
  subscribersGained: 0,
}

/** A video with revenue over its lifetime, over one exact week, and on two of its days. */
const earningVideo: FakeUpload = {
  ...numbered(1),
  metrics: {
    ...videoOneNumbers,
    estimatedRevenue: 9.5,
    estimatedAdRevenue: 7,
    estimatedRedPartnerRevenue: 1.25,
  },
  rangeMetrics: [
    {
      startDate: '2026-10-01',
      endDate: '2026-10-07',
      metrics: { ...videoOneNumbers, estimatedRevenue: 2.75 },
    },
  ],
  days: [
    {
      day: '2026-10-02',
      engagedViews: 1,
      views: 2,
      estimatedRevenue: 0.5,
      estimatedAdRevenue: 0.25,
      estimatedRedPartnerRevenue: 0.125,
    },
    { day: '2026-10-03', engagedViews: 3, views: 4 },
  ],
}

/** The query of one video's numbers and revenue by day, the way the since publish table reads it. */
const sincePublishQuery = {
  dimensions: 'day',
  filters: 'video==v1',
  metrics: 'engagedViews,views,estimatedMinutesWatched,estimatedRevenue',
}

/**
 * The five queries a video's revenue is read with: the list's two, the detail's two and the since
 * publish table's one.
 */
const videoRevenueQueries = [
  { query: { dimensions: 'video', filters: 'video==v1,v2', metrics: revenueSources } },
  { query: { dimensions: 'video,day', filters: 'video==v1,v2', metrics: revenueSources } },
  { query: { dimensions: 'day', filters: 'video==v1', metrics: revenueSources } },
  { query: { filters: 'video==v1', metrics: revenueSources } },
  { query: sincePublishQuery },
]

describe("the fake video revenue reports, each video's own", () => {
  test("a dimensions=video revenue report answers each listed video's revenue sources over the range, a zero where the video holds none", async () => {
    const { google, get } = await earningChannel()
    google.setChannel('UC-uploader', {
      createdAt: '2019-03-01T06:00:00Z',
      uploads: [earningVideo, numbered(2)],
    })
    const query = { dimensions: 'video', filters: 'video==v1,v2', metrics: revenueSources }

    const lifetimeReport = await get('/v2/reports', { ...lifetime, ...query })
    const week = await get('/v2/reports', {
      ...lifetime,
      startDate: '2026-10-01',
      endDate: '2026-10-07',
      ...query,
    })

    expect(lifetimeReport.body).toEqual(
      expect.objectContaining({
        columnHeaders: [
          { name: 'video', columnType: 'DIMENSION', dataType: 'STRING' },
          { name: 'estimatedRevenue', columnType: 'METRIC', dataType: 'FLOAT' },
          { name: 'estimatedAdRevenue', columnType: 'METRIC', dataType: 'FLOAT' },
          { name: 'estimatedRedPartnerRevenue', columnType: 'METRIC', dataType: 'FLOAT' },
        ],
        rows: [
          ['v1', 9.5, 7, 1.25],
          ['v2', 0, 0, 0],
        ],
      }),
    )
    expect(week.body.rows).toEqual([['v1', 2.75, 0, 0]])
  })

  test("a dimensions=video,day revenue report answers each listed video's revenue sources on each of its days, leaving out a day with no revenue", async () => {
    const { google, get } = await earningChannel()
    google.setChannel('UC-uploader', { createdAt: '2019-03-01T06:00:00Z', uploads: [earningVideo] })

    const report = await get('/v2/reports', {
      ...lifetime,
      dimensions: 'video,day',
      filters: 'video==v1',
      metrics: revenueSources,
    })

    expect(report.body.rows).toEqual([['v1', '2026-10-02', 0.5, 0.25, 0.125]])
  })

  test('a dimensions=day revenue report of one video answers its revenue sources on each of its days', async () => {
    const { google, get } = await earningChannel()
    google.setChannel('UC-uploader', { createdAt: '2019-03-01T06:00:00Z', uploads: [earningVideo] })

    const report = await get('/v2/reports', {
      ...lifetime,
      dimensions: 'day',
      filters: 'video==v1',
      metrics: revenueSources,
    })

    expect(report.status).toBe(200)
    expect((report.body.rows as unknown[][]).toSorted()).toEqual([
      ['2026-10-02', 0.5, 0.25, 0.125],
      ['2026-10-03', 0, 0, 0],
    ])
  })

  test('a dimensions=day report of one video answers its engaged views, views, watch time and revenue together on each of its days', async () => {
    const { google, get } = await earningChannel()
    google.setChannel('UC-uploader', {
      createdAt: '2019-03-01T06:00:00Z',
      uploads: [
        {
          ...earningVideo,
          days: [
            {
              day: '2026-10-02',
              engagedViews: 1,
              views: 2,
              estimatedMinutesWatched: 6,
              estimatedRevenue: 0.5,
            },
            { day: '2026-10-03', engagedViews: 3, views: 4, estimatedMinutesWatched: 12 },
          ],
        },
      ],
    })

    const report = await get('/v2/reports', { ...lifetime, ...sincePublishQuery })

    expect(report.status).toBe(200)
    expect(report.body).toEqual(
      expect.objectContaining({
        columnHeaders: [
          { name: 'day', columnType: 'DIMENSION', dataType: 'STRING' },
          { name: 'engagedViews', columnType: 'METRIC', dataType: 'INTEGER' },
          { name: 'views', columnType: 'METRIC', dataType: 'INTEGER' },
          { name: 'estimatedMinutesWatched', columnType: 'METRIC', dataType: 'INTEGER' },
          { name: 'estimatedRevenue', columnType: 'METRIC', dataType: 'FLOAT' },
        ],
      }),
    )
    expect((report.body.rows as unknown[][]).toSorted()).toEqual([
      ['2026-10-02', 1, 2, 6, 0.5],
      ['2026-10-03', 3, 4, 12, 0],
    ])
  })

  test('a revenue report of one video with no dimension answers its revenue sources over the range', async () => {
    const { google, get } = await earningChannel()
    google.setChannel('UC-uploader', { createdAt: '2019-03-01T06:00:00Z', uploads: [earningVideo] })

    const report = await get('/v2/reports', {
      ...lifetime,
      filters: 'video==v1',
      metrics: revenueSources,
    })

    expect(report.body).toEqual(
      expect.objectContaining({
        columnHeaders: [
          { name: 'estimatedRevenue', columnType: 'METRIC', dataType: 'FLOAT' },
          { name: 'estimatedAdRevenue', columnType: 'METRIC', dataType: 'FLOAT' },
          { name: 'estimatedRedPartnerRevenue', columnType: 'METRIC', dataType: 'FLOAT' },
        ],
        rows: [[9.5, 7, 1.25]],
      }),
    )
  })

  test('a channel set to answer its revenue without rows gets a 200 with no rows to each video revenue report, and its views report still answers', async () => {
    const { google, get } = await earningChannel()
    google.setChannel('UC-uploader', {
      createdAt: '2019-03-01T06:00:00Z',
      uploads: [earningVideo, numbered(2)],
    })
    google.setRevenueRows('UC-uploader', false)
    const query = { dimensions: 'video', filters: 'video==v1,v2' }

    const revenue = await get('/v2/reports', { ...lifetime, ...query, metrics: revenueSources })
    const others = await Promise.all(
      videoRevenueQueries.map(({ query }) => get('/v2/reports', { ...lifetime, ...query })),
    )
    const views = await get('/v2/reports', { ...lifetime, ...query, metrics: 'engagedViews' })

    expect(revenue).toEqual({
      status: 200,
      body: {
        kind: 'youtubeAnalytics#resultTable',
        columnHeaders: [
          { name: 'video', columnType: 'DIMENSION', dataType: 'STRING' },
          { name: 'estimatedRevenue', columnType: 'METRIC', dataType: 'FLOAT' },
          { name: 'estimatedAdRevenue', columnType: 'METRIC', dataType: 'FLOAT' },
          { name: 'estimatedRedPartnerRevenue', columnType: 'METRIC', dataType: 'FLOAT' },
        ],
      },
    })
    expect(others.map(({ status, body }) => [status, body.rows])).toEqual(
      videoRevenueQueries.map(() => [200, undefined]),
    )
    expect(views.body.rows).toEqual([
      ['v1', 1],
      ['v2', 2],
    ])
  })

  test('a channel set back to answer its revenue with rows answers them again', async () => {
    const { google, get } = await earningChannel()
    google.setChannel('UC-uploader', { createdAt: '2019-03-01T06:00:00Z', uploads: [earningVideo] })
    const query = {
      ...lifetime,
      dimensions: 'video',
      filters: 'video==v1',
      metrics: revenueSources,
    }
    google.setRevenueRows('UC-uploader', false)
    const without = await get('/v2/reports', query)

    google.setRevenueRows('UC-uploader', true)
    const withRows = await get('/v2/reports', query)

    expect([without.body.rows, withRows.body.rows]).toEqual([undefined, [['v1', 9.5, 7, 1.25]]])
  })
})

describe('the fake Reporting API', () => {
  /** A Google whose signed-in user picked this channel, and calls to its jobs with a token. */
  async function reportingChannel(youtubeChannelId = 'UC-reporting', scope = analytics) {
    const google = await signedInGoogle()
    google.pickChannel(youtubeChannelId)
    const { access_token } = await grant(google, { scope })
    const headers = { authorization: `Bearer ${access_token}` }
    const list = async () => {
      const response = await fetch(new URL('/v1/jobs', google.origin), { headers })
      return { status: response.status, body: (await response.json()) as Record<string, unknown> }
    }
    const create = async (body: Record<string, string>) => {
      const response = await fetch(new URL('/v1/jobs', google.origin), {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      return { status: response.status, body: (await response.json()) as Record<string, unknown> }
    }
    return { google, list, create }
  }

  const reach = { reportTypeId: 'channel_reach_combined_a1', name: 'Stillstats reach' }

  test("jobs.create gives the token's channel a job, which jobs.list answers with its id, report type, name and creation time", async () => {
    const { google, list, create } = await reportingChannel()

    const created = await create(reach)

    expect(created.status).toBe(200)
    expect(created.body).toEqual({
      id: expect.any(String),
      ...reach,
      createTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    })
    expect((await list()).body).toEqual({ jobs: [created.body] })
    expect(google.reportingJobsOf('UC-reporting')).toEqual([created.body])
  })

  test('jobs.list answers a channel with no job an empty body, as Google leaves out an empty list', async () => {
    const { list } = await reportingChannel()

    expect(await list()).toEqual({ status: 200, body: {} })
  })

  test('jobs.create answers 409 for a report type the channel already has a job for, and creates none', async () => {
    const { google, create } = await reportingChannel()
    await create(reach)

    const again = await create({ ...reach, name: 'Another name' })

    expect(again.status).toBe(409)
    expect(google.reportingJobsOf('UC-reporting')).toHaveLength(1)
  })

  test('jobs.create answers 400 without a report type or a name', async () => {
    const { google, create } = await reportingChannel()

    const statuses = [
      (await create({ name: reach.name })).status,
      (await create({ reportTypeId: reach.reportTypeId })).status,
    ]

    expect(statuses).toEqual([400, 400])
    expect(google.reportingJobsOf('UC-reporting')).toEqual([])
  })

  test("a channel's jobs are its own: another channel's token lists none of them", async () => {
    const { google } = await reportingChannel('UC-other')
    google.setReportingJob('UC-reporting', {
      ...reach,
      id: 'held',
      createTime: '2026-11-01T00:00:00Z',
    })
    const { access_token } = await grant(google, { scope: analytics })

    const response = await fetch(new URL('/v1/jobs', google.origin), {
      headers: { authorization: `Bearer ${access_token}` },
    })

    expect(await response.json()).toEqual({})
  })

  test('a job set with setReportingJob is listed for its channel, as one Google already holds', async () => {
    const { google, list } = await reportingChannel()
    const held = { ...reach, id: 'held-at-google', createTime: '2026-11-01T00:00:00Z' }

    google.setReportingJob('UC-reporting', held)

    expect((await list()).body).toEqual({ jobs: [held] })
  })

  test('the jobs answer 401 to no live token and 403 to a token with neither Analytics scope', async () => {
    const { google } = await reportingChannel()
    const { access_token } = await grant(google, { scope: youtube })
    const statusWith = async (authorization?: string) =>
      (
        await fetch(new URL('/v1/jobs', google.origin), {
          headers: authorization ? { authorization } : {},
        })
      ).status

    expect([await statusWith(), await statusWith(`Bearer ${access_token}`)]).toEqual([401, 403])
  })

  test('the jobs failed with failReporting answer that status and create nothing', async () => {
    const { google, list, create } = await reportingChannel()
    google.failReporting(503)

    expect([(await list()).status, (await create(reach)).status]).toEqual([503, 503])
    expect(google.reportingJobsOf('UC-reporting')).toEqual([])
  })

  test('the jobs dropped with dropReportingApi get no answer to a later request', async () => {
    const { google, list } = await reportingChannel()
    google.dropReportingApi()

    await expect(list()).rejects.toThrow('fetch failed')
  })

  test('every jobs request is recorded by method and path, in the order it arrived', async () => {
    const { google, list, create } = await reportingChannel()

    await list()
    await create(reach)

    expect(google.reportingRequests).toEqual(['GET /v1/jobs', 'POST /v1/jobs'])
  })
})

describe('the fake Reporting API reports', () => {
  const reach = { reportTypeId: 'channel_reach_combined_a1', name: 'Stillstats reach' }

  /** A channel with a reach job at Google, and calls to its reports with a token. */
  async function reachChannel(youtubeChannelId = 'UC-reports') {
    const google = await signedInGoogle()
    google.pickChannel(youtubeChannelId)
    google.setReportingJob(youtubeChannelId, {
      ...reach,
      id: 'reach-job',
      createTime: '2026-10-01T00:00:00Z',
    })
    google.setNow(new Date('2026-11-17T12:00:00Z'))
    const { access_token } = await grant(google, { scope: analytics })
    const headers = { authorization: `Bearer ${access_token}` }
    const list = async (query: Record<string, string> = {}, jobId = 'reach-job') => {
      const url = new URL(`/v1/jobs/${jobId}/reports`, google.origin)
      url.search = new URLSearchParams(query).toString()
      const response = await fetch(url, { headers })
      return {
        status: response.status,
        body: (await response.json()) as { reports?: Record<string, string>[] },
      }
    }
    const download = async (downloadUrl: string) => {
      const response = await fetch(downloadUrl, { headers })
      return {
        status: response.status,
        retryAfter: response.headers.get('retry-after'),
        text: await response.text(),
      }
    }
    return { google, list, download }
  }

  const row = { videoId: 'v1', trafficSourceType: 5, impressions: 100, ctr: 0.05 }

  test("reports.list answers the job's reports with the Pacific day as start and end time, and with createdAfter only those created after it", async () => {
    const { google, list } = await reachChannel()
    const first = google.addReachReport('UC-reports', {
      day: '2026-11-01',
      createTime: '2026-11-02T10:00:00Z',
      rows: [row],
    })
    const second = google.addReachReport('UC-reports', {
      day: '2026-11-02',
      createTime: '2026-11-03T10:00:00Z',
      rows: [],
    })

    const every = await list()
    const newer = await list({ createdAfter: '2026-11-02T10:00:00Z' })

    expect(every.body.reports).toEqual([
      {
        id: first,
        jobId: 'reach-job',
        startTime: '2026-11-01T07:00:00.000Z',
        // Pacific Time leaves daylight saving on 2026-11-01, so the day ends at 08:00 UTC.
        endTime: '2026-11-02T08:00:00.000Z',
        createTime: '2026-11-02T10:00:00Z',
        downloadUrl: expect.stringContaining(google.origin),
      },
      expect.objectContaining({ id: second, startTime: '2026-11-02T08:00:00.000Z' }),
    ])
    expect(newer.body.reports?.map((report) => report.id)).toEqual([second])
  })

  test('a report created over 60 days before the clock is no longer listed', async () => {
    const { google, list } = await reachChannel()
    google.addReachReport('UC-reports', {
      day: '2026-09-16',
      createTime: '2026-09-17T11:00:00Z',
      rows: [row],
    })
    const kept = google.addReachReport('UC-reports', {
      day: '2026-09-17',
      createTime: '2026-09-18T13:00:00Z',
      rows: [row],
    })

    expect((await list()).body.reports?.map((report) => report.id)).toEqual([kept])
  })

  test("a correction of a delivered day is listed beside the original, with a new id and the same day's times", async () => {
    const { google, list } = await reachChannel()
    const original = google.addReachReport('UC-reports', {
      day: '2026-11-01',
      createTime: '2026-11-02T10:00:00Z',
      rows: [row],
    })
    const correction = google.addReachReport('UC-reports', {
      day: '2026-11-01',
      createTime: '2026-11-05T10:00:00Z',
      rows: [],
    })

    const reports = (await list()).body.reports ?? []

    expect(reports.map(({ id, startTime }) => ({ id, startTime }))).toEqual([
      { id: original, startTime: '2026-11-01T07:00:00.000Z' },
      { id: correction, startTime: '2026-11-01T07:00:00.000Z' },
    ])
  })

  test('reports.list answers 404 for a job the channel does not hold', async () => {
    const { list } = await reachChannel()

    expect((await list({}, 'another-job')).status).toBe(404)
  })

  test('a report file is CSV whose header row names every documented column, then one line per row, a field holding a comma quoted', async () => {
    const { google, list, download } = await reachChannel()
    google.addReachReport('UC-reports', {
      day: '2026-11-01',
      createTime: '2026-11-02T10:00:00Z',
      rows: [{ ...row, trafficSourceDetail: 'cats, dogs' }],
    })
    const [report] = (await list()).body.reports ?? []

    const file = await download(report?.downloadUrl ?? '')
    const [header, line, ...rest] = file.text.trimEnd().split('\n')
    const fields = Object.fromEntries(
      (header ?? '')
        .split(',')
        .map((column, i) => [column, line?.match(/("[^"]*"|[^,]*)(,|$)/g)?.[i]?.replace(/,$/, '')]),
    )

    expect(file.status).toBe(200)
    expect(Object.keys(fields).toSorted()).toEqual([
      'channel_id',
      'date',
      'device_type',
      'operating_system',
      'traffic_source_detail',
      'traffic_source_type',
      'video_id',
      'video_thumbnail_impressions',
      'video_thumbnail_impressions_ctr',
    ])
    expect(fields).toMatchObject({
      date: '20261101',
      video_id: 'v1',
      traffic_source_type: '5',
      traffic_source_detail: '"cats, dogs"',
      video_thumbnail_impressions: '100',
      video_thumbnail_impressions_ctr: '0.05',
    })
    expect(rest).toEqual([])
  })

  test('a report of a day with no data is its header row alone', async () => {
    const { google, list, download } = await reachChannel()
    google.addReachReport('UC-reports', {
      day: '2026-11-01',
      createTime: '2026-11-02T10:00:00Z',
      rows: [],
    })
    const [report] = (await list()).body.reports ?? []

    const file = await download(report?.downloadUrl ?? '')

    expect(file.text.trimEnd().split('\n')).toHaveLength(1)
  })

  test('downloads are recorded by report id; failReportDownloads answers its status and dropReportDownloads no answer, while listing still answers', async () => {
    const { google, list, download } = await reachChannel()
    const id = google.addReachReport('UC-reports', {
      day: '2026-11-01',
      createTime: '2026-11-02T10:00:00Z',
      rows: [row],
    })
    const [report] = (await list()).body.reports ?? []
    const url = report?.downloadUrl ?? ''

    const answered = (await download(url)).status
    google.failReportDownloads(503)
    const failed = (await download(url)).status
    const listed = (await list()).status
    google.dropReportDownloads()

    await expect(download(url)).rejects.toThrow('fetch failed')
    expect([answered, failed, listed]).toEqual([200, 503, 200])
    expect(google.reportDownloads).toEqual([id, id, id])
  })

  test('limitReportDownloads answers 429 past its count in a minute of the fake clock, with its Retry-After, until a minute after the first download of that minute, while listing still answers', async () => {
    const { google, list, download } = await reachChannel()
    google.addReachReport('UC-reports', {
      day: '2026-11-01',
      createTime: '2026-11-02T10:00:00Z',
      rows: [row],
    })
    const [report] = (await list()).body.reports ?? []
    const url = report?.downloadUrl ?? ''
    const downloadAt = async (time: string) => {
      google.setNow(new Date(time))
      const { status, retryAfter } = await download(url)
      return { status, retryAfter }
    }
    google.limitReportDownloads(2, { retryAfter: '120' })

    const answers = [
      await downloadAt('2026-11-17T12:00:00Z'),
      await downloadAt('2026-11-17T12:00:30Z'),
      await downloadAt('2026-11-17T12:00:59Z'),
      (await list()).status,
      await downloadAt('2026-11-17T12:01:00Z'),
    ]

    expect(answers).toEqual([
      { status: 200, retryAfter: null },
      { status: 200, retryAfter: null },
      { status: 429, retryAfter: '120' },
      200,
      { status: 200, retryAfter: null },
    ])
  })

  test('limitReportLists answers 429 to report lists past its count in a minute of the fake clock, with its Retry-After, while downloads still answer', async () => {
    const { google, list, download } = await reachChannel()
    google.addReachReport('UC-reports', {
      day: '2026-11-01',
      createTime: '2026-11-02T10:00:00Z',
      rows: [row],
    })
    const [report] = (await list()).body.reports ?? []
    const listAt = async (time: string) => {
      google.setNow(new Date(time))
      return (await list()).status
    }
    google.limitReportLists(1, { retryAfter: '90' })

    const answers = [
      await listAt('2026-11-17T12:00:00Z'),
      await listAt('2026-11-17T12:00:59Z'),
      (await download(report?.downloadUrl ?? '')).status,
      await listAt('2026-11-17T12:01:00Z'),
    ]
    google.setNow(new Date('2026-11-17T12:01:30Z'))
    const refused = await fetch(new URL('/v1/jobs/reach-job/reports', google.origin), {
      headers: { authorization: `Bearer ${google.issuedAccessTokens.at(-1)}` },
    })

    expect(answers).toEqual([200, 429, 200, 200])
    expect([refused.status, refused.headers.get('retry-after')]).toEqual([429, '90'])
  })

  test('a report file answers 401 to no live token', async () => {
    const { google, list } = await reachChannel()
    google.addReachReport('UC-reports', {
      day: '2026-11-01',
      createTime: '2026-11-02T10:00:00Z',
      rows: [row],
    })
    const [report] = (await list()).body.reports ?? []

    expect((await fetch(report?.downloadUrl ?? '')).status).toBe(401)
  })
})
