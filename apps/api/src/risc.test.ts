// Limits: the events come from the fake Google server, so these tests cannot prove Google's real
// delivery, its real keys or the exact form of its token identifiers. Nick registering the
// receiver and seeing it accept Google's verification event on the deployed product covers them.
import { deletionRequests, type WorkerDatabase } from '@creator-analytics/database'
import { type FindJobs, test } from '@creator-analytics/database/testing'
import type { SecurityEvent, SecurityEventForgery } from '@creator-analytics/fake-google'
import {
  fanOutSecurityEvent,
  googleRevocationJobData,
  markRevokedByGoogle,
  securityEventJobData,
} from '@creator-analytics/token-vault'
import { describe, expect } from 'vitest'
import type { Browser } from '../test/browser.ts'
import { channelsOf, connect, signIn } from '../test/flows.ts'
import { type StartedApi, startApi } from '../test/start-api.ts'

const creator = { sub: '704729', email: 'risc@example.com', name: 'A Creator' }

async function deliver(
  api: StartedApi,
  event: SecurityEvent,
  forgery?: SecurityEventForgery,
): Promise<Response> {
  return fetch(new URL('/api/risc/events', api.origin), {
    method: 'POST',
    headers: { 'content-type': 'application/secevent+jwt' },
    body: await api.google.securityEventToken(event, forgery),
  })
}

async function connectedChannel(api: StartedApi): Promise<{ browser: Browser; channelId: string }> {
  const browser = await signIn(api, creator)
  api.google.pickChannel('UC-risc')
  await connect(browser)
  const [channel] = (await channelsOf(browser)).channels
  if (!channel) throw new Error('The connect flow connected no channel')
  return { browser, channelId: channel.id }
}

/**
 * Runs the event's jobs in the scopes the worker runs them in, and returns the deletion requests
 * of the channel.
 */
async function revocationsAfterJobs(worker: WorkerDatabase, findJobs: FindJobs, channelId: string) {
  for (const job of await findJobs('securityEvent')) {
    await worker.asSystem((tx) => fanOutSecurityEvent(tx, securityEventJobData(job.data)))
  }
  for (const job of await findJobs('googleRevocation')) {
    const data = googleRevocationJobData(job.data)
    await worker.forChannel(data.channelId, (tx) => markRevokedByGoogle(tx, data))
  }
  return worker.forChannel(channelId, (tx) =>
    tx.sql.select({ reason: deletionRequests.reason }).from(deletionRequests),
  )
}

describe('seam 1: the RISC receiver', () => {
  test("a tokens-revoked event revokes the connection of the event's Google subject, which leaves the creator's list", async ({
    web,
    worker,
    findJobs,
  }) => {
    const api = await startApi(web)
    const { browser, channelId } = await connectedChannel(api)

    const response = await deliver(api, { type: 'tokens-revoked', sub: creator.sub })

    expect(response.status).toBe(202)
    expect(await revocationsAfterJobs(worker, findJobs, channelId)).toEqual([
      { reason: 'google_revocation' },
    ])
    expect(await channelsOf(browser)).toEqual({ channels: [] })
  })

  test.for(['prefix', 'hash_base64_sha512_sha512'] as const)(
    'a token-revoked event naming the refresh token by %s revokes its connection',
    async (identifier, { web, worker, findJobs }) => {
      const api = await startApi(web)
      const { channelId } = await connectedChannel(api)
      const refreshToken = api.google.issuedRefreshTokens.at(-1) ?? ''

      const response = await deliver(api, { type: 'token-revoked', refreshToken, identifier })

      expect(response.status).toBe(202)
      expect(await revocationsAfterJobs(worker, findJobs, channelId)).toEqual([
        { reason: 'google_revocation' },
      ])
    },
  )

  test('an event whose exp has passed still revokes its connection', async ({
    web,
    worker,
    findJobs,
  }) => {
    const api = await startApi(web)
    const { channelId } = await connectedChannel(api)

    const response = await deliver(
      api,
      { type: 'tokens-revoked', sub: creator.sub },
      { expiresAt: new Date('2020-01-01T00:00:00.000Z') },
    )

    expect(response.status).toBe(202)
    expect(await revocationsAfterJobs(worker, findJobs, channelId)).toEqual([
      { reason: 'google_revocation' },
    ])
  })

  test.for([
    ['a bad signature', { signing: 'foreign-key' }],
    ['a key id Google does not publish', { signing: 'unknown-key-id' }],
    ['no key id', { signing: 'no-key-id' }],
    ['no signature', { signing: 'unsigned' }],
    ['a wrong issuer', { issuer: 'https://attacker.example/' }],
    ['a wrong audience', { audience: 'another-client.apps.googleusercontent.com' }],
  ] as const)(
    'an event with %s is refused with 400 and changes nothing',
    async ([, forgery], { web, findJobs }) => {
      const api = await startApi(web)
      const { browser } = await connectedChannel(api)
      const before = await channelsOf(browser)

      const response = await deliver(api, { type: 'tokens-revoked', sub: creator.sub }, forgery)

      expect(response.status).toBe(400)
      expect(await channelsOf(browser)).toEqual(before)
      expect(await findJobs('securityEvent')).toEqual([])
    },
  )

  test('a body that is no token is refused with 400', async ({ web }) => {
    const api = await startApi(web)

    const response = await fetch(new URL('/api/risc/events', api.origin), {
      method: 'POST',
      body: 'not a token',
    })

    expect(response.status).toBe(400)
  })

  test.for([
    { type: 'sessions-revoked', sub: creator.sub },
    { type: 'account-disabled', sub: creator.sub },
    { type: 'account-enabled', sub: creator.sub },
    { type: 'account-credential-change-required', sub: creator.sub },
    { type: 'verification', state: 'a-state' },
  ] as const)(
    'a $type event is accepted with 202 and changes nothing',
    async (event, { web, findJobs }) => {
      const api = await startApi(web)
      const { browser } = await connectedChannel(api)
      const before = await channelsOf(browser)

      const response = await deliver(api, event)

      expect(response.status).toBe(202)
      expect(await channelsOf(browser)).toEqual(before)
      expect(await findJobs('securityEvent')).toEqual([])
    },
  )
})
