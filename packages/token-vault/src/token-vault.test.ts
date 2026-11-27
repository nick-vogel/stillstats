// Limits: Google is the fake Google server, so these tests cannot prove Google's real token
// lifetimes or its refresh behaviour. Nick connecting his own channel on the deployed product
// covers the real consent; a real refresh happens an hour after it. The invalid_grant and
// no-YouTube-quota tests rely on the fake answering invalid_grant after a revocation. Nick
// revoking the product's access in his own Google account settings on the deployed product, then
// seeing the connection end after the next probe or read, covers the real case.
import { randomBytes, randomUUID } from 'node:crypto'
import {
  connectionIdentifiers,
  connections,
  deletionRequests,
  quotaUsage,
  type Scoped,
  securityEvents,
  type WebDatabase,
  type WorkerDatabase,
} from '@creator-analytics/database'
import {
  test as databaseTest,
  type FindJobs,
  seedChannel,
} from '@creator-analytics/database/testing'
import { type FakeGoogle, startFakeGoogle } from '@creator-analytics/fake-google'
import {
  type RecordingReporter,
  type Reporter,
  recordingReporter,
} from '@creator-analytics/reporter'
import { eq, sql } from 'drizzle-orm'
import { describe, expect, onTestFinished, vi } from 'vitest'
import { parseTokenKeys, type TokenKeys } from './encryption.ts'
import {
  type ConnectionProbe,
  type ConsentIntent,
  createConnectionProbe,
  createTokenVault,
  enqueueConnectionProbes,
  fanOutSecurityEvent,
  googleCallTimeoutMs,
  googleRevocationJobData,
  markRevokedByGoogle,
  probeConnectionJobData,
  type RevokedGrant,
  scopeUrls,
  securityEventJobData,
  TokenEndpointUnansweredError,
  type TokenVault,
  type UnclaimedGrant,
} from './token-vault.ts'

const creator = { sub: '104729', email: 'creator@example.com', name: 'A Creator' }

function keyText(): string {
  return randomBytes(32).toString('base64')
}

function vaultFor(
  google: FakeGoogle,
  keys: TokenKeys,
  reporter: Reporter = recordingReporter(),
  callTimeoutMs?: number,
): TokenVault {
  return createTokenVault({
    google: {
      authorizationEndpoint: google.authorizationEndpoint,
      tokenEndpoint: google.tokenEndpoint,
      revocationEndpoint: google.revocationEndpoint,
      clientId: google.clientId,
      clientSecret: google.clientSecret,
    },
    redirectUri: 'http://localhost:3000/api/channels/connect/callback',
    keys,
    identifierKey: 'an identifier key',
    reporter,
    callTimeoutMs,
  })
}

const test = databaseTest.extend<{
  $test: {
    google: FakeGoogle
    keyOne: string
    reporter: RecordingReporter
    vault: TokenVault
  }
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest reads a fixture's dependencies from this pattern.
  google: async ({}, use) => {
    const google = await startFakeGoogle()
    onTestFinished(() => google.close())
    google.signInAs(creator)
    google.pickChannel('UC-creator')
    await use(google)
  },
  // biome-ignore lint/correctness/noEmptyPattern: as above.
  keyOne: async ({}, use) => use(keyText()),
  // biome-ignore lint/correctness/noEmptyPattern: as above.
  reporter: async ({}, use) => use(recordingReporter()),
  vault: async ({ google, keyOne, reporter }, use) =>
    use(vaultFor(google, parseTokenKeys(`1:${keyOne}`), reporter)),
})

/** Signs in a user and runs a consent through Google, a connect one unless told otherwise. */
async function completedConsent(
  web: WebDatabase,
  vault: TokenVault,
  userId: string,
  intent: ConsentIntent = { purpose: 'connect' },
) {
  await seedUser(web, userId)
  const { authorizationUrl } = await web.asUser(userId, (tx) =>
    vault.beginConsent(tx, intent, { loginHint: creator.email }),
  )
  const redirect = await fetch(authorizationUrl, { redirect: 'manual' })
  const callback = new URL(redirect.headers.get('location') ?? '')
  const completed = await web.asUser(userId, (tx) =>
    vault.completeConsent(tx, Object.fromEntries(callback.searchParams)),
  )
  return { authorization: new URL(authorizationUrl).searchParams, completed }
}

/** Signs in a user, runs a consent through Google, and returns its grant. */
async function consent(
  web: WebDatabase,
  vault: TokenVault,
  userId: string,
  intent?: ConsentIntent,
) {
  const { completed } = await completedConsent(web, vault, userId, intent)
  if (!completed.ok) throw new Error(`The consent was refused: ${completed.refusal}`)
  return completed.grant
}

/** Claims a channel for the user and attaches the grant as its connection. */
function connect(web: WebDatabase, vault: TokenVault, userId: string, grant: UnclaimedGrant) {
  return web.asUser(userId, async (tx) => {
    const channelId = await claim(tx, 'UC-creator')
    await vault.attach(tx, channelId, { grant, youtubeChannelId: 'UC-creator' })
    return channelId
  })
}

async function seedUser(web: WebDatabase, userId: string): Promise<void> {
  await web.asAnonymous((tx) =>
    tx.sql.execute(
      sql`insert into users (id, name, email) values (${userId}, ${userId}, ${`${userId}@example.com`}) on conflict do nothing`,
    ),
  )
}

async function claim(tx: Scoped<'user'>, youtubeChannelId: string): Promise<string> {
  const result = await tx.sql.execute<{ channel_id: string }>(
    sql`select channel_id from claim_channel(${youtubeChannelId})`,
  )
  const channelId = result.rows[0]?.channel_id
  if (!channelId) throw new Error('The claim was refused')
  return channelId
}

function readConnection(web: WebDatabase, userId: string) {
  return web.asUser(userId, async (tx) => {
    const [row] = await tx.sql.select().from(connections)
    return row
  })
}

/** Connects the user's channel and expires its access token, so the next read refreshes it. */
async function expiredConnection(web: WebDatabase, vault: TokenVault, userId: string) {
  const channelId = await connect(web, vault, userId, await consent(web, vault, userId))
  await web.asUser(userId, (tx) => tx.sql.update(connections).set({ accessTokenExpiresAt: tx.now }))
  return channelId
}

function bearerOf(vault: TokenVault, web: WebDatabase, userId: string, channelId: string) {
  return web.asUser(userId, (tx) =>
    vault.withAuthority(tx, channelId, ['youtube.readonly'], async (authority) =>
      authority.bearer(),
    ),
  )
}

/** Runs a security event's jobs as the worker does: its fan-out, then each channel's revocation. */
async function runSecurityEventJobs(worker: WorkerDatabase, findJobs: FindJobs) {
  for (const job of await findJobs('securityEvent')) {
    await worker.asSystem((tx) => fanOutSecurityEvent(tx, securityEventJobData(job.data)))
  }
  for (const job of await findJobs('googleRevocation')) {
    const data = googleRevocationJobData(job.data)
    await worker.forChannel(data.channelId, (tx) => markRevokedByGoogle(tx, data))
  }
}

/** The creator revokes the product's access in their Google account settings. */
async function revokeInGoogleSettings(google: FakeGoogle): Promise<void> {
  for (const token of google.issuedRefreshTokens) {
    await fetch(google.revocationEndpoint, { method: 'POST', body: new URLSearchParams({ token }) })
  }
}

/** The connection's state and the reasons of its channel's deletion requests. */
function revocationOf(worker: WorkerDatabase, vault: TokenVault, channelId: string) {
  return worker.forChannel(channelId, async (tx) => ({
    state: (await vault.status(tx, channelId))?.state,
    requests: await tx.sql.select({ reason: deletionRequests.reason }).from(deletionRequests),
  }))
}

/** The connection probe the worker builds, with the vault's Google client and keys. */
function proberFor(google: FakeGoogle, keyOne: string): ConnectionProbe {
  return createConnectionProbe({
    google: {
      tokenEndpoint: google.tokenEndpoint,
      clientId: google.clientId,
      clientSecret: google.clientSecret,
    },
    keys: parseTokenKeys(`1:${keyOne}`),
  })
}

/** Runs the daily roster job as the worker does, then each channel's probe. */
async function runRosterJobs(worker: WorkerDatabase, prober: ConnectionProbe, findJobs: FindJobs) {
  await worker.asSystem((tx) => enqueueConnectionProbes(tx))
  for (const job of await findJobs('probeConnection')) {
    const { channelId } = probeConnectionJobData(job.data)
    await worker.forChannel(channelId, (tx) => prober.probe(tx, channelId))
  }
}

function receive(web: WebDatabase, vault: TokenVault, revoked: RevokedGrant[]) {
  return web.asAnonymous((tx) => vault.receiveRevocations(tx, revoked))
}

/** Every later token endpoint call answers `status` with this raw JSON body; other calls go through. */
function answerTokenEndpoint(google: FakeGoogle, status: number, body: string) {
  const realFetch = globalThis.fetch
  const spy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input, init) =>
      String(input) === google.tokenEndpoint
        ? Promise.resolve(
            new Response(body, { status, headers: { 'content-type': 'application/json' } }),
          )
        : realFetch(input, init),
    )
  onTestFinished(() => spy.mockRestore())
}

describe('the token vault', () => {
  test('a connection stores both tokens only as ciphertexts under the current key', async ({
    web,
    vault,
    google,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )

    const stored = await readConnection(web, 'vault-user-a')

    const [accessToken] = google.issuedAccessTokens
    const [refreshToken] = google.issuedRefreshTokens
    expect(accessToken && refreshToken).toBeTruthy()
    expect(stored).toMatchObject({ channelId, keyVersion: 1, status: 'active' })
    expect(JSON.stringify(stored)).not.toContain(accessToken)
    expect(JSON.stringify(stored)).not.toContain(refreshToken)
  })

  test('a connection records each granted scope with the time it was granted', async ({
    web,
    vault,
  }) => {
    await connect(web, vault, 'vault-user-a', await consent(web, vault, 'vault-user-a'))

    const stored = await readConnection(web, 'vault-user-a')

    const grantedAt = stored?.connectedAt.toISOString()
    expect(stored?.scopes).toEqual([
      { name: 'youtube.readonly', grantedAt },
      { name: 'yt-analytics.readonly', grantedAt },
    ])
  })

  test('a connection stores identifiers of its Google subject and refresh token, never their raw values', async ({
    web,
    vault,
    google,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )

    const stored = await web.asUser('vault-user-a', (tx) =>
      tx.sql
        .select({ kind: connectionIdentifiers.kind, hmac: connectionIdentifiers.hmac })
        .from(connectionIdentifiers)
        .where(eq(connectionIdentifiers.channelId, channelId)),
    )

    expect(stored.map(({ kind }) => kind).sort()).toEqual(
      ['refresh_token_hash', 'refresh_token_prefix', 'subject'].sort(),
    )
    const refreshToken = google.issuedRefreshTokens.at(-1) ?? ''
    const hmacs = stored.map(({ hmac }) => hmac)
    expect(hmacs).not.toContain(creator.sub)
    expect(hmacs).not.toContain(refreshToken)
    expect(hmacs).not.toContain(refreshToken.slice(0, 16))
  })

  test('no value the vault returns holds a token, a ciphertext or a key version', async ({
    web,
    google,
    vault,
  }) => {
    const grant = await consent(web, vault, 'vault-user-a')
    const channelId = await connect(web, vault, 'vault-user-a', grant)
    const stored = await readConnection(web, 'vault-user-a')
    const authorityResult = await web.asUser('vault-user-a', (tx) =>
      vault.withAuthority(tx, channelId, ['youtube.readonly'], async (authority) => authority),
    )

    const returned = JSON.stringify([grant, authorityResult])

    const secrets = [
      ...google.issuedAccessTokens,
      ...google.issuedRefreshTokens,
      stored?.accessToken,
      stored?.refreshToken,
    ]
    expect(secrets.filter((secret) => secret && returned.includes(secret))).toEqual([])
    expect(returned).not.toContain('keyVersion')
  })

  test('the authority gives its access token only inside the call', async ({ web, vault }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )

    const result = await web.asUser('vault-user-a', (tx) =>
      vault.withAuthority(tx, channelId, ['youtube.readonly'], async (authority) => authority),
    )

    if (!result.ok) throw new Error(result.refusal)
    expect(() => result.value.bearer()).toThrow('outside its call')
  })

  test('a connection sealed under an older key still works and is resealed under the current key', async ({
    web,
    google,
    keyOne,
    vault,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )
    const sealedUnderOne = await readConnection(web, 'vault-user-a')
    const rotated = vaultFor(google, parseTokenKeys(`1:${keyOne},2:${keyText()}`))

    const bearer = await bearerOf(rotated, web, 'vault-user-a', channelId)

    expect(bearer).toEqual({ ok: true, value: google.issuedAccessTokens[0] })
    const resealed = await readConnection(web, 'vault-user-a')
    expect(resealed?.keyVersion).toBe(2)
    expect(resealed?.refreshToken).not.toBe(sealedUnderOne?.refreshToken)
  })

  test('an expired access token is refreshed through Google and the new one is stored', async ({
    web,
    google,
    vault,
  }) => {
    const channelId = await expiredConnection(web, vault, 'vault-user-a')

    const first = await bearerOf(vault, web, 'vault-user-a', channelId)
    const second = await bearerOf(vault, web, 'vault-user-a', channelId)

    const refreshed = google.issuedAccessTokens[1]
    expect(refreshed).toBeTruthy()
    expect(first).toEqual({ ok: true, value: refreshed })
    expect(second).toEqual({ ok: true, value: refreshed })
  })

  test('a channel with no connection is refused with not_connected', async ({ web, vault }) => {
    await seedUser(web, 'vault-user-a')

    const result = await web.asUser('vault-user-a', async (tx) => {
      const channelId = await claim(tx, 'UC-unconnected')
      return vault.withAuthority(tx, channelId, ['youtube.readonly'], async () => 'called')
    })

    expect(result).toEqual({ ok: false, refusal: 'not_connected' })
  })

  test('a scope the connection was not granted is refused with consent_missing', async ({
    web,
    vault,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )

    const result = await web.asUser('vault-user-a', (tx) =>
      vault.withAuthority(tx, channelId, ['yt-analytics-monetary.readonly'], async () => 'called'),
    )

    expect(result).toEqual({ ok: false, refusal: 'consent_missing' })
  })

  test('a revoked connection is refused with connection_revoked', async ({ web, vault }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )
    await web.asUser('vault-user-a', (tx) => tx.sql.update(connections).set({ status: 'revoked' }))

    const result = await web.asUser('vault-user-a', (tx) =>
      vault.withAuthority(tx, channelId, ['youtube.readonly'], async () => 'called'),
    )

    expect(result).toEqual({ ok: false, refusal: 'connection_revoked' })
  })

  // Read in the channel's scope, as for a disconnect: the deletion request ends the membership.
  test('a refresh Google refuses with invalid_grant is refused with connection_revoked, and the revocation and the deletion request commit', async ({
    web,
    worker,
    google,
    vault,
    findJobs,
  }) => {
    const channelId = await expiredConnection(web, vault, 'vault-user-a')
    await revokeInGoogleSettings(google)

    const result = await web.asUser('vault-user-a', (tx) =>
      vault.withAuthority(tx, channelId, ['youtube.readonly'], async () => 'called'),
    )

    expect(result).toEqual({ ok: false, refusal: 'connection_revoked' })
    expect(await revocationOf(worker, vault, channelId)).toEqual({
      state: 'revoked',
      requests: [{ reason: 'google_revocation' }],
    })
    expect(await findJobs('deleteChannel')).toHaveLength(1)
  })

  test.for([
    ['no access token or lifetime', '{}'],
    ['no access token', '{"expires_in":3599,"token_type":"Bearer"}'],
    ['no lifetime', '{"access_token":"ya29.fresh","token_type":"Bearer"}'],
    ['a null body', 'null'],
  ] as const)(
    'a refresh Google answers 200 with %s ends as a token endpoint outage',
    async ([, body], { web, vault, google }) => {
      const channelId = await expiredConnection(web, vault, 'vault-user-a')
      answerTokenEndpoint(google, 200, body)

      await expect(bearerOf(vault, web, 'vault-user-a', channelId)).rejects.toBeInstanceOf(
        TokenEndpointUnansweredError,
      )
    },
  )

  test('a refresh Google answers 503 with a null body ends as a token endpoint outage', async ({
    web,
    vault,
    google,
  }) => {
    const channelId = await expiredConnection(web, vault, 'vault-user-a')
    answerTokenEndpoint(google, 503, 'null')

    await expect(bearerOf(vault, web, 'vault-user-a', channelId)).rejects.toBeInstanceOf(
      TokenEndpointUnansweredError,
    )
  })

  test('a refresh Google answers 429 ends as a token endpoint outage, not a plain error', async ({
    web,
    vault,
    google,
  }) => {
    const channelId = await expiredConnection(web, vault, 'vault-user-a')
    answerTokenEndpoint(google, 429, '{"error":"rate_limit_exceeded"}')

    await expect(bearerOf(vault, web, 'vault-user-a', channelId)).rejects.toBeInstanceOf(
      TokenEndpointUnansweredError,
    )
  })

  test('a refresh Google answers 400 with invalid_request rejects with a plain error, not a token endpoint outage', async ({
    web,
    vault,
    google,
  }) => {
    const channelId = await expiredConnection(web, vault, 'vault-user-a')
    answerTokenEndpoint(google, 400, '{"error":"invalid_request"}')

    const refresh = bearerOf(vault, web, 'vault-user-a', channelId)

    await expect(refresh).rejects.toThrow("Google's token endpoint answered 400 invalid_request")
    await expect(refresh).rejects.not.toBeInstanceOf(TokenEndpointUnansweredError)
  })

  test('a connect consent asks for the connection scopes, openid and email through incremental authorization', async ({
    web,
    vault,
  }) => {
    const { authorization, completed } = await completedConsent(web, vault, 'vault-user-a')

    expect(authorization.get('scope')?.split(' ').sort()).toEqual(
      ['openid', 'email', scopeUrls['youtube.readonly'], scopeUrls['yt-analytics.readonly']].sort(),
    )
    expect(authorization.get('include_granted_scopes')).toBe('true')
    expect(completed).toMatchObject({ ok: true, intent: { purpose: 'connect' } })
  })

  // creator-analytics#907: a connect begun from the upgrade screen lands back on it.
  test('a connect consent keeps the landing it began with, and one begun with none keeps none', async ({
    web,
    vault,
  }) => {
    const { completed: toUpgrade } = await completedConsent(web, vault, 'vault-user-a', {
      purpose: 'connect',
      landing: 'upgrade',
    })
    const { completed: plain } = await completedConsent(web, vault, 'vault-user-b')

    expect(toUpgrade).toMatchObject({
      ok: true,
      intent: { purpose: 'connect', landing: 'upgrade' },
    })
    expect(plain.ok && plain.intent).toEqual({ purpose: 'connect' })
  })

  test('a refused connect consent keeps its landing, so the refusal lands where the connect began', async ({
    web,
    vault,
    google,
  }) => {
    google.refuseConsent()

    const { completed } = await completedConsent(web, vault, 'vault-user-a', {
      purpose: 'connect',
      landing: 'upgrade',
    })

    expect(completed).toEqual({
      ok: false,
      refusal: 'consent_denied',
      intent: { purpose: 'connect', landing: 'upgrade' },
    })
  })

  test('a revenue consent completes with its channel and a grant that holds the connection scopes too', async ({
    web,
    vault,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )

    const { completed } = await completedConsent(web, vault, 'vault-user-a', {
      purpose: 'revenue',
      channelId,
    })

    expect(completed).toMatchObject({ ok: true, intent: { purpose: 'revenue', channelId } })
    if (!completed.ok) throw new Error('The revenue consent was refused')
    expect(completed.grant.scopes).toContain('yt-analytics-monetary.readonly')
    expect(completed.grant.scopes).toContain('youtube.readonly')
  })

  test('a revenue consent without the monetary scope is refused with scopes_missing and its intent', async ({
    web,
    vault,
    google,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )
    google.uncheckScopes([scopeUrls['yt-analytics-monetary.readonly']])

    const { completed } = await completedConsent(web, vault, 'vault-user-a', {
      purpose: 'revenue',
      channelId,
    })

    expect(completed).toEqual({
      ok: false,
      refusal: 'scopes_missing',
      intent: { purpose: 'revenue', channelId },
    })
  })

  test('a consent whose code exchange Google answers with a 503 is refused with google_failed and its intent', async ({
    web,
    vault,
    google,
  }) => {
    google.failTokenEndpoint(503)

    const { completed } = await completedConsent(web, vault, 'vault-user-a')

    expect(completed).toEqual({
      ok: false,
      refusal: 'google_failed',
      intent: { purpose: 'connect' },
      answer: 'none',
    })
  })

  test('a consent whose code exchange Google answers with no refresh token is refused with google_failed and its intent', async ({
    web,
    vault,
    google,
  }) => {
    google.withholdRefreshToken()

    const { completed } = await completedConsent(web, vault, 'vault-user-a')

    expect(completed).toEqual({
      ok: false,
      refusal: 'google_failed',
      intent: { purpose: 'connect' },
      answer: 'unusable',
    })
  })

  // Fails today, the proof creator-analytics#248 asked for: completeConsent drops an unusable
  // answer without revoking it, so its grant stays live at Google. The last line's assertion is the
  // proof and the only line that may throw: under `.fails` any throw passes the test, so a setup
  // that throws or goes another way returns instead, and `.fails` reports that body as a failure.
  // The guarded revoke is not filed yet: a revoke ends the whole Google grant, so it is safe only
  // once no active connection carries the answer's subject. Drop `.fails` when it lands.
  test.fails('a consent whose code exchange Google answers with no refresh token has the access token it issued revoked at Google', async ({
    web,
    vault,
    google,
  }) => {
    const completed = await (async () => {
      google.withholdRefreshToken()
      return (await completedConsent(web, vault, 'vault-user-a')).completed
    })().catch(() => undefined)
    const unusableAnswerRefused =
      completed?.ok === false &&
      completed.refusal === 'google_failed' &&
      completed.answer === 'unusable' &&
      google.issuedAccessTokens.length === 1
    if (!unusableAnswerRefused) return

    expect(google.revokedTokens).toEqual(google.issuedAccessTokens)
  })

  test('a consent whose code exchange Google answers with an ID token with no subject is refused with google_failed and its intent', async ({
    web,
    vault,
    google,
  }) => {
    google.withholdIdTokenSubject()

    const { completed } = await completedConsent(web, vault, 'vault-user-a')

    expect(completed).toEqual({
      ok: false,
      refusal: 'google_failed',
      intent: { purpose: 'connect' },
      answer: 'unusable',
    })
  })

  test('a consent whose code exchange Google answers with an ID token whose payload is not JSON is refused with google_failed and its intent', async ({
    web,
    vault,
    google,
  }) => {
    google.malformIdToken('not_json')

    const { completed } = await completedConsent(web, vault, 'vault-user-a')

    expect(completed).toEqual({
      ok: false,
      refusal: 'google_failed',
      intent: { purpose: 'connect' },
      answer: 'unusable',
    })
  })

  test('a consent whose code exchange Google answers with an ID token whose payload is null is refused with google_failed and its intent', async ({
    web,
    vault,
    google,
  }) => {
    google.malformIdToken('null')

    const { completed } = await completedConsent(web, vault, 'vault-user-a')

    expect(completed).toEqual({
      ok: false,
      refusal: 'google_failed',
      intent: { purpose: 'connect' },
      answer: 'unusable',
    })
  })

  test('a consent whose code exchange Google answers 200 with a null body is refused with google_failed and its intent', async ({
    web,
    vault,
    google,
  }) => {
    answerTokenEndpoint(google, 200, 'null')

    const { completed } = await completedConsent(web, vault, 'vault-user-a')

    expect(completed).toEqual({
      ok: false,
      refusal: 'google_failed',
      intent: { purpose: 'connect' },
      answer: 'none',
    })
  })

  test.for(['42', '"x"', 'true'])(
    'a consent whose code exchange Google answers 200 with the JSON primitive %s is refused with google_failed and its intent',
    async (body, { web, vault, google }) => {
      answerTokenEndpoint(google, 200, body)

      const { completed } = await completedConsent(web, vault, 'vault-user-a')

      expect(completed).toEqual({
        ok: false,
        refusal: 'google_failed',
        intent: { purpose: 'connect' },
        answer: 'none',
      })
    },
  )

  test('a consent whose code exchange Google answers 503 with a null body is refused with google_failed and its intent', async ({
    web,
    vault,
    google,
  }) => {
    answerTokenEndpoint(google, 503, 'null')

    const { completed } = await completedConsent(web, vault, 'vault-user-a')

    expect(completed).toEqual({
      ok: false,
      refusal: 'google_failed',
      intent: { purpose: 'connect' },
      answer: 'none',
    })
  })

  test('a consent whose code exchange Google answers 429 is refused with google_failed and its intent', async ({
    web,
    vault,
    google,
  }) => {
    answerTokenEndpoint(google, 429, '{"error":"rate_limit_exceeded"}')

    const { completed } = await completedConsent(web, vault, 'vault-user-a')

    expect(completed).toEqual({
      ok: false,
      refusal: 'google_failed',
      intent: { purpose: 'connect' },
      answer: 'none',
    })
  })

  test('a consent whose code exchange Google answers 200 with every field but an access token is refused with google_failed and its intent', async ({
    web,
    vault,
    google,
  }) => {
    answerTokenEndpoint(
      google,
      200,
      JSON.stringify({
        expires_in: 3599,
        refresh_token: '1//refresh-without-access',
        scope: [
          scopeUrls['youtube.readonly'],
          scopeUrls['yt-analytics.readonly'],
          'openid',
          'email',
        ].join(' '),
        token_type: 'Bearer',
        id_token: 'a.b.c',
      }),
    )

    const { completed } = await completedConsent(web, vault, 'vault-user-a')

    expect(completed).toEqual({
      ok: false,
      refusal: 'google_failed',
      intent: { purpose: 'connect' },
      answer: 'none',
    })
  })

  test('a consent whose code exchange Google answers 200 with a JSON array is refused with google_failed and its intent', async ({
    web,
    vault,
    google,
  }) => {
    answerTokenEndpoint(google, 200, '[]')

    const { completed } = await completedConsent(web, vault, 'vault-user-a')

    expect(completed).toEqual({
      ok: false,
      refusal: 'google_failed',
      intent: { purpose: 'connect' },
      answer: 'none',
    })
  })

  test('a revenue consent whose code exchange Google answers with no refresh token is refused with google_failed and its revenue intent', async ({
    web,
    vault,
    google,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )
    google.withholdRefreshToken()

    const { completed } = await completedConsent(web, vault, 'vault-user-a', {
      purpose: 'revenue',
      channelId,
    })

    expect(completed).toEqual({
      ok: false,
      refusal: 'google_failed',
      intent: { purpose: 'revenue', channelId },
      answer: 'unusable',
    })
  })

  test('added scopes keep the grant time of each earlier scope and record their own', async ({
    web,
    vault,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )
    const before = await readConnection(web, 'vault-user-a')
    const grant = await consent(web, vault, 'vault-user-a', { purpose: 'revenue', channelId })

    await web.asUser('vault-user-a', (tx) =>
      vault.addScopes(tx, channelId, { grant, youtubeChannelId: 'UC-creator' }),
    )

    const after = await readConnection(web, 'vault-user-a')
    const connectedAt = before?.connectedAt.toISOString()
    expect(after?.connectedAt).toEqual(before?.connectedAt)
    expect(after?.scopes).toEqual([
      { name: 'youtube.readonly', grantedAt: connectedAt },
      { name: 'yt-analytics.readonly', grantedAt: connectedAt },
      { name: 'yt-analytics-monetary.readonly', grantedAt: grant.grantedAt.toISOString() },
    ])
  })

  test("added scopes replace the connection's tokens with the revenue grant's", async ({
    web,
    vault,
    google,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )
    const grant = await consent(web, vault, 'vault-user-a', { purpose: 'revenue', channelId })

    await web.asUser('vault-user-a', (tx) =>
      vault.addScopes(tx, channelId, { grant, youtubeChannelId: 'UC-creator' }),
    )

    const result = await bearerOf(vault, web, 'vault-user-a', channelId)
    expect(result).toEqual({ ok: true, value: google.issuedAccessTokens.at(-1) })
  })

  test('scopes are never added to a revoked connection', async ({ web, vault }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )
    const grant = await consent(web, vault, 'vault-user-a', { purpose: 'revenue', channelId })
    await web.asUser('vault-user-a', (tx) => tx.sql.update(connections).set({ status: 'revoked' }))
    const revoked = await readConnection(web, 'vault-user-a')

    const added = await web.asUser('vault-user-a', (tx) =>
      vault.addScopes(tx, channelId, { grant, youtubeChannelId: 'UC-creator' }),
    )

    expect(added).toEqual({ ok: false, refusal: 'connection_revoked' })
    expect(await readConnection(web, 'vault-user-a')).toEqual(revoked)
  })

  test('a connect never records the revenue scope, even when Google grants it from an earlier consent', async ({
    web,
    vault,
    google,
  }) => {
    google.grantedEarlier([scopeUrls['yt-analytics-monetary.readonly']])
    const grant = await consent(web, vault, 'vault-user-a')

    await connect(web, vault, 'vault-user-a', grant)

    expect(grant.scopes).toContain('yt-analytics-monetary.readonly')
    const stored = await readConnection(web, 'vault-user-a')
    expect(stored?.scopes.map((scope) => scope.name)).toEqual([
      'youtube.readonly',
      'yt-analytics.readonly',
    ])
  })

  test('a reconnect keeps the grant time of each scope the connection already held', async ({
    web,
    vault,
  }) => {
    await connect(web, vault, 'vault-user-a', await consent(web, vault, 'vault-user-a'))
    const before = await readConnection(web, 'vault-user-a')

    await connect(web, vault, 'vault-user-a', await consent(web, vault, 'vault-user-a'))

    const after = await readConnection(web, 'vault-user-a')
    expect(after?.scopes).toEqual(before?.scopes)
  })

  test('a new grant does not make a revoked connection active again', async ({ web, vault }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )
    await web.asUser('vault-user-a', (tx) => tx.sql.update(connections).set({ status: 'revoked' }))
    const revoked = await readConnection(web, 'vault-user-a')
    const grant = await consent(web, vault, 'vault-user-a')

    await web.asUser('vault-user-a', (tx) =>
      vault.attach(tx, channelId, { grant, youtubeChannelId: 'UC-creator' }),
    )

    expect(await readConnection(web, 'vault-user-a')).toEqual(revoked)
  })

  test('a disconnect revokes the refresh token at Google', async ({ web, google, vault }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )

    const disconnected = await web.asUser('vault-user-a', (tx) =>
      vault.disconnect(tx, channelId, 'in_app_revocation'),
    )

    expect(disconnected).toEqual({ revokedAtGoogle: true })
    expect(google.revokedTokens).toEqual(google.issuedRefreshTokens)
  })

  // Read in the channel's scope: the deletion request ends the user's membership, so the user's
  // scope no longer admits the channel's rows.
  test('a disconnect marks the connection revoked and requests the deletion with its reason', async ({
    web,
    worker,
    vault,
    findJobs,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )

    await web.asUser('vault-user-a', (tx) => vault.disconnect(tx, channelId, 'in_app_revocation'))

    const read = await worker.forChannel(channelId, async (tx) => {
      const requests = await tx.sql
        .select({ channelId: deletionRequests.channelId, reason: deletionRequests.reason })
        .from(deletionRequests)
      return { status: await vault.status(tx, channelId), requests }
    })

    expect(read.status?.state).toBe('revoked')
    expect(read.requests).toEqual([{ channelId, reason: 'in_app_revocation' }])
    expect(await findJobs('deleteChannel')).toHaveLength(1)
  })

  test('a revoke Google refuses is reported, and the connection is still revoked and its deletion requested', async ({
    web,
    worker,
    google,
    vault,
    reporter,
    findJobs,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )
    google.failRevocation(503)

    const disconnected = await web.asUser('vault-user-a', (tx) =>
      vault.disconnect(tx, channelId, 'in_app_revocation'),
    )

    expect(disconnected).toEqual({ revokedAtGoogle: false })
    expect(reporter.reports).toEqual([
      {
        message: 'Google did not confirm the revocation of a disconnected connection',
        context: { channelId, status: '503' },
      },
    ])
    expect(await worker.forChannel(channelId, (tx) => vault.status(tx, channelId))).toMatchObject({
      state: 'revoked',
    })
    expect(await findJobs('deleteChannel')).toHaveLength(1)
  })

  // The test's timeout is half production's bound, and the held revocation never answers, so only
  // the vault's bound on a Google call can end the disconnect in time.
  test('a revoke Google holds open past the bound is reported unanswered, and the connection is still revoked', {
    timeout: googleCallTimeoutMs / 2,
  }, async ({ web, worker, google, keyOne, reporter, findJobs }) => {
    const vault = vaultFor(google, parseTokenKeys(`1:${keyOne}`), reporter, 500)
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )
    google.holdRevocation()

    const disconnected = await web.asUser('vault-user-a', (tx) =>
      vault.disconnect(tx, channelId, 'in_app_revocation'),
    )

    expect(disconnected).toEqual({ revokedAtGoogle: false })
    expect(reporter.reports).toEqual([
      {
        message: 'Google did not confirm the revocation of a disconnected connection',
        context: { channelId, status: 'no_answer' },
      },
    ])
    expect(await worker.forChannel(channelId, (tx) => vault.status(tx, channelId))).toMatchObject({
      state: 'revoked',
    })
    expect(await findJobs('deleteChannel')).toHaveLength(1)
  })

  test('a disconnect that rolls back leaves the connection active, and no request and no job', async ({
    web,
    vault,
    findJobs,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )

    await web
      .asUser('vault-user-a', async (tx) => {
        await vault.disconnect(tx, channelId, 'in_app_revocation')
        throw new Error('the disconnect failed after the vault')
      })
      .catch(() => undefined)

    const read = await web.asUser('vault-user-a', async (tx) => ({
      status: await vault.status(tx, channelId),
      requests: await tx.sql.select().from(deletionRequests),
    }))
    expect(read.status?.state).toBe('active')
    expect(read.requests).toEqual([])
    expect(await findJobs('deleteChannel')).toEqual([])
  })

  test("a security event naming the Google subject revokes the subject's connection and requests its deletion as google_revocation", async ({
    web,
    worker,
    vault,
    findJobs,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )

    await receive(web, vault, [{ by: 'subject', sub: creator.sub }])
    await runSecurityEventJobs(worker, findJobs)

    const read = await worker.forChannel(channelId, async (tx) => ({
      status: await vault.status(tx, channelId),
      requests: await tx.sql.select({ reason: deletionRequests.reason }).from(deletionRequests),
    }))
    expect(read.status?.state).toBe('revoked')
    expect(read.requests).toEqual([{ reason: 'google_revocation' }])
  })

  test('a security event naming another Google subject revokes nothing, and its record is deleted', async ({
    web,
    worker,
    vault,
    findJobs,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )

    await receive(web, vault, [{ by: 'subject', sub: 'another-subject' }])
    await runSecurityEventJobs(worker, findJobs)

    expect(await findJobs('googleRevocation')).toEqual([])
    expect(await worker.forChannel(channelId, (tx) => vault.status(tx, channelId))).toMatchObject({
      state: 'active',
    })
    expect(await worker.asSystem((tx) => tx.sql.select().from(securityEvents))).toEqual([])
  })

  test('a security event delivered twice requests one deletion', async ({
    web,
    worker,
    vault,
    findJobs,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )

    await receive(web, vault, [{ by: 'subject', sub: creator.sub }])
    await receive(web, vault, [{ by: 'subject', sub: creator.sub }])
    await runSecurityEventJobs(worker, findJobs)

    expect(await findJobs('deleteChannel')).toEqual([
      expect.objectContaining({ data: expect.objectContaining({ channelId }) }),
    ])
  })

  test('a revocation for a channel whose connection is gone changes nothing', async ({
    worker,
  }) => {
    const channelId = randomUUID()

    await worker.forChannel(channelId, (tx) => markRevokedByGoogle(tx, { channelId }))

    expect(
      await worker.forChannel(channelId, (tx) => tx.sql.select().from(deletionRequests)),
    ).toEqual([])
  })
})

describe('the revocation backstop', () => {
  test('the roster job enqueues one probe per active connection, and none for a revoked one', async ({
    web,
    worker,
    findJobs,
  }) => {
    const first = await seedChannel(web, worker, 'vault-roster-a')
    const second = await seedChannel(web, worker, 'vault-roster-b')
    const revoked = await seedChannel(web, worker, 'vault-roster-c')
    await worker.forChannel(revoked, (tx) =>
      tx.sql
        .update(connections)
        .set({ status: 'revoked' })
        .where(eq(connections.channelId, revoked)),
    )

    await worker.asSystem((tx) => enqueueConnectionProbes(tx))

    const probed = (await findJobs('probeConnection')).map((job) => job.data.channelId)
    expect(probed.sort()).toEqual([first, second].sort())
  })

  test('a roster job that runs twice in a day probes each channel once', async ({
    web,
    worker,
    findJobs,
  }) => {
    const channelId = await seedChannel(web, worker, 'vault-roster-a')

    await worker.asSystem((tx) => enqueueConnectionProbes(tx))
    await worker.asSystem((tx) => enqueueConnectionProbes(tx))

    expect((await findJobs('probeConnection')).map((job) => job.data)).toEqual([{ channelId }])
  })

  test('a probe refreshes an active connection through Google even with a fresh access token, and spends no YouTube quota', async ({
    web,
    worker,
    google,
    keyOne,
    vault,
    findJobs,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )

    await runRosterJobs(worker, proberFor(google, keyOne), findJobs)

    const refreshed = google.issuedAccessTokens[1]
    expect(refreshed).toBeTruthy()
    expect(await worker.forChannel(channelId, (tx) => vault.status(tx, channelId))).toMatchObject({
      state: 'active',
    })
    expect(await bearerOf(vault, web, 'vault-user-a', channelId)).toEqual({
      ok: true,
      value: refreshed,
    })
    expect(google.analyticsRequests).toEqual([])
    expect(await worker.forChannel(channelId, (tx) => tx.sql.select().from(quotaUsage))).toEqual([])
  })

  test('a probe Google refuses with invalid_grant revokes the connection and requests the deletion as google_revocation', async ({
    web,
    worker,
    google,
    keyOne,
    vault,
    findJobs,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )
    await revokeInGoogleSettings(google)

    await runRosterJobs(worker, proberFor(google, keyOne), findJobs)

    expect(await revocationOf(worker, vault, channelId)).toEqual({
      state: 'revoked',
      requests: [{ reason: 'google_revocation' }],
    })
    expect(await findJobs('deleteChannel')).toHaveLength(1)
  })

  test('a probe of a revoked connection calls Google for nothing', async ({
    web,
    worker,
    google,
    keyOne,
    vault,
  }) => {
    const channelId = await connect(
      web,
      vault,
      'vault-user-a',
      await consent(web, vault, 'vault-user-a'),
    )
    await web.asUser('vault-user-a', (tx) => vault.disconnect(tx, channelId, 'in_app_revocation'))

    const prober = proberFor(google, keyOne)
    await worker.forChannel(channelId, (tx) => prober.probe(tx, channelId))

    expect(google.issuedAccessTokens).toHaveLength(1)
    expect(await revocationOf(worker, vault, channelId)).toEqual({
      state: 'revoked',
      requests: [{ reason: 'in_app_revocation' }],
    })
  })

  test('a probe of a channel whose connection is gone calls Google for nothing', async ({
    worker,
    google,
    keyOne,
  }) => {
    const gone = randomUUID()

    const prober = proberFor(google, keyOne)
    await worker.forChannel(gone, (tx) => prober.probe(tx, gone))

    expect(google.issuedAccessTokens).toEqual([])
  })
})
