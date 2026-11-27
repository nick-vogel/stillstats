// Pre-PR review 11 of creator-analytics#4, finding 1. The tests state the correct behaviour, so they
// are red until the finding is fixed: a token endpoint that answers 429, Google's rate limit, is an
// outage like a 5xx, so a refresh ends as TokenEndpointUnansweredError and a code exchange ends as
// google_failed, not as a plain Error the API answers 500 internal. Whether Google's real token
// endpoint answers 429 is not observable here.
import { randomBytes } from 'node:crypto'
import { expect, onTestFinished, vi } from 'vitest'
import { sql } from '../../../../packages/database/node_modules/drizzle-orm/index.js'
import {
  connections,
  type Scoped,
  type WebDatabase,
} from '../../../../packages/database/src/index.ts'
import { test as databaseTest } from '../../../../packages/database/test/harness.ts'
import { type FakeGoogle, startFakeGoogle } from '../../../../packages/fake-google/src/index.ts'
import {
  type RecordingReporter,
  type Reporter,
  recordingReporter,
} from '../../../../packages/reporter/src/index.ts'
import { parseTokenKeys, type TokenKeys } from '../../../../packages/token-vault/src/encryption.ts'
import {
  type ConsentIntent,
  createTokenVault,
  TokenEndpointUnansweredError,
  type TokenVault,
  type UnclaimedGrant,
} from '../../../../packages/token-vault/src/token-vault.ts'

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

function bearerOf(vault: TokenVault, web: WebDatabase, userId: string, channelId: string) {
  return web.asUser(userId, (tx) =>
    vault.withAuthority(tx, channelId, ['youtube.readonly'], async (authority) =>
      authority.bearer(),
    ),
  )
}

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

test('a refresh Google answers 429 ends as a token endpoint outage, not a plain error', async ({
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
  await web.asUser('vault-user-a', (tx) =>
    tx.sql.update(connections).set({ accessTokenExpiresAt: tx.now }),
  )
  answerTokenEndpoint(google, 429, '{"error":"rate_limit_exceeded"}')

  await expect(bearerOf(vault, web, 'vault-user-a', channelId)).rejects.toBeInstanceOf(
    TokenEndpointUnansweredError,
  )
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
